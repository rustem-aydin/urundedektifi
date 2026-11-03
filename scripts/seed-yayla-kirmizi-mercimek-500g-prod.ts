import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Kırmızı Mercimek 500 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B09SLQK4FR + ürün ambalajı (EAN-13 8693374265698).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-kirmizi-mercimek-500g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-kirmizi-mercimek-500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374265698'
const ASIN = 'B09SLQK4FR'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-kirmizi-mercimek-500g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Kırmızı Mercimek 500 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Kırmızı Mercimek 500 g ürün tipi, sınıfı ve Gıda Kodeksi beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Kırmızı Mercimek 500 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Kırmızı Mercimek 500 g ambalaj sembolleri (PP 5 geri dönüşüm, gıda ile temasa uygun, helal, TSE)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Kırmızı Mercimek 500 g arka yüz: üretici, besin değerleri, saklama koşulu ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Kırmızı Mercimek 500 g barkod numarası 8693374265698',
  },
] as const

/** Etiketten okunan içindekiler: tek madde — mercimek. */
const INGREDIENTS = [{ id: 3059, name: 'Kırmızı Mercimek' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
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
  potassium: 35,
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

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0]
  if (!found) throw new Error(`İçindekiler kaydı yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`İçindekiler adı uyuşmuyor: ${id} → ${String(found.name)} ≠ ${name}`)
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
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  for (const entry of INGREDIENTS) await assertIngredient(client, entry.id, entry.name)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Kırmızı Mercimek 500 g',
    description:
      "Yayla Kırmızı Mercimek, ayıklanmış kırmızı iç mercimeğin 500 g'lık şeffaf ambalajda sunulduğu kuru baklagildir. 1. sınıf (TS 143) üründür ve Gıda Kodeksi Mercimek Tebliği'ne uygundur. Çorba, pilav, köfte ve salatalarda pişirilerek kullanılır; paket üzerinde 12 porsiyon bilgisi yer alır.\n\nBesin değeri bakımından lif (100 g'da 18,7 g), protein (25,8 g), potasyum (1004 mg) ve demir-çinko gibi mineraller açısından zengin bir baklagildir. Ambalajda koruyucu ve renklendirici içermediği beyan edilir; helal ve TSE işaretleri basılıdır.\n\nMenşei ambalajda Kanada olarak belirtilmiştir; ürün Türkiye'de (Ankara/Mersin) işlenip paketlenir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B09SLQK4FR) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Şeffaf plastik poşet (PP 5)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1360, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 323, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 41.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 18.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 25.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 1004, unit: 'mg' },
      ],
    },
    labels: ['halal-certified', 'no-additives'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Kırmızı mercimek (kuru baklagil)' },
      { key: 'Tip', value: 'Kırmızı İç Mercimek' },
      { key: 'Sınıf', value: '1. Sınıf TS 143' },
      { key: 'Net Miktar', value: '500 g' },
      { key: 'Porsiyon', value: '12 porsiyon (ambalaj üzerindeki bilgi)' },
      { key: 'Ambalaj', value: 'Şeffaf plastik poşet (PP 5)' },
      { key: 'Menşei', value: 'Kanada (ambalaj üzerinde)' },
      { key: 'Üretim Yeri', value: "Türkiye (Ankara ve Mersin fabrikaları)" },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mah. Fatih Sultan Mehmet Bul. No:327 Kahramankazan / Ankara',
      },
      { key: 'Mersin Fabrikası', value: 'Yalınayak Mah. 102099. Sk. No:1 Toroslar / Mersin' },
      { key: 'Tüketici Hattı', value: '0 312 815 49 50 (faks 0 312 815 47 90)' },
      { key: 'Web', value: 'www.yaylaagro.com' },
      { key: 'İşletme Kayıt No', value: '(ANK) TR-06-K-000171 / (MER) TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Gıda Kodeksi Mercimek Tebliğine uygundur" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '14,4 × 9 × 5,5 cm; 160 g (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Katkı Beyanı',
        value: 'Koruyucu ve Renklendirici içermez (ambalaj/kolide beyan)',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5 geri dönüşüm, gıda ile temasa uygun (çatal-bardak), güneşten ve nemden koruyun, helal, TSE',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — listeleme 3 Kasım 2026 itibarıyla "Şu anda mevcut değil", fiyat yok',
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
      {
        severity: 'low' as const,
        text: 'Çiğ baklagil pişirilerek tüketilmelidir; pişirmeden yemeyiniz.',
      },
    ],
    storage:
      'Lütfen rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
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
