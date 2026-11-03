import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Sarı Kırık Bezelye 500 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, etiket fotoğrafları ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08PL4VR6J + ürün ambalajı (EAN-13 8693374239279).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-gurme-sari-kirik-bezelye-500g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-gurme-sari-kirik-bezelye-500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374239279'
const ASIN = 'B08PL4VR6J'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-sari-kirik-bezelye-500g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Gurme Sarı Kırık Bezelye 500 g ön yüz' },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Sarı Kırık Bezelye 500 g besin değerleri tablosu (pişmemiş 100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Gurme Sarı Kırık Bezelye 500 g geri dönüşüm ve ambalaj sembolleri (PP 5, 2502, helal)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Sarı Kırık Bezelye 500 g arka yüz: menşe haritası, net ağırlık, üretici ve saklama bilgisi',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Sarı Kırık Bezelye 500 g barkod numarası 8693374239279',
  },
] as const

/** Ambalaj tek içindekili üründür: "Sarı kırık bezelye". */
const INGREDIENT = {
  id: null,
  name: 'Sarı kırık bezelye',
  slug: 'sari-kirik-bezelye',
  aliases: ['Yellow split peas', 'Kırık bezelye', 'Sarı bezelye'],
} as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1027 // Yayla Gurme
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye (üretim yeri; menşe Rusya)

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

async function ensureIngredient(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: INGREDIENT.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: INGREDIENT.name,
    slug: INGREDIENT.slug,
    aliases: INGREDIENT.aliases.map((alias) => ({ alias })),
  })
  console.log(`  + içindekiler: ${INGREDIENT.name} (${created.id})`)
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

  const ingredientId = await ensureIngredient(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Sarı Kırık Bezelye 500 g',
    description:
      "Yayla Gurme Sarı Kırık Bezelye, Rusya menşeli sarı kırık bezelyenin 500 g'lık tekli paketidir. Tek içindekili (sarı kırık bezelye) kuru baklagildir; Mersin'deki Yayla tesislerinde paketlenir. Etikette lif kaynağı ve vegan olarak tanımlanır, '1982'den beri' ve 'Yeni' rozetleri taşır.\n\nÇorba, yemek ve pürelerde kullanılan kırık bezelye, pişirmeden önce yıkanıp ıslatılarak hazırlanır. Ambalajda güneş görmeyen serin bir yerde, mümkünse bez torbada saklanması önerilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08PL4VR6J) ve ürün ambalajı (EAN-13 8693374239279).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Şeffaf pencereli plastik poşet (PP 5)',
    items: [{ ingredients: ingredientId }],
    additives: [] as number[],
    /* Etiket değerleri pişmemiş (çiğ) 100 g içindir. */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1416, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 334, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 61.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 21.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.2, unit: 'g' },
      ],
    },
    labels: ['vegan', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Kuru baklagil (sarı kırık bezelye)' },
      { key: 'Net Miktar', value: '500 g' },
      { key: 'Menşei', value: 'Rusya (ambalajdaki menşe haritası: Yellow Split Peas / Russia)' },
      { key: 'Ambalaj', value: 'Şeffaf pencereli plastik poşet (PP 5)' },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No:1, Toroslar / Mersin',
      },
      { key: 'Tüketici Danışma Hattı', value: '+90 324 221 62 76 (pbx) — Faks: +90 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr — yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      {
        key: 'Etiket Beyanları',
        value: "Lif kaynağı (Fiber Source), vegan, 1982'den beri, Yeni (New)",
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          '5 PP, 2502, gıda ile temasa uygunluk (çatal-bardak), evsel atık, güneşten koruyunuz, kuru tutunuz, helal',
      },
      {
        key: 'Besin Tablosu',
        value:
          'Etiket değerleri pişmemiş (çiğ) 100 g içindir; ambalajda porsiyon ve %RA sütunu bulunmuyor.',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor',
      },
      {
        key: 'TETT Notu',
        value:
          'Tavsiye edilen tüketim tarihi (TETT), parti no. (P.N.), ürün yılı ve menşe ülke ambalaj üzerindedir',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ağırlığı', value: '0,52 kg (Amazon.com.tr); paket ağırlığı 0,49 kg' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 116,81 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT), parti numarası ve ürün yılı ambalaj üzerindedir; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Güneş görmeyen serin bir yerde muhafaza ediniz, mümkünse bez torbada saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 116.81, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: menşe haritası, net ağırlık, üretici, saklama ve ambalaj sembolleri',
      },
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
