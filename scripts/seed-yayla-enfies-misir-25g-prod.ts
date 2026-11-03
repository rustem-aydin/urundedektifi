import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Enfies Freeze Dried Mısır 25 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B09HGNR5CY + ürün ambalajı (EAN-13 8693374279916)
 * + üretici mağazası (yaylastore.com) net miktar doğrulaması.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-enfies-misir-25g-prod.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-enfies-misir-25g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374279916'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-enfies-misir-25g')

function assertEan13(barcode: string): void {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 değil: ${barcode}`)
  const digits = barcode.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${barcode} (beklenen ${expected})`)
  }
}

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır 25 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır içindekiler, saklama koşulları ve ürün bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır ambalaj sembolleri: güneşten koru, kuru tut, temiz tut, gıda temas, PP 5, geri dönüşüm',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır arka yüz: içindekiler, besin değerleri, üretici bilgileri ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Enfies Freeze Dried Mısır barkod numarası 8693374279916',
  },
] as const

/** Etiketten okunan yaprak içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [{ name: 'mısır', slug: 'misir' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 8 // Atıştırmalık & Tatlı › Atıştırmalık
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
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
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

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Enfies Freeze Dried Mısır 25 g',
    description:
      'Dondurularak kurutulmuş mısır. Mevsiminde toplanan mısır, düşük sıcaklık ve düşük basınçla kurutularak çıtır bir atıştırmalığa dönüştürülür; içinde yalnızca mısır bulunur. 25 g’lık paket, yaklaşık 11 katı taze sebzeye karşılık gelir.\n\nVegan, glutensiz, katkısız ve koruyucusuzdur; şeker ilavesi yoktur (doğal olarak şeker içerir). Yayla Agro Gıda tarafından Niğde’de üretilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B09HGNR5CY), ürün ambalajı ve üretici mağazası (yaylastore.com).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '25 g',
    packaging: 'Paket',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1997, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 477, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 3.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 70, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 13, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 15, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 14, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['vegan', 'gluten-free', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Seri', value: 'Enfies' },
      { key: 'Ürün Tipi', value: 'Dondurularak kurutulmuş mısır (freeze-dried)' },
      { key: 'Net Miktar', value: '25 g' },
      { key: 'Sebze Oranı', value: '%100' },
      { key: 'Taze Sebze Karşılığı', value: '11 kat taze sebze' },
      { key: 'Ambalaj', value: 'Paket' },
      { key: 'Üretim Yeri', value: 'Türkiye (yerli ve ithal hammadde)' },
      { key: 'Üretici', value: 'Yayla Agro Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Niğde Organize Sanayi Bölgesi 12. Cadde No: 1, Merkez / Niğde',
      },
      { key: 'Danışma Hattı', value: '444 4 330' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-51-K-006543' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: 'B09HGNR5CY' },
      { key: 'Amazon Satış Biçimi', value: 'Tekli paket (25 g)' },
      {
        key: 'Ürün Beyanları',
        value:
          'İçinde sadece doğallık var: %100 sebze, taze sebzeden üretilmiştir, yüksek lif, 11 kat taze sebze, şeker ilavesiz, vegan, glutensiz, katkısız, koruyucusuz',
      },
      { key: 'Şeker Beyanı', value: 'Şeker ilavesi yoktur; doğal olarak şeker içerir' },
      { key: 'Ambalaj Bilgisi', value: 'TETT ve parti numarası ambalajın üzerindedir' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 80,06 TL (3 Kasım 2026)' },
    ],
    warnings: [
      { severity: 'low' as const, text: 'Ambalajı açılmış, delinmiş veya yırtılmış ürünleri satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünleri tüketmeyiniz.',
      },
    ],
    storage:
      'Ambalajı açmadan önce güneş görmeyen, serin ve kuru bir yerde; açtıktan sonra hava almayacak şekilde muhafaza ediniz.',
    model: 'B09HGNR5CY',
    sku: 'AMZ-B09HGNR5CY',
    prices: [{ amount: 80.06, date: '2026-11-03T00:00:00.000Z' }],
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
