import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Rol yetki matrisi (ADR 0029): yazma işleri işin sahibine daraltıldı.
 * Denemeler gerçek `payload.create` çağrısıdır; erişim kapısı 403 ile reddederse test geçer.
 */

type Role = 'admin' | 'editor' | 'expert' | 'user'

const ROLES: Role[] = ['admin', 'editor', 'expert', 'user']

let payload: Payload
const stamp = Date.now()
const created: Array<{ collection: string; id: number | string }> = []
let topicId: number | string
let seq = 0

function actor(id: number | string, role: Role): Parameters<Payload['create']>[0]['user'] {
  return { id, role, collection: 'users', emailVerified: true } as never
}

async function createExact(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run()
    return true
  } catch (error) {
    const status = (error as { status?: number }).status
    // 403 = erişim kapısı kapalı. 400 = kapı açıldı, yalnız doğrulama reddetti.
    if (status === 403) return false
    if (status === 400) return true
    throw error
  }
}

async function userFor(role: Role) {
  seq += 1
  const label = `access-${role}-${seq}-${stamp}`

  // Hedef uzman: her rol bu uzmanın kimliğiyle yazar; hesabı otomatik açılır (ADR 0032).
  const expert = await payload.create({
    collection: 'experts',
    data: {
      name: `access uzman ${label}`,
      slug: `access-uzman-${label}`,
    } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'experts', id: expert.id })

  // "Uzman" rolü yalnız uzman kaydından doğar: hesap normal üye olarak açılır,
  // uzman kaydına bağlanınca rolü uzmana çekilir. Diğer roller bağsız kalır.
  const person = await payload.create({
    collection: 'users',
    data: {
      name: `access ${label}`,
      email: `${label}@example.com`,
      password: 'test-password-123',
      role: role === 'expert' ? 'user' : role,
    } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'users', id: person.id })

  let actorExpert = expert
  if (role === 'expert') {
    actorExpert = await payload.create({
      collection: 'experts',
      data: {
        name: `access uzman sahibi ${label}`,
        slug: `access-uzman-sahibi-${label}`,
        user: person.id,
      } as never,
      overrideAccess: true,
    })
    created.push({ collection: 'experts', id: actorExpert.id })
  }

  const scale = await payload.create({
    collection: 'rating-scales',
    data: { expert: actorExpert.id, name: 'Uygun', order: 0 } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'rating-scales', id: scale.id })

  return { person, expert: actorExpert, scale, user: actor(person.id, role) }
}

const lexicalBody = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          { type: 'text', text: 'access', format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      },
    ],
  },
}

describe('rol yetki matrisi (ADR 0029)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const topic = await payload.create({
      collection: 'topics',
      data: { name: `access konu ${stamp}`, slug: `access-konu-${stamp}` } as never,
      overrideAccess: true,
    })
    topicId = topic.id
  })

  afterAll(async () => {
    for (const entry of created.reverse()) {
      await payload
        .delete({ collection: entry.collection as never, id: entry.id as never, overrideAccess: true })
        .catch(() => undefined)
    }
    await payload
      .delete({ collection: 'topics', id: topicId as never, overrideAccess: true })
      .catch(() => undefined)
  })

  it('ürünü yalnız admin ve editör doğrudan açar', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: true, expert: false, user: false }
    for (const role of ROLES) {
      const { user } = await userFor(role)
      const ok = await createExact(async () => {
        const doc = await payload.create({
          collection: 'products',
          data: { barcode: `${stamp}`.slice(-11) + String(ROLES.indexOf(role)), nutrition: { per: '100g' } } as never,
          user,
          overrideAccess: false,
        })
        created.push({ collection: 'products', id: doc.id })
      })
      expect({ role, ok }).toEqual({ role, ok: allowed[role] })
    }
  })

  it('ürün verisini yalnız admin ve editör günceller (uzman dosyaya dokunmaz)', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: true, expert: false, user: false }
    for (const role of ROLES) {
      const product = await payload.create({
        collection: 'products',
        data: {
          barcode: `8${`${stamp}`.slice(-9)}${ROLES.indexOf(role)}`,
          nutrition: { per: '100g' },
        } as never,
        overrideAccess: true,
      })
      created.push({ collection: 'products', id: product.id })

      const { user } = await userFor(role)
      const ok = await createExact(() =>
        payload.update({
          collection: 'products',
          id: product.id,
          data: { name: `access güncelleme ${role}` },
          user,
          overrideAccess: false,
        }),
      )
      expect({ role, ok }).toEqual({ role, ok: allowed[role] })
    }
  })

  it('yazıyı yalnız admin ve uzman açar, silmeyi admin ve yazının sahibi uzman yapar', async () => {
    const createAllowed: Record<Role, boolean> = { admin: true, editor: false, expert: true, user: false }
    // ADR 0032: uzman kendi yazısını siler (aşağıdaki yazı o uzmanın).
    const deleteAllowed: Record<Role, boolean> = { admin: true, editor: false, expert: true, user: false }

    for (const role of ROLES) {
      const { expert, user } = await userFor(role)
      const postOk = await createExact(async () => {
        const doc = await payload.create({
          collection: 'posts',
          data: { title: `access yazı ${role} ${stamp}`, expert: expert.id, body: lexicalBody, status: 'draft' } as never,
          user,
          overrideAccess: false,
        })
        created.push({ collection: 'posts', id: doc.id })
      })
      expect({ role, postOk }).toEqual({ role, postOk: createAllowed[role] })

      const removable = await payload.create({
        collection: 'posts',
        data: { title: `access silinecek ${role} ${stamp}`, expert: expert.id, body: lexicalBody, status: 'draft' } as never,
        overrideAccess: true,
      })
      created.push({ collection: 'posts', id: removable.id })
      const deleteOk = await createExact(() =>
        payload.delete({ collection: 'posts', id: removable.id, user, overrideAccess: false }),
      )
      expect({ role, deleteOk }).toEqual({ role, deleteOk: deleteAllowed[role] })
    }
  })

  it('uzman kuralını yalnız admin ve uzman açar', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: false, expert: true, user: false }
    for (const role of ROLES) {
      const { expert, scale, user } = await userFor(role)
      const ok = await createExact(async () => {
        const doc = await payload.create({
          collection: 'expert-rules',
          data: {
            name: `access kural ${role} ${stamp}`,
            expert: expert.id,
            topic: topicId,
            rating: scale.id,
            description: 'access',
            ruleType: 'country',
            isActive: false,
          } as never,
          user,
          overrideAccess: false,
        })
        created.push({ collection: 'expert-rules', id: doc.id })
      })
      expect({ role, ok }).toEqual({ role, ok: allowed[role] })
    }
  })

  it('yapay zekâ ayarını yalnız admin okur', async () => {
    const allowed: Record<Role, boolean> = { admin: true, editor: false, expert: false, user: false }
    for (const role of ROLES) {
      const { user } = await userFor(role)
      // Erişim kapalıyken Payload global okumasını 403 ile reddeder.
      const ok = await createExact(async () => {
        const doc = await payload.findGlobal({ slug: 'ai-settings', user, overrideAccess: false })
        if (!doc?.baseUrl) throw Object.assign(new Error('alan gizli'), { status: 403 })
      })
      expect({ role, ok }).toEqual({ role, ok: allowed[role] })
    }
  })
})
