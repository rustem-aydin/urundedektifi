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
 * `select` ürünün ağır bir-çok tablolarını (fiyat, içindekiler satırları, uyarı...)
 * sorgu dışında bırakır: bunlar olmadan `depth` yalnız marka/kategori/görsel
 * ilişkilerini çözer. `additionalImages` yalnız kapak yedeği için seçilir; satır başına
 * en fazla 5 hafif kayıt döner.
 */
export const PRODUCT_CARD_SELECT = {
  name: true,
  barcode: true,
  goruntulenme: true,
  brand: true,
  category: true,
  frontImage: true,
  // Kapak yedeği: ön yüz fotoğrafı olmayan ürünlerde (OFF aktarımında kalanlar)
  // sıradaki ilk fotoğraf gösterilir. `additionalImages` hafif bir dizi; kart
  // başına en fazla 5 satır döner.
  ingredientsImage: true,
  nutritionImage: true,
  recyclingImage: true,
  additionalImages: true,
} as const

/**
 * `select` yalnız ana belgenin alanlarını daraltır; `depth: 1` ile çözülen
 * ilişkilerin (marka, kategori, görseller) **tamamı** gelmeye devam eder. 24 kart
 * için ölçülen: select tek başına 49,8 KB, `populate` ile 23,3 KB (medya belgesi
 * ~1,5 KB → ~150 B; marka/kategori yalnız `name`).
 *
 * TUZAK: `media.url` veritabanı sütunu değil, `filename`'den üretilir. `url` tek
 * başına seçilirse `null` döner (REST'te ölçüldü); bu yüzden `filename` de seçilir.
 */
export const PRODUCT_CARD_POPULATE = {
  media: { url: true, filename: true, alt: true },
  brands: { name: true },
  categories: { name: true },
} as const

/** Kart sorgusunun ortak şekli: ana belge `select`, ilişkiler `populate`, derinlik 1. */
export const PRODUCT_CARD_QUERY = {
  depth: 1,
  select: PRODUCT_CARD_SELECT,
  populate: PRODUCT_CARD_POPULATE,
} as const

/** Payload medya ilişkisinden yalnız karta gereken iki alanı çıkarır. */
function mediaOf(value: unknown): { url: string; alt: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { url?: unknown; alt?: unknown }
  if (typeof record.url !== 'string' || record.url.length === 0) return null
  return { url: record.url, alt: typeof record.alt === 'string' ? record.alt : null }
}

type CoverSource = {
  frontImage?: unknown
  ingredientsImage?: unknown
  nutritionImage?: unknown
  recyclingImage?: unknown
  additionalImages?: { image?: unknown }[] | null
}

/**
 * Kart kapağı. Ön yüz fotoğrafı yoksa ürünün diğer fotoğrafları sırayla denenir:
 * detay sayfasında görünen bir fotoğraf listede "Görsel yok" olarak kalmamalı.
 */
function coverOf(product: CoverSource): { url: string; alt: string | null } | null {
  const extras = Array.isArray(product.additionalImages)
    ? product.additionalImages.map((row) => row?.image)
    : []
  const candidates = [
    product.frontImage,
    product.ingredientsImage,
    product.nutritionImage,
    product.recyclingImage,
    ...extras,
  ]
  for (const candidate of candidates) {
    const media = mediaOf(candidate)
    if (media) return media
  }
  return null
}

/** Sorgudan dönen ürün satırını karta çevirir (sayfa ve ana sayfa aynı biçimi kullanır). */
export function productCardFromDoc(product: {
  id: string | number
  name?: string | null
  barcode?: string | null
  goruntulenme?: number | null
  brand?: unknown
  category?: unknown
} & CoverSource): ProductCardData {
  const brand = product.brand && typeof product.brand === 'object' ? product.brand : null
  const category = product.category && typeof product.category === 'object' ? product.category : null
  const barcode = product.barcode != null ? String(product.barcode) : null
  const name = product.name || 'İsimsiz ürün'
  const cover = coverOf(product)
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
    imageUrl: cover?.url ?? null,
    imageAlt: cover?.alt || name,
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
    ...PRODUCT_CARD_QUERY,
  })

  return { docs: result.docs.map(productCardFromDoc), totalDocs: result.totalDocs }
}
