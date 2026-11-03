import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Fasulye Pilaki 400 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07SVNTKWQ + ürün ambalajı (EAN-13 8693374255453).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-fasulye-pilaki-400g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-fasulye-pilaki-400g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN?.trim() || undefined

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374255453'
const GTIN = '8693374255453'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-fasulye-pilaki-400g')

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

assertEan13(BARCODE)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g ön yüz: Yemek Hazır, ACYE Aç Ye',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g içindekiler ve alerjen beyanı şeridi',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g besin değerleri tablosu (100 g başına)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g ambalaj ve geri dönüşüm sembolleri (PP 5, helal)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g arka yüz: içindekiler, besin değerleri, saklama ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Fasulye Pilaki 400 g barkod numarası 8693374255453',
  },
] as const

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'Fasulye', slug: 'fasulye', percent: 42 },
  { name: 'Su', slug: 'su' },
  { name: 'domates', slug: 'domates', percent: 7 },
  { name: 'Bitkisel yağ', slug: 'bitkisel-yag', percent: 5 },
  { name: 'Ayçiçek yağı', slug: 'aycicek-yagi' },
  { name: 'Zeytinyağı', slug: 'zeytinyagi' },
  { name: 'patates', slug: 'patates', percent: 5 },
  { name: 'havuç', slug: 'havuc', percent: 4 },
  { name: 'Domates salçası', slug: 'domates-salcasi' },
  { name: 'Biber salçası', slug: 'biber-salcasi' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'sirke', slug: 'sirke' },
  { name: 'buğday unu', slug: 'bugday-unu' },
  { name: 'Şeker', slug: 'seker' },
  { name: 'soğan', slug: 'sogan' },
  { name: 'Sarımsak', slug: 'sarimsak' },
  { name: 'karabiber', slug: 'karabiber' },
  { name: 'kimyon', slug: 'kimyon' },
  { name: 'Fesleğen', slug: 'feslegen' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 24 // Temel Gıda & Mutfak › Hazır Yemek
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  transFat: 52,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
  potassium: 35,
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', { name: entry.name, slug: entry.slug })
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
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const items: { ingredients: number; percent_estimate?: number }[] = []
  for (const entry of INGREDIENTS) {
    const id = await ensureIngredient(client, entry)
    items.push(
      'percent' in entry
        ? { ingredients: id, percent_estimate: entry.percent }
        : { ingredients: id },
    )
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Fasulye Pilaki 400 g',
    description:
      "Yayla Fasulye Pilaki, domates sosunda fasulye, patates ve havuçla hazırlanan, 400 g'lık 4 katmanlı poşette sunulan hazır yemektir. Etiketinde \"Yemek Hazır / Ready to Eat\" ve \"ACYE — Aç, Ye\" ibareleri yer alır: ambalaj açıldığında ısıtmadan tüketilebilir. Poşet, 4 katmanlı yapısı sayesinde oda sıcaklığında korunur; paket yaklaşık 3 porsiyondur. Etikette renklendirici ve koruyucu içermediği belirtilir. Buğday unu nedeniyle gluten içerir; süt ürünleri içerebilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07SVNTKWQ) ve ürün ambalajı (EAN-13 8693374255453).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '400 g',
    packaging: '4 katmanlı lamine poşet (oda sıcaklığında saklanır)',
    items,
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 580, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 139, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 7.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 8.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 7.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 5.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 314.4, unit: 'mg' },
      ],
    },
    labels: ['halal-certified', 'no-additives'] as const,
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Hazır Yemek (Fasulye Pilaki)' },
      { key: 'Çeşni', value: 'Domates soslu; patates ve havuçlu' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Porsiyon', value: '3 porsiyon (porsiyon başına yaklaşık 130 g)' },
      { key: 'Ambalaj', value: '4 katmanlı lamine poşet; oda sıcaklığında korur' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Yayla Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mh. 102099. Sk. No: 1, Toroslar / Mersin' },
      { key: 'Telefon', value: '0324 221 62 76 (pbx)' },
      { key: 'Faks', value: '0324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B07SVNTKWQ' },
      { key: 'Ürün Ölçüleri', value: '17,7 × 13,4 × 3,7 cm' },
      { key: 'Katkı Beyanı', value: 'Renklendirici içermez, koruyucu içermez' },
      { key: 'Alerjen Beyanı', value: 'Gluten içerir; süt ürünleri içerebilir' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'PP 5, 2502 (çok katmanlı PE/PP), cam-çatal, geri dönüşüm halkası, helal',
      },
      {
        key: 'Etiket Varyantı',
        value:
          "Aynı EAN'in ikinci etiket baskısında oranlar fasulye %38, patates %7, havuç %6, bitkisel yağ %6, domates püresi %5, salça %2 olarak basılmıştır; ana kayıt Türkçe etiketin oranlarını kullanır.",
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 49,77 TL (124,43 TL/kg), 3 Kasım 2026' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday unu) içerir; süt ürünleri içerebilir. Gluten alerjisi, çölyak hastalığı veya süt alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Şişmiş veya sızıntılı ambalajdaki ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında (25 °C), güneş ışığından uzakta saklayın. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edin ve 2 gün içinde tüketin.',
    usage: 'Ambalaj açıldıktan sonra doğrudan tüketime hazırdır (ACYE — Aç, Ye).',
    model: 'B07SVNTKWQ',
    sku: 'AMZ-B07SVNTKWQ',
    prices: [{ amount: 49.77, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8693374255453' },
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
