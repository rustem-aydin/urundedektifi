import fs from 'fs'
import os from 'os'
import path from 'path'
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { slugify } from '../src/lib/slugify'
import { createPayloadClient } from './lib/payload-rest'

/**
 * Gerçek ürünleri (Open Food Facts verisi) UZAK Payload REST API'sine yazar.
 * Ürün başına: barkod, ad, marka, kategori, menşe ülke, içindekiler (master
 * kayıtlara bağlı), alerjen, katkı maddeleri, besin değerleri, etiketler ve
 * gerçek ürün fotoğrafları (ön yüz + içindekiler + besin tablosu) aktarılır.
 *
 * Idempotent: barkoda göre upsert eder; medya alt metnine göre yeniden kullanılır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-products-prod.ts
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

/** Türkiye pazarında satılan, OFF'ta fotoğraflı ve tam verili 20 ürün. */
const BARCODES = [
  '8690766009205', // Ülker Çizi Peynirli Kraker 70 g
  '8690504028536', // Ülker Dido Sütlü Çikolatalı Gofret 35 g
  '8690504142959', // Ülker Bol Sütlü Kare Çikolata 60 g
  '8690504121541', // Ülker Çokokrem 950 g
  '8690766086473', // Ülker Rulokat 170 g
  '8690526028040', // Eti Karam Bitter 60 g
  '8690526083254', // Eti Tutku Bisküvi 100 g
  '8690526063508', // Eti Burçak Sütlü Çikolatalı Bisküvi 114 g
  '8690526069500', // Eti Lifalif Yulaf Ezmesi 500 g
  '8696362804718', // Heinz Domates Ketçabı 460 g
  '8690574114528', // Pepsi 2,5 L
  '8695077102010', // Dost Tam Yağlı Süt 1 L
  '8690565100530', // Pınar Süt 1 L
  '8692886310711', // Altınkılıç Kefir 1 L
  '8690787251010', // Tadım Kavrulmuş Siyah Ay Çekirdeği 180 g
  '8681630310015', // Züber %100 Fıstık Ezmesi 315 g
  '8695077124685', // Bolbol Mayonez 870 g
  '8683130067796', // Calve Ranch Sos 250 ml
  '5000112672039', // Coca-Cola 1,5 L
  '80135876', // Nutella 400 g
]

const OFF_FIELDS = [
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

const OFF_HEADERS = { 'User-Agent': 'urundedektifi-seed/1.0 (admin@admin.com)' }

const OffIngredient = z
  .object({
    id: z.string().optional(),
    text: z.string(),
    percent_estimate: z.number().optional(),
  })
  .loose()

const OffProduct = z
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

const OffResponse = z.object({ status: z.number(), product: OffProduct.optional() })

const TaxonomyEntry = z
  .object({ name: z.record(z.string(), z.string()).optional() })
  .loose()
const TaxonomyResponse = z.record(z.string(), TaxonomyEntry)

const ProductSummary = z
  .object({
    name: z.string(),
    brand: z.object({ name: z.string() }).nullish(),
    category: z.object({ name: z.string() }).nullish(),
    frontImage: z.unknown().nullish(),
  })
  .loose()

type OffProduct = z.infer<typeof OffProduct>

/** Ürün adları: OFF başlıkları dağınık olduğu için ambalaj adıyla sabitlendi. */
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
  // OFF, Pınar sütün içindekilerini OCR artığı olarak veriyor; etiketin gerçek içeriği:
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
  'en:vegetarian': 'vegetarian',
  'en:vegan': 'vegan',
  'en:organic': 'organic',
  'en:fair-trade': 'fair-trade',
  'en:halal': 'halal-certified',
}

/** Kategori eşlemesi: ilk uyan etiket kazanır. */
const CATEGORY_RULES: Array<{ match: string[]; name: string }> = [
  { match: ['chocolate-spreads', 'hazelnut-spreads', 'sweet-spreads'], name: 'Kahvaltılık & Sürülebilir' },
  { match: ['waters', 'sodas', 'colas', 'carbonated-drinks'], name: 'İçecekler' },
  { match: ['milks', 'dairies', 'yogurts', 'kefir', 'fermented-milk'], name: 'Süt Ürünleri' },
  { match: ['biscuits', 'wafers', 'cookies', 'crackers'], name: 'Bisküvi & Gofret' },
  { match: ['chocolates', 'confectionery'], name: 'Çikolata' },
  { match: ['sauces', 'condiments', 'mayonnaises', 'ketchups', 'dressings'], name: 'Soslar & Çeşniler' },
  { match: ['nuts', 'seeds', 'snacks'], name: 'Atıştırmalık' },
]

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

const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
const tmpDir = path.join(os.tmpdir(), 'urundedektifi-seed')

