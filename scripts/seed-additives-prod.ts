import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

import { createPayloadClient } from './lib/payload-rest'

/**
 * Katkı maddesi master listesini (`additives`) UZAK Payload REST API'sine uygular.
 *
 * Kaynak veri: `src/lib/seed/data/additives-world.json`
 *  - `additives`: E-kodlu katkı maddelerinin tamamı (Türk Gıda Kodeksi + AB listesi +
 *    Open Food Facts taksonomisi + EFSA değerlendirmeleri), Türkçe adlarıyla.
 *  - `groups`: E-kodu olmayan ortak kayıtlar (ör. "Modifiye Nişastalar").
 *
 * Ayrıca prod'da biriken hatalı kayıtları onarır: kod/ad alanına OFF etiketi artığı
 * yazılmış satırları gerçek kayda birleştirir (ürün ilişkileri taşınır, artık silinir).
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-additives-prod.ts            # kuru
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-additives-prod.ts --apply    # yazar
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const APPLY = process.argv.includes('--apply')

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

type Function = 'acidity_regulator' | 'antioxidant' | 'flavor_enhancer' | 'emulsifier' | 'preservative' | 'color' | 'sweetener' | 'thickener' | 'anti_caking' | 'leavening' | 'stabilizer' | 'other'
type Level = 'low' | 'medium' | 'high'
type Alias = { alias: string }
type Source = { title: string; url: string }

type Metadata = {
  name: string
  aliases: Alias[]
  function: Function | null
  riskLevel: Level | null
  halalStatus: 'halal' | 'haram' | 'mashbooh' | 'unknown' | null
  isVegan: 'yes' | 'no' | 'unknown' | null
  description: string
  sources: Source[]
}

type CatalogRow = Metadata & { code: string }
type AdditiveDoc = Metadata & { id: number; code: string | null }

const DATA_FILE = path.join(process.cwd(), 'src/lib/seed/data/additives-world.json')

/**
 * Artık satırlar → hedef kayıt. `from` kod veya (kodsuz kayıtlar için) ad;
 * `into` hedefin E-kodu veya kodsuz kayıt adı.
 */
const MERGES: { from: { code?: string; name?: string }; into: { code?: string; name?: string } }[] = [
  { from: { code: 'MONO-AND-DIGLYCERIDES-OF-VEGETABLE-FATTY-ACIDS' }, into: { code: 'E471' } },
  { from: { code: 'XX:E386' }, into: { code: 'E386' } },
  { from: { code: 'CA:CARBONAT-ACID-DE-SODI-I-DIFOSFAT-DE-DISODI' }, into: { name: 'Sodyum Hidrojen Karbonat ve Disodyum Difosfat' } },
  { from: { code: 'E14XX' }, into: { name: 'Modifiye Nişastalar' } },
  { from: { name: 'Sodyum Hidrojen Karbonat Ve Disodyum Difosfat' }, into: { name: 'Sodyum Hidrojen Karbonat ve Disodyum Difosfat' } },
  { from: { name: 'Soya Lesitini' }, into: { code: 'E322I' } },
  { from: { name: 'Sodyum Hidrojen Karbonat' }, into: { code: 'E500II' } },
  { from: { name: 'Amonyum Hidrojen Karbonat' }, into: { code: 'E503II' } },
]

/**
 * Payload dizi satırlarına kendi `id`'sini ekler; karşılaştırma yalnız değer
 * alanlarına bakar, aksi hâlde ikinci çalıştırma her kaydı "değişti" sayar.
 */
const rowsOf = (value: unknown, keys: string[]) =>
  (Array.isArray(value) ? value : []).map((row) =>
    keys.map((key) => String((row as Record<string, unknown>)?.[key] ?? '')),
  )

const sameRows = (a: unknown, b: unknown, keys: string[]) =>
  JSON.stringify(rowsOf(a, keys)) === JSON.stringify(rowsOf(b, keys))

