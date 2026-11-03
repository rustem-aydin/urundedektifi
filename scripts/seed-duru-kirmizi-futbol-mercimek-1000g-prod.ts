import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Duru Yerli Kırmızı Futbol Mercimek 1000 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B00OLKEKZ6 + ürün ambalajı (EAN-13 8691440710349).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-duru-kirmizi-futbol-mercimek-1000g-prod.ts
 *   veya SEED_EMAIL / SEED_PASSWORD ile.
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691440710349'
const GTIN = '8691440710349'
const ASIN = 'B00OLKEKZ6'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'duru-kirmizi-futbol-mercimek-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 1000 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Duru Kırmızı Futbol Mercimek 1000 g içindekiler: kırmızı iç mercimek (Round Red Lentils)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Duru Kırmızı Futbol Mercimek 1000 g besin değerleri tablosu (100 g pişmemiş ürün)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Duru Kırmızı Futbol Mercimek 1000 g geri dönüşüm ve ambalaj sembolleri (UCSA, PP 5)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Duru Kırmızı Futbol Mercimek 1000 g arka yüz: içindekiler, besin değerleri, saklama ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Duru Kırmızı Futbol Mercimek 1000 g barkod numarası 8691440710349',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 3059 // Kırmızı Mercimek (kirmizi-mercimek)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 606 // Duru
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
} as const

/** EAN-13 kontrol hanesi. */
function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`Geçersiz EAN-13: ${code}`)
  const digits = [...code].map(Number)
  const check = digits.pop()!
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== check) throw new Error(`EAN-13 kontrol hanesi hatalı: ${code}`)
}

async function ensureMedia(client: PayloadClient): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of IMAGES) {
    const alt = ALT[image.key]!
    const existing = await client.findOne('media', { alt: { equals: alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_DIR, image.file), { alt })
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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Duru Yerli Kırmızı Futbol Mercimek 1000 g',
    description:
      "Duru Yerli Kırmızı Futbol Mercimek, Türkiye'de yetiştirilen kırmızı mercimeğin kabuğu alınmış, yuvarlak (futbol) taneli hâlidir. Tek içindekiler maddesinden oluşur; katkı maddesi, koruyucu ve tuz eklenmemiştir. Etiket beyanına göre yüksek oranda protein ve lif içerir.\n\nÇorba, salata ve bulgur pilavı gibi yemeklerde kullanılır; pişirmeden önce yıkanır. 100 g pişmemiş üründe 24,6 g protein, 8,8 g lif ve 1468 kJ (347 kcal) enerji bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00OLKEKZ6, model BLY010) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Duru Bulgur Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Plastik paket (PP 5)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1468, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 347, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 52.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 24.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.6, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Duru' },
      { key: 'Ürün Tipi', value: 'Kırmızı mercimek (kabuğu alınmış, yuvarlak taneli)' },
      { key: 'Çeşit', value: 'Futbol mercimek (yerli)' },
      { key: 'Net Miktar', value: '1000 g' },
      { key: 'Ambalaj', value: 'Plastik paket (PP 5)' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'Duru Bulgur Gıda San. ve Tic. A.Ş.' },
      { key: 'Üretici Adresi', value: 'Organize Sanayi Bölgesi 20. Cadde No: 17, Karaman / Türkiye' },
      { key: 'Telefon', value: '+90 338 224 10 81' },
      { key: 'Faks', value: '+90 338 224 10 85' },
      { key: 'Tüketici Hattı', value: '444 1 338' },
      { key: 'E-posta', value: 'duru@durubulgur.com' },
      { key: 'Web', value: 'www.durubulgur.com' },
      { key: 'Tarif Sitesi', value: 'www.durulezzetler.com' },
      { key: 'İşletme Kayıt No', value: 'TR-70-K-004214' },
      {
        key: 'AB İthalatçısı',
        value: 'Durkar Lebensmittel GmbH, Im Media Park 8, 50670 Köln / Almanya (www.durkargmbh.com)',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Model Numarası', value: 'BLY010' },
      { key: 'Ürün Ölçüleri', value: '22,7 × 15,8 × 5,3 cm' },
      { key: 'Paket Ağırlığı', value: '1,01 kg' },
      {
        key: 'Besin Değerleri Bazı',
        value: '100 g pişmemiş (çiğ) kırmızı iç mercimek için',
      },
      { key: 'Protein ve Lif Beyanı', value: 'Yüksek oranda protein ve lif içerir' },
      { key: 'Ambalaj Sembolleri', value: 'UCSA, Tidyman, gıda ile temasa uygunluk, PP 5 geri dönüşüm' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 107,09 TL / kg (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Çiğ tüketilmez; yıkanıp pişirilerek tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj hasarlı veya açılmışsa ürünü satın almayınız; TETT (tavsiye edilen tüketim tarihi) geçmeden tüketiniz.',
      },
    ],
    storage: 'Güneş ışığı almayan, serin ve rutubetsiz yerde saklayınız.',
    usage:
      'Kırmızı futbol mercimeklerini yıkayın ve pişirin. Etiketteki Kırmızı Mercimek Çorbası tarifi: 1,5 su bardağı Duru Yerli Kırmızı Futbol Mercimek, 5 bardak kaynar su, yarım yemek kaşığı salça, 1 yemek kaşığı tereyağı, 1 tatlı kaşığı nane ve 1 tatlı kaşığı pul biber. Mercimeği yıkayın; nane ve pul biber hariç bütün malzemeleri ekleyerek tencerede (düdüklü) pişirin. Piştikten sonra blenderdan geçirin, nane ve pul biberi ekleyerek sıcak servis edin.',
    model: 'BLY010',
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 107.09, date: '2026-11-03T00:00:00.000Z' }],
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
