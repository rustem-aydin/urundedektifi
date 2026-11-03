import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Etli Nohut Yemeği 250 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08WBFGSHN + ürün ambalajı (EAN-13 8693374260785).
 * Ürün daha önce Open Food Facts aktarımından gelmiş (id 11221, "Yayla Etli Nohut");
 * betik mevcut kaydı barkoddan bulup etiket verisiyle günceller.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-etli-nohut-250g-prod.ts
 *   (veya hazır admin jetonu: SEED_TOKEN=...)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8693374260785'
const GTIN = '8693374260785'
const ASIN = 'B08WBFGSHN'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-etli-nohut-250g')

/** EAN-13 doğrulama hanesini kontrol eder; yanlış barkodla yazmayı engeller. */
function assertEan13(value: string): void {
  if (!/^\d{13}$/.test(value)) throw new Error(`EAN-13 13 haneli olmalı: ${value}`)
  const digits = value.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  if (check !== digits[12]) throw new Error(`EAN-13 doğrulama hanesi hatalı: ${value}`)
}

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g içindekiler ve alerjen beyanı yakın çekim',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g besin değerleri tablosu (100 g ve 125 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g net ağırlık, helal ve ambalaj sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g arka yüz: içindekiler, besin değerleri, barkod ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Etli Nohut Yemeği 250 g barkod numarası 8693374260785',
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler) ve prod master kimlikleri.
 * Kimlikler prod'da ada göre birebir doğrulanır (assertIngredients).
 */
const INGREDIENTS = [
  { id: 1170, name: 'Nohut', percent: 48 },
  { id: 278, name: 'Su' },
  { id: 1461, name: 'Dana eti', percent: 6 },
  { id: 3541, name: 'Et suyu', percent: 4 },
  { id: 298, name: 'Ayçiçek yağı', percent: 4 },
  { id: 399, name: 'Domates püresi', percent: 3 },
  { id: 1392, name: 'Biber salçası', percent: 3 },
  { id: 137, name: 'tuz' },
  { id: 181, name: 'buğday unu' },
  { id: 464, name: 'soğan' },
  { id: 466, name: 'Sarımsak' },
  { id: 815, name: 'karabiber' },
  { id: 895, name: 'kimyon' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 24 // Temel Gıda & Mutfak › Hazır Yemek
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (etiket: "Gluten içerir. / Contains wheat gluten.")

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
  phosphorus: 38,
} as const

async function assertIngredients(client: PayloadClient): Promise<void> {
  const ids = INGREDIENTS.map((entry) => entry.id)
  const found = await client.find('ingredients', {
    where: { id: { in: ids } },
    limit: ids.length,
    select: { name: true },
  })
  if (found.totalDocs !== ids.length) {
    throw new Error(`Master içindekiler eksik: ${ids.length} yerine ${found.totalDocs} kayıt bulundu`)
  }
  for (const entry of INGREDIENTS) {
    const doc = found.docs.find((candidate) => candidate.id === entry.id) as
      | { id: number; name?: string }
      | undefined
    if (doc?.name !== entry.name) {
      throw new Error(
        `İçindekiler kimliği kaydı: ${entry.id} → "${doc?.name}" (beklenen "${entry.name}")`,
      )
    }
  }
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
  assertEan13(GTIN)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  await assertIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Etli Nohut Yemeği 250 g',
    description:
      "Yayla Etli Nohut Yemeği, 250 g'lık retort poşette satılan hazır yemektir; nohut (%48) ve dana kuşbaşı (%6) ile et suyu, domates püresi ve biber salçasında pişirilir. Paket 2 porsiyona (125 g) denk gelir ve servis önerisi sıcaktır. Isıtmadan önce ambalajın şişmiş veya sızdırmıyor olması gerekir.\n\nEtiket içindekileri nohut, su, et (dana kuşbaşı), et suyu, bitkisel yağ (ayçiçek yağı), domates püresi, biber salçası, tuz, buğday unu, soğan, sarımsak, karabiber ve kimyon olarak verir; buğday unu nedeniyle gluten içerdiğini belirtir. Ambalaj 3 katlı BPA'sız koruyucu ambalajdır ve koruyucu/renklendirici içermez.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08WBFGSHN) ve ürün ambalajı (EAN-13 8693374260785).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: "3 katlı BPA'sız koruyucu ambalaj (retort poşet)",
    items: INGREDIENTS.map((entry) => ({
      ingredients: entry.id,
      ...('percent' in entry ? { percent_estimate: entry.percent } : {}),
    })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 579, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 138, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 15.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 118, unit: 'mg' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Hazır Yemek (Etli Nohut)' },
      { key: 'İngilizce Adı', value: 'Chickpea Stew With Beef' },
      { key: 'Net Miktar', value: '250 g' },
      { key: 'Porsiyon', value: '2 porsiyon (porsiyon başına 125 g)' },
      { key: 'Ambalaj', value: "3 katlı BPA'sız koruyucu ambalaj (retort poşet)" },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1 Toroslar / Mersin',
      },
      { key: 'Telefon', value: '0 324 221 62 76' },
      { key: 'Faks', value: '0 324 221 62 78' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Ölçü Seçeneği',
        value: '250 Gr (tekli); 12 x 250 g seçeneği B0C1VHLMCK',
      },
      { key: 'Ürün Ölçüleri', value: '16,9 × 12,4 × 3,4 cm' },
      { key: 'Kargo Ağırlığı', value: '560 g' },
      { key: 'Helal Beyanı', value: 'Ambalaj üzerinde helal işareti bulunur' },
      { key: 'Gluten Beyanı', value: 'Gluten içerir (buğday unu)' },
      {
        key: 'Katkı Beyanı',
        value: 'Koruyucu ve renklendirici içermez; 3 katlı BPA’sız koruyucu ambalaj',
      },
      {
        key: 'Servis',
        value: 'Servis önerisi: sıcak olarak, 2 porsiyon',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 116,82 TL (3 Kasım 2026); liste yalnız bağış amaçlı satışa açık, bağış dışı siparişler iptal edilir',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday unu) içerir. Çölyak hastalığı veya gluten hassasiyeti olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Şişmiş ve sızdıran ambalajdaki ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj açıldıktan sonra buzdolabında (+4 °C) saklanmalı ve 2 gün içinde tüketilmelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında, güneş ışığından uzak ortamda saklayın. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edin ve 2 gün içinde tüketin.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 116.82, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${GTIN}` },
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
