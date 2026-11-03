import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Eti Susamlı Çubuk Kraker 120 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0F4Y2CL5Q (2 × 120 g 2'li paket) + ürün ambalajı
 * (EAN-13 8690533734064).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-eti-susamli-cubuk-kraker-120g-prod.ts
 *   (veya SEED_EMAIL/SEED_PASSWORD ile)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL/SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690533734064'
const GTIN = '8690533734064'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'eti-susamli-cubuk-kraker-120g')

/** EAN-13 doğrulama hanesini kontrol eder. */
function assertEan13(value: string): void {
  if (!/^\d{13}$/.test(value)) throw new Error(`EAN-13 13 haneli değil: ${value}`)
  const digits = value.split('').map(Number)
  let sum = 0
  for (let index = 0; index < 12; index++) {
    sum += digits[index] * (index % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  if (check !== digits[12]) throw new Error(`EAN-13 doğrulama hanesi hatalı: ${value}`)
}

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g içindekiler, alerjen ve üretici bilgileri (arka yüz)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g geri dönüşüm, TSE ve iletişim sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g arka yüz: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Eti Susamlı Çubuk Kraker 120 g barkod numarası 8690533734064',
  },
] as const

/**
 * Etiketten okunan yaprak içindekiler ve prod master kimlikleri.
 * Kimlikler kullanım sayısına göre kanonik kayıtlar (prod'da doğrulandı).
 * Sodyum Hidroksit master listede yoktu; betik ad + slug ile oluşturur.
 */
