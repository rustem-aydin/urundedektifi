import fs from 'fs'
import os from 'os'
import path from 'path'
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { slugify } from '../../src/lib/slugify'
import type { PayloadClient } from './payload-rest'

/**
 * Open Food Facts → Payload ürün aktarımının ortak katmanı.
 *
 * Tek ürün (`seed-products-prod.ts`) ve toplu sayfa aktarımı
 * (`off-bulk-import.ts`) aynı dönüşümü kullanır: barkod, ad, marka, kategori,
 * içindekiler (master kayıtlara bağlı), alerjen, katkı, besin değerleri,
 * etiketler ve ürün fotoğrafları.
 *
 * OFF'a nazik davranır: UA zorunlu, yanıtlar diskte önbelleklenir, 503/429
 * yanıtlarında geri çekilir.
 */

export const OFF_HEADERS = {
  'User-Agent': 'seffafurun-import/1.0 (admin@admin.com)',
}

/**
 * OFF, "robot" trafiği nedeniyle arama/facet uçlarını anonim kullanıcıya
 * kapatıyor (401 + "create a free account"). Bir OFF hesabıyla oturum açılıp
 * dönen `session` çerezi tüm isteklere eklenir.
 */
let sessionCookie = ''

export function hasOffSession(): boolean {
  return sessionCookie !== ''
}

export function offHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...OFF_HEADERS,
    ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    ...extra,
  }
}

/**
 * OFF hesabıyla oturum açar; `session` çerezini sonraki isteklere taşır.
 *
 * OFF'un login formu sürüm sürüm değiştiği için (/cgi/login.pl multipart,
 * /cgi/session.pl urlencoded) iki biçim de denenir; ilk çerez veren kazanır.
 */
