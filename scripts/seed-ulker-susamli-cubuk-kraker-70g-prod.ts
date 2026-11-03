import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ülker Susamlı Çubuk Kraker 70 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0827D3BJB + ürün ambalajı (EAN-13 8690504117827).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-ulker-susamli-cubuk-kraker-70g-prod.ts
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

const BARCODE = '8690504117827'
const GTIN = '8690504117827'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'ulker-susamli-cubuk-kraker-70g')

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
    alt: 'Ülker Susamlı Çubuk Kraker 70 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Ülker Susamlı Çubuk Kraker 70 g içindekiler ve alerjen beyanı yakın çekim',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Ülker Susamlı Çubuk Kraker 70 g besin değerleri tablosu (100 g ve 15 g porsiyon)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ülker Susamlı Çubuk Kraker 70 g arka yüz: içindekiler, besin değerleri, barkod ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Ülker Susamlı Çubuk Kraker 70 g barkod numarası 8690504117827',
  },
  {
    key: 'manufacturer',
    file: 'manufacturer.jpg',
    alt: 'Ülker Susamlı Çubuk Kraker 70 g üretici, işletme kayıt no ve ihracatçı bilgileri',
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler) ve prod master kimlikleri.
 * Kimlikler kullanım sayısına göre kanonik kayıtlar (prod'da doğrulandı).
 */
const INGREDIENTS = [
  { id: 181, name: 'buğday unu' },
  { id: 193, name: 'susam', percent: 17 },
  { id: 499, name: 'Palm yağı' },
  { id: 137, name: 'tuz' },
  { id: 1983, name: 'Amonyum Hidrojen Karbonat' },
  { id: 4738, name: 'Disodyum difosfat' },
  { id: 218, name: 'Tam yağlı süttozu' },
  { id: 213, name: 'soya lesitini' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 16 // Ülker
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_SESAME_ID = 11 // Susam (gluten, süt ve soya uyarılarda belirtilir)
const ADDITIVE_IDS = {
  lecithin: 11, // E322I Lesitin (soya lesitini)
  disodiumDiphosphate: 5, // E450I Disodyum Difosfat
  ammoniumHydrogenCarbonate: 9, // E503II Amonyum Hidrojen Karbonat
  sodiumHydroxide: 21, // E524 Sodyum Hidroksit
} as const

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
    name: 'Ülker Susamlı Çubuk Kraker 70 g',
    description:
      "Ülker Susamlı Çubuk Kraker, 70 g'lık tekli pakette satılan susamlı çubuk krakerdir. Krakerler susamla kaplıdır; içindekiler listesinde susam %17 oranıyla belirtilir. Paket yaklaşık 5 porsiyona (15 g) denk gelir; çay/kahve yanında ve ara öğünlerde tüketilir.\n\nEtiket buğday unu, susam, palm yağı, tuz, kabartıcılar (amonyum hidrojen karbonat, disodyum difosfat), asitlik düzenleyici (sodyum hidroksit), tam yağlı süttozu ve emülgatör (soya lesitini) içerdiğini; eser miktarda yumurta ve fındık içerebileceğini belirtir. Ürünün domuz yağı ve katkılarını içermediği, serin ve kuru yerde saklanması gerektiği ambalajda yazar.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0827D3BJB) ve ürün ambalajı (EAN-13 8690504117827).",
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
    allergens: ALLERGEN_SESAME_ID,
    additives: [
      ADDITIVE_IDS.lecithin,
      ADDITIVE_IDS.disodiumDiphosphate,
      ADDITIVE_IDS.ammoniumHydrogenCarbonate,
      ADDITIVE_IDS.sodiumHydroxide,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1831, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 435, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 14, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 4.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 63, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 3.8, unit: 'g' },
      ],
    },
    labels: ['vegetarian'],
    specifications: [
      { key: 'Marka', value: 'Ülker' },
      { key: 'Ürün Tipi', value: 'Çubuk kraker' },
      { key: 'Tat', value: 'Susamlı, tuzlu' },
      { key: 'Net Miktar', value: '70 g' },
      { key: 'Porsiyon', value: '15 g (1 paket yaklaşık 5 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Ülker Bisküvi San. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Gebze Organize Sanayi Bölgesi 90. Sokak No:94 Çayırova-Kocaeli / Türkiye',
      },
      { key: 'İşletme Kayıt No', value: 'TR-41-K-000198' },
      {
        key: 'İhracatçı',
        value:
          'İstanbul Gıda Dış Ticaret A.Ş., Kısıklı Mah. Ferah Cad. No:1 Büyükçamlıca Üsküdar / İstanbul',
      },
      { key: 'Tüketici Hattı', value: '+90 212 567 1 567' },
      { key: 'Web', value: 'www.ulker.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0827D3BJB' },
      { key: 'Üretici Ürün Kodu', value: '01178-02 (MLZ KOD 40052747)' },
      {
        key: 'Alerjen Beyanı',
        value:
          'Buğday (gluten), susam, süt ve soya içerir; eser miktarda yumurta ve fındık içerebilir',
      },
      { key: 'Domuz Yağı Beyanı', value: 'Domuz yağı ve katkıları içermez' },
      { key: 'Diyet Beyanı', value: 'Vejetaryen (Amazon ürün bilgisi)' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 17,50 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Buğday (gluten), susam, süt ve soya içerir. Çölyak hastalığı veya susam, süt, soya alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Eser miktarda yumurta ve fındık (sert kabuklu yemiş) içerebilir.',
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
    storage: 'Serin ve kuru yerde muhafaza ediniz.',
    model: 'B0827D3BJB',
    sku: 'AMZ-B0827D3BJB',
    prices: [{ amount: 17.5, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690504117827' },
      { image: media.manufacturer, caption: 'Üretici ve ihracatçı bilgileri' },
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
