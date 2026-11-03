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

  it('admin panel e-posta adresini değiştirir; aynı adres ikinci hesaba verilemez', async () => {
    const first = await makeExpert('posta-a')
    const second = await makeExpert('posta-b')

    await payload.update({
      collection: 'experts',
      id: first.id,
      data: { accountEmail: `  Gercek.Adres-${stamp}@Example.COM ` } as never,
      overrideAccess: true,
    })

    const account = await payload.findByID({
      collection: 'users',
      id: relationshipId(first.user) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(account.email).toBe(`gercek.adres-${stamp}@example.com`)

    const clashStatus = await rejectionStatus(() =>
      payload.update({
        collection: 'experts',
        id: second.id,
        data: { accountEmail: `gercek.adres-${stamp}@example.com` } as never,
        overrideAccess: true,
      }),
    )
    expect(clashStatus).toBe(400)

    const invalidStatus = await rejectionStatus(() =>
      payload.update({
        collection: 'experts',
        id: second.id,
        data: { accountEmail: 'gecersiz-adres' } as never,
        overrideAccess: true,
      }),
    )
    expect(invalidStatus).toBe(400)
  })

  it('okuma e-postayı sanal alanda döner, başka alanları değiştirmez', async () => {
    const expert = await makeExpert('okuma')
    await payload.update({
      collection: 'experts',
      id: expert.id,
      data: { accountEmail: `okuma-${stamp}@example.com` } as never,
      overrideAccess: true,
    })

    const admin = await payload.create({
      collection: 'users',
      data: {
        name: 'okuma admin',
        email: `okuma-admin-${stamp}@example.com`,
        password: 'test-password-123',
        role: 'admin',
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: admin.id })

    const read = await payload.findByID({
      collection: 'experts',
      id: expert.id,
      depth: 0,
      overrideAccess: false,
      user: admin as never,
    })
    expect((read as { accountEmail?: string }).accountEmail).toBe(`okuma-${stamp}@example.com`)
    // Uzman adı değişince e-posta yeniden türetilmez: kullanıcının verdiği adres kalır.
    await payload.update({
      collection: 'experts',
      id: expert.id,
      data: { name: `hesap okuma yeni ${stamp}` } as never,
      overrideAccess: true,
    })
    const account = await payload.findByID({
      collection: 'users',
      id: relationshipId(expert.user) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(account.email).toBe(`okuma-${stamp}@example.com`)
  })

  it('kayıt sırasında verilen e-posta hesabın giriş adresi olur', async () => {
    const expert = await makeExpert('ilk-posta', {
      accountEmail: ` Ilk.Adres-${stamp}@Example.com `,
    })
    const account = await payload.findByID({
      collection: 'users',
      id: relationshipId(expert.user) as number,
      depth: 0,
      overrideAccess: true,
    })
    expect(account.email).toBe(`ilk.adres-${stamp}@example.com`)
  })

  it('kayıtta başka hesabın e-postası verilemez', async () => {
    const first = await makeExpert('cakisan-a', {
      accountEmail: `cakisan-${stamp}@example.com`,
    })
    expect(relationshipId(first.user)).not.toBeNull()

    const status = await rejectionStatus(() =>
      payload.create({
        collection: 'experts',
        data: {
          name: `hesap cakisan b ${stamp}`,
          slug: `hesap-cakisan-b-${stamp}`,
          accountEmail: `cakisan-${stamp}@example.com`,
        } as never,
        overrideAccess: true,
      }),
    )
    expect(status).toBe(400)
  })

  it('panel dışı hesap uzman hesabının e-postasını göremez', async () => {
    const expert = await makeExpert('gizli')
    const consumer = await payload.create({
      collection: 'users',
      data: {
        name: 'gizli tuketici',
        email: `gizli-tuketici-${stamp}@example.com`,
        password: 'test-password-123',
        role: 'user',
      },
      overrideAccess: true,
    })
    created.push({ collection: 'users', id: consumer.id })

    for (const user of [
      undefined,
      { id: consumer.id, role: 'user', collection: 'users' } as never,
    ]) {
      const read = await payload.findByID({
        collection: 'experts',
        id: expert.id,
        depth: 0,
        overrideAccess: false,
        ...(user ? { user } : {}),
      })
      expect((read as { accountEmail?: string }).accountEmail).toBeUndefined()
    }
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
