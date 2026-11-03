import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ülker Çizi Peynirli Kraker 70 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08R3Q8VXH + ürün ambalajı (EAN-13 8690766009205).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 * Kayıt Open Food Facts içe aktarımından geldiği için mevcut ürün güncellenir;
 * OFF'un ayrıştırma artıklarıyla dolu `items` listesi etiketin yaprak
 * maddeleriyle değiştirilir.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-ulker-cizi-peynirli-kraker-70g-prod.ts
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

const BARCODE = '8690766009205'
const GTIN = '8690766009205'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'ulker-cizi-peynirli-kraker-70g')

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
    alt: 'Ülker Çizi Peynirli Kraker 70 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Ülker Çizi Peynirli Kraker 70 g içindekiler ve alerjen beyanı (arka yüz)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Ülker Çizi Peynirli Kraker 70 g besin değerleri tablosu (100 g ve 15 g porsiyon)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ülker Çizi Peynirli Kraker 70 g arka yüz: barkod, net miktar, üretici ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Ülker Çizi Peynirli Kraker 70 g barkod numarası 8690766009205',
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler) ve prod master kimlikleri.
 * Kimlikler kullanım sayısına göre kanonik kayıtlar (prod'da doğrulandı).
 */
const INGREDIENTS = [
  { id: 181, name: 'buğday unu' },
  { id: 499, name: 'Palm yağı' },
  { id: 1983, name: 'Amonyum Hidrojen Karbonat' },
  { id: 250, name: 'Sodyum Hidrojen Karbonat' },
  { id: 4738, name: 'Disodyum difosfat' },
  { id: 184, name: 'Peyniraltı suyu tozu' },
  { id: 137, name: 'tuz' },
  { id: 185, name: 'Invert şeker şurubu' },
  { id: 186, name: 'Şeker' },
  { id: 4694, name: 'Aroma Verici' },
  { id: 188, name: 'Yağsız süttozu' },
  { id: 4722, name: 'Peynir tozu', percent: 0.2 },
  { id: 4740, name: 'Sodyum metabisülfit' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 16 // Ülker
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (buğday unu; süt uyarıda ayrıca belirtilir)
const ADDITIVE_IDS = {
  sodiumMetabisulphite: 3, // E223 Sodyum Metabisülfit
  disodiumDiphosphate: 5, // E450I Disodyum Difosfat
  sodiumHydrogenCarbonate: 7, // E500II Sodyum Hidrojen Karbonat
  ammoniumHydrogenCarbonate: 9, // E503II Amonyum Hidrojen Karbonat
} as const

const NUTRIENT_IDS = {
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
  sodium: 21,
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
      throw new Error(`İçindekiler kimliği kaydı: ${entry.id} → "${doc?.name}" (beklenen "${entry.name}")`)
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
    name: 'Ülker Çizi Peynirli Kraker 70 g',
    description:
      "Ülker Çizi Peynirli Kraker, 70 g'lık tekli pakette satılan peynirli krakerdir. Paket yaklaşık 5 porsiyona (15 g) denk gelir; çay/kahve yanında ve ara öğünlerde tüketilir. Etikette ürünün domuz yağı ve türevlerini içermediği, serin ve kuru yerde saklanması gerektiği belirtilir.\n\nİçindekiler: buğday unu, bitkisel yağ (palm), kabartıcılar (amonyum hidrojen karbonat, sodyum hidrojen karbonat, disodyum difosfat), peyniraltı suyu tozu, tuz, invert şeker şurubu, şeker, aroma vericiler (süt içerir), yağsız süttozu, peynir tozu (%0,2), un işlem maddesi (sodyum metabisülfit). Eser miktarda yumurta, soya, susam ve fındık içerebilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08R3Q8VXH) ve ürün ambalajı (EAN-13 8690766009205).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Ülker Bisküvi San. A.Ş.',
    country: COUNTRY_ID,
    size: '70 g',
    packaging: 'Plastik paket (metalleştirilmiş film)',
    items: INGREDIENTS.map((entry) => ({
      ingredients: entry.id,
      ...('percent' in entry ? { percent_estimate: entry.percent } : {}),
    })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [
      ADDITIVE_IDS.sodiumMetabisulphite,
      ADDITIVE_IDS.disodiumDiphosphate,
      ADDITIVE_IDS.sodiumHydrogenCarbonate,
      ADDITIVE_IDS.ammoniumHydrogenCarbonate,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 456, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 20, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 9.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 61, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 7.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 1200, unit: 'mg' },
      ],
    },
    nutriscore: 'e' as const,
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Ülker' },
      { key: 'Ürün Tipi', value: 'Peynirli kraker' },
      { key: 'Tat', value: 'Tuzlu, peynirli' },
      { key: 'Net Miktar', value: '70 g' },
      { key: 'Porsiyon', value: '15 g (1 paket yaklaşık 5 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Ülker Bisküvi San. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Kişi Mahallesi Ferah Caddesi No: 1, 34692 Büyükamıca, Üsküdar / İstanbul',
      },
      { key: 'İşletme Kayıt No', value: 'TR-41-K-000187 (AKARA A) / TR-00-K-000408' },
      { key: 'Tüketici Hattı', value: '0 212 567 56 57 · Alo Gıda 0 800 211 00 00' },
      { key: 'Web', value: 'www.ulker.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B08R3Q8VXH' },
      { key: 'Üretici Ürün Kodu', value: '00092-00 (MLZ KOD 40044516)' },
      { key: 'Ürün Ölçüleri', value: '15 × 10 × 5 cm' },
      { key: 'Domuz Yağı Beyanı', value: 'Domuz yağı ve türevlerini içermez' },
      { key: 'Diyet Beyanı', value: 'Vejetaryen (Amazon ürün bilgisi)' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 17,00 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Buğday (gluten), süt ve sülfit içerir. Gluten intoleransı (çölyak), süt alerjisi veya laktoz intoleransı olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Eser miktarda yumurta, soya, susam ve sert kabuklu meyve (fındık) içerebilir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalajı yırtılmış, delinmiş veya açılmış ürünleri satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünleri tüketmeyiniz.',
      },
    ],
    storage: 'Serin ve kuru yerde saklayınız.',
    model: 'B08R3Q8VXH',
    sku: 'AMZ-B08R3Q8VXH',
    prices: [{ amount: 17, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690766009205' },
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