export async function loginOff(userId: string, password: string): Promise<void> {
  const baseHeaders = {
    Origin: 'https://world.openfoodfacts.org',
    Referer: 'https://world.openfoodfacts.org/cgi/session.pl',
  }

  const attempts: Array<{ label: string; run: () => Promise<Response> }> = [
    {
      label: 'login.pl multipart',
      run: () => {
        const form = new FormData()
        form.append('user_id', userId)
        form.append('password', password)
        form.append('remember_me', 'on')
        form.append('submit', 'Sign in')
        form.append('redirect', '')
        return fetch('https://world.openfoodfacts.org/cgi/login.pl', {
          method: 'POST',
          headers: offHeaders(baseHeaders),
          body: form,
          redirect: 'manual',
        })
      },
    },
    {
      label: 'session.pl urlencoded',
      run: () =>
        fetch('https://world.openfoodfacts.org/cgi/session.pl', {
          method: 'POST',
          headers: offHeaders({ ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' }),
          body: new URLSearchParams({
            user_id: userId,
            password,
            next: '/',
            '.submit': 'Sign in',
          }),
          redirect: 'manual',
        }),
    },
  ]

  const problems: string[] = []
  for (const attempt of attempts) {
    const res = await attempt.run().catch((error: Error) => {
      problems.push(`${attempt.label}: ${error.message}`)
      return null
    })
    if (!res) continue

    const session = (res.headers.getSetCookie?.() ?? [])
      .map((cookie) => cookie.split(';')[0])
      .filter((cookie) => cookie.startsWith('session='))
      .join('; ')
    if (session) {
      sessionCookie = session
      return
    }
    const body = await res.text().catch(() => '')
    const notice = body.match(/(?:Error|error)[^<]{0,120}/)?.[0]?.replace(/\s+/g, ' ').trim()
    problems.push(`${attempt.label}: HTTP ${res.status}${notice ? ` — ${notice}` : ''}`)
  }

  throw new Error(`OFF oturumu açılamadı. ${problems.join(' | ')}`)
}

export const OFF_SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_tr',
  'generic_name_tr',
  'generic_name',
  'brands',
  'quantity',
  'image_front_url',
  'image_ingredients_url',
  'image_nutrition_url',
  'nutriments',
  'ingredients_text_tr',
  'ingredients',
  'additives_tags',
  'allergens_tags',
  'categories_tags',
  'labels_tags',
  'nutriscore_grade',
].join(',')

const OffIngredient = z
  .object({
    id: z.string().optional(),
    text: z.string(),
    percent_estimate: z.number().optional(),
  })
  .loose()

export const OffProductSchema = z
  .object({
    code: z.string(),
    product_name: z.string().optional(),
    product_name_tr: z.string().optional(),
    generic_name_tr: z.string().optional(),
    generic_name: z.string().optional(),
    brands: z.string().optional(),
    quantity: z.string().optional(),
    image_front_url: z.string().optional(),
    image_ingredients_url: z.string().optional(),
    image_nutrition_url: z.string().optional(),
    nutriments: z.record(z.string(), z.unknown()).optional(),
    ingredients: z.array(OffIngredient).optional(),
    additives_tags: z.array(z.string()).optional(),
    allergens_tags: z.array(z.string()).optional(),
    categories_tags: z.array(z.string()).optional(),
    labels_tags: z.array(z.string()).optional(),
    nutriscore_grade: z.string().optional(),
  })
  .loose()

export type OffProduct = z.infer<typeof OffProductSchema>

const OffResponse = z.object({ status: z.number(), product: OffProductSchema.optional() })

const OffSearchResponse = z.object({
  count: z.number(),
  page: z.number().optional(),
  page_size: z.number().optional(),
  products: z.array(OffProductSchema),
})

const TaxonomyEntry = z.object({ name: z.record(z.string(), z.string()).optional() }).loose()
const TaxonomyResponse = z.record(z.string(), TaxonomyEntry)

/** OFF başlıkları dağınık olduğu için ambalaj adıyla sabitlenen ürünler. */
const NAME_OVERRIDES: Record<string, string> = {
  '8690766009205': 'Ülker Çizi Peynirli Kraker 70 g',
  '8690504028536': 'Ülker Dido Sütlü Çikolatalı Gofret 35 g',
  '8690504142959': 'Ülker Bol Sütlü Kare Çikolata 60 g',
  '8690504121541': 'Ülker Çokokrem Kakaolu Fındık Kreması 950 g',
  '8690766086473': 'Ülker Rulokat Fındıklı Kremalı Rulo Gofret 170 g',
  '8690526028040': 'Eti Karam Bitter Çikolata 60 g',
  '8690526083254': 'Eti Tutku Bisküvi 100 g',
  '8690526063508': 'Eti Burçak Sütlü Çikolatalı Bisküvi 114 g',
  '8690526069500': 'Eti Lifalif Yulaf Ezmesi 500 g',
  '8696362804718': 'Heinz Domates Ketçabı 460 g',
  '8690574114528': 'Pepsi 2,5 L',
  '8695077102010': 'Dost Tam Yağlı Süt 1 L',
  '8690565100530': 'Pınar Süt 1 L',
  '8692886310711': 'Altınkılıç Kefir 1 L',
  '8690787251010': 'Tadım Kavrulmuş Siyah Ay Çekirdeği 180 g',
  '8681630310015': 'Züber %100 Fıstık Ezmesi 315 g',
  '8695077124685': 'Bolbol Mayonez 870 g',
  '8683130067796': 'Calve Ranch Sos 250 ml',
  '5000112672039': 'Coca-Cola 1,5 L',
  '80135876': 'Nutella Kakaolu Fındık Kreması 400 g',
}

/** OFF'un ayrıştırdığı metinlerde etiket/OCR artıkları olabiliyor; bunları ele. */
const ITEM_OVERRIDES: Record<string, string[]> = {
  '8690565100530': ['Süt'],
}

const INGREDIENT_STOPWORDS = [
  'içerebilir',
  'içermez',
  'üretici',
  'menşe',
  'mense',
  'seri no',
  'tüketici',
  'ambalaj',
  'buzdolabı',
  'saklayın',
  'çalkalayınız',
  'içindekiler',
  'http',
  'www.',
]

function isCleanIngredientName(name: string): boolean {
  if (name.length < 2 || name.length > 40) return false
  if (/[0-9]{2,}|%/.test(name)) return false
  const capitals = name.match(/[A-ZÇĞİÖŞÜ]/g)?.length ?? 0
  if (capitals > Math.max(3, name.length * 0.6)) return false
  const lower = name.toLocaleLowerCase('tr')
  return !INGREDIENT_STOPWORDS.some((word) => lower.includes(word))
}

/** OFF alerjen etiketleri → Türkçe ad (taxonomy bu etiketlerde ad döndürmüyor). */
const ALLERGEN_NAMES: Record<string, string> = {
  'en:gluten': 'Gluten',
  'en:milk': 'Süt',
  'en:nuts': 'Sert Kabuklu Yemişler',
  'en:peanuts': 'Yer Fıstığı',
  'en:soybeans': 'Soya',
  'en:eggs': 'Yumurta',
  'en:sesame-seeds': 'Susam',
  'en:fish': 'Balık',
  'en:crustaceans': 'Kabuklular',
  'en:molluscs': 'Yumuşakçalar',
  'en:mustard': 'Hardal',
  'en:celery': 'Kereviz',
  'en:sulphur-dioxide-and-sulphites': 'Sülfitler',
  'en:lupin': 'Acı Bakla',
}

/** Sık görülen katkı kodlarının Türkçe adları; bilinmeyen kodda ad = kod. */
const ADDITIVE_NAMES: Record<string, string> = {
  E150: 'Karamel',
  E200: 'Sorbik Asit',
  E202: 'Potasyum Sorbat',
  E211: 'Sodyum Benzoat',
  E223: 'Sodyum Metabisülfit',
  E270: 'Laktik Asit',
  E290: 'Karbondioksit',
  E322: 'Lesitinler',
  E330: 'Sitrik Asit',
  E338: 'Fosforik Asit',
  E341: 'Kalsiyum Fosfatlar',
  E415: 'Ksantan Sakızı',
  E450: 'Difosfatlar',
  E471: 'Mono- ve Digliseritler',
  E472E: 'DATEM',
  E476: 'Poligliserol Polirisinoleat',
  E500: 'Sodyum Karbonatlar',
  E503: 'Amonyum Karbonatlar',
  E1200: 'Polidekstroz',
}

const LABEL_MAP: Record<string, string> = {
  'en:no-gluten': 'gluten-free',
  'en:gluten-free': 'gluten-free',
  'en:vegetarian': 'vegetarian',
  'en:vegan': 'vegan',
  'en:organic': 'organic',
  'en:eu-organic': 'organic',
  'en:fair-trade': 'fair-trade',
  'en:halal': 'halal-certified',
  'en:halal-quality-control': 'halal-certified',
  'en:kosher': 'kosher',
  'en:no-additives': 'no-additives',
  'en:no-preservatives': 'no-additives',
  'en:no-flavors': 'no-additives',
  'en:no-colorings': 'no-additives',
  'en:no-artificial-flavors': 'no-additives',
  'en:no-artificial-colors': 'no-additives',
  'en:no-artificial-colours-or-flavours': 'no-additives',
  'en:low-or-no-sugar': 'sugar-free',
  'en:no-sugar': 'sugar-free',
  'en:no-added-sugar': 'sugar-free',
  'en:lactose-free': 'lactose-free',
  'en:no-lactose': 'lactose-free',
  'en:non-gmo': 'non-gmo',
  'en:natural': 'natural',
  'en:natural-product': 'natural',
  'en:100-natural': 'natural',
  'en:cruelty-free': 'cruelty-free',
  'en:recyclable': 'recyclable',
}

/**
 * Kategori eşlemesi: sırayla ilk uyan kural kazanır.
 * Özel kurallar önce, ürünlerin neredeyse tamamında geçen genel etiketler
 * (`snacks`, `plant-based-foods`) en sonda; hiçbiri uymazsa "Diğer".
 */
const CATEGORY_RULES: Array<{ match: string[]; name: string }> = [
  {
    match: ['chocolate-spreads', 'hazelnut-spreads', 'sweet-spreads', 'nut-butters', 'peanut-butters'],
    name: 'Kahvaltılık & Sürülebilir',
  },
  { match: ['waters', 'sodas', 'colas', 'carbonated-drinks'], name: 'İçecekler' },
  { match: ['milks', 'dairies', 'yogurts', 'kefir', 'fermented-milk'], name: 'Süt Ürünleri' },
  { match: ['biscuits', 'wafers', 'cookies', 'crackers'], name: 'Bisküvi & Gofret' },
  { match: ['chocolates', 'confectionery'], name: 'Çikolata' },
  { match: ['sauces', 'condiments', 'mayonnaises', 'ketchups', 'dressings'], name: 'Soslar & Çeşniler' },
  { match: ['fats', 'oils'], name: 'Yağlar' },
  { match: ['coffees', 'teas', 'coffee-substitutes'], name: 'Kahve & Çay' },
  { match: ['fruit-juices', 'juices', 'nectars', 'smoothies'], name: 'Meyve Suyu' },
  { match: ['plant-based-milk-alternatives', 'cereal-based-drinks', 'soy-drinks'], name: 'Bitkisel İçecek' },
  { match: ['beers', 'wines', 'spirits'], name: 'Alkollü İçecekler' },
  { match: ['ice-creams', 'ice-cream', 'frozen-desserts'], name: 'Dondurma' },
  { match: ['cheeses'], name: 'Peynir' },
  { match: ['butters', 'margarines'], name: 'Tereyağı & Margarin' },
  { match: ['breakfast-cereals', 'mueslis', 'granolas'], name: 'Kahvaltılık Tahıl' },
  { match: ['breads', 'bakery', 'viennoiseries', 'pastries'], name: 'Fırın & Ekmek' },
  { match: ['pastas', 'noodles', 'rices', 'pasta'], name: 'Makarna & Pirinç' },
  { match: ['meats', 'sausages', 'hams', 'poultry', 'prepared-meats'], name: 'Et & Şarküteri' },
  { match: ['fishes', 'seafood', 'fish'], name: 'Su Ürünleri' },
  { match: ['fruits', 'vegetables', 'legumes', 'fresh-plants'], name: 'Meyve & Sebze' },
  { match: ['pulses', 'cereals-and-potatoes'], name: 'Baklagil & Tahıl' },
  { match: ['spices', 'herbs', 'salts', 'vinegars', 'seasonings'], name: 'Baharat & Çeşni' },
  { match: ['jams', 'honeys', 'spreads'], name: 'Reçel & Bal' },
  { match: ['desserts', 'cakes', 'sweets', 'pastries'], name: 'Tatlı' },
  { match: ['baby-foods', 'baby-milks', 'infant-formulas'], name: 'Bebek & Çocuk' },
  { match: ['soups', 'prepared-meals', 'meals', 'frozen-foods'], name: 'Hazır Yemek' },
  { match: ['nuts', 'seeds', 'dried-fruits'], name: 'Kuruyemiş' },
  { match: ['crisps', 'chips', 'salty-snacks', 'appetizers'], name: 'Cips & Atıştırmalık' },
  { match: ['snacks', 'snack-foods'], name: 'Atıştırmalık' },
  { match: ['waters', 'beverages', 'drinks'], name: 'İçecekler' },
  { match: ['dairies', 'milk'], name: 'Süt Ürünleri' },
]

const DEFAULT_CATEGORY = 'Diğer'

/** OFF besin anahtarı → master nutrient slug'ı ve hedef birim. */
const NUTRIENT_MAP: Array<{ off: string; slug: string; unit: 'kcal' | 'g' | 'mg' }> = [
  { off: 'energy-kcal_100g', slug: 'energy-kcal', unit: 'kcal' },
  { off: 'fat_100g', slug: 'fat', unit: 'g' },
  { off: 'saturated-fat_100g', slug: 'saturated-fat', unit: 'g' },
  { off: 'carbohydrates_100g', slug: 'carbohydrates', unit: 'g' },
  { off: 'sugars_100g', slug: 'sugars', unit: 'g' },
  { off: 'proteins_100g', slug: 'proteins', unit: 'g' },
  { off: 'salt_100g', slug: 'salt', unit: 'g' },
  { off: 'fiber_100g', slug: 'fiber', unit: 'g' },
  { off: 'sodium_100g', slug: 'sodium', unit: 'mg' },
]

export const tmpDir = path.join(os.tmpdir(), 'seffafurun-seed')

export async function fetchWithRetry(url: string, attempts = 5): Promise<unknown> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, { headers: offHeaders() })
    const text = await res.text()
    if (text.trim().startsWith('{')) return JSON.parse(text) as unknown
    if (attempt === attempts) {
      throw new Error(`OFF yanıtı alınamadı (${res.status}): ${url}`)
    }
    await sleep(Math.min(60_000, 5000 * 2 ** (attempt - 1)))
  }
  throw new Error(`OFF yanıtı alınamadı: ${url}`)
}