const INGREDIENTS = [
  { id: 181, name: 'buğday unu', slug: 'bugday-unu' },
  { id: 499, name: 'Palm yağı', slug: 'palm-yagi' },
  { id: 298, name: 'Ayçiçek yağı', slug: 'aycicek-yagi' },
  { id: 4725, name: 'Pamuk yağı', slug: 'pamuk-yagi' },
  { id: 639, name: 'kanola yağı', slug: 'kanola-yagi' },
  { id: 184, name: 'Peyniraltı suyu tozu', slug: 'peyniralti-suyu-tozu' },
  { id: 193, name: 'susam', slug: 'susam', percent: 13 },
  { id: 185, name: 'Invert şeker şurubu', slug: 'invert-seker-surubu' },
  { id: 137, name: 'tuz', slug: 'tuz' },
  { id: 1983, name: 'Amonyum Hidrojen Karbonat', slug: 'amonyum-hidrojen-karbonat' },
  { id: 250, name: 'Sodyum Hidrojen Karbonat', slug: 'sodyum-hidrojen-karbonat' },
  { name: 'Sodyum Hidroksit', slug: 'sodyum-hidroksit' },
  { id: 350, name: 'Yaş maya', slug: 'yas-maya' },
  { id: 4740, name: 'Sodyum metabisülfit', slug: 'sodyum-metabisulfit' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 42 // Eti
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (susam, sülfit ve süt uyarıda ayrıca belirtilir)
const ADDITIVE_IDS = {
  sodiumMetabisulphite: 3, // E223 Sodyum Metabisülfit
  sodiumHydrogenCarbonate: 7, // E500II Sodyum Hidrojen Karbonat
  ammoniumHydrogenCarbonate: 9, // E503II Amonyum Hidrojen Karbonat
  sodiumHydroxide: 21, // E524 Sodyum Hidroksit
} as const

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  transFat: 52,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  if ('id' in entry) {
    const found = await client.findOne('ingredients', { id: { equals: entry.id } })
    if (!found) throw new Error(`Master içindekiler kaydı yok: ${entry.name} (${entry.id})`)
    return found.id
  }

  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', { name: entry.name, slug: entry.slug })
  console.log(`  + içindekiler: ${entry.name} (${created.id})`)
  return created.id
}

async function ensureMedia(client: PayloadClient): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of IMAGES) {
    const existing = await client.findOne('media', { alt: { equals: image.alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_DIR, image.file), {
      alt: image.alt,
    })
    console.log(`  + medya: ${image.file} (${created.id})`)
    ids[image.key] = created.id
  }
  return ids
}

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Eti Susamlı Çubuk Kraker 120 g',
    description:
      "Eti Susamlı Çubuk Kraker, kavrulmuş susam kaplı ince çubuk krakerlerden oluşan 120 g'lık pakettir. Buğday unu, %13 susam ve bitkisel yağ (palm, ayçiçeği, pamuk, kanola) hamurunun kabartıcılarla pişirilmesiyle üretilir; çay yanında tüketime uygundur.\n\nAmbalajda gluten, susam, sülfit ve süt ürünü içerdiği, eser miktarda kereviz ve yumurta içerebileceği belirtilir. Ürün trans yağ içermez; ürünlerin hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F4Y2CL5Q — 2 × 120 g 2'li paket) ve ürün ambalajı (EAN-13 8690533734064).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Eti Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '120 g',
    packaging: 'Plastik paket (metalleştirilmiş film)',
    items: INGREDIENTS.map((entry, index) => {
      const doc = { ingredients: ingredientIds[index] }
      return 'percent' in entry ? { ...doc, percent_estimate: entry.percent } : doc
    }),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [
      ADDITIVE_IDS.sodiumMetabisulphite,
      ADDITIVE_IDS.sodiumHydrogenCarbonate,
      ADDITIVE_IDS.ammoniumHydrogenCarbonate,
      ADDITIVE_IDS.sodiumHydroxide,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1941, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 463, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 19, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 7.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 61, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 4.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.8, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Eti' },
      { key: 'Ürün Tipi', value: 'Çubuk Kraker' },
      { key: 'Çeşni', value: 'Susamlı' },
      { key: 'Net Miktar', value: '120 g' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Eti Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Kraker Fabrikası, Organize Sanayi Bölgesi, Mümtaz Zeytinoğlu Bulvarı No: 3, Eskişehir / Türkiye',
      },
      { key: 'İşletme Kayıt No', value: 'TR-26-K-000058' },
      { key: 'Ürün Kodu', value: '73406' },
      { key: 'Standart', value: 'TS 2383 Bisküvi' },
      { key: 'Tüketici Hattı', value: '0800 211 0 384 / 0216 651 0 384' },
      { key: 'Web', value: 'www.etieti.com' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0F4Y2CL5Q' },
      { key: 'Amazon Satış Biçimi', value: "2'li paket (2 × 120 g)" },
      { key: 'Trans Yağ Beyanı', value: 'Trans yağ içermez' },
      {
        key: 'Alkol ve Domuz Yağı Beyanı',
        value:
          'Ürünlerimizin hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Gluten, susam, sülfit ve süt ürünü içerir; eser miktarda kereviz ve yumurta içerebilir',
      },
      { key: 'Fiyat Kaynağı', value: "Amazon.com.tr — 2'li paket 44,73 TL (18,64 TL/100 g), 3 Kasım 2026" },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten, susam, sülfit ve süt ürünü içerir; eser miktarda kereviz ve yumurta içerebilir. Alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ambalaj açılmış veya delinmişse satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) ve parti numarası paketin üzerindedir; TETT geçmeden tüketin.',
      },
    ],
    storage: 'Doğrudan güneş ışığına maruz bırakmayın. Serin ve rutubetsiz yerde muhafaza edin.',
    usage: 'Çay yanında tüketime uygundur.',
    model: 'B0F4Y2CL5Q',
    sku: 'AMZ-B0F4Y2CL5Q',
    prices: [{ amount: 44.73, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690533734064' },
    ],
    status: 'published' as const,
  }

  const existing = await client.findOne('products', { barcode: { equals: BARCODE } })
  const product = existing
    ? await client.update('products', existing.id, data)
    : await client.create('products', data)

  console.log(`\nÜrün ${existing ? 'güncellendi' : 'oluşturuldu'}: ${product.id}`)
  console.log(`https://barkoddedektifi.com/urun/${BARCODE}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
