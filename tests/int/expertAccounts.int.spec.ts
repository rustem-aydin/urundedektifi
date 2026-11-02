import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { EXPERT_EMAIL_DOMAIN, relationshipId } from '@/lib/expertAccounts'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Uzman ↔ panel hesabı eşleşmesi (ADR 0032).
 * Bu dosya gerçek hook'ları çalıştırır: yardımcılar erişim kapısını atlatsa da
 * yaşam döngüsü kuralları (otomatik hesap, 1:1, rol kilidi, cascade) yürürlüktedir.
 */

let payload: Payload
const stamp = Date.now()
const created: Array<{ collection: 'users' | 'experts'; id: number | string }> = []

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number }).status
}

/** Reddedilmesi beklenen çağrı: HTTP durumunu döner, çağrı geçerse null döner. */
async function rejectionStatus(run: () => Promise<unknown>): Promise<number | null> {
  try {
    await run()
    return null
  } catch (error) {
    return statusOf(error) ?? -1
  }
}

async function makeExpert(label: string, data: Record<string, unknown> = {}) {
  const expert = await payload.create({
    collection: 'experts',
    data: {
      name: `hesap ${label} ${stamp}`,
      slug: `hesap-${label}-${stamp}`,
      ...data,
    } as never,
    overrideAccess: true,
  })
  created.push({ collection: 'experts', id: expert.id })
  return expert
}

describe('uzman hesabı eşleşmesi (ADR 0032)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const entry of created.reverse()) {
      await payload
        .delete({
          collection: entry.collection as never,
          id: entry.id as never,
          overrideAccess: true,
        })
        .catch(() => undefined)
    }
  })

  it('hesabı olmayan uzman için panel hesabını adından türetip açar', async () => {
    const expert = await makeExpert('otomatik')
    const accountId = relationshipId(expert.user)
    expect(accountId).not.toBeNull()

    const account = await payload.findByID({
      collection: 'users',
      id: accountId as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(account.role).toBe('expert')
    expect(account.email).toBe(`hesap_otomatik_${stamp}@${EXPERT_EMAIL_DOMAIN}`)
  })

  it('aynı hesap ikinci bir uzmana bağlanamaz', async () => {
    const first = await makeExpert('tekil-a')
    const second = await makeExpert('tekil-b')

    const status = await rejectionStatus(() =>
      payload.update({
        collection: 'experts',
        id: second.id,
        data: { user: relationshipId(first.user) } as never,
        overrideAccess: true,
      }),
    )
    expect(status).toBe(400)
  })

  it('uzmana bağlı hesabın rolü düşürülemez', async () => {
    const expert = await makeExpert('rol')
    const accountId = relationshipId(expert.user) as number

    const status = await rejectionStatus(() =>
      payload.update({
        collection: 'users',
        id: accountId,
        data: { role: 'user' },
        overrideAccess: true,
      }),
    )
    expect(status).toBe(400)
  })

  it('"uzman" rolü elle açılamaz; bağı olmayan hesap uzman yapılamaz', async () => {
    const createStatus = await rejectionStatus(() =>
      payload.create({
        collection: 'users',
        data: {
          name: 'elle uzman',
          email: `hesap-elle-${stamp}@example.com`,
          password: 'test-password-123',
          role: 'expert',
        },
        overrideAccess: true,
      }),
    )
    expect(createStatus).toBe(400)

    const plain = await payload.create({
      collection: 'users',
      data: {
        name: 'baglantisi yok',
        email: `hesap-baglayan-${stamp}@example.com`,
        password: 'test-password-123',
        role: 'user',
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: plain.id })

    const promoteStatus = await rejectionStatus(() =>
      payload.update({
        collection: 'users',
        id: plain.id,
        data: { role: 'expert' },
        overrideAccess: true,
      }),
    )
    expect(promoteStatus).toBe(400)
  })

  it('uzman silinince otomatik açılan hesabı da silinir', async () => {
    const expert = await makeExpert('silinir')
    const accountId = relationshipId(expert.user) as number

    await payload.delete({ collection: 'experts', id: expert.id, overrideAccess: true })

    const status = await rejectionStatus(() =>
      payload.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true }),
    )
    expect(status).toBe(404)
  })

  it('admin hesabı uzman silinince korunur', async () => {
    const admin = await payload.create({
      collection: 'users',
      data: {
        name: 'hesap admin',
        email: `hesap-admin-${stamp}@example.com`,
        password: 'test-password-123',
        role: 'admin',
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: admin.id })

    const expert = await makeExpert('adminli', { user: admin.id })
    await payload.delete({ collection: 'experts', id: expert.id, overrideAccess: true })

    const still = await payload.findByID({
      collection: 'users',
      id: admin.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(still.role).toBe('admin')
  })
})
