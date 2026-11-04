import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Dola Soya Fasulyesi 400 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0CHZ29R94 + ürün ambalajı (EAN-13 8681314066849).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-dola-soya-fasulyesi-400g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8681314066849'
const ASIN = 'B0CHZ29R94'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'dola-soya-fasulyesi-400g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Dola Soya Fasulyesi 400 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Dola Soya Fasulyesi 400 g içindekiler: soya fasulyesi (Ingredients: Soybeans)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Dola Soya Fasulyesi 400 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Dola Soya Fasulyesi 400 g arka yüz: içindekiler, besin değerleri, saklama ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Dola Soya Fasulyesi 400 g barkod numarası 8681314066849',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 3648 // Soya fasulyesi (soya-fasulyesi)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 5576 // Dola
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const SOY_ALLERGEN_ID = 10 // Soya

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
    name: 'Dola Soya Fasulyesi 400 g',
    description:
      "Dola Soya Fasulyesi, Türkiye'de yetiştirilen bütün soya fasulyesinin 400 g'lık paketidir. Tek bileşenden oluşur; katkı maddesi, tuz ve koruyucu içermez. Ambalajda ürün «Yüksek Protein • Glutensiz • Vegan» olarak tanımlanır; 100 g'ında 36 g protein ve 9 g lif bulunur.\n\nKuru bakliyat olarak pişirilerek tüketilir; soya fasulyesi doğal olarak glutensizdir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CHZ29R94) ve ürün ambalajı (EAN-13 8681314066849).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '400 g',
    packaging: 'Plastik ambalaj (poşet)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    allergens: SOY_ALLERGEN_ID,
    additives: [] as number[],
    labels: ['gluten-free', 'vegan'],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 446, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 20, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 2.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 30, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 36, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Dola' },
      { key: 'Ürün Tipi', value: 'Soya fasulyesi (bütün tane, kuru bakliyat)' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (poşet); ambalajda «Tazeliğini Koruyan Ambalaj!» ibaresi var' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.' },
      {
        key: 'Üretici Adresi',
        value: 'Ostim OSB Mahallesi 243. Cadde No: 7, Yenimahalle / Ankara',
      },
      { key: 'Telefon / Faks', value: '+90 312 472 42 12' },
      { key: 'E-posta', value: 'info@dola.com.tr' },
      { key: 'Web', value: 'dolagida.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-06-K-029293' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Formu (Amazon)', value: 'Bütün' },
      { key: 'Birim Sayısı (Amazon)', value: '400 g (ürün ve paket ağırlığı 0,41 kg)' },
      {
        key: 'Beyanlar',
        value: 'Yüksek protein, glutensiz, vegan; 100 g\'da 36 g protein ve 9 g lif',
      },
      {
        key: 'Sertifika ve Uygunluk',
        value:
          'ISO 9001 Kalite Yönetim Sistemi, ISO 22000 Gıda Güvenliği Yönetim Sistemi, GMP İyi Üretim Uygulamaları, HACCP; helal gıda sertifikası. Türk Gıda Kodeksi\'ne uygun olarak üretilmiştir.',
      },
      {
        key: 'Besin Değerleri Bazı',
        value: '100 g ürün; ambalaj notu: «Enerji ve besin değerleri doğal ürünlerde küçük farklılıklar gösterebilir.»',
      },
      {
        key: 'Enerji Satırı Notu',
        value:
          'Etikette enerji tek satırda «Enerji (kJ/kcal): 446» olarak basılı. Makro besinlerden hesaplanan değer (30×4 + 36×4 + 20×9 ≈ 444 kcal) bunun kcal olduğunu doğruluyor; 446 kJ ≈ 107 kcal olurdu. kJ değeri etikette basılı olmadığı için kaydedilmedi.',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Geri dönüşüm sembolü, yerli üretim ibaresi; ayrıntılı ambalaj/geri dönüşüm sembolleri okunabilir çözünürlükte basılı olmadığı için sembol görseli eklenmedi',
      },
      {
        key: 'Kullanım Beyanı',
        value: 'Ambalajda pişirme/kullanım önerisi basılı değil',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 171,00 TL / 400 g (427,50 TL/kg), 4 Kasım 2026, stokta',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Soya içerir; soya alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'T.E.T.T. (tavsiye edilen tüketim tarihi) ve seri no ambalaj üzerindedir; son kullanma tarihi geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Serin ve kuru bir yerde, güneş ışığına maruz kalmayacak şekilde muhafaza ediniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 171, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
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
