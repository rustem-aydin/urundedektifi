import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Reis Patlatmalık Mısır (Popcorn) 500 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08QKQTCH7 + ürünün arka yüz ambalajı (EAN-13 8690849110101).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-reis-patlatmalik-misir-500g-prod.ts
 *   (veya mevcut bir admin JWT'si ile: SEED_TOKEN=... node --import tsx/esm scripts/...)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8690849110101'
const ASIN = 'B08QKQTCH7'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'reis-patlatmalik-misir-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Reis Patlatmalık Mısır (Popcorn) 500 g ön yüz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Reis Patlatmalık Mısır 500 g besin değerleri tablosu (100 g / 1 bardak)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Reis Patlatmalık Mısır 500 g arka yüz: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Reis Patlatmalık Mısır 500 g barkod numarası 8690849110101',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [{ name: 'Patlatmalık Mısır', slug: 'patlatmalik-misir' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 803 // Reis
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  cholesterol: 6,
  carbohydrate: 7,
  sugars: 8,
  addedSugars: 9,
  fiber: 18,
  protein: 19,
  sodium: 21,
  transFat: 52,
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
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
  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Reis Patlatmalık Mısır (Popcorn) 500 g',
    description:
      "Reis Patlatmalık Mısır, patlatmaya uygun mısır tanelerinden oluşan 500 g'lık ambalajdır. Sıcak tavada, tencerede veya mikrodalgada patlatılarak tüketilir; tuz ve yağ eklenmeden de hazırlanabilen doğal bir atıştırmalıktır.\n\nAmbalajın içindekiler bölümünde yalnızca \"Patlatmalık Mısır\" yazar; etikette katkı maddesi, ilave şeker veya tuz bildirimi bulunmaz. 100 g'da 320 kcal enerji, 19 g diyet lifi ve 10 g protein sağlar. Türkiye'de üretilmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08QKQTCH7) ve ürünün arka yüz ambalajı (EAN-13 8690849110101).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Plastik paket (yumuşak ambalaj)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 320, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.56, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.cholesterol, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 54, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 19, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.addedSugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Reis' },
      { key: 'Ürün Tipi', value: 'Patlatmalık mısır (cin mısır)' },
      { key: 'Net Miktar', value: '500 g (17,6 oz)' },
      { key: 'Porsiyon', value: '1 bardak (100 g); paket başına yaklaşık 10 porsiyon' },
      { key: 'Ambalaj', value: 'Plastik paket (yumuşak ambalaj)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.' },
      { key: 'Ürün Sınıfı', value: 'T.G. 3416, Tip: Mısır, Sınıf: 1' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '15,7 × 12,6 × 5,3 cm' },
      { key: 'Ürün Ağırlığı', value: '0,53 kg (paket ağırlığı 0,45 kg)' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 37,95 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Ambalajı yırtılmış, delinmiş veya nemlenmiş ürünü satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalaj üzerinde yazılıdır; tarihi geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Serin ve kuru yerde, nemden uzak tutarak saklayın; ambalaj üzerindeki saklama koşullarına uyun.',
    usage: 'Mikrodalgada 2–3 dakika ısıtın.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 37.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    nutritionImage: media.nutrition,
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
