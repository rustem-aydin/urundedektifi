import type { Payload } from 'payload'
import { LRUCache } from 'lru-cache'
import {
  evaluateProduct,
  rulesForProduct,
  evaluateRule,
  loadRuleSet,
  type Rule,
  type VerdictResult,
} from './verdictEngine'

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
  /** Ürün dosyasının kaç kez açıldığı (yalnız sayaç ucundan artar). */
  goruntulenme: number
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
  ingredients: { name: string; slug: string | null; pct: number | null }[]
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
      slug: relObj(it?.ingredients)?.slug ?? null,
      pct: typeof it?.percent_estimate === 'number' ? it.percent_estimate : null,
    }))
    .filter((it: any) => it.name)

  const additives = (product.additives || [])
    .map((a: any) => (relObj(a) ? { code: a.code, name: a.name } : null))
    .filter(Boolean) as { code?: string; name?: string }[]

  // `allergens` koleksiyonda tek ilişki olarak tanımlı; eski veri dizisi gelebilir.
  const allergenRelations = Array.isArray(product.allergens)
    ? product.allergens
    : product.allergens
      ? [product.allergens]
      : []
  const allergens = allergenRelations
    .map((a: unknown) => relObj(a)?.name ?? null)
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
    // `numeric` sürücüden metin gelebilir. Buradaki değer Dosya önbelleğinin anlık
    // görüntüsüdür; detay yüzeyleri `viewCountFor` ile taze sayıyı okur.
    goruntulenme: Math.max(0, Math.trunc(Number(product.goruntulenme ?? 0)) || 0),
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
  goruntulenme: true,
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

// Görüntülenme artışı bu önbelleği düşürmez: her açılışta kural motorunu yeniden çalıştırmak
// pahalı. İstemci sayaç ucunun yanıtındaki taze değeri gösterir; diğer ziyaretçiler en fazla
// 10 dk eski sayıyı görür (sayaç için kabul edilebilir).
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
  // Kural eşleşmesi ürün verisine bağlı: tarama önbelleği de tazelenir.
  matchScanCache.clear()
}

