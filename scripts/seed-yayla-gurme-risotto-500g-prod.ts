import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Risotto Pirinç 500 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B081JPWH1R + ürün ambalajı (EAN-13 8693374239378).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-gurme-risotto-500g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-gurme-risotto-500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374239378'
const ASIN = 'B081JPWH1R'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-risotto-500g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Gurme Risotto Pirinç 500 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Risotto Pirinç 500 g ürün adı, sınıfı, kırık oranı ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Risotto Pirinç 500 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Gurme Risotto Pirinç 500 g ambalaj sembolleri (PP 5, 2502, gıda ile temasa uygun, helal)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Risotto Pirinç 500 g arka yüz: besin değerleri, üretici, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Risotto Pirinç 500 g barkod numarası 8693374239378',
  },
] as const

/** Etiketten okunan içindekiler: tek madde — risotto (arborio) pirinci. */
const INGREDIENTS = [
  { name: 'Risotto Pirinç', slug: 'risotto-pirinc', aliases: ['Arborio pirinci', 'Arborio rice'] },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1027 // Yayla Gurme
const CATEGORY_ID = 27 // Baklagil & Tahıl › Makarna & Pirinç
const COUNTRY_ID = 1 // Türkiye

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

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmalı: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${code} (beklenen ${expected})`)
  }
}

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    aliases: entry.aliases.map((alias) => ({ alias })),
  })
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

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) ingredientIds.push(await ensureIngredient(client, entry))

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Risotto Pirinç 500 g',
    description:
      "Yayla Gurme Risotto Pirinç, risotto yapımına uygun kısa taneli arborio pirincidir (500 g). 1. sınıf üründür; kırık oranı en fazla %5'tir. Yüksek nişasta içeriği sayesinde pişerken nişastasını dışarı bırakarak risottoya kremamsı yapı verir ve pişerken ağırlığının yaklaşık 3-4 katı su alabilir. Risotto, pilav ve fırın yemeklerinde kullanılır.\n\nAmbalajda glutensiz olduğu, fosfor kaynağı ve düşük yağlı olduğu beyan edilir; helal işareti basılıdır. Pirinç İtalya menşelidir, Türkiye'de (Mersin) işlenip paketlenir. Yayla Gurme serisi 1982'den beri üretim yapan Yayla Agro Gıda'ya aittir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B081JPWH1R) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Plastik paket (PP 5, 2502)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1425, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 340, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 75.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 280.2, unit: 'mg' },
      ],
    },
    labels: ['gluten-free', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Risotto pirinci (arborio)' },
      { key: 'Ürün Adı (Etiket)', value: 'Risotto Pirinç / Arborio Rice' },
      { key: 'Tane Uzunluğu', value: 'Kısa tane' },
      { key: 'Sınıf', value: '1. Sınıf' },
      { key: 'Kırık Oranı', value: 'En fazla %5' },
      { key: 'Net Miktar', value: '500 g' },
      { key: 'Porsiyon', value: '50 g (100 g tablosundan; ambalajdaki RA* değerleri 50 g içindir)' },
      { key: 'Menşei', value: 'İtalya (ambalaj üzerinde İtalya bayrağı)' },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Ambalaj', value: 'Plastik paket (PP 5, 2502)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi (Ambalaj)',
        value: 'Yalınayak Mah. 1099. Sok. No:1 Toroslar / Mersin',
      },
      { key: 'Tüketici Hattı', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Gıda Kodeksi'ne uygundur" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Model Numarası', value: '17860' },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '18,6 × 13 × 4 cm; 510 g (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Beyanlar',
        value: 'Glutensiz, fosfor kaynağı, düşük yağ (ambalaj üzerindeki rozetler)',
      },
      {
        key: 'Pişirme Notu',
        value:
          'Yüksek nişasta içeriğiyle risottoya kremamsı yapı verir; pişerken yaklaşık 3-4 katı su alabilir',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'PP 5, 2502, gıda ile temasa uygun (çatal-bardak), güneşten ve nemden koruyun, helal',
      },
      {
        key: 'Amazon Üretici Adresi',
        value:
          'Amazon.com.tr ürün detayında Kahramankazan / Ankara adresi yazıyor; ambalajda Mersin adresi basılı',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 81,87 TL (163,74 TL/kg, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Ambalajı yırtılmış, delinmiş veya hasarlı ürünü satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir.',
      },
    ],
    storage:
      'Lütfen rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Risotto yapımında kullanın: yüksek nişasta içeriği sayesinde pişerken nişastasını dışarı bırakarak kremamsı bir yapı verir ve yaklaşık 3-4 katı su alabilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 81.87, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
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
