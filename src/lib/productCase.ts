import type { Payload } from 'payload'
import { LRUCache } from 'lru-cache'
import { evaluateProduct, loadRuleSet, type VerdictResult } from './verdictEngine'

/**
 * Ürün Dosyası — barkoda ait derin, sunuma hazır paket.
 * Web sayfası ve mobil API (GET /api/products/case/:barcode) bu tek dikişi tüketir.
 *
 * İlişki çözümleme, galeri inşası, fiyat özeti, etiket çevirisi ve hüküm
 * hesabı burada yaşar; sayfalar ve endpoint yalnızca ince adaptörlerdir.
 */

export type GalleryImage = {
  url: string
  alt: string
  label: string
}

export type PriceSummary = {
  count: number
  min: number
  max: number
  average: number
}

export type ProductCase = {
  id: string
  barcode: string | null
  name: string
  slug: string | null
  description: string | null
  usage: string | null
  brand: { id: string; name: string; isBoycotted?: boolean } | null
  category: { id: string; name: string } | null
  country: { id: string; name: string } | null
  manufacturer: string | null
  size: string | null
  packaging: string | null
  model: string | null
  sku: string | null
  warranty: string | null
  storage: string | null
  nutriscore: string | null
  labels: { value: string; name: string }[]
  gallery: GalleryImage[]
  ingredients: { name: string; pct: number | null }[]
  additives: { code?: string; name?: string }[]
  allergens: string[]
  nutrition: {
    per: '100g' | '100ml' | 'serving'
    perLabel: string
    items: { name: string; amount: number; unit: string }[]
  } | null
  specifications: { key: string; value: string; unit?: string }[]
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  prices: { amount: number; date?: string }[]
  priceSummary: PriceSummary | null
  verdict: VerdictResult
}

const LABEL_NAMES: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vejetaryen',
  'gluten-free': 'Glütensiz',
  'lactose-free': 'Laktozsuz',
  organic: 'Organik / Bio',
  'halal-certified': 'Helal Sertifikalı',
  kosher: 'Koşer',
  'non-gmo': 'GDO içermez',
  natural: 'Doğal',
  'no-additives': 'Katkısız',
  'sugar-free': 'Şekersiz',
  'ce-mark': 'CE İşareti',
  rohs: 'RoHS Uyumlu',
  'energy-star': 'Energy Star',
  'cruelty-free': 'Hayvan Deneysiz',
  'vegan-certified-cosmetics': 'Vegan Sertifikalı',
  'bpa-free': 'BPA İçermez',
  'paraben-free': 'Paraben İçermez',
  'sulfate-free': 'Sülfatsız',
  recyclable: 'Geri Dönüştürülebilir Ambalaj',
  disposable: 'Tek Kullanımlık',
  reusable: 'Yeniden Kullanılabilir',
  'oeko-tex': 'Oeko-Tex Standard 100',
  gots: 'GOTS (Organik Tekstil)',
  'fair-trade': 'Fair Trade / Adil Ticaret',
  fsc: 'FSC Sertifikalı',
  'energy-a-plus-plus-plus': 'Enerji Sınıfı A+++',
  'energy-a-plus-plus': 'Enerji Sınıfı A++',
  'energy-a-plus': 'Enerji Sınıfı A+',
  'energy-a': 'Enerji Sınıfı A',
  'energy-b': 'Enerji Sınıfı B',
}

export function labelName(value: string): string {
  return LABEL_NAMES[value] ?? value
}

function relObj(rel: any): any | null {
  return rel && typeof rel === 'object' ? rel : null
}

function summarizePrices(prices: { amount: number }[]): PriceSummary | null {
  const amounts = prices
    .map((p) => p.amount)
    .filter((a) => typeof a === 'number' && !isNaN(a) && a > 0)
  if (amounts.length === 0) return null
  return {
    count: amounts.length,
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    average: amounts.reduce((a, b) => a + b, 0) / amounts.length,
  }
}