/**
 * Sayfa sayfa arama (Türkiye ürünleri). 50 ürünlük sayfa başına tek istek.
 * OFF'un nginx hız sınırı ara sıra 0 baytlık 503 döndürüyor; çağıran taraf
 * kendi geri çekilme döngüsünü kurar (`attempts` varsayılan 1).
 */
export async function searchOffPage(
  page: number,
  pageSize = 50,
  attempts = 1,
): Promise<{ products: OffProduct[]; count: number }> {
  const url =
    `https://world.openfoodfacts.org/api/v2/search` +
    `?countries_tags_en=turkey&page=${page}&page_size=${pageSize}` +
    `&fields=${OFF_SEARCH_FIELDS}`
  const parsed = OffSearchResponse.parse(await fetchWithRetry(url, attempts))
  return { products: parsed.products, count: parsed.count }
}

export async function fetchOffProduct(barcode: string): Promise<OffProduct> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_SEARCH_FIELDS}`
  const parsed = OffResponse.parse(await fetchWithRetry(url))
  if (parsed.status !== 1 || !parsed.product) {
    throw new Error(`OFF ürünü bulunamadı: ${barcode}`)
  }
  return parsed.product
}

/** OFF ingredient id'lerini (en:sugar) Türkçe adlara çevirir; 40'lık partiler. */
export async function fetchIngredientNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40)
    const url = `https://world.openfoodfacts.org/api/v2/taxonomy?tagtype=ingredients&tags=${chunk.join(',')}&lc=tr`
    const result = TaxonomyResponse.parse(await fetchWithRetry(url))
    for (const [tag, entry] of Object.entries(result)) {
      const tr = entry.name?.tr
      if (tr) names.set(tag, tr)
    }
    await sleep(1200)
  }
  return names
}

