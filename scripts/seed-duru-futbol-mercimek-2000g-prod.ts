import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Duru Yerli Kırmızı Futbol Mercimek 2000 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0C5BKVP6M + ürün ambalajı (EAN-13 8691440308942).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 * Kardeş kayıt: 1 kg paket (id 18375, EAN 8691440710349) ayrı üründür; bu 2 kg kendi EAN'ini taşır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-duru-futbol-mercimek-2000g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-duru-futbol-mercimek-2000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691440308942'
const ASIN = 'B0C5BKVP6M'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'duru-futbol-mercimek-2000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g içindekiler beyanı (Kırmızı İç Mercimek / Round Red Lentils)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g besin değerleri tablosu (100 g pişmemiş)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g ambalaj sembolleri (PP 5 geri dönüşüm, gıda ile temasa uygun)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g arka yüz: içindekiler, besin değerleri, üretici, tarif ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g barkod numarası 8691440308942',
  },
] as const

/** Etiketten okunan içindekiler: "Kırmızı İç Mercimek / Round Red Lentils". */
const INGREDIENTS = [{ id: 3059, name: 'Kırmızı Mercimek' }] as const

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
    name: 'Duru Yerli Kırmızı Futbol Mercimek 2000 g',
    description:
      "Duru Yerli Kırmızı Futbol Mercimek, kabuğu alınmış yuvarlak taneli yerli kırmızı iç mercimeğin 2000 g'lık (2 kg) paketidir. Protein ve lif oranı yüksektir (100 g pişmemiş üründe 24,6 g protein, 8,8 g lif); çorba, salata ve bulgur pilavlarında kullanılır. Ambalajın arkasında Kırmızı Mercimek Çorbası tarifi yer alır.\n\nGüneş ışığı almayan, serin ve rutubetsiz ortamda saklandığında son tüketim tarihine kadar tazeliğini korur. Tek içeriklidir; katkı maddesi içermez.\n\nAynı ürünün 1 kg paketi ayrı bir kayıttır (EAN 8691440710349); 2 kg paket kendi barkodunu taşır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0C5BKVP6M) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Duru Bulgur Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '2000 g',
    packaging: 'Plastik paket (PP 5)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
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
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Duru' },
      { key: 'Ürün Tipi', value: 'Kırmızı mercimek (kabuğu alınmış, yuvarlak taneli)' },
      { key: 'Çeşit', value: 'Futbol mercimek (yerli)' },
      { key: 'Net Miktar', value: '2000 g (2 kg)' },
      { key: 'Ambalaj', value: 'Plastik paket (PP 5)' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'Duru Bulgur Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Organize Sanayi Bölgesi 20. Cadde No: 17, Karaman / Türkiye',
      },
      { key: 'Telefon', value: '+90 338 224 10 81' },
      { key: 'Tüketici Hattı', value: '444 1 338' },
      { key: 'E-posta', value: 'duru@durubulgur.com' },
      { key: 'Web', value: 'www.durubulgur.com' },
      { key: 'Tarif Sitesi', value: 'www.durulezzetler.com' },
      { key: 'İşletme Kayıt No', value: 'TR-70-K-004214' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value:
          '27,8 × 20,9 × 5,2 cm; 450 g (Amazon.com.tr ürün detayı — 2 kg paket için ağırlık bilgisi tutarsız)',
      },
      {
        key: 'Besin Değeri Notu',
        value: 'Değerler 100 g pişmemiş kırmızı iç mercimek içindir (ambalaj: "100 g pişmemiş")',
      },
      { key: 'Katkı Beyanı', value: 'Tek içerikli ürün; katkı maddesi içermez' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5 geri dönüşüm, gıda ile temasa uygun (çatal-bardak), çöp adam, UCSA Bulgur (16 10 4 001194)',
      },
      {
        key: 'Amazon Satış Biçimi',
        value: '2 kg tek paket (3\'lü paket varyantı ayrı ASIN: B0GYV9K563)',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 292,58 TL (146,29 TL/kg, 4 Kasım 2026)',
      },
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
      'Kırmızı futbol mercimeklerini yıkayın ve pişirin. Etiketteki Kırmızı Mercimek Çorbası tarifi: 1,5 su bardağı Duru Yerli Kırmızı Futbol Mercimek, 5 bardak kaynar su, yarım yemek kaşığı salça, 1 yemek kaşığı tereyağı, 1 tatlı kaşığı nane ve 1 tatlı kaşığı pul biber. Mercimeği yıkayın; nane ve pul biber hariç bütün malzemeleri ekleyerek basınçlı (düdüklü) tencerede pişirin. Piştikten sonra blenderdan geçirin, nane ve pul biberi ekleyerek sıcak servis edin.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 292.58, date: '2026-11-04T00:00:00.000Z' }],
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
