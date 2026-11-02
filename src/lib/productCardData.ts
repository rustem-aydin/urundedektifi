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
 *
 * `select` ürünün bir-çok tablolarını (fiyat, içindekiler, uyarı...) sorgu dışında
 * bırakır: bunlar olmadan `depth` yalnız marka/kategori/görsel ilişkilerini çözer.
 */
export const PRODUCT_CARD_SELECT = {
  name: true,
  barcode: true,
  goruntulenme: true,
  brand: true,
  category: true,
  frontImage: true,
} as const

/** Sorgudan dönen ürün satırını karta çevirir (sayfa ve ana sayfa aynı biçimi kullanır). */
export function productCardFromDoc(product: {
  id: string | number
  name?: string | null
  barcode?: string | null
  goruntulenme?: number | null
  brand?: unknown
  category?: unknown
  frontImage?: unknown
}): ProductCardData {
  const front =
    product.frontImage && typeof product.frontImage === 'object' ? product.frontImage : null
  const brand = product.brand && typeof product.brand === 'object' ? product.brand : null
  const category = product.category && typeof product.category === 'object' ? product.category : null
  const barcode = product.barcode != null ? String(product.barcode) : null
  const name = product.name || 'İsimsiz ürün'
  const frontUrl = front && 'url' in front && typeof front.url === 'string' ? front.url : null
  const frontAlt = front && 'alt' in front && typeof front.alt === 'string' ? front.alt : null
  const brandName = brand && 'name' in brand && typeof brand.name === 'string' ? brand.name : null
  const categoryName =
    category && 'name' in category && typeof category.name === 'string' ? category.name : null

  return {
    id: String(product.id),
    href: barcode ? `/urun/${barcode}` : null,
    name,
    brandName,
    categoryName,
    barcode,
    imageUrl: frontUrl,
    imageAlt: frontAlt || name,
    viewCount: Math.max(0, Math.trunc(Number(product.goruntulenme ?? 0)) || 0),
  }
}

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
    // Sıralama `products_status_goruntulenme_created_idx` indeksinden gelir.
    sort: ['-goruntulenme', '-createdAt'],
    limit: filter.limit ?? 48,
    page: filter.page ?? 1,
    // Kart yalnız marka/kategori/görsel ilişkilerini çözer; depth 2 bunların alt
    // ilişkilerini de (marka ülkesi, kategori ikonu) gereksiz yere çekiyordu.
    depth: 1,
    select: PRODUCT_CARD_SELECT,
  })

  return { docs: result.docs.map(productCardFromDoc), totalDocs: result.totalDocs }
}