export function normalizeName(text: string): string {
  return text
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase())
}

export function pickCategory(categories: string[]): string {
  const joined = categories.map((c) => c.replace(/^[a-z]{2}:/, ''))
  for (const rule of CATEGORY_RULES) {
    if (joined.some((tag) => rule.match.some((needle) => tag.includes(needle)))) {
      return rule.name
    }
  }
  return DEFAULT_CATEGORY
}

export function isLiquid(product: OffProduct): boolean {
  const quantity = (product.quantity ?? '').toLowerCase()
  if (/\d\s*(l|lt|litre|ml|cl)\b/.test(quantity)) return true
  const categories = (product.categories_tags ?? []).join(' ')
  return /beverages|waters|drinks|sodas|colas/.test(categories)
}

/** Ürün adı: marka + ad (ad markayla başlamıyorsa). Ad yoksa null. */
export function productName(product: OffProduct): string | null {
  const override = NAME_OVERRIDES[product.code]
  if (override) return override
  const brandName = product.brands?.split(',')[0]?.trim() || ''
  const baseName =
    product.product_name_tr?.trim() || product.product_name?.trim() || product.generic_name_tr?.trim() || ''
  // Adsız kayıtlarda OFF bazen barkodu ad olarak taşıyor; ürün adı sayılmaz.
  if (!baseName || /^\d{8,14}$/.test(baseName)) return null
  const brandLower = brandName.toLocaleLowerCase('tr')
  return brandName && !baseName.toLocaleLowerCase('tr').startsWith(brandLower)
    ? `${brandName} ${baseName}`
    : baseName
}

