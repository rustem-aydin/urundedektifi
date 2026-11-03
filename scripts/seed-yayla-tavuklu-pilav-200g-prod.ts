import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Tavuklu Pilav 200 g (tekli paket) ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, etiket fotoğrafları ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0BQ76PCGH + ürün ambalajı (EAN-13 8693374268491).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-tavuklu-pilav-200g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-tavuklu-pilav-200g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374268491'
const ASIN = 'B0BQ76PCGH'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-tavuklu-pilav-200g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Tavuklu Pilav 200 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Tavuklu Pilav 200 g içindekiler listesi (pirinç %27, tavuk göğüs eti %11)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Tavuklu Pilav 200 g besin değerleri tablosu (100 g ve 200 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: "Yayla Tavuklu Pilav 200 g geri dönüşüm ve ambalaj sembolleri (PP 5, BPA'sız)",
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Tavuklu Pilav 200 g arka yüz: içindekiler, besin değerleri, saklama, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Tavuklu Pilav 200 g barkod numarası 8693374268491',
  },
] as const

/** Ambalajdan okunan içindekiler: "Pirinç (%27), su, tavuk göğüs eti (%11), nohut, bitkisel yağ (ayçiçek yağı), tuz." */
const INGREDIENTS = [
  { id: 673, name: 'pirinç', percent: 27 },
  { id: 278, name: 'Su', percent: null },
  { id: 3330, name: 'tavuk göğsü', percent: 11 },
  { id: 1170, name: 'Nohut', percent: null },
  { id: 298, name: 'Ayçiçek yağı', percent: null },
  { id: 137, name: 'tuz', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 24 // Hazır Yemek
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
    name: 'Yayla Tavuklu Pilav 200 g',
    description:
      "Yayla Tavuklu Pilav, 3 katlı BPA'sız koruyucu ambalajda paketlenmiş hazır tavuklu pirinç pilavıdır. 200 g'lık tekli paket bir porsiyondur; ambalajı açmadan mikrodalgada 2 dakikada, tencerede 3 dakikada veya kaynar suda 5 dakikada ısıtılır. Pirinç (%27) ve tavuk göğüs eti (%11) ile nohut içerir.\n\nEtikette koruyucu ve renklendirici içermediği, helal olduğu ve ambalajın BPA'sız olduğu beyan edilir. Ev yapımı tadında, pratik bir öğün olarak sunulur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0BQ76PCGH) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '200 g',
    packaging: "3 katlı BPA'sız esnek ambalaj (retort poşet)",
    items: INGREDIENTS.map((entry) =>
      entry.percent === null
        ? { ingredients: entry.id }
        : { ingredients: entry.id, percent_estimate: entry.percent },
    ),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 669, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 159, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 22.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.9, unit: 'g' },
      ],
    },
    labels: ['halal-certified', 'bpa-free', 'recyclable'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Hazır pilav (tavuklu, ısıtılıp tüketilir)' },
      { key: 'Aroma', value: 'Doğal' },
      { key: 'Net Miktar', value: '200 g' },
      { key: 'Porsiyon', value: '1 porsiyon = 1 paket (200 g)' },
      {
        key: 'Ambalaj',
        value: "3 katlı BPA'sız koruyucu ambalaj (retort poşet)",
      },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mah. 102099. Sk. No:1 Toroslar / Mersin' },
      { key: 'Tüketici Hattı', value: '0 324 221 62 76' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Diyet Türü', value: 'Helal' },
      { key: 'Katkı Beyanı', value: 'Koruyucu ve renklendirici içermez' },
      { key: 'Ambalaj Sembolleri', value: "PP 5 geri dönüşüm, BPA'sız, gıda ile temasa uygun" },
      {
        key: 'Isıtma',
        value:
          'Mikrodalga (ambalaj 2-3 cm açık, dik) 2 dakika; tencerede 3 dakika; ambalaj açılmadan kaynar suda 5 dakika',
      },
      {
        key: 'Amazon Üretici Adresi',
        value:
          'Amazon.com.tr "Üreticinin İletişim Bilgileri" alanında Saray Mah. FSM Bul. No:327 Kahramankazan / Ankara yazıyor; ambalajda Mersin adresi basılı.',
      },
      {
        key: 'İçindekiler Sırası Notu',
        value:
          'Amazon.com.tr içindekiler listesi su ile başlıyor; ambalajda sıra "Pirinç (%27), su, tavuk göğüs eti (%11), nohut, bitkisel yağ (ayçiçek yağı), tuz" şeklindedir.',
      },
      {
        key: 'Besin Değerleri Notu',
        value:
          'Etiketteki değer sütunu bir satır kaymış basılmıştır; eşleştirme %RA/%RI oranlarıyla doğrulanmıştır (yağ 5,0 g %7, doymuş 0,7 g %3, karbonhidrat 22,6 g %9, lif 3,5 g %14, protein 4,2 g %8, tuz 0,9 g %14).',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — Tekli paket 56,97 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Şişmiş, sızdıran veya hasarlı ambalajdaki ürün tüketilmemelidir.',
      },
      {
        severity: 'low' as const,
        text: "Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir; açıldıktan sonra buzdolabında (+4 °C) saklanıp 2 gün içinde tüketilmelidir.",
      },
    ],
    storage:
      "Oda sıcaklığında, güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.",
    usage:
      '1) Paketi hafifçe eziniz, ambalajı 2-3 cm açarak dik olarak mikrodalga fırında 2 dakika ısıtabilirsiniz.\n2) Tencereye dökerek 3 dakika ısıtabilirsiniz.\n3) Ambalajı açmadan kaynar suda 5 dakika bekletebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 56.97, date: '2026-11-03T00:00:00.000Z' }],
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
