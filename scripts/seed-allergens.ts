import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { allergenRows } from './lib/allergen-taxonomy'

/**
 * Alerjen master listesini YEREL Payload lokal API'siyle uygular (dev/verify DB).
 * Uzak (prod) karşılığı: `scripts/seed-allergens-prod.ts`.
 *
 * Idempotent: slug'a göre upsert eder; var olan kayıtta yalnız ad farklıysa yazar
 * (ör. eski "laktoz" → "Laktoz"). Kayıt silmez; ürünlerin alerjen bağlantısı
 * kimlikle durduğu için ad düzeltmesi referansları bozmaz.
 *
 * Kullanım: node --import tsx/esm scripts/seed-allergens.ts [--dry]
 */

const DRY = process.argv.includes('--dry')

async function main() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const existing = await payload.find({ collection: 'allergens', limit: 500, pagination: false, depth: 0 })
  const bySlug = new Map(existing.docs.map((doc) => [String(doc.slug), doc]))
  payload.logger.info(`Mevcut alerjen: ${existing.totalDocs}${DRY ? ' (dry-run)' : ''}`)

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const row of allergenRows()) {
    const current = bySlug.get(row.slug)
    if (!current) {
      if (!DRY) await payload.create({ collection: 'allergens', data: row })
      created++
      continue
    }
    if (current.name === row.name) {
      unchanged++
      continue
    }
    payload.logger.info(`~ ${current.name} → ${row.name}`)
    if (!DRY) await payload.update({ collection: 'allergens', id: current.id, data: { name: row.name } })
    updated++
  }

  const total = await payload.count({ collection: 'allergens' })
  payload.logger.info(
    `Bitti: ${created} yeni, ${updated} güncellendi, ${unchanged} değişmedi — toplam ${total.totalDocs} alerjen.`,
  )

  await payload.destroy()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