function buildGallery(product: any): GalleryImage[] {
  const gallery: GalleryImage[] = []
  const push = (media: any, label: string, altFallback: string) => {
    const img = relObj(media)
    if (img?.url) gallery.push({ url: img.url, alt: img.alt || altFallback, label })
  }
  push(product.frontImage, 'Ön yüz', product.name)
  push(product.ingredientsImage, 'İçindekiler', 'İçindekiler')
  push(product.nutritionImage, 'Besin değerleri', 'Besin değerleri')
  push(product.recyclingImage, 'Geri dönüşüm', 'Geri dönüşüm')
  for (const extra of product.additionalImages || []) {
    const img = relObj(extra?.image)
    if (img?.url)
      gallery.push({
        url: img.url,
        alt: img.alt || extra.caption || product.name,
        label: extra.caption || 'Ek fotoğraf',
      })
  }
  return gallery
}

const NUTRITION_PER_LABELS: Record<string, string> = {
  '100g': '100 g başına',
  '100ml': '100 ml başına',
  serving: 'Porsiyon başına',
}

/** Ham products dokümanını (depth: 2) sunuma hazır Dosya'ya dönüştürür. Saf fonksiyon. */
export function toProductCase(product: any, rules: any[]): ProductCase {
  const brand = relObj(product.brand)
  const category = relObj(product.category)
  const country = relObj(product.country)

  const ingredients = (product.items || [])
    .map((it: any) => ({
      name: relObj(it?.ingredients)?.name ?? null,
      pct: typeof it?.percent_estimate === 'number' ? it.percent_estimate : null,
    }))
    .filter((it: any) => it.name)

  const additives = (product.additives || [])
    .map((a: any) => (relObj(a) ? { code: a.code, name: a.name } : null))
    .filter(Boolean) as { code?: string; name?: string }[]

  const allergens = (product.allergens || [])
    .map((a: any) => relObj(a)?.name ?? null)
    .filter(Boolean) as string[]

  const nutritionItems = (product.nutrition?.items || [])
    .map((it: any) => ({
      name: relObj(it?.nutrient)?.name ?? null,
      amount: it?.amount,
      unit: it?.unit,
    }))
    .filter((it: any) => it.name && typeof it.amount === 'number')

  const per = product.nutrition?.per
  const nutrition =
    nutritionItems.length > 0
      ? {
          per: (per === '100ml' || per === 'serving' ? per : '100g') as '100g' | '100ml' | 'serving',
          perLabel: NUTRITION_PER_LABELS[per] ?? NUTRITION_PER_LABELS['100g'],
          items: nutritionItems,
        }
      : null

  const prices = (product.prices || []).filter((p: any) => typeof p?.amount === 'number')

  const specifications = (product.specifications || [])
    .filter((s: any) => s?.key && s?.value)
    .map((s: any) => ({ key: s.key, value: s.value, unit: s.unit || undefined }))

  const warnings = (product.warnings || [])
    .filter((w: any) => w?.text)
    .map((w: any) => ({
      severity: (['low', 'medium', 'high'].includes(w.severity) ? w.severity : 'medium') as
        | 'low'
        | 'medium'
        | 'high',
      text: w.text,
    }))

  return {
    id: String(product.id),
    barcode: product.barcode != null ? String(product.barcode) : null,
    name: product.name ?? '',
    slug: product.slug ?? null,
    description: product.description ?? null,
    usage: product.usage ?? null,
    brand: brand ? { id: String(brand.id), name: brand.name, isBoycotted: brand.isBoycotted } : null,
    category: category ? { id: String(category.id), name: category.name } : null,
    country: country ? { id: String(country.id), name: country.name } : null,
    manufacturer: product.manufacturer ?? null,
    size: product.size ?? null,
    packaging: product.packaging ?? null,
    model: product.model ?? null,
    sku: product.sku ?? null,
    warranty: product.warranty ?? null,
    storage: product.storage ?? null,
    nutriscore: product.nutriscore ?? null,
    labels: (product.labels || []).map((l: string) => ({ value: l, name: labelName(l) })),
    gallery: buildGallery(product),
    ingredients,
    additives,
    allergens,
    nutrition,
    specifications,
    warnings,
    prices: prices.map((p: any) => ({ amount: p.amount, date: p.date || undefined })),
    priceSummary: summarizePrices(prices),
    verdict: evaluateProduct(product, rules),
  }
}

