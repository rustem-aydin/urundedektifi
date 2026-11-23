import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MAX_MEDIA_FILE_BYTES } from '@/lib/mediaUpload'

/**
 * Medya erişim matrisi: okuma herkese açık, yükleme oturum ister, mevcut bir
 * medyayı değiştirmek/silmek yalnız admin ve editörün hakkıdır.
 */

type Role = 'admin' | 'editor' | 'expert' | 'user'

const ROLES: Role[] = ['admin', 'editor', 'expert', 'user']

// 1x1 PNG: gerçek görsel baytları, Payload'ın içerik koklamasını geçer.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let payload: Payload
const stamp = Date.now()
const createdUsers: Array<number | string> = []
const createdMedia: Array<number | string> = []
let seq = 0

function actor(id: number | string, role: Role): Parameters<Payload['create']>[0]['user'] {
  return { id, role, collection: 'users', emailVerified: true } as never
}

function mediaFile(name: string, mimetype = 'image/png', data = PNG) {
  return { name, mimetype, size: data.length, data } as never
}

async function attempt(run: () => Promise<unknown>): Promise<'allowed' | 'forbidden' | 'rejected'> {
  try {
    await run()
    return 'allowed'
  } catch (error) {
    // Payload erişim hataları Error üzerinde HTTP `status` taşır; tipte görünmez.
    const failure = error as Error & { status?: number }
    if (failure.status === 403) return 'forbidden'
    if (failure.status === 400) return 'rejected'
    throw error
  }
}

async function userFor(role: Role) {
  seq += 1
  const label = `media-acl-${role}-${seq}-${stamp}`
  const person = await payload.create({
    collection: 'users',
    data: { name: label, email: `${label}@example.com`, password: 'test-password-123', role } as never,
    overrideAccess: true,
  })
  createdUsers.push(person.id)
  return actor(person.id, role)
}

async function mediaFor(label: string) {
  const doc = await payload.create({
    collection: 'media',
    data: { alt: label } as never,
    file: mediaFile(`${label}-${stamp}.png`),
    overrideAccess: true,
  })
  createdMedia.push(doc.id)
  return doc
}

describe('medya erişim denetimi', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of createdMedia.reverse()) {
      await payload.delete({ collection: 'media', id: id as never, overrideAccess: true }).catch(() => undefined)
    }
    for (const id of createdUsers.reverse()) {
      await payload.delete({ collection: 'users', id: id as never, overrideAccess: true }).catch(() => undefined)
    }
  })

  it('anonim okuma herkese açık kalır', async () => {
    const doc = await mediaFor('acl-public')
    const result = await payload.find({
      collection: 'media',
      where: { id: { equals: doc.id } },
      overrideAccess: false,
    })
    expect(result.docs.map((item) => item.id)).toContain(doc.id)
  })

  it('yüklemeyi her oturum açar, anonim reddedilir', async () => {
    const anonymous = await attempt(() =>
      payload.create({
        collection: 'media',
        data: { alt: 'anonim' } as never,
        file: mediaFile(`acl-anon-${stamp}.png`),
        overrideAccess: false,
      }),
    )
    expect(anonymous).toBe('forbidden')

    for (const role of ROLES) {
      const user = await userFor(role)
      const outcome = await attempt(async () => {
        const doc = await payload.create({
          collection: 'media',
          data: { alt: `yükleme ${role}` } as never,
          file: mediaFile(`acl-create-${role}-${stamp}.png`),
          user,
          overrideAccess: false,
        })
        createdMedia.push(doc.id)
      })
      expect({ role, outcome }).toEqual({ role, outcome: 'allowed' })
    }
  })

  it('mevcut medyayı yalnız admin ve editör günceller', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: true, expert: false, user: false }

    for (const role of ROLES) {
      const doc = await mediaFor(`acl-update-${role}`)
      const user = await userFor(role)
      const outcome = await attempt(() =>
        payload.update({
          collection: 'media',
          id: doc.id,
          data: { alt: `güncellendi ${role}` },
          user,
          overrideAccess: false,
        }),
      )
      expect({ role, outcome }).toEqual({ role, outcome: allowed[role] ? 'allowed' : 'forbidden' })
    }

    const doc = await mediaFor('acl-update-anon')
    expect(
      await attempt(() =>
        payload.update({
          collection: 'media',
          id: doc.id,
          data: { alt: 'anonim' },
          overrideAccess: false,
        }),
      ),
    ).toBe('forbidden')
  })

  it('mevcut medyayı yalnız admin ve editör siler', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: true, expert: false, user: false }

    for (const role of ROLES) {
      const doc = await mediaFor(`acl-delete-${role}`)
      const user = await userFor(role)
      const outcome = await attempt(() => payload.delete({ collection: 'media', id: doc.id, user, overrideAccess: false }))
      expect({ role, outcome }).toEqual({ role, outcome: allowed[role] ? 'allowed' : 'forbidden' })
    }

    const doc = await mediaFor('acl-delete-anon')
    expect(
      await attempt(() => payload.delete({ collection: 'media', id: doc.id, overrideAccess: false })),
    ).toBe('forbidden')
  })

  it('8 MB üzerindeki yükleme doğrulama hatasıyla reddedilir', async () => {
    const user = await userFor('user')
    const big = Buffer.alloc(MAX_MEDIA_FILE_BYTES + 1, 0)
    const outcome = await attempt(() =>
      payload.create({
        collection: 'media',
        data: { alt: 'büyük' } as never,
        file: mediaFile(`acl-big-${stamp}.png`, 'image/png', big),
        user,
        overrideAccess: false,
      }),
    )
    expect(outcome).toBe('rejected')
  })

  it('SVG yüklemesi doğrulama hatasıyla reddedilir', async () => {
    const user = await userFor('user')
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const outcome = await attempt(() =>
      payload.create({
        collection: 'media',
        data: { alt: 'svg' } as never,
        file: mediaFile(`acl-svg-${stamp}.svg`, 'image/svg+xml', svg),
        user,
        overrideAccess: false,
      }),
    )
    expect(outcome).toBe('rejected')
  })
})
