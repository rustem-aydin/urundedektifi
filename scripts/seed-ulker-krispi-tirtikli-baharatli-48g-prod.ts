import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ülker Krispi Tırtıklı Baharatlı Kraker 48 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B082GM4SGR + ürün ambalajı (EAN-13 8690504108771).
 * Mevcut kayıt (id 10433, Open Food Facts'ten "Krispi" markasıyla gelmiş) barkoda göre
 * güncellenir; hiçbir alan boşaltılmaz, hatalı marka Ülker ile düzeltilir.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-ulker-krispi-tirtikli-baharatli-48g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690504108771'
const GTIN = '8690504108771'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'ulker-krispi-48g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g içindekiler listesi (arka yüz)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g besin değerleri tablosu (100 g ve 15 g porsiyon)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g arka yüz: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g barkod numarası 8690504108771',
  },
  {
    key: 'manufacturer',
    file: 'manufacturer.jpg',
    alt: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g üretici, işletme kayıt no, çeşit no ve saklama bilgileri',
  },
] as const

type IngredientEntry = { name: string; id?: number; slug?: string }

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS: readonly IngredientEntry[] = [
  { name: 'buğday unu', id: 181 },
  { name: 'Palm yağı', id: 499 },
  { name: 'Nişasta', id: 402 },
  { name: 'Mısır unu', id: 1920 },
  { name: 'Peyniraltı suyu tozu', id: 184 },
  { name: 'tuz', id: 137 },
  { name: 'maltodekstrin', id: 121 },
  { name: 'Şeker', id: 186 },
  { name: 'Pirinç Unu', id: 616 },
  { name: 'soğan', id: 464 },
  { name: 'Acı biber', id: 1207 },
  { name: 'Kalsiyum fosfatlar', slug: 'kalsiyum-fosfatlar' },
  { name: 'Sodyum fosfatlar', slug: 'sodyum-fosfatlar' },
  { name: 'Sitrik asit', id: 538 },
  { name: 'Hidrolize soya proteini', slug: 'hidrolize-soya-proteini' },
  { name: 'Hindistan cevizi yağı', id: 1231 },
  { name: 'Sarımsak', id: 466 },
  { name: 'Çeşni', id: 1550 },
  { name: 'Paprika ekstraktı', slug: 'paprika-ekstrakti' },
  { name: 'Aroma Verici', id: 4694 },
  { name: 'mısır', id: 634 },
  { name: 'Buğday Nişastası', id: 414 },
  { name: 'Kalsiyum karbonat', slug: 'kalsiyum-karbonat' },
  { name: 'Mono ve digliseritler', slug: 'mono-ve-digliseritler' },
  { name: 'Buğday irmiği', id: 3642 },
  { name: 'Buğday proteini', id: 2643 },
  { name: 'Malt unu', id: 2915 },
  { name: 'Disodyum difosfat', slug: 'disodyum-difosfat' },
  { name: 'Sodyum Hidrojen Karbonat', id: 250 },
  { name: 'Amonyum Hidrojen Karbonat', id: 1983 },
  { name: 'DATEM (Mono- ve dias etiltartarik asit esterleri)', slug: 'datem' },
  { name: 'Sodyum stearol-2-laktilat', id: 1059 },
  { name: 'Malt ekstraktı', id: 1051 },
  { name: 'Sodyum metabisülfit', slug: 'sodyum-metabisulfit' },
]

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 16 // Ülker
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten
const ADDITIVE_IDS = [
  23, // E341 Kalsiyum Fosfatlar
  103, // E339 Sodyum Fosfatlar
  1, // E330 Sitrik Asit
  34, // E160C Paprika Ekstraktı
  80, // E170 Kalsiyum Karbonatlar
  14, // E471 Mono- ve Digliseritler
  4, // E450 Difosfatlar
  6, // E500 Sodyum Karbonatlar
  8, // E503 Amonyum Karbonatlar
  25, // E472E DATEM
  149, // E481 Sodyum Stearoil-2-Laktilat
  3, // E223 Sodyum Metabisülfit
] as const

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
  if ('id' in entry && entry.id) return entry.id

  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug ?? entry.name.toLocaleLowerCase('tr-TR'),
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

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Ülker Krispi Tırtıklı Baharatlı Kraker 48 g',
    slug: 'ulker-krispi-tirtikli-baharatli-kraker-48-g',
    description:
      "Ülker Krispi Tırtıklı Baharatlı Kraker, taco baharat çeşnili tırtıklı krakerlerin 48 g'lık (yaklaşık 3 porsiyon) paketidir. Patentli tırtıklı doku ve özel baharat karışımıyla çıtır bir aperatiflik sunar.\n\nEtikette buğday (gluten), süt ve soya içerdiği, eser miktarda susam içerebileceği belirtilir. Ürün domuz yağı ve domuzdan elde edilmiş hiçbir katkı maddesi içermez; vejetaryen beslenmeye uygundur. Türkiye'de üretilmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B082GM4SGR) ve ürün ambalajı (EAN-13 8690504108771).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Ülker Bisküvi Sanayi A.Ş.',
    country: COUNTRY_ID,
    size: '48 g',
    packaging: 'Plastik paket (metalleştirilmiş film)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [...ADDITIVE_IDS],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 493, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 25, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 60, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 7.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2.7, unit: 'g' },
      ],
    },
    labels: ['vegetarian'],
    specifications: [
      { key: 'Marka', value: 'Ülker' },
      { key: 'Ürün Tipi', value: 'Tırtıklı kraker' },
      { key: 'Aroma', value: 'Taco baharat çeşnisi (baharatlı)' },
      { key: 'Net Miktar', value: '48 g' },
      { key: 'Porsiyon', value: '15 g (paket başına yaklaşık 3 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Ülker Bisküvi Sanayi A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Gebze Organize Sanayi Bölgesi 90. Sokak No:9, Çayırova-Kocaeli / Türkiye',
      },
      { key: 'İşletme Kayıt No', value: 'TR-41-K-000198' },
      { key: 'Çeşit No (Item No)', value: '01087-07' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B082GM4SGR' },
      { key: 'Ürün Ölçüleri', value: '14,7 × 14,4 × 3,9 cm' },
      { key: 'Diyet Türü', value: 'Vejetaryen' },
      {
        key: 'Domuz Yağı Beyanı',
        value: 'Domuz yağı ve domuzdan elde edilmiş hiçbir katkı maddesi içermez',
      },
      { key: 'Eser Alerjen', value: 'Eser miktarda susam içerebilir' },
      { key: 'Saklama Koşulu', value: 'Serin ve kuru yerde muhafaza ediniz' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 17,50 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday), süt ve soya içerir. Çölyak hastalığı, gluten duyarlılığı, süt alerjisi veya soya alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Eser miktarda susam içerebilir. Susam alerjisi olan kişiler dikkatli olmalıdır.',
      },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      { severity: 'low' as const, text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir.' },
    ],
    storage: 'Serin ve kuru yerde muhafaza ediniz. Ambalaj açıldıktan sonra ağzını kapatın.',
    usage: 'Aperatif olarak tüketilir.',
    model: 'B082GM4SGR',
    sku: 'AMZ-B082GM4SGR',
    prices: [{ amount: 17.5, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690504108771' },
      { image: media.manufacturer, caption: 'Üretici ve saklama bilgileri' },
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