/** Değişen alanları döndürür; boş nesne = kayıt zaten güncel. */
function diff(existing: AdditiveDoc, row: Metadata): Partial<Metadata> {
  const patch: Partial<Metadata> = {}
  if (existing.name !== row.name) patch.name = row.name
  if (!sameRows(existing.aliases, row.aliases, ['alias'])) patch.aliases = row.aliases
  if ((existing.function ?? null) !== row.function) patch.function = row.function as never
  if ((existing.riskLevel ?? null) !== row.riskLevel) patch.riskLevel = row.riskLevel as never
  if ((existing.halalStatus ?? null) !== row.halalStatus) patch.halalStatus = row.halalStatus as never
  if ((existing.isVegan ?? null) !== row.isVegan) patch.isVegan = row.isVegan as never
  if ((existing.description ?? '') !== row.description) patch.description = row.description
  if (!sameRows(existing.sources, row.sources, ['title', 'url'])) patch.sources = row.sources
  return patch
}

async function main() {
  const data: { additives: CatalogRow[]; groups: Metadata[] } = JSON.parse(
    fs.readFileSync(DATA_FILE, 'utf8'),
  )
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()

  const existing = (await client.findAll('additives', { limit: 200, depth: 0 })) as unknown as AdditiveDoc[]
  console.log(
    `Katalog: ${data.additives.length} kodlu + ${data.groups.length} kodsuz · mevcut kayıt: ${existing.length}${APPLY ? '' : ' (kuru)'}`,
  )

  const byCode = new Map<string, AdditiveDoc>()
  const byName = new Map<string, AdditiveDoc>()
  for (const doc of existing) {
    if (doc.code) byCode.set(doc.code, doc)
    else if (doc.name) byName.set(doc.name, doc)
  }

  let created = 0
  let updated = 0
  let unchanged = 0

  // 1) Kodsuz ortak kayıtlar (E-kodu yok): ada göre upsert.
  for (const group of data.groups) {
    const current = byName.get(group.name)
    if (!current) {
      created += 1
      console.log(`  + (kodsuz) ${group.name}`)
      if (APPLY) byName.set(group.name, (await client.create('additives', group)) as unknown as AdditiveDoc)
      continue
    }
    const patch = diff(current, group)
    if (!Object.keys(patch).length) {
      unchanged += 1
      continue
    }
    updated += 1
    console.log(`  ~ (kodsuz) ${group.name}: ${Object.keys(patch).join(', ')}`)
    if (APPLY) await client.update('additives', current.id, patch)
  }

  // 2) Katalog satırları: koda göre upsert, yalnız değişen alanlar yazılır.
  for (const row of data.additives) {
    const current = byCode.get(row.code)
    if (!current) {
      created += 1
      console.log(`  + ${row.code} · ${row.name}`)
      if (APPLY) byCode.set(row.code, (await client.create('additives', row)) as unknown as AdditiveDoc)
      continue
    }
    const patch = diff(current, row)
    if (!Object.keys(patch).length) {
      unchanged += 1
      continue
    }
    updated += 1
    if (updated <= 20) console.log(`  ~ ${row.code}: ${Object.keys(patch).join(', ')}`)
    if (APPLY) await client.update('additives', current.id, patch)
  }

  // 3) Artık satırları hedefe birleştir: ürün ilişkisini taşı, sonra satırı sil.
  const removed = new Set<number>()
  const resolve = (ref: { code?: string; name?: string }) => {
    const doc = ref.code ? byCode.get(ref.code) : ref.name ? byName.get(ref.name) : undefined
    return doc && !removed.has(doc.id) ? doc : undefined
  }
  for (const merge of MERGES) {
    const source = resolve(merge.from)
    if (!source) continue
    const target = resolve(merge.into)
    if (!target) {
      console.warn(`  ! hedef bulunamadı, ${source.code ?? source.name} birleştirilmedi`)
      continue
    }
    removed.add(source.id)
    const products = (await client.findAll('products', {
      where: { additives: { in: [source.id] } },
      limit: 200,
      depth: 0,
    })) as unknown as { id: number; additives?: (number | { id: number })[] }[]
    console.log(
      `  ⇄ ${source.code ?? source.name} → ${merge.into.code ?? merge.into.name}: ${products.length} ürün ilişkisi taşınıyor`,
    )
    if (!APPLY) continue
    for (const product of products) {
      const ids = (product.additives ?? []).map((a) => (typeof a === 'number' ? a : a.id))
      const next = [...new Set(ids.map((id) => (id === source.id ? target.id : id)))]
      await client.update('products', product.id, { additives: next })
    }
    await client.remove('additives', source.id)
  }

  console.log(
    `Yeni: ${created} · güncellenen: ${updated} · değişmeyen: ${unchanged}${APPLY ? '' : ' (yazılmadı)'}`,
  )
}

await main()
process.exit(0)
