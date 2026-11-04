import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Pol's Freeze Fresh Dondurularak Kurutulmuş Kivi 20 g ürününü UZAK Payload
 * REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0BT9QS7BJ + ürün ambalajının ön/arka yüzü
 * (EAN-13 8682169337061). Prod'da bu barkod yok; betik yeni kayıt açar.
 * Kardeş kayıtlar: Pols Freeze Fresh Golden Mix 20 g (16362) ve Çilek & Muz
 * 20 g (16361) aynı kategori 20 ve marka 1848 ile duruyor.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekiler kayıtlarını slug üzerinden doğrular.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-pols-dondurularak-kurutulmus-kivi-20g-prod.ts
 *   (veya SEED_EMAIL / SEED_PASSWORD)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8682169337061'
const ASIN = 'B0BT9QS7BJ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'pols-kivi-20g')
const PRODUCT_NAME = "Pols Freeze Fresh Dondurularak Kurutulmuş Kivi 20 g"

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
    file: 'pols-kivi-front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: Pol's Freeze Fresh logosu, dondurularak kurutulmuş kivi parçaları, 190 g taze kividen üretildiği, 20 g e, vegan ve glutensiz rozetleri`,
  },
  {
    key: 'ingredients',
    file: 'pols-kivi-ingredients.jpg',
    alt: `${PRODUCT_NAME} içindekiler satırı: TR İçindekiler: Kivi / EN Ingredients: Kiwi`,
  },
  {
    key: 'nutrition',
    file: 'pols-kivi-nutrition.jpg',
    alt: `${PRODUCT_NAME} enerji ve besin öğeleri tablosu: 100 g için 1499 kJ / 352 kcal, yağ, karbonhidrat, şeker, lif, protein ve tuz değerleri`,
  },
  {
    key: 'recycling',
    file: 'pols-kivi-recycling.jpg',
    alt: `${PRODUCT_NAME} ambalaj sembolleri: gıda temasına uygunluk ve ambalajı çöpe atmayın (tidyman) işaretleri`,
  },
  {
    key: 'back',
    file: 'pols-kivi-back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: içindekiler, besin tablosu, şeker ilavesiz beyanı, üretici bilgileri, saklama koşulları ve barkod`,
  },
  {
    key: 'barcode',
    file: 'pols-kivi-barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8682169337061`,
  },
] as const

