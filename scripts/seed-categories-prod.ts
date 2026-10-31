import 'dotenv/config'
import { z } from 'zod'

import { createPayloadClient } from './lib/payload-rest'
import { DUPLICATE_CATEGORY_MERGES, flattenTaxonomy } from './lib/category-taxonomy'

/**
 * Kategori taksonomisini UZAK Payload REST API'sine uygular: üst kategorileri
 * oluşturur, mevcut kategorileri alt kategori olarak üstüne bağlar, yinelenen
 * eski kategorileri birleştirir.
 *
 * Idempotent: slug'a göre upsert eder; ikinci çalıştırma yalnız değişen alanları
 * yazar. Ürün kayıtlarına dokunmaz (yalnız birleştirmede kategori referansı taşınır).
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-categories-prod.ts [--dry]
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const DRY = process.argv.includes('--dry')

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const CategoryRow = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    slug: z.string().nullish(),
    description: z.string().nullish(),
    parent: z.union([z.number(), z.object({ id: z.number() }).loose(), z.null()]).optional(),
    order: z.number().nullish(),
  })
  .loose()

type CategoryRow = z.infer<typeof CategoryRow>

function parentId(value: CategoryRow['parent']): number | null {
  if (value == null) return null
  return typeof value === 'number' ? value : value.id
}

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()

  const existing = (await client.findAll('categories', { limit: 100, depth: 0 })).map((doc) =>
    CategoryRow.parse(doc),
  )
  const bySlug = new Map(existing.map((doc) => [String(doc.slug), doc]))
  console.log(`Mevcut kategori: ${existing.length}${DRY ? ' (dry-run)' : ''}`)

  // 1) Yinelenenleri birleştir: ürün/kural referanslarını taşı, kaydı sil.
  for (const merge of DUPLICATE_CATEGORY_MERGES) {
    const source = bySlug.get(merge.from)
    if (!source) continue
    const target = bySlug.get(merge.to)
    if (!target) throw new Error(`Birleştirme hedefi yok: ${merge.to}`)

    const products = await client.findAll('products', {
      where: { category: { equals: source.id } },
      limit: 100,
      depth: 0,
    })
    const rules = await client.findAll('expert-rules', {
      where: { productType: { equals: source.id } },
      limit: 100,
      depth: 0,
    })
    const children = existing.filter((doc) => parentId(doc.parent) === source.id)

    console.log(
      `Birleştir: ${merge.from} → ${merge.to} (ürün ${products.length}, kural ${rules.length}, alt kategori ${children.length})`,
    )
    if (DRY) continue

    for (const product of products) {
      await client.update('products', product.id, { category: target.id })
    }
    for (const rule of rules) {
      await client.update('expert-rules', rule.id, { productType: target.id })
    }
    for (const child of children) {
      await client.update('categories', child.id, { parent: target.id })
    }
    await client.remove('categories', source.id)
    bySlug.delete(merge.from)
  }

  // 2) Taksonomi: üst kayıtlar önce gelecek sırada upsert.
  const flat = flattenTaxonomy()
  let created = 0
  let updated = 0
  let unchanged = 0

  for (const node of flat) {
    const parent = node.parentSlug ? bySlug.get(node.parentSlug) : undefined
    if (node.parentSlug && !parent) throw new Error(`Üst kategori bulunamadı: ${node.parentSlug}`)
    const desiredParentId = parent ? parent.id : null

    const current = bySlug.get(node.slug)
    if (!current) {
      console.log(`+ yeni: ${node.slug} (üst: ${node.parentSlug ?? '—'})`)
      if (DRY) {
        // Deneme çalışmasında da alt kayıtlar üstünü bulabilsin diye negatif sahte kimlik.
        bySlug.set(node.slug, {
          id: -(created + 1),
          name: node.name,
          slug: node.slug,
          description: node.description ?? null,
          order: node.order,
          parent: desiredParentId,
        })
        created++
        continue
      }
      const doc = CategoryRow.parse(
        await client.create('categories', {
          name: node.name,
          slug: node.slug,
          order: node.order,
          ...(node.description ? { description: node.description } : {}),
          ...(desiredParentId != null ? { parent: desiredParentId } : {}),
        }),
      )
      bySlug.set(node.slug, doc)
      created++
      continue
    }

    const data: Record<string, unknown> = {}
    if (current.name !== node.name) data.name = node.name
    if ((current.order ?? 0) !== node.order) data.order = node.order
    if (node.description && current.description !== node.description) {
      data.description = node.description
    }
    if (parentId(current.parent) !== desiredParentId) data.parent = desiredParentId

    if (Object.keys(data).length === 0) {
      unchanged++
      continue
    }
    console.log(`~ güncelle: ${node.slug} ${JSON.stringify(data)}`)
    if (!DRY) {
      const doc = CategoryRow.parse(await client.update('categories', current.id, data))
      bySlug.set(node.slug, doc)
    }
    updated++
  }

  const total = (await client.find('categories', { limit: 1, depth: 0 })).totalDocs
  console.log(
    `Bitti: ${created} yeni, ${updated} güncellendi, ${unchanged} değişmedi — sunucuda ${total} kategori.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