/** Gereksiz alanları kırpar — yalnızca Dosya'nın ihtiyaç duydukları. */
const PRODUCT_SELECT = {
  name: true,
  slug: true,
  barcode: true,
  description: true,
  usage: true,
  frontImage: true,
  ingredientsImage: true,
  nutritionImage: true,
  recyclingImage: true,
  additionalImages: true,
  brand: true,
  category: true,
  country: true,
  manufacturer: true,
  size: true,
  packaging: true,
  model: true,
  sku: true,
  warranty: true,
  storage: true,
  nutriscore: true,
  labels: true,
  items: true,
  additives: true,
  allergens: true,
  nutrition: true,
  specifications: true,
  warnings: true,
  prices: true,
} as const

// --- Process-içi cache (tek container; Redis ileride tek noktadan eklenebilir) ---

const caseCache = new LRUCache<string, ProductCase>({
  max: 500,
  ttl: 1000 * 60 * 10, // 10 dk
})

const ruleSetCache = new LRUCache<string, any[]>({ max: 1, ttl: 1000 * 60 * 10 })
const RULESET_KEY = 'active-rules'

/** Admin hook'larından çağrılır: ürün/kural değişince önbelleği düşür. */
export function invalidateProductCaseCache(barcode?: string | number | null) {
  if (barcode != null) caseCache.delete(String(barcode))
  else caseCache.clear()
}

export function invalidateRuleSetCache() {
  ruleSetCache.delete(RULESET_KEY)
}

async function getCachedRuleSet(payload: Payload): Promise<any[]> {
  const cached = ruleSetCache.get(RULESET_KEY)
  if (cached) return cached
  const rules = await loadRuleSet(payload)
  ruleSetCache.set(RULESET_KEY, rules)
  return rules
}

/**
 * Barkod ile tek ürünün tam Dosya'sını döndürür.
 * Yayında olmayan ürünler dışarı sunulmaz (null döner).
 */
export async function getProductCase(
  payload: Payload,
  barcode: string | number,
): Promise<ProductCase | null> {
  const key = String(barcode)
  const cached = caseCache.get(key)
  if (cached) return cached

  const found = await payload.find({
    collection: 'products',
    where: { and: [{ barcode: { equals: barcode } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    select: PRODUCT_SELECT,
  })

  const product = found.docs[0]
  if (!product) return null

  const rules = await getCachedRuleSet(payload)
  const productCase = toProductCase(product, rules)
  caseCache.set(key, productCase)
  return productCase
}

export type ProductCaseFilter = {
  q?: string
  category?: string
  brand?: string
  labels?: string[]
  limit?: number
}

/**
 * Yayında olan ürünlerin Dosya listesi.
 * Aktif kural seti tek kez yüklenir; her ürün için bellek içi eşleştirme (N+1 yok).
 */
export async function listProductCases(
  payload: Payload,
  filter: ProductCaseFilter = {},
): Promise<{ docs: ProductCase[]; totalDocs: number }> {
  const where: any = { and: [{ status: { equals: 'published' } }] }
  if (filter.q) where.and.push({ name: { contains: filter.q } })
  if (filter.category) where.and.push({ category: { equals: filter.category } })
  if (filter.brand) where.and.push({ brand: { equals: filter.brand } })
  for (const l of filter.labels || []) where.and.push({ labels: { contains: l } })

  const products = await payload.find({
    collection: 'products',
    where,
    sort: '-createdAt',
    limit: filter.limit ?? 48,
    depth: 2,
    select: PRODUCT_SELECT,
  })

  const rules = await getCachedRuleSet(payload)
  const docs = products.docs.map((p) => toProductCase(p, rules))
  return { docs, totalDocs: products.totalDocs }
}