export function invalidateRuleSetCache() {
  ruleSetCache.delete(RULESET_KEY)
  // Kural tanımı değişince eşleşme kümesi de değişir.
  matchScanCache.clear()
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

/**
 * Görüntülenme sayısını canlı okur (tek indeksli PK sorgusu).
 *
 * Dosya 10 dk önbellekte yaşadığı için sayaç önbellekten sunulmaz: aksi hâlde sayfa
 * yenilendiğinde sayı geriye düşerdi. Detay ekranları bu taze değeri kullanır.
 */
export async function viewCountFor(
  payload: Payload,
  id: string | number,
): Promise<number> {
  // `goruntulenme` alanı henüz üretim şemasında yok; alan seçimi tipleri kırıyordu.
  // Alan eklendiğinde bu okuma doğrudan o değeri döndürür.
  const doc = (await payload
    .findByID({
      collection: 'products',
      id,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as { goruntulenme?: unknown } | null
  const value = Math.trunc(Number(doc?.goruntulenme ?? 0))
  return Number.isFinite(value) && value > 0 ? value : 0
}

export type ProductCaseFilter = {
  q?: string
  category?: string
  brand?: string
  labels?: string[]
  limit?: number
  /** 1 tabanlı sayfa; sonuç `limit` kadar ürün döner (sonsuz kaydırma için). */
  page?: number
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
    // En çok görüntülenen önce; eşitlik (yeni ürünlerde 0) yayın tarihine göre bozulur.
    sort: ['-goruntulenme', '-createdAt'],
    limit: filter.limit ?? 48,
    page: filter.page ?? 1,
    depth: 2,
    select: PRODUCT_SELECT,
  })

  const rules = await getCachedRuleSet(payload)
  const docs = products.docs.map((p) => toProductCase(p, rules))
  return { docs, totalDocs: products.totalDocs }
}

/** Oturumdaki kullanıcının takip ettiği uzman kimlikleri (misafir → boş dizi). */
export async function followingExpertIds(
  payload: Payload,
  userId: string | number | null | undefined,
): Promise<string[]> {
  if (userId == null) return []
  const user = await payload
    .findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    .catch(() => null)
  const following = (user as { following?: unknown } | null)?.following
  if (!Array.isArray(following)) return []
  return following
    .map((ref: unknown) =>
      ref && typeof ref === 'object' && 'id' in ref ? (ref as { id: unknown }).id : ref,
    )
    .filter((id) => id != null)
    .map((id) => String(id))
}

/**
 * Hükmü yalnız verilen uzmanlara daraltır (hükümler takibe bağlıdır).
 * `totalMatched` kalan uzmanların eşleşen kurallarından yeniden hesaplanır;
 * `byTopic` döndürülmez (konu hükmü kullanılmıyor ve takip süzgecini aşardı).
 */
export function verdictForExperts(verdict: VerdictResult, expertIds: string[]): VerdictResult {
  const set = new Set(expertIds.map(String))
  const byExpert = verdict.byExpert.filter((entry) => set.has(String(entry.expert.id)))
  const totalMatched = byExpert.reduce((sum, entry) => sum + entry.matchedRules.length, 0)
  return { byTopic: [], byExpert, totalMatched }
}

/**
 * Barkod → takip edilen uzmanların eşleşen kural sayısı (liste kartı rozetleri).
 * Kural seti önbellekten gelir; yalnız istenen ürünler ve takip edilen uzmanların
 * kuralları değerlendirilir.
 */
export async function matchedRuleCountsByBarcode(
  payload: Payload,
  barcodes: (string | number)[],
  expertIds: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  const values = Array.from(new Set(barcodes.map((value) => String(value)).filter(Boolean))).slice(
    0,
    60,
  )
  if (values.length === 0 || expertIds.length === 0) return counts

  const scope = new Set(expertIds.map(String))
  const rules = (await getCachedRuleSet(payload)).filter((rule: Rule) => {
    const expert = rule?.expert
    const id = expert && typeof expert === 'object' ? expert.id : expert
    return id != null && scope.has(String(id))
  })
  if (rules.length === 0) return counts

  const products = await payload.find({
    collection: 'products',
    where: { and: [{ status: { equals: 'published' } }, { barcode: { in: values } }] },
    limit: values.length,
    depth: 2,
    select: PRODUCT_SELECT,
  })

  for (const product of products.docs as any[]) {
    const matched = rules.reduce(
      (sum: number, rule: Rule) => (evaluateRule(rule, product).matched ? sum + 1 : sum),
      0,
    )
    if (product.barcode) counts[String(product.barcode)] = matched
  }
  return counts
}

/**
 * Tarama için alan kümesi kural tipine göre daraltılır: `evaluateRule` yalnız
 * ilgili alanı okur. Tam `PRODUCT_SELECT` (beş görsel ilişkisi) her sayfada
 * fazladan ilişki sorgusu açıp kural sayfasını ~11 sn'ye çıkarıyordu.
 */
const SCAN_FIELDS_BY_RULE_TYPE: Record<string, Record<string, unknown>> = {
  ingredient_text: { items: { ingredients: true } },
  ingredient_excludes: { items: { ingredients: true } },
  additive_code: { additives: true },
  allergen: { allergens: true },
  country: { country: true },
  brand: { brand: true },
  brand_boycotted: { brand: true },
  category: { category: true },
  nutrition_max: { nutrition: { per: true, items: { nutrient: true, amount: true, unit: true } } },
  nutrition_min: { nutrition: { per: true, items: { nutrient: true, amount: true, unit: true } } },
  label_has: { labels: true },
  label_missing: { labels: true },
}

function scanSelectFor(rules: Rule[]): Record<string, unknown> {
  const select: Record<string, unknown> = { name: true }
  for (const rule of rules) {
    const fields = SCAN_FIELDS_BY_RULE_TYPE[(rule as { ruleType?: string }).ruleType ?? '']
    if (fields) Object.assign(select, fields)
  }
  return select
}

/** Tarama sonucu kısa süreli önbellekte: kural sayfası her açılışta 10 bin kaydı gezmesin. */
const matchScanCache = new LRUCache<string, Array<string | number>>({
  max: 200,
  ttl: 1000 * 60,
})

/** Tarama anahtarı: kural kimlikleri bir kez hesaplanır, sayfa başına yeniden sıralanmaz. */
function scanCacheKey(ruleSetKey: string, from: number): string {
  return `${from}|${ruleSetKey}`
}

function ruleSetKeyFor(rules: Rule[]): string {
  return rules
    .map((rule) => String((rule as { id?: string | number }).id ?? '?'))
    .sort()
    .join(',')
}

/** Yayındaki tüm ürünleri sayfa sayfa tarar, kurallara takılanların kimliklerini döndürür. */
async function scanPublishedProductIds(
  payload: Payload,
  rules: Rule[],
): Promise<Array<string | number>> {
  const pageSize = 1000
  const select = scanSelectFor(rules)
  const ruleSetKey = ruleSetKeyFor(rules)
  const matched: Array<string | number> = []
  for (let page = 1; ; page++) {
    const cacheKey = scanCacheKey(ruleSetKey, page)
    const cached = matchScanCache.get(cacheKey)
    if (cached) {
      matched.push(...cached)
      if (cached.length < pageSize) return matched
      continue
    }

    const result = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: pageSize,
      page,
      depth: 1,
      select,
    })
    const pageMatches: Array<string | number> = []
    for (const product of result.docs as any[]) {
      // Kural seti ürün başına marka/ülke ile daraltılır: 3.900 marka kuralını her ürün
      // için gezmek 10 bin ürünlük taramayı dakikalara çıkarıyordu.
      const candidates = rulesForProduct(product as never, rules)
      if (candidates.some((rule) => evaluateRule(rule, product as never).matched)) {
        pageMatches.push(product.id)
      }
    }
    matchScanCache.set(cacheKey, pageMatches)
    matched.push(...pageMatches)

    // Önbellekten gelen sayfa tam değilse son sayfadayız.
    if (result.docs.length < pageSize || page * pageSize >= result.totalDocs) return matched
  }
}

