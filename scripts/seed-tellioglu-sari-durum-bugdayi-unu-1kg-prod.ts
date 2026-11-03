import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Tellioğlu Sarı Durum Buğdayı Unu 1 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0913D7F1K + ürün ambalajı (EAN-13 8691533124374).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-tellioglu-sari-durum-bugdayi-unu-1kg-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-tellioglu-sari-durum-bugdayi-unu-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691533124374'
const ASIN = 'B0913D7F1K'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'tellioglu-sari-durum-bugdayi-unu-1kg',
)

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg içindekiler: durum buğdayı unu, askorbik asit, vitamin (B2, B9) ve demir',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg TSE, TS 4500, Türk Malı ve ambalaj sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg arka yüz: içindekiler, besin değerleri, üretici, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg barkod numarası 8691533124374',
  },
] as const

/** Etiketten okunan içindekiler: "Durum Buğdayı Unu (gluten), Askorbik Asit (E300),
 *  Vitamin (B2(Riboflavin), B9(Folik Asit)), Demir." */
const NEW_INGREDIENTS = [
  {
    name: 'Durum Buğdayı Unu',
    slug: 'durum-bugdayi-unu',
    aliases: ['Durum Buğday Unu', 'Durum Unu', 'Durum Buğdayı Unu (gluten)'],
  },
] as const

const INGREDIENTS = [
  { id: 1158, name: 'askorbik asit' },
  { id: 650, name: 'Riboflavin' },
  { id: 649, name: 'Folik asit' },
  { id: 571, name: 'Demir' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 990 // Tellioğlu
const CATEGORY_ID = 52 // Baklagil & Tahıl › Un & İrmik
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten
const ADDITIVE_E300_ID = 48 // E300 Askorbik Asit

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
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

async function ensureIngredient(client: PayloadClient): Promise<number> {
  const entry = NEW_INGREDIENTS[0]
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    aliases: entry.aliases.map((alias) => ({ alias })),
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
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const durumFlourId = await ensureIngredient(client)
  for (const entry of INGREDIENTS) await assertIngredient(client, entry.id, entry.name)

  const media = await ensureMedia(client)

  const itemIds = [durumFlourId, ...INGREDIENTS.map((entry) => entry.id)]

  const data = {
    barcode: BARCODE,
    name: 'Tellioğlu Sarı Durum Buğdayı Unu 1 kg',
    description:
      "Tellioğlu Sarı Durum Buğdayı Unu, durum buğdayının öğütülmesiyle elde edilen 1 kg'lık sarı un paketidir. Ambalajda 'Yüksek Proteinli' rozeti, 'Özenle toplanan tahıllar, el değmeden sofranızda' ifadesi ve '1982'den bugüne' marka notu bulunur. Etiket 100 g için 12,5 g protein ve 71 g karbonhidrat beyan eder.\n\nİçindekiler durum buğdayı unu (gluten), askorbik asit (E300), vitamin (B2 riboflavin, B9 folik asit) ve demirdir; ürün glüten içerir. Ambalajda TSE, TS 4500 ve Türk Malı işaretleri ile 'yerli ve/veya ithal buğdaylardan Türkiye'de üretilmiştir' beyanı yer alır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0913D7F1K) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'TELLİOĞLU YEM - GIDA ENTEGRE TESİSLERİ SAN. VE TİC. A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Un paketi',
    items: itemIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [ADDITIVE_E300_ID],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1453, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 346, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 71, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.12, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Tellioğlu' },
      { key: 'Ürün Tipi', value: 'Un' },
      { key: 'Un Çeşidi', value: 'Sarı Durum Buğdayı Unu' },
      { key: 'Net Miktar', value: '1 kg (1000 g)' },
      { key: 'Ambalaj', value: 'Un paketi (1 kge)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'TELLİOĞLU YEM - GIDA ENTEGRE TESİSLERİ SAN. VE TİC. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Paşa Alanı Mah. Balıkesir-Bursa Yolu Cad. No:216/1 Karesi / Balıkesir',
      },
      { key: 'Tüketici Hattı', value: '0266 246 14 50' },
      { key: 'Faks', value: '0266 274 50 03' },
      { key: 'E-posta', value: 'tellioglu@tellioglu.com.tr' },
      { key: 'Web', value: 'www.tellioglu.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-10-K-000610' },
      {
        key: 'Sertifikalar',
        value: 'ISO 22000 Gıda Güvenliği, ISO 9001 Kalite Yönetim Sistemi, TSE TS 4500',
      },
      {
        key: 'Uygunluk Beyanı',
        value: "Türk Gıda Kodeksi'ne uygundur; yerli ve/veya ithal buğdaylardan Türkiye'de üretilmiştir",
      },
      { key: 'Protein (K.M.\'de)', value: 'Min. %12,5' },
      { key: 'Kül (K.M.\'de)', value: 'Max. %0,8' },
      { key: 'Rutubet Esası', value: '%14,5 (paketleme esası)' },
      { key: 'Ön Yüz Rozeti', value: 'Yüksek Proteinli' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'Yağmurdan koruyun, güneş ışığından koruyun, çöp kutusu (Tidyman), CEVKO, gıda ile temasa uygun (çatal-bardak)',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ağırlığı', value: '1,02 kg' },
      {
        key: 'Amazon Başlığı',
        value: "Amazon.com.tr'de 'Tellioğlu Sarı Sert Buğday Unu 1 Kg' yazıyor; ambalajda 'Sarı Durum Buğdayı Unu' basılı",
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 141,55 TL (141,55 TL/kg, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (durum buğdayı) içerir. Çölyak hastalığı veya gluten hassasiyeti olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) ve parti numarası ambalajın üzerindedir; TETT geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage: 'Serin, kuru ve güneş ışığı almayan yerde muhafaza ediniz.',
    usage: 'Kullanmadan önce eleyiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 141.55, date: '2026-11-03T00:00:00.000Z' }],
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
