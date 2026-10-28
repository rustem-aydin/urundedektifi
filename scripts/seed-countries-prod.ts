import { createPayloadClient } from './lib/payload-rest'
import { planCountrySeed, type ExistingCountryDoc } from '../src/lib/seed/countries'

/**
 * "Ülkeler" koleksiyonuna BM üyesi 193 ülkeyi UZAK Payload REST API'sine yazar.
 * Yerel seed ile aynı planı (`planCountrySeed`) kullanır.
 *
 * Idempotent: ISO kodu (yoksa ad) ile eşleşen kayıtlar güncellenir, çoğaltılmaz.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-countries-prod.ts
 *   (SEED_API_URL verilmezse üretim adresi kullanılır.)
 */
const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })

async function main() {
  console.log(`Hedef: ${client.api}`)
  await client.login()

  const existing = (await client.findAll('countries', {
    limit: 200,
    depth: 0,
  })) as unknown as ExistingCountryDoc[]
  const plan = planCountrySeed(existing)

  console.log(
    `Mevcut ${existing.length} ülke · yeni ${plan.creates.length} · güncellenecek ${plan.updates.length} · değişmeyen ${plan.unchanged}`,
  )

  for (const record of plan.creates) {
    const doc = await client.create('countries', {
      name: record.name,
      slug: record.slug,
      iso: record.iso,
      code: record.code,
      aliases: record.aliases.map((prefix) => ({ prefix })),
    })
    console.log(`  + ${record.name} (#${doc.id})`)
  }

  for (const { id, data } of plan.updates) {
    await client.update('countries', id, data)
    console.log(`  ~ ${data.name} (#${id})`)
  }

  const after = await client.find('countries', { limit: 1, depth: 0 })
  console.log(`Toplam ülke: ${after.totalDocs}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