/**
 * Döküm (jsonl) kaydından görsel URL'i üretir: OFF dosya yolunu barkodu 13 haneye
 * tamamlayıp 3/3/3/4 olarak böler (`8690526001135` → `869/052/600/1135`).
 */
function dumpImagePath(code: string): string {
  const padded = code.replace(/\D/g, '').padStart(13, '0')
  return `${padded.slice(0, 3)}/${padded.slice(3, 6)}/${padded.slice(6, 9)}/${padded.slice(9)}`
}

function dumpImageUrl(
  record: Record<string, unknown>,
  kind: 'front' | 'ingredients' | 'nutrition',
): string | undefined {
  const images = record.images as Record<string, Record<string, unknown>> | undefined
  const selected = images?.selected as Record<string, Record<string, unknown>> | undefined
  // Dökümde seçili görsel `images.selected.<kind>` altında; eski kayıtlarda
  // doğrudan `images.<kind>` olabiliyor.
  const entry = selected?.[kind] ?? images?.[kind]
  if (!entry || typeof entry !== 'object') return undefined

  const languages = Object.keys(entry).filter(
    (language) => entry[language] && typeof entry[language] === 'object',
  )
  const language = languages.includes('tr') ? 'tr' : languages.includes('en') ? 'en' : languages[0]
  if (!language) return undefined

  const meta = entry[language] as { rev?: unknown; imgid?: unknown }
  // Dosya adı ürünün görselin eklendiği andaki revizyonunu taşır: `front_tr.<rev>.400.jpg`
  // (doğrulandı: 12/12 örnekte API'nin image_front_url'ü ile aynı).
  const rev = meta.rev ?? meta.imgid
  if (rev === undefined || rev === null) return undefined
  return `https://images.openfoodfacts.org/images/products/${dumpImagePath(String(record.code))}/${kind}_${language}.${rev}.full.jpg`
}

/**
 * Resmî döküm kaydını (jsonl) arama API'siyle aynı şekle çevirir.
 * Tek fark görsellerdir: dökümde hazır URL yok, `images.selected` üzerinden üretilir.
 */
export function fromDumpRecord(record: Record<string, unknown>): OffProduct {
  const stringAt = (key: string): string | undefined => {
    const value = record[key]
    return typeof value === 'string' && value.trim() ? value : undefined
  }
  const listAt = (key: string): string[] | undefined => {
    const value = record[key]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
  }

  return OffProductSchema.parse({
    code: String(record.code),
    product_name: stringAt('product_name'),
    product_name_tr: stringAt('product_name_tr'),
    generic_name: stringAt('generic_name'),
    generic_name_tr: stringAt('generic_name_tr'),
    brands: stringAt('brands'),
    quantity: stringAt('quantity'),
    image_front_url: dumpImageUrl(record, 'front'),
    image_ingredients_url: dumpImageUrl(record, 'ingredients'),
    image_nutrition_url: dumpImageUrl(record, 'nutrition'),
    nutriments: record.nutriments,
    ingredients: record.ingredients,
    additives_tags: listAt('additives_tags'),
    allergens_tags: listAt('allergens_tags'),
    categories_tags: listAt('categories_tags'),
    labels_tags: listAt('labels_tags'),
    nutriscore_grade: stringAt('nutriscore_grade'),
  })
}

/** Arama API'si 400 px URL döner; ürün sayfası için tam çözünürlük kullanılır. */
export function hiResImageUrl(url: string): string {
  return url.replace(/\.\d+\.jpg$/, '.full.jpg')
}

/** Görsel indirme/yükleme için global eşzamanlılık sınırı (OFF CDN'i zorlamamak için). */
function createSemaphore(limit: number) {
  let active = 0
  const waiting: Array<() => void> = []
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve))
    active++
    try {
      return await fn()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}

