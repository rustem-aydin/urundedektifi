import 'dotenv/config'

import { allergenRows } from './lib/allergen-taxonomy'
import { createPayloadClient } from './lib/payload-rest'

/**
 * Alerjen master listesini UZAK Payload REST API'sine uygular.
 *
 * Idempotent: slug'a göre upsert eder; var olan kayıtta yalnız ad farklıysa yazar
 * (ör. eski "laktoz" → "Laktoz"). Kayıt silmez, ürün bağlantılarına dokunmaz.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-allergens-prod.ts [--dry]
 */

const API = process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const DRY = process.argv.includes('--dry')

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()

  const existing = await client.findAll('allergens', { limit: 100, depth: 0 })
  const bySlug = new Map(existing.map((doc) => [String(doc.slug), doc]))
  console.log(`Mevcut alerjen: ${existing.length}${DRY ? ' (dry-run)' : ''}`)

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const row of allergenRows()) {
    const current = bySlug.get(row.slug)
    if (!current) {
      console.log(`+ yeni: ${row.name} (${row.slug})`)
      if (!DRY) {
        const doc = await client.create('allergens', row)
        bySlug.set(row.slug, doc)
      }
      created++
      continue
    }
    if (current.name === row.name) {
      unchanged++
      continue
    }
    console.log(`~ güncelle: ${String(current.name)} → ${row.name} (${row.slug})`)
    if (!DRY) {
      const doc = await client.update('allergens', current.id, { name: row.name })
      bySlug.set(row.slug, doc)
    }
    updated++
  }

  const total = (await client.find('allergens', { limit: 1, depth: 0 })).totalDocs
  console.log(
    `Bitti: ${created} yeni, ${updated} güncellendi, ${unchanged} değişmedi — sunucuda ${total} alerjen.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
