import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ülker Rulokat Fındıklı Kremalı Rulo Gofret 42 g ürününü
 * UZAK Payload REST API'sine yazar: master içindekiler bağlantıları, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0827D1FSG + ürün ambalajı (EAN-13 8690504086444).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-ulker-rulokat-findikli-42g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690504086444'
const GTIN = '8690504086444'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'rulokat-findikli-42g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Ülker Rulokat Fındıklı Kremalı Rulo Gofret 42 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.png',
    alt: 'Ülker Rulokat Fındıklı 42 g içindekiler ve alerjen bilgileri (Türkçe/İngilizce)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.png',
    alt: 'Ülker Rulokat Fındıklı 42 g besin değerleri tablosu (100 g ve 40 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.png',
    alt: 'Ülker Rulokat Fındıklı 42 g Türk Malı ve TÜKÇEV geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ülker Rulokat Fındıklı 42 g arka yüz: içindekiler, besin değerleri, barkod, üretici ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.png',
    alt: 'Ülker Rulokat Fındıklı 42 g barkod numarası 8690504086444',
  },
] as const

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'Şeker', slug: 'seker' },
  { name: 'Bitkisel Yağlar', slug: 'bitkisel-yaglar' },
  { name: 'buğday unu', slug: 'bugday-unu' },
  { name: 'Fındık püresi', slug: 'findik-puresi' },
  { name: 'Tam yağlı süttozu', slug: 'tam-yagli-suttozu' },
  { name: 'Yağsız süttozu', slug: 'yagsiz-suttozu' },
  { name: 'Peyniraltı suyu tozu', slug: 'peyniralti-suyu-tozu' },
  { name: 'Albumin', slug: 'albumin', aliases: ['Albümin', 'Yumurta akı'] },
  { name: 'soya lesitini', slug: 'soya-lesitini' },
  { name: 'Yağı Azaltılmış Kakao Tozu', slug: 'yagi-azaltilmis-kakao-tozu' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'Buğday proteini', slug: 'bugday-proteini' },
  { name: 'Aroma Vericiler', slug: 'aroma-vericiler' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 16 // Ülker
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_MILK_ID = 3 // Süt
const ADDITIVE_IDS = {
  soyLecithin: 11, // E322I Lesitin (soya lesitini)
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
    ...('aliases' in entry && entry.aliases
      ? { aliases: entry.aliases.map((alias) => ({ alias })) }
      : {}),
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
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Ülker Rulokat Fındıklı Kremalı Rulo Gofret 42 g',
    description:
      "Ülker Rulokat Fındıklı, ince gofret yapraklarının fındıklı krema (%68) ile sarıldığı 42 g'lık tek porsiyonluk rulo gofrettir. Pratik ambalajıyla çantada, çekmecede veya ara öğünde kolay taşınır; ürün 3 yaş ve üzeri için uygundur.\n\nÜrün Türkiye'de Biskot Bisküvi Gıda San. Tic. A.Ş. tarafından üretilir. Etikette domuz yağı ve domuzdan elde edilmiş katkı maddesi içermediği belirtilir. Gluten (buğday), süt, yumurta, soya ve fındık içerir; eser miktarda susam içerebilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0827D1FSG) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Biskot Bisküvi Gıda San. Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '42 g',
    packaging: 'Plastik ambalaj (bükümlü film)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_MILK_ID,
    additives: [ADDITIVE_IDS.soyLecithin],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 499, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 24, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 63, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 42, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 2.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.38, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Ülker' },
      { key: 'Ürün Tipi', value: 'Rulo Gofret' },
      { key: 'Aroma', value: 'Fındık' },
      { key: 'Dolgu', value: 'Fındıklı krema (%68)' },
      { key: 'Net Miktar', value: '42 g' },
      { key: 'Porsiyon', value: '40 g (bir paket yaklaşık 1 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (bükümlü film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Biskot Bisküvi Gıda San. Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Organize Sanayi Bölgesi Çarşamba Müdürlüğü Karşısı 1260 Ada 82 Parsel Merkez / Karaman',
      },
      { key: 'İşletme Kayıt No', value: 'TR-70-K-000215' },
      { key: 'Tüketici Hattı', value: '+90 212 567 1 567' },
      { key: 'Web', value: 'www.ulker.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0827D1FSG' },
      { key: 'Ürün Kodu', value: '00864-04' },
      { key: 'Ürün Ölçüleri', value: '15 × 10 × 5 cm' },
      { key: 'Diyet Türü', value: 'Vejetaryen (Amazon ürün bilgisi)' },
      { key: 'Yaş Aralığı', value: '3 yaş ve üzeri' },
      {
        key: 'Domuz Yağı Beyanı',
        value: 'Domuz yağı ve domuzdan elde edilmiş katkı maddesi içermez',
      },
      { key: 'Ambalaj Sembolleri', value: 'TÜRK MALI, TÜKÇEV geri dönüşüm' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 19,90 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday), süt, yumurta, soya ve fındık içerir; eser miktarda susam içerebilir. Alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ambalajı hasarlı veya açılmış ürünleri satın almayınız.' },
      { severity: 'low' as const, text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünleri tüketmeyiniz.' },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde saklayınız. TETT ve parti numarası ambalaj üzerindedir.',
    usage: 'Günlük atıştırmalık olarak tüketime uygundur. 3 yaş ve üzeri içindir.',
    model: 'B0827D1FSG',
    sku: 'AMZ-B0827D1FSG',
    prices: [{ amount: 19.9, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690504086444' },
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
