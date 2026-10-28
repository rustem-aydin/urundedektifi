import type { Payload, Where } from 'payload'

/** Ürün listelerinde (ızgara) karta taşınan alanlar; tam Dosya istemciye gönderilmez. */
export type ProductCardData = {
  id: string
  href: string | null
  name: string
  brandName?: string | null
  categoryName?: string | null
  barcode?: string | null
  imageUrl?: string | null
  imageAlt?: string | null
  viewCount?: number
}

/** Liste süzgeci: ad, kategori (tek veya alt kategorilerle), marka ve etiketler. */
export type ProductCardFilter = {
  q?: string
  category?: string
  /** Bir kategorinin kendisi + alt kategorileri (kategori detay sayfası). */
  categories?: string[]
  brand?: string
  labels?: string[]
  limit?: number
  /** 1 tabanlı sayfa; sonuç `limit` kadar kart döner (sonsuz kaydırma için). */
  page?: number
}

/** `/urunler`, kategori detayı ve sonsuz kaydırma ucunun ortak sayfa boyutu. */
export const PRODUCT_PAGE_SIZE = 24

/**
 * Liste kartları yalnız künye + kapak görseli ister. Kural motoru (`evaluateProduct`)
 * burada çalıştırılmaz: 3.900+ kuralın 24 ürüne uygulanması liste sayfasını dakikalara
 * çıkarıyordu; kart rozetleri ayrı uçtan (`match-counts`) gelir.
 */
const CARD_SELECT = {
  name: true,
  barcode: true,
  goruntulenme: true,
  brand: true,
  category: true,
  frontImage: true,
} as const

export async function listProductCards(
  payload: Payload,
  filter: ProductCardFilter = {},
): Promise<{ docs: ProductCardData[]; totalDocs: number }> {
  const and: Where[] = [{ status: { equals: 'published' } }]
  if (filter.q) and.push({ name: { contains: filter.q } })
  if (filter.categories && filter.categories.length > 0) {
    and.push({ category: { in: filter.categories } })
  } else if (filter.category) {
    and.push({ category: { equals: filter.category } })
  }
  if (filter.brand) and.push({ brand: { equals: filter.brand } })
  for (const label of filter.labels || []) and.push({ labels: { contains: label } })

  const result = await payload.find({
    collection: 'products',
    where: { and },
    // En çok görüntülenen önce; eşitlik (yeni ürünlerde 0) yayın tarihine göre bozulur.
    sort: ['-goruntulenme', '-createdAt'],
    limit: filter.limit ?? 48,
    page: filter.page ?? 1,
    depth: 2,
    select: CARD_SELECT,
  })

  const products = result.docs.map((product) => {
    const front =
      product.frontImage && typeof product.frontImage === 'object' ? product.frontImage : null
    const brand = product.brand && typeof product.brand === 'object' ? product.brand : null
    const category =
      product.category && typeof product.category === 'object' ? product.category : null
    const barcode = product.barcode != null ? String(product.barcode) : null
    const name = product.name || 'İsimsiz ürün'

    return {
      id: String(product.id),
      href: barcode ? `/urun/${barcode}` : null,
      name,
      brandName: brand?.name ?? null,
      categoryName: category?.name ?? null,
      barcode,
      imageUrl: front?.url ?? null,
      imageAlt: front?.alt || name,
      viewCount: Math.max(0, Math.trunc(Number(product.goruntulenme ?? 0)) || 0),
    }
  })

  return { docs: products, totalDocs: result.totalDocs }
}