async function fetchWithRetry(url: string, attempts = 4): Promise<unknown> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, { headers: OFF_HEADERS })
    const text = await res.text()
    if (text.trim().startsWith('{')) return JSON.parse(text) as unknown
    await sleep(3000 * attempt)
  }
  throw new Error(`OFF yanıtı alınamadı: ${url}`)
}

async function fetchOffProduct(barcode: string): Promise<OffProduct> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`
  const parsed = OffResponse.parse(await fetchWithRetry(url))
  if (parsed.status !== 1 || !parsed.product) {
    throw new Error(`OFF ürünü bulunamadı: ${barcode}`)
  }
  return parsed.product
}

/** OFF ingredient id'lerini (en:sugar) Türkçe adlara çevirir; 40'lık partiler. */
async function fetchIngredientNames(ids: string[]): Promise<Map<string, string>> {
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

function normalizeName(text: string): string {
  return text
    .replace(/_/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase())
}

function pickCategory(categories: string[]): string {
  const joined = categories.map((c) => c.replace(/^[a-z]{2}:/, ''))
  for (const rule of CATEGORY_RULES) {
    if (joined.some((tag) => rule.match.some((needle) => tag.includes(needle)))) {
      return rule.name
    }
  }
  return 'Atıştırmalık'
}

function isLiquid(product: OffProduct): boolean {
  const quantity = (product.quantity ?? '').toLowerCase()
  if (/\d\s*(l|lt|litre|ml|cl)\b/.test(quantity)) return true
  const categories = (product.categories_tags ?? []).join(' ')
  return /beverages|waters|drinks|sodas|colas/.test(categories)
}

async function downloadImage(url: string, filename: string): Promise<string> {
  fs.mkdirSync(tmpDir, { recursive: true })
  const target = path.join(tmpDir, filename)
  if (!fs.existsSync(target)) {
    const res = await fetch(url, { headers: OFF_HEADERS })
    if (!res.ok) throw new Error(`görsel indirilemedi ${url}: ${res.status}`)
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()))
  }
  return target
}

async function ensureImage(url: string | undefined, alt: string, filename: string) {
  if (!url) return undefined
  const existing = await client.findOne('media', { alt: { equals: alt } })
  if (existing) return existing.id
  const filePath = await downloadImage(url, filename)
  const media = await client.upload('media', filePath, { alt })
  return media.id
}

async function main() {
  console.log(`Hedef: ${client.api}`)
  await client.login()
  console.log(`  Giriş yapıldı: ${EMAIL}`)

  // Ürünleri OFF'tan çek
  const products: OffProduct[] = []
  for (const barcode of BARCODES) {
    const product = await fetchOffProduct(barcode)
    products.push(product)
    await sleep(1200)
  }
  console.log(`  OFF'tan ${products.length} ürün alındı`)

  // İçindekiler için Türkçe adlar
  const ingredientTags = [
    ...new Set(
      products.flatMap((p) => (p.ingredients ?? []).map((i) => i.id).filter((id): id is string => Boolean(id))),
    ),
  ]
  const ingredientNames = await fetchIngredientNames(ingredientTags)
  console.log(`  İçindekiler sözlüğü: ${ingredientNames.size}/${ingredientTags.length}`)

  // Master haritaları (tek seferde çek, slug ile eşle)
  const brandBySlug = new Map(
    (await client.findAll('brands', { limit: 500 })).map((d) => [String(d.slug), d.id]),
  )

  const categoryBySlug = new Map(
    (await client.findAll('categories')).map((d) => [String(d.slug), d.id]),
  )

  const ingredientBySlug = new Map(
    (await client.findAll('ingredients', { limit: 500 })).map((d) => [String(d.slug), d.id]),
  )

  const additiveByCode = new Map(
    (await client.findAll('additives')).map((d) => [String(d.code).toUpperCase(), d.id]),
  )

  const allergenBySlug = new Map(
    (await client.findAll('allergens')).map((d) => [String(d.slug), d.id]),
  )

  const nutrientBySlug = new Map(
    (await client.findAll('nutrients')).map((d) => [String(d.slug), d.id]),
  )

  async function categoryId(name: string): Promise<number> {
    const slug = slugify(name)
    const existing = categoryBySlug.get(slug)
    if (existing) return existing
    const doc = await client.create('categories', { name, slug, order: 100 })
    categoryBySlug.set(slug, doc.id)
    return doc.id
  }

  async function ingredientId(tag: string | undefined, text: string): Promise<number | undefined> {
    const name = (tag && ingredientNames.get(tag)) || normalizeName(text)
    if (!name) return undefined
    const slug = slugify(name)
    const existing = ingredientBySlug.get(slug)
    if (existing) return existing

    const doc = await client.create('ingredients', { name, slug })
    ingredientBySlug.set(slug, doc.id)
    return doc.id
  }

  async function additiveId(tag: string): Promise<number> {
    const code = tag.replace(/^en:/, '').toUpperCase()
    const existing = additiveByCode.get(code)
    if (existing) return existing
    const doc = await client.create('additives', { code, name: ADDITIVE_NAMES[code] ?? code })
    additiveByCode.set(code, doc.id)
    return doc.id
  }

  async function allergenId(tag: string): Promise<number | undefined> {
    const name = ALLERGEN_NAMES[tag]
    if (!name) return undefined
    const slug = slugify(name)
    const existing = allergenBySlug.get(slug)
    if (existing) return existing
    const doc = await client.create('allergens', { name, slug })
    allergenBySlug.set(slug, doc.id)
    return doc.id
  }

  let created = 0
  let updated = 0
  const failures: string[] = []

  async function importProduct(product: OffProduct): Promise<boolean> {
    const barcode = product.code
    const baseName = product.product_name_tr?.trim() || product.product_name?.trim() || barcode
    const brandName = product.brands?.split(',')[0]?.trim() || ''
    const brandLower = brandName.toLocaleLowerCase('tr')
    const name =
      NAME_OVERRIDES[barcode] ??
      (brandName && !baseName.toLocaleLowerCase('tr').startsWith(brandLower)
        ? `${brandName} ${baseName}`
        : baseName)

    const brand = brandBySlug.get(slugify(brandName))
    const category = await categoryId(pickCategory(product.categories_tags ?? []))
    const existingProduct = await client.findOne('products', { barcode: { equals: barcode } })

    // İçindekiler: OFF tahmini yüzdeleriyle master kayıtlara bağla
    const items: Array<{ ingredients: number; percent_estimate: number }> = []
    const sourceIngredients = product.ingredients ?? []
    for (const item of sourceIngredients) {
      // Prod şeması yüzdeyi zorunlu tutuyor: tek içindekili üründe oran %100'dür.
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
      items.push({
        ingredients: id,
        percent_estimate: Math.round(percent * 100) / 100,
      })
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

    const frontImage = await ensureImage(
      product.image_front_url,
      `${name} — ön yüz`,
      `${barcode}-front.jpg`,
    )
    const ingredientsImage = await ensureImage(
      product.image_ingredients_url,
      `${name} — içindekiler`,
      `${barcode}-ingredients.jpg`,
    )
    const nutritionImage = await ensureImage(
      product.image_nutrition_url,
      `${name} — besin değerleri`,
      `${barcode}-nutrition.jpg`,
    )

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
      ...(labels.length ? { labels } : {}),
      ...(allergen ? { allergens: allergen } : {}),
      ...(additives.length ? { additives } : {}),
      ...(items.length ? { items } : {}),
      ...(nutritionItems.length
        ? { nutrition: { per: isLiquid(product) ? '100ml' : '100g', items: nutritionItems } }
        : {}),
      ...(frontImage ? { frontImage } : {}),
      ...(ingredientsImage ? { ingredientsImage } : {}),
      ...(nutritionImage ? { nutritionImage } : {}),
      is_submit: true,
    }

    if (existingProduct) {
      await client.update('products', existingProduct.id, data)
    } else {
      const baseSlug = slugify(name)
      const slugTaken = await client.findOne('products', { slug: { equals: baseSlug } })
      await client.create('products', { ...data, slug: slugTaken ? `${baseSlug}-${barcode}` : baseSlug })
    }

    console.log(
      `  ${existingProduct ? '↻' : '+'} ${barcode} ${name} | ${items.length} içindekiler, ${nutritionItems.length} besin, ${additives.length} katkı`,
    )
    return Boolean(existingProduct)
  }

  for (const product of products) {
    try {
      if (await importProduct(product)) updated++
      else created++
    } catch (error) {
      failures.push(`${product.code}: ${(error as Error).message}`)
      console.log(`  ! ${product.code} atlandı: ${(error as Error).message}`)
    }
  }

  // Doğrulama
  const published = await client.find('products', {
    where: { status: { equals: 'published' } },
    limit: 0,
  })
  const sample = await client.find('products', {
    where: { barcode: { equals: BARCODES[0] } },
    depth: 1,
    limit: 1,
  })
  const doc = sample.docs[0]
  console.log('\nDoğrulama:')
  console.log(`  Yeni ürün: ${created} · Güncellenen: ${updated} · Atlanan: ${failures.length}`)
  for (const failure of failures) console.log(`    ! ${failure}`)
  console.log(`  Yayındaki ürün sayısı: ${published.totalDocs}`)
  if (doc) {
    const summary = ProductSummary.parse(doc)
    console.log(
      `  Örnek: ${summary.name} | marka: ${summary.brand?.name ?? '-'} | kategori: ${summary.category?.name ?? '-'} | görsel: ${summary.frontImage ? 'var' : 'yok'}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
