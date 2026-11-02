import type { Payload } from 'payload'

/** Aynı içeriği taşıyan yinelenen kategori: `from` silinir, ürün/kural referansları `to`ya taşınır. */
export type CategoryMerge = { from: string; to: string }

/**
 * Yinelenen kategoriler. Sol taraf silinir; ürünleri, uzman kuralı referansları ve
 * alt kategorileri sağ tarafa taşınır. Slug'lar `slugify(name)` çıktısıdır.
 */
export const DUPLICATE_CATEGORY_MERGES: CategoryMerge[] = [
  // Eski OFF içe aktarımlarından kalan kopyalar.
  { from: 'i-cecekler', to: 'icecekler' },
  { from: 'caylar', to: 'kahve-cay' },
  { from: 'meyve-nektari', to: 'meyve-suyu' },
  // İnceleme ekranında "Yeni oluştur" ile açılan, taksonomide karşılığı olan kayıtlar.
  { from: 'sac-bakim-kuru', to: 'sac-bakimi' },
  { from: 'kedi-mamasi', to: 'kedi-kopek-mamasi' },
  { from: 'islak-havlu', to: 'kagit-hijyen' },
]

async function categoryBySlug(payload: Payload, slug: string) {
  const found = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    pagination: false,
  })
  return found.docs[0] ?? null
}

/**
 * Yinelenen kategorileri hedef kayda birleştirir. Idempotent: kaynak kategori yoksa
 * atlar, ikinci çalıştırma hiçbir şey yazmaz. Kaynak silinmeden önce ürünler,
 * uzman kuralı referansları ve alt kategoriler hedefe taşınır (FK kısıtı).
 */
export async function mergeDuplicateCategories(
  payload: Payload,
  merges: CategoryMerge[] = DUPLICATE_CATEGORY_MERGES,
): Promise<number> {
  let merged = 0

  // Tek sorgu: hiçbir kaynak yoksa (normal durum) açılışta yalnız bu okuma yapılır.
  const found = await payload.find({
    collection: 'categories',
    where: { slug: { in: merges.map((merge) => merge.from) } },
    limit: merges.length,
    depth: 0,
    pagination: false,
  })
  const sourceBySlug = new Map(found.docs.map((doc) => [String(doc.slug), doc]))

  for (const merge of merges) {
    const source = sourceBySlug.get(merge.from)
    if (!source) continue
    const target = await categoryBySlug(payload, merge.to)
    if (!target) throw new Error(`Kategori birleştirme hedefi yok: ${merge.to}`)

    const products = await payload.update({
      collection: 'products',
      where: { category: { equals: source.id } },
      data: { category: target.id },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'expert-rules',
      where: { productType: { equals: source.id } },
      data: { productType: target.id },
      depth: 0,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'categories',
      where: { parent: { equals: source.id } },
      data: { parent: target.id },
      depth: 0,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'categories',
      id: source.id,
      depth: 0,
      overrideAccess: true,
    })

    merged += 1
    payload.logger.info(
      `Kategori birleştirildi: ${merge.from} → ${merge.to} (${products.docs.length} ürün taşındı)`,
    )
  }

  return merged
}
