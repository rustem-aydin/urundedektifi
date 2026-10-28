import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { planCountrySeed } from '../src/lib/seed/countries'

/**
 * "Ülkeler" koleksiyonuna BM üyesi 193 ülkeyi yazar (yerel veritabanı).
 * Idempotent: ISO kodu (yoksa ad) ile eşleşen kayıtlar güncellenir, çoğaltılmaz.
 * GS1 prefixleri `src/lib/barcodePrefixes.ts` tablosundan türetilir.
 *
 * Kullanım: pnpm seed:countries
 */
async function main() {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'countries',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const plan = planCountrySeed(existing.docs)

  console.log(
    `Mevcut ${existing.docs.length} ülke · yeni ${plan.creates.length} · güncellenecek ${plan.updates.length} · değişmeyen ${plan.unchanged}`,
  )

  for (const record of plan.creates) {
    await payload.create({
      collection: 'countries',
      data: {
        name: record.name,
        slug: record.slug,
        iso: record.iso,
        code: record.code,
        aliases: record.aliases.map((prefix) => ({ prefix })),
      },
      overrideAccess: true,
    })
  }

  for (const { id, data } of plan.updates) {
    await payload.update({ collection: 'countries', id, data, overrideAccess: true })
  }

  const after = await payload.find({
    collection: 'countries',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  console.log(`Toplam ülke: ${after.totalDocs}`)

  await payload.destroy()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