async function downloadImage(url: string, filename: string): Promise<string> {
  fs.mkdirSync(tmpDir, { recursive: true })
  const target = path.join(tmpDir, filename)
  if (fs.existsSync(target) && fs.statSync(target).size > 0) return target

  // images.openfoodfacts.org sık sık yavaşlıyor/kopuyor: uzun zaman aşımı + 5 deneme.
  let lastError: unknown
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: offHeaders(),
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) throw new Error(`görsel indirilemedi ${url}: ${res.status}`)
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length === 0) throw new Error(`boş görsel ${url}`)
      fs.writeFileSync(target, bytes)
      return target
    } catch (error) {
      lastError = error
      if (attempt < 5) await sleep(4000 * attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export type ImagePolicy = 'all' | 'front' | 'none'

export type ImportResult =
  | { status: 'created'; barcode: string; name: string; items: number; nutrition: number }
  | { status: 'updated'; barcode: string; name: string; items: number; nutrition: number }
  | { status: 'skipped'; barcode: string; reason: string }

export type OffImporter = {
  init(): Promise<void>
  /** Sayfadaki tüm içindekiler etiketleri için Türkçe adları önceden getirir. */
  prefetchIngredients(products: OffProduct[]): Promise<void>
  importProduct(product: OffProduct): Promise<ImportResult>
  /**
   * Önceden aktarılmış ürünün eksik görsellerini tamamlar. OFF'un görsel
   * sunucusu koptuğu için ürün görselsiz kalmış olabilir.
   */
  fixImages(product: OffProduct): Promise<'present' | 'filled' | 'failed' | 'missing'>
}

/**
 * Master listeleri bellekte tutan, barkoda göre var olan kaydı ATLAMAYAN
 * (üzerine yazmayan) aktarıcı. Var olan ürün verisi elle zenginleştirilmiş
 * olabildiği için toplu aktarımda ürün güncellenmez.
 */
export async function createOffImporter(
  client: PayloadClient,
  options: {
    images?: ImagePolicy
    existing?: 'skip' | 'update'
    imageConcurrency?: number
    /** İçindekiler sözlüğünün disk önbelleği: süreç yeniden başlasa da OFF'a tekrar sorulmaz. */
    ingredientCachePath?: string
  } = {},
): Promise<OffImporter> {
  const imagePolicy = options.images ?? 'all'
  const existingMode = options.existing ?? 'skip'
  const limitImages = createSemaphore(options.imageConcurrency ?? 2)
  const ingredientCachePath = options.ingredientCachePath
  const ingredientNames = new Map<string, string>()

  if (ingredientCachePath && fs.existsSync(ingredientCachePath)) {
    const cached = z.record(z.string(), z.string()).safeParse(
      JSON.parse(fs.readFileSync(ingredientCachePath, 'utf-8')),
    )
    if (cached.success) {
      for (const [tag, name] of Object.entries(cached.data)) ingredientNames.set(tag, name)
    }
  }

  function saveIngredientCache(): void {
    if (!ingredientCachePath) return
    fs.mkdirSync(path.dirname(ingredientCachePath), { recursive: true })
    fs.writeFileSync(
      ingredientCachePath,
      JSON.stringify(Object.fromEntries(ingredientNames), null, 0),
    )
  }

  const brandBySlug = new Map<string, number>()
  const categoryBySlug = new Map<string, number>()
  const ingredientBySlug = new Map<string, number>()
  const additiveByCode = new Map<string, number>()
  const allergenBySlug = new Map<string, number>()
  const nutrientBySlug = new Map<string, number>()
  const productByBarcode = new Map<string, number>()

  /**
   * Aynı master kaydı eşzamanlı iki ürün isterse tek create yapılır
   * (paralel aktarımda yinelenen marka/içindekiler oluşmasın).
   */
  const inFlight = new Map<string, Promise<unknown>>()
  function once<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const running = inFlight.get(key)
    if (running) return running as Promise<T>
    const promise = factory().finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }

  async function init(): Promise<void> {
    for (const doc of await client.findAll('brands', { limit: 200 })) {
      brandBySlug.set(String(doc.slug), doc.id)
    }
    for (const doc of await client.findAll('categories', { limit: 200 })) {
      categoryBySlug.set(String(doc.slug), doc.id)
    }
    for (const doc of await client.findAll('ingredients', { limit: 200 })) {
      ingredientBySlug.set(String(doc.slug), doc.id)
    }
    for (const doc of await client.findAll('additives')) {
      additiveByCode.set(String(doc.code).toUpperCase(), doc.id)
    }
    for (const doc of await client.findAll('allergens')) {
      allergenBySlug.set(String(doc.slug), doc.id)
    }
    for (const doc of await client.findAll('nutrients')) {
      nutrientBySlug.set(String(doc.slug), doc.id)
    }
    for (const doc of await client.findAll('products', { limit: 200 })) {
      productByBarcode.set(String(doc.barcode), doc.id)
    }
  }

  async function prefetchIngredients(products: OffProduct[]): Promise<void> {
    const tags = [
      ...new Set(
        products.flatMap((p) =>
          (p.ingredients ?? []).map((i) => i.id).filter((id): id is string => Boolean(id)),
        ),
      ),
    ].filter((tag) => !ingredientNames.has(tag))
    if (!tags.length) return
    const fetched = await fetchIngredientNames(tags)
    for (const [tag, name] of fetched) ingredientNames.set(tag, name)
    saveIngredientCache()
    console.log(`    içindekiler sözlüğü: +${fetched.size}/${tags.length} (toplam ${ingredientNames.size})`)
  }

  async function brandId(name: string): Promise<number | undefined> {
    const clean = name.replace(/\s+/g, ' ').trim()
    if (clean.length < 2 || clean.length > 60 || /^[0-9\s.,]+$/.test(clean)) return undefined
    const slug = slugify(clean)
    if (!slug) return undefined
    const existing = brandBySlug.get(slug)
    if (existing) return existing
    return once(`brand:${slug}`, async () => {
      const doc = await client.create('brands', { name: clean, slug })
      brandBySlug.set(slug, doc.id)
      return doc.id
    })
  }

  async function categoryId(name: string): Promise<number> {
    const slug = slugify(name)
    const existing = categoryBySlug.get(slug)
    if (existing) return existing
    return once(`category:${slug}`, async () => {
      const doc = await client.create('categories', { name, slug, order: 100 })
      categoryBySlug.set(slug, doc.id)
      return doc.id
    })
  }

  async function ingredientId(tag: string | undefined, text: string): Promise<number | undefined> {
    const name = (tag && ingredientNames.get(tag)) || normalizeName(text)
    if (!name) return undefined
    const slug = slugify(name)
    const existing = ingredientBySlug.get(slug)
    if (existing) return existing

    return once(`ingredient:${slug}`, async () => {
      const doc = await client.create('ingredients', { name, slug })
      ingredientBySlug.set(slug, doc.id)
      return doc.id
    })
  }

  async function additiveId(tag: string): Promise<number> {
    const code = tag.replace(/^en:/, '').toUpperCase()
    const existing = additiveByCode.get(code)
    if (existing) return existing
    return once(`additive:${code}`, async () => {
      const doc = await client.create('additives', { code, name: ADDITIVE_NAMES[code] ?? code })
      additiveByCode.set(code, doc.id)
      return doc.id
    })
  }

  async function allergenId(tag: string): Promise<number | undefined> {
    const name = ALLERGEN_NAMES[tag]
    if (!name) return undefined
    const slug = slugify(name)
    const existing = allergenBySlug.get(slug)
    if (existing) return existing
    return once(`allergen:${slug}`, async () => {
      const doc = await client.create('allergens', { name, slug })
      allergenBySlug.set(slug, doc.id)
      return doc.id
    })
  }

  async function ensureImage(url: string | undefined, alt: string, filename: string) {
    if (!url || imagePolicy === 'none') return undefined
    try {
      return await limitImages(async () => {
        const filePath = await downloadImage(hiResImageUrl(url), filename)
        const media = await client.upload('media', filePath, { alt })
        return media.id
      })
    } catch (error) {
      console.log(`    ! görsel atlandı (${filename}): ${(error as Error).message}`)
      return undefined
    }
  }

  async function importProduct(product: OffProduct): Promise<ImportResult> {
    const barcode = product.code
    const name = productName(product)
    if (!name) return { status: 'skipped', barcode, reason: 'adsız ürün' }
    // Payload barkod alanı 8–14 hane kabul ediyor; OFF'ta bozuk kodlar var.
    if (!/^\d{8,14}$/.test(barcode)) return { status: 'skipped', barcode, reason: 'geçersiz barkod' }
    const existingId = productByBarcode.get(barcode)
    if (existingId && existingMode === 'skip') {
      return { status: 'skipped', barcode, reason: 'zaten kayıtlı' }
    }

    const brandName = product.brands?.split(',')[0]?.trim() || ''
    const brand = await brandId(brandName)
    const category = await categoryId(pickCategory(product.categories_tags ?? []))

    // İçindekiler: OFF tahmini yüzdeleriyle master kayıtlara bağla
    const items: Array<{ ingredients: number; percent_estimate: number }> = []
    const sourceIngredients = product.ingredients ?? []
    for (const item of sourceIngredients) {
      const percent =
        typeof item.percent_estimate === 'number'
          ? item.percent_estimate
          : sourceIngredients.length === 1
            ? 100
            : undefined
      if (percent === undefined) continue
      const tag = item.id
      const label = (tag && ingredientNames.get(tag)) || normalizeName(item.text)
      if (!label || !isCleanIngredientName(label)) continue
      const id = await ingredientId(tag, item.text)
      if (!id || items.some((existing) => existing.ingredients === id)) continue
      items.push({ ingredients: id, percent_estimate: Math.round(percent * 100) / 100 })
    }

    // Etiketteki gerçek içerik (OFF verisi bozuksa) master kayıtlara bağlanır
    const overrideNames = ITEM_OVERRIDES[barcode]
    if (overrideNames) {
      items.length = 0
      for (const overrideName of overrideNames) {
        const id = await ingredientId(undefined, overrideName)
        if (!id || items.some((existing) => existing.ingredients === id)) continue
        items.push({
          ingredients: id,
          percent_estimate: Math.round((100 / overrideNames.length) * 100) / 100,
        })
      }
    }

    // Alerjenler: tek ilişki alanı olduğu için ilk eşleşen
    let allergen: number | undefined
    for (const tag of product.allergens_tags ?? []) {
      allergen = await allergenId(tag)
      if (allergen) break
    }

    // Katkı maddeleri
    const additives: number[] = []
    for (const tag of product.additives_tags ?? []) {
      additives.push(await additiveId(tag))
    }

    // Besin değerleri
    const nutriments = product.nutriments ?? {}
    const nutritionItems = NUTRIENT_MAP.flatMap(({ off, slug, unit }) => {
      const raw = nutriments[off]
      if (typeof raw !== 'number') return []
      const nutrient = nutrientBySlug.get(slug)
      if (!nutrient) return []
      const amount = unit === 'mg' ? Math.round(raw * 1000 * 100) / 100 : Math.round(raw * 100) / 100
      return [{ nutrient, amount, unit }]
    })

    const [frontImage, ingredientsImage, nutritionImage] = await Promise.all([
      ensureImage(product.image_front_url, `${name} — ön yüz`, `${barcode}-front.jpg`),
      imagePolicy === 'all'
        ? ensureImage(product.image_ingredients_url, `${name} — içindekiler`, `${barcode}-ingredients.jpg`)
        : undefined,
      imagePolicy === 'all'
        ? ensureImage(product.image_nutrition_url, `${name} — besin değerleri`, `${barcode}-nutrition.jpg`)
        : undefined,
    ])

    const genericName = product.generic_name_tr?.trim() || product.generic_name?.trim()
    const labels = (product.labels_tags ?? [])
      .map((tag) => LABEL_MAP[tag])
      .filter((label): label is string => Boolean(label))
    const nutriscore = product.nutriscore_grade?.toLowerCase()

    const data: Record<string, unknown> = {
      barcode,
      name,
      description: [
        genericName,
        `${brandName} markasının ${product.quantity ?? 'ambalajsız'} ürünü.`,
        `Veri kaynağı: Open Food Facts (EAN ${barcode}).`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      status: 'published',
      ...(brand ? { brand } : {}),
      category,
      ...(product.quantity ? { size: product.quantity } : {}),
      ...(nutriscore && ['a', 'b', 'c', 'd', 'e'].includes(nutriscore) ? { nutriscore } : {}),
      ...(labels.length ? { labels: [...new Set(labels)] } : {}),
      ...(allergen ? { allergens: allergen } : {}),
      ...(additives.length ? { additives: [...new Set(additives)] } : {}),
      ...(items.length ? { items } : {}),
      ...(nutritionItems.length
        ? { nutrition: { per: isLiquid(product) ? '100ml' : '100g', items: nutritionItems } }
        : {}),
      ...(frontImage ? { frontImage } : {}),
      ...(ingredientsImage ? { ingredientsImage } : {}),
      ...(nutritionImage ? { nutritionImage } : {}),
      is_submit: true,
    }

    const summary = { barcode, name, items: items.length, nutrition: nutritionItems.length }

    if (existingId) {
      await client.update('products', existingId, data)
      return { status: 'updated', ...summary }
    }

    const baseSlug = slugify(name)
    const slugTaken = await client.findOne('products', { slug: { equals: baseSlug } })
    const slug = slugTaken ? `${baseSlug}-${barcode}` : baseSlug
    let doc
    try {
      doc = await client.create('products', { ...data, slug })
    } catch (error) {
      // Paralel aktarımda aynı ad iki ürüne denk gelebilir; barkodla çöz.
      if (!/slug/i.test((error as Error).message)) throw error
      doc = await client.create('products', { ...data, slug: `${baseSlug}-${barcode}` })
    }
    productByBarcode.set(barcode, doc.id)

    return { status: 'created', ...summary }
  }

  async function fixImages(
    product: OffProduct,
  ): Promise<'present' | 'filled' | 'failed' | 'missing'> {
    const existing = await client.findOne('products', { barcode: { equals: product.code } })
    if (!existing) return 'missing'

    const idOf = (value: unknown): number | null =>
      value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)
        ? Number((value as { id: number }).id)
        : typeof value === 'number'
          ? value
          : null

    const updates: Record<string, number> = {}
    let attemptFailed = false

    // Ön yüz: yoksa eklenir, 400 px eski görsel varsa tam çözünürlükle değiştirilir.
    const frontId = idOf(existing.frontImage)
    if (!frontId && product.image_front_url) {
      const uploaded = await ensureImage(
        product.image_front_url,
        `${productName(product) ?? product.code} — ön yüz`,
        `${product.code}-front.jpg`,
      )
      if (uploaded) updates.frontImage = uploaded
      else attemptFailed = true
    } else {
      const media = await client.findOne('media', { id: { equals: frontId } })
      const width = typeof media?.width === 'number' ? media.width : null
      if (width !== null && width < 600 && imagePolicy !== 'none' && product.image_front_url) {
        const uploaded = await ensureImage(
          product.image_front_url,
          `${productName(product) ?? product.code} — ön yüz`,
          `${product.code}-front.jpg`,
        )
        if (uploaded) updates.frontImage = uploaded
        else attemptFailed = true
      }
    }

    if (imagePolicy === 'all') {
      const kinds = [
        {
          field: 'ingredientsImage',
          url: product.image_ingredients_url,
          alt: 'içindekiler',
          file: `${product.code}-ingredients.jpg`,
        },
        {
          field: 'nutritionImage',
          url: product.image_nutrition_url,
          alt: 'besin değerleri',
          file: `${product.code}-nutrition.jpg`,
        },
      ]
      for (const kind of kinds) {
        // OFF'ta o görsel yoksa onarım denemesi de yok: eksik sayılmaz.
        if (idOf(existing[kind.field]) || !kind.url) continue
        const uploaded = await ensureImage(
          kind.url,
          `${productName(product) ?? product.code} — ${kind.alt}`,
          kind.file,
        )
        if (uploaded) updates[kind.field] = uploaded
        else attemptFailed = true
      }
    }

    if (Object.keys(updates).length) await client.update('products', existing.id, updates)
    if (Object.keys(updates).length) return 'filled'
    return attemptFailed ? 'failed' : 'present'
  }

  return { init, prefetchIngredients, importProduct, fixImages }
}
