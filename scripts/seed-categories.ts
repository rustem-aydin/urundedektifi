import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { DUPLICATE_CATEGORY_MERGES, flattenTaxonomy } from './lib/category-taxonomy'

/**
 * Kategori taksonomisini YEREL Payload lokal API'siyle uygular (dev/verify DB).
 * Uzak (prod) karşılığı: `scripts/seed-categories-prod.ts`.
 *
 * Kullanım: node --import tsx/esm scripts/seed-categories.ts [--dry]
 */

const DRY = process.argv.includes('--dry')

async function main() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const existing = await payload.find({ collection: 'categories', limit: 500, pagination: false, depth: 0 })
  const bySlug = new Map(existing.docs.map((doc) => [String(doc.slug), doc]))
  payload.logger.info(`Mevcut kategori: ${existing.totalDocs}${DRY ? ' (dry-run)' : ''}`)

  for (const merge of DUPLICATE_CATEGORY_MERGES) {
    const source = bySlug.get(merge.from)
    if (!source) continue
    const target = bySlug.get(merge.to)
    if (!target) throw new Error(`Birleştirme hedefi yok: ${merge.to}`)
    if (!DRY) {
      await payload.update({
        collection: 'products',
        where: { category: { equals: source.id } },
        data: { category: target.id },
      })
      await payload.update({
        collection: 'expert-rules',
        where: { productType: { equals: source.id } },
        data: { productType: target.id },
      })
      await payload.update({
        collection: 'categories',
        where: { parent: { equals: source.id } },
        data: { parent: target.id },
      })
      await payload.delete({ collection: 'categories', id: source.id })
    }
    bySlug.delete(merge.from)
  }

  let created = 0
  let updated = 0
  for (const node of flattenTaxonomy()) {
    const parent = node.parentSlug ? bySlug.get(node.parentSlug) : undefined
    if (node.parentSlug && !parent) throw new Error(`Üst kategori bulunamadı: ${node.parentSlug}`)
    const desiredParentId = parent ? parent.id : null
    const current = bySlug.get(node.slug)

    if (!current) {
      if (DRY) {
        bySlug.set(node.slug, {
          id: -(created + 1),
          slug: node.slug,
        } as never)
        created++
        continue
      }
      const doc = await payload.create({
        collection: 'categories',
        data: {
          name: node.name,
          slug: node.slug,
          order: node.order,
          ...(node.description ? { description: node.description } : {}),
          ...(desiredParentId != null ? { parent: desiredParentId } : {}),
        },
      })
      bySlug.set(node.slug, doc)
      created++
      continue
    }

    const data: Record<string, unknown> = {}
    const currentParentId =
      current.parent == null
        ? null
        : typeof current.parent === 'object'
          ? current.parent.id
          : current.parent
    if (current.name !== node.name) data.name = node.name
    if ((current.order ?? 0) !== node.order) data.order = node.order
    if (node.description && current.description !== node.description) data.description = node.description
    if (currentParentId !== desiredParentId) data.parent = desiredParentId
    if (Object.keys(data).length === 0) continue

    if (!DRY) {
      const doc = await payload.update({ collection: 'categories', id: current.id, data })
      bySlug.set(node.slug, doc)
    }
    updated++
  }

  const total = await payload.count({ collection: 'categories' })
  payload.logger.info(`Bitti: ${created} yeni, ${updated} güncellendi — toplam ${total.totalDocs} kategori.`)

  await payload.destroy()
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