/** Etiketten okunan içindekiler: tek madde, kivi. */
const INGREDIENTS = [{ id: 3638, name: 'Kivi', slug: 'kivi', percent: null }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1848 // Pols (kardeş freeze-dried kayıtlarıyla aynı marka)
const CATEGORY_ID = 20 // Meyve & Sebze (Pols Freeze Fresh kardeş kayıtları)
const COUNTRY_ID = 1 // Türkiye (etiket: Menşei/Origin TÜRKİYE)

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

async function assertIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (!existing) throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    const doc = existing as { id: number; name?: string; slug?: string }
    if (doc.slug !== entry.slug) {
      throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
    }
    if (entry.id !== null && doc.id !== entry.id) {
      throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
    }
    ids.push(doc.id)
  }
  return ids
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

  const ingredientIds = await assertIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Pol's Freeze Fresh Dondurularak Kurutulmuş Kivi, freeze dry (dondurarak kurutma) teknolojisiyle üretilen tek içerikli bir meyve atıştırmalığıdır; 20 g'lık tekrar kapatılabilir poşette satılır. Ambalaja göre 190 g taze kividen 20 g ürün elde edilir. İçindekiler yalnız kividir; ürün koruyucu ve renklendirici içermez, vegan ve glutensizdir. Şeker ilavesi yoktur; etiket \"doğal olarak şeker içerir\" beyanını taşır (100 g'da 37 g şeker). Lif içeriği 100 g'da 7 g'dır ve ambalaj \"yüksek lif\" beyanı taşır.\n\nKullanım: çıtır çıtır atıştırmalık olarak; smoothie, kokteyl ve salatalarda; trekking, yolculuk, spor, sinema, okul ve iş için pratik paket.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0BT9QS7BJ) ve ürün ambalajının ön/arka yüzü. Besin tablosu ambalajda hem 100 g hem 20 g (1 paket) için basılıdır; kayıt karşılaştırılabilirlik için 100 g değerlerini kullanır.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'POLS ERM TARIM A.Ş.',
    country: COUNTRY_ID,
    size: '20 g',
    packaging: 'Tekrar kapatılabilir lamine poşet ambalaj',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent ?? undefined,
    })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1499, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 352, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 86, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 37, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.3, unit: 'g' },
      ],
    },
    labels: ['vegan', 'gluten-free', 'no-additives'] as const,
    specifications: [
      { key: 'Marka', value: "Pol's (Freeze Fresh)" },
      { key: 'Ürün Tipi', value: 'Dondurularak kurutulmuş meyve (freeze-dried)' },
      { key: 'İngilizce Adı', value: 'Freeze Dried Kiwi' },
      { key: 'Net Miktar', value: '20 g (1 paket)' },
      { key: 'İçerik', value: 'Kivi (%100, tek içerik)' },
      { key: 'Hammadde Oranı', value: '190 g taze kividen 20 g dondurularak kurutulmuş kivi (ambalaj)' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Ambalaj', value: 'Tekrar kapatılabilir lamine poşet; gıda temasına uygunluk ve çöpe atmayın işaretleri' },
      { key: 'Üretici', value: 'POLS ERM TARIM A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Seyran Mahallesi Yağlısu Mevkii Küme Evler No: 4, 70400 Ermenek / Karaman / Türkiye',
      },
      { key: 'Telefon', value: '+90 338 716 46 85' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-70-K-004289' },
      { key: 'Tüketici Danışma Hattı', value: '0850 216 7657' },
      { key: 'Web', value: 'www.pols.com.tr' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ağırlığı', value: '20 g' },
      {
        key: 'Amazon Ölçü Seçenekleri',
        value:
          'Kivi 20 g (bu kayıt). Aynı seride İncir, Çilek, Muz, Vişne, Mango, Ananas, Portakal, Lime, Böğürtlen, Elma, Ahududu, Fruit Mix, Berry Mix ve Çıtır Küpler ayrı ASIN/EAN taşır',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 89,94 TL (20 g tekli paket, 4 Kasım 2026; 100 g başına 449,70 TL)',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalaj 100 g ve 20 g (1 paket) değerlerini verir; kayıt 100 g kullanır. 20 g: 300 kJ / 70 kcal, 0,1 g yağ, 17 g karbonhidrat, 7 g şeker, 1,4 g lif, 1 g protein, 0,06 g tuz',
      },
      { key: 'Şeker Beyanı', value: 'Şeker ilavesizdir; doğal olarak şeker içerir (100 g’da 37 g)' },
      { key: 'Gluten Beyanı', value: 'Glutensiz (ambalaj rozeti)' },
      { key: 'Vegan Beyanı', value: 'Vegan (ambalaj rozeti)' },
      { key: 'Katkı Beyanı', value: 'Koruyucu ve renklendirici içermez; katkısız' },
      { key: 'Sağlık Beyanları', value: 'Yüksek lif (100 g’da 7 g), sadece meyve' },
      {
        key: 'Teknoloji',
        value:
          'Freeze Dry (dondurarak kurutma); ambalaj: "Besin değerini koruyan kiviler, Freeze Dry Teknolojisi ile nefis ve çıtır çıtır birer atıştırmalığa dönüşüyor."',
      },
      {
        key: 'Servis Önerisi',
        value:
          'Çıtır çıtır atıştırmalık; smoothie, kokteyl ve salatalarda; trekking, yolculuk, spor, sinema, okul ve iş için pratik',
      },
      {
        key: 'TETT / Parti',
        value: 'Tavsiye edilen tüketim tarihi (T.E.T.T.) ve parti numarası (Lot No) ambalaj üzerindedir',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Kiviye alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Şeker ilavesi yoktur; ürün doğal olarak şeker içerir (100 g’da 37 g).',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalajın üzerindedir.',
      },
    ],
    storage:
      'Orijinal ambalajında ve açıldıktan sonra tekrar kapatılarak saklanmalıdır. Serin ve kuru yerde muhafaza ediniz.',
    usage:
      'Çıtır çıtır bir atıştırmalık olarak doğrudan tüketilebilir; smoothie, kokteyl ve salatalarda da kullanılır. Trekking, yolculuk, spor, sinema, okul ve iş için pratik paket.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 89.94, date: '2026-11-04T00:00:00.000Z' }],
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
