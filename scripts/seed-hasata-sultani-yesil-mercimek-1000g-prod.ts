import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Hasata Yozgat Sultani Yeşil Mercimek 1000 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0C1X7KCD9 + ürün ambalajı.
 * EAN-13 (8697423961883) ambalajdan okundu ve hasata.com.tr ürün sayfasındaki
 * JSON-LD `gtin13` alanıyla teyit edildi.
 *
 * NOT: Amazon URL'sinin kısa adı "Mardin Kırmızı Mercimek" diyor, ancak
 * ASIN B0C1X7KCD9'un sayfa başlığı, ambalaj ve marka sitesi "Yozgat Sultani
 * YEŞİL Mercimek 1 kg" ürününü gösteriyor. Kayıt sayfadaki/ambalajdaki ürünle açılır.
 *
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-hasata-sultani-yesil-mercimek-1000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8697423961883'
const ASIN = 'B0C1X7KCD9'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'hasata-sultani-yesil-mercimek-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g ürün adı ve net miktar (Yeşil Mercimek, 1 kg)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g arka yüz: besin değerleri, saklama, menşei ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g barkod numarası 8697423961883',
  },
] as const

/** Etiketten okunan içindekiler: tek madde — yeşil mercimek (Sultani). */
const INGREDIENTS = [{ id: 3064, name: 'Yeşil Mercimek' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1098 // Hasata
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
  phosphorus: 38,
  potassium: 35,
  magnesium: 40,
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
    name: 'Hasata Yozgat Sultani Yeşil Mercimek 1000 g',
    description:
      "Hasata Yozgat Sultani Yeşil Mercimek, Yozgat bölgesinde yetiştirilen Sultani yeşil mercimeğin 1 kg'lık zipli (aç-kapa) paketidir. Her paket aynı hasadın mahsulünü içerdiği için taneler eşit sürede pişer; parlak zümrüt yeşili rengi ve pişerken dağılmayan dolgun taneleriyle bilinir. 1. sınıf üründür.\n\nPotasyum, fosfor, magnezyum, protein ve lif kaynağıdır (100 g'da 23,7 g protein, 24,1 g lif). Kelebeklenmeyi (güve) önlemek için paketleme öncesinde tamamen doğal Kontrollü Atmosfer uygulaması yapılır; ürün kendi kilitli ambalajında, güve riski taşıyan diğer bakliyatlardan uzakta saklanır.\n\nNot: Bu kayıt Amazon.com.tr ASIN B0C1X7KCD9 sayfasındaki üründür; sayfa başlığı ve ambalaj 'Yozgat Sultani Yeşil Mercimek' der, bağlantı adresindeki 'Mardin Kırmızı Mercimek' ifadesi eski/kalıntı kısa addır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0C1X7KCD9), ürün ambalajı ve hasata.com.tr ürün sayfası (GTIN teyidi).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Tiryaki Perakende Gıda Ürünleri San. ve Tic. A.Ş. (Hasata)',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Plastik paket (zipli / aç-kapa)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1281, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 307, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 39.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 24.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 23.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 276.3, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 624, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 65.8, unit: 'mg' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Hasata' },
      { key: 'Ürün Tipi', value: 'Yeşil mercimek (Sultani)' },
      { key: 'Çeşit', value: 'Sultani yeşil mercimek' },
      { key: 'Sınıf', value: '1. Sınıf' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Ambalaj', value: 'Plastik paket, zipli (aç-kapa) kilitli ambalaj' },
      { key: 'Menşe Ülke', value: 'Türkiye (Yozgat)' },
      { key: 'Üretici', value: 'Tiryaki Perakende Gıda Ürünleri San. ve Tic. A.Ş. (Hasata)' },
      { key: 'Üretici Stok Kodu', value: '370034' },
      { key: 'Web', value: 'hasata.com.tr' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '21,2 × 15,1 × 6,8 cm; 1,01 kg (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Koruma Yöntemi',
        value: 'Kontrollü Atmosfer uygulaması (güve/kelebeklenme riskine karşı doğal yöntem)',
      },
      {
        key: 'Beyanlar',
        value:
          "Potasyum, protein, magnezyum, fosfor ve lif kaynağı; Türk Gıda Kodeksi Mevzuatına uygun olarak etiketlenmiştir",
      },
      {
        key: 'Amazon Sayfa Notu',
        value:
          "Amazon URL kısa adı 'Mardin Kırmızı Mercimek' diyor; ASIN B0C1X7KCD9 sayfa başlığı ve ambalaj 'Yozgat Sultani Yeşil Mercimek 1000 g'",
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr listesi 4 Kasım 2026 itibarıyla "Şu anda mevcut değil"; resmi site hasata.com.tr 169,95 TL',
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
      {
        severity: 'low' as const,
        text: 'Ürünü kendi kilitli ambalajında, güve (kelebeklenme) riski taşıyan diğer bakliyatlardan uzakta saklayınız.',
      },
    ],
    storage:
      'Serin ve kuru ortamda, güneş ışığından uzak bir yerde saklanmalıdır. Ürünü kendi kilitli ambalajında, diğer bakliyatlardan ayrı tutunuz.',
    usage:
      'Mercimekleri kullanmadan önce bol soğuk suda yıkayınız. Önceden suda bekletmeye gerek olmadan pişirebilirsiniz. Kısa süre haşlayıp suyunu süzdükten sonra kullanırsanız yemeğiniz daha parlak olacaktır.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 169.95, date: '2026-11-04T00:00:00.000Z' }],
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