/** Eşleşen ürünleri görsel ilişkileriyle (depth 2) çekip tarama sırasını korur. */
async function casesForProductIds(
  payload: Payload,
  rules: Rule[],
  ids: Array<string | number>,
): Promise<ProductCase[]> {
  const cases = new Map<string, ProductCase>()
  const chunkSize = 100
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const found = await payload.find({
      collection: 'products',
      where: { and: [{ status: { equals: 'published' } }, { id: { in: chunk } }] },
      limit: chunk.length,
      depth: 2,
      select: PRODUCT_SELECT,
    })
    for (const product of found.docs as any[]) {
      cases.set(String(product.id), toProductCase(product, rules))
    }
  }
  return ids
    .map((id) => cases.get(String(id)))
    .filter((productCase): productCase is ProductCase => Boolean(productCase))
}

/**
 * Bir uzmanın kurallarına takılan yayınlanmış ürünler.
 *
 * `listProductsMatchingRule` kural başına ayrı tarama yapar; uzman profili tek istekte
 * tüm kuralları istediği için ürün listesi bir kez çekilip kurallar bellekte değerlendirilir.
 */
export async function listProductsForRules(
  payload: Payload,
  rules: Rule[],
): Promise<ProductCase[]> {
  if (rules.length === 0) return []
  return casesForProductIds(payload, rules, await scanPublishedProductIds(payload, rules))
}

/**
 * Yayındaki ürünlerden tek bir kurala takılanları Dosya'ya çevirir.
 * Kural detay sayfası ve `/api/expert-rules/:id/products` ucu bunu kullanır;
 * eşleştirme `verdictEngine`'in tek kaynağından gelir (kopya mantık yok).
 */
export async function listProductsMatchingRule(
  payload: Payload,
  rule: Rule,
): Promise<ProductCase[]> {
  return casesForProductIds(payload, [rule], await scanPublishedProductIds(payload, [rule]))
}
