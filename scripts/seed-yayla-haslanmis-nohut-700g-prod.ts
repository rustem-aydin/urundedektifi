import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Nohut 700 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07SQJGD5W + ürün ambalajı (EAN-13 8693374253589).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-haslanmis-nohut-700g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-haslanmis-nohut-700g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374253589'
const ASIN = 'B07SQJGD5W'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-haslanmis-nohut-700g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Haşlanmış Nohut 700 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Nohut 700 g içindekiler ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Nohut 700 g besin değerleri tablosu (100 g ve 130 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Haşlanmış Nohut 700 g geri dönüşüm ve ambalaj sembolleri (PP 5, BPA içermez)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Nohut 700 g arka yüz: içindekiler, besin değerleri, saklama, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Nohut 700 g barkod numarası 8693374253589',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan içindekiler: "Haşlanmış Nohut (%57), su, tuz." */
const INGREDIENTS = [
  { id: 1170, name: 'Nohut', percent: 57 },
  { id: 278, name: 'Su', percent: null },
  { id: 137, name: 'tuz', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 20 // Meyve & Sebze (haşlanmış baklagil konserve grubu ile tutarlı)
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
    name: 'Yayla Haşlanmış Nohut 700 g',
    description:
      "Yayla Haşlanmış Nohut, haşlanıp 4 katlı BPA'sız koruyucu ambalajda paketlenmiş hazır nohuttur. 700 g net (400 g süzme) ürün içerir; ambalajın içindeki suyu da yemeklerde kullanabilirsiniz. Pilav, çorba, salata ve mezelere açıp doğrudan eklenir; ıslatma veya haşlama gerekmez.\n\nEtikette koruyucu ve renklendirici içermediği, vegan olduğu ve helal sertifikalı olduğu beyan edilir. Yağ, doymuş yağ ve şeker bakımından düşüktür; lif kaynağı ve protein kaynağıdır (100 g'da 8 g lif, 8 g protein).\n\nVeri kaynağı: Amazon.com.tr (ASIN B07SQJGD5W) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '700 g',
    packaging: "4 katlı BPA'sız plastik poşet (konserve tipi esnek ambalaj)",
    items: INGREDIENTS.map((entry) =>
      entry.percent === null
        ? { ingredients: entry.id }
        : { ingredients: entry.id, percent_estimate: entry.percent },
    ),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 529, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 129, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 13.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.5, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'halal-certified', 'no-additives'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış nohut (hazır baklagil)' },
      { key: 'Çeşitlilik', value: 'Nohut' },
      { key: 'Net Miktar', value: '700 g' },
      { key: 'Süzme Miktarı', value: '400 g' },
      { key: 'Porsiyon', value: 'Yaklaşık 3 porsiyon (1 porsiyon ≈ 130 g)' },
      { key: 'Ambalaj', value: "4 katlı BPA'sız koruyucu ambalaj" },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi (Ambalaj)',
        value: 'Yalınayak Mh. 102099. Sk. No:1 Toroslar / Mersin',
      },
      { key: 'Tüketici Hattı', value: '0324 221 62 76' },
      { key: 'Web', value: 'www.yaylaagro.com' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '19,9 × 13,3 × 4,6 cm' },
      { key: 'Ürün Ağırlığı', value: '0,7 kg' },
      { key: 'Katkı Beyanı', value: 'Koruyucu ve renklendirici içermez' },
      { key: 'GDO Beyanı', value: 'GDO içermez (Amazon.com.tr ürün bilgisi)' },
      { key: 'Ambalaj Sembolleri', value: 'PP 5 geri dönüşüm, BPA içermez, gıda ile temasa uygun' },
      {
        key: 'Amazon Üretici Adresi',
        value: 'Amazon.com.tr ürün detayında Kahramankazan / Ankara yazıyor; ambalajda Mersin adresi basılı',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — Tekli Paket 79,97 TL (114,24 TL/kg, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Şişmiş, sızdıran veya hasarlı ambalajdaki ürün tüketilmemelidir. Ambalajı açıldıktan sonra buzdolabında (+4 °C) saklanmalı ve 2 gün içinde tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: "Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir; oda sıcaklığında güneş ışığından uzak ortamda saklanmalıdır.",
      },
    ],
    storage:
      "Oda sıcaklığında (25 °C) güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.",
    usage:
      'Yemeklerinizde hemen kullanabilirsiniz, ürün içindeki suyu yemeklerinize ekleyebilirsiniz. Yemek, pilav, çorba, salata ve mezelere ekleyin.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 79.97, date: '2026-11-03T00:00:00.000Z' }],
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
