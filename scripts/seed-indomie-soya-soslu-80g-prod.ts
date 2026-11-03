import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Indomie Gurme Soya Soslu Hazır Noodle 80 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08TBZ8VYF (40'lı koli) + tekli ASIN B08QSM7THY
 * ve ürün ambalajı (EAN-13 8680908020113). Tekli 80 g paket, mevcut barkod
 * kaydını zenginleştirir; koli satış biçimi teknik özelliklere yazılır.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-indomie-soya-soslu-80g-prod.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-indomie-soya-soslu-80g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8680908020113'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'indomie-soya-soslu-80g')

function assertEan13(barcode: string): void {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 değil: ${barcode}`)
  const digits = barcode.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${barcode} (beklenen ${expected})`)
  }
}

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle 80 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle içindekiler ve alerjen beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle besin değerleri tablosu (100 g ve 80 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle helal, ISO 22000 ve geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle ambalaj bilgi paneli: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Indomie Gurme Soya Soslu Hazır Noodle barkod numarası 8680908020113',
  },
] as const

export type IngredientEntry = {
  name: string
  slug: string
  aliases?: readonly string[]
}

/** Etiketten okunan yaprak içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS: readonly IngredientEntry[] = [
  { name: 'buğday unu', slug: 'bugday-unu' },
  { name: 'Palm yağı', slug: 'palm-yagi' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'Potasyum Karbonat', slug: 'potasyum-karbonat', aliases: ['E501', 'Potassium carbonate'] },
  { name: 'Sodyum Karbonat', slug: 'sodyum-karbonat', aliases: ['E500', 'Sodium carbonate'] },
  {
    name: 'Sodyum Polifosfat',
    slug: 'sodyum-polifosfat',
    aliases: ['E452', 'Sodium polyphosphate'],
  },
  { name: 'Guar Gam', slug: 'guar-gam', aliases: ['E412', 'Guar gum'] },
  { name: 'Riboflavin', slug: 'riboflavin' },
  { name: 'Şeker', slug: 'seker' },
  { name: 'Monosodyum Glutamat (MSG)', slug: 'monosodyum-glutamat-msg', aliases: ['E621', 'MSG'] },
  // Master listede 957 "sarimsak tozu" kaydı var; yeni kopya açılmaz.
  { name: 'sarimsak tozu', slug: 'sarimsak-tozu' },
  { name: 'Dana Eti Aroma Vericisi', slug: 'dana-eti-aroma-vericisi' },
  { name: 'Soğan Tozu', slug: 'sogan-tozu' },
  { name: 'Maya', slug: 'maya' },
  { name: 'Karamel', slug: 'karamel' },
  { name: 'Kırmızı Biber Tozu', slug: 'kirmizi-biber-tozu' },
  { name: 'soğan', slug: 'sogan' },
  { name: 'Tatlı Soya Sosu', slug: 'tatli-soya-sosu' },
  { name: 'susam', slug: 'susam' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 74 // Indomie
const CATEGORY_ID = 27 // Temel Gıda & Mutfak › Makarna & Pirinç
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten
const ADDITIVE_IDS = {
  sodiumCarbonate: 107, // E500I Sodyum Karbonat
  potassiumCarbonate: 105, // E501I Potasyum Karbonat
  sodiumPolyphosphate: 106, // E452I Sodyum Polifosfat
  guarGum: 51, // E412 Guar Gamı
  riboflavin: 120, // E101I Riboflavin
  msg: 36, // E621 Monosodyum Glutamat
} as const

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

async function ensureIngredient(
  client: PayloadClient,
  entry: IngredientEntry,
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    ...(entry.aliases ? { aliases: entry.aliases.map((alias) => ({ alias })) } : {}),
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

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Indomie Gurme Soya Soslu Hazır Noodle 80 g',
    description:
      'Indomie Gurme serisinin soya soslu hazır noodle paketi. Buğday unundan üretilen erişte, palm yağı ve soya sosu aromalı çeşni karışımıyla birlikte tek porsiyonluk 80 g pakette sunulur. Kaynar suda birkaç dakikada hazırlanan pratik bir öğün alternatifidir.\n\nTürkiye’de Adkotürk Gıda Sanayi ve Ticaret Limited Şirketi tarafından üretilir; marka sahibi Endonezya merkezli PT Indofood Sukses Makmur Tbk’dir. Gluten (buğday), soya fasulyesi ve susam içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TBZ8VYF 40’lı koli listesi, tekli ASIN B08QSM7THY) ve ürün ambalajı.',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'ADKOTURK Gıda Sanayi ve Ticaret Limited Şirketi',
    country: COUNTRY_ID,
    size: '80 g',
    packaging: 'Paket (plastik film)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [
      ADDITIVE_IDS.sodiumCarbonate,
      ADDITIVE_IDS.potassiumCarbonate,
      ADDITIVE_IDS.sodiumPolyphosphate,
      ADDITIVE_IDS.guarGum,
      ADDITIVE_IDS.riboflavin,
      ADDITIVE_IDS.msg,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1911, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 455, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 18, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 64, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 4, unit: 'g' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Indomie' },
      { key: 'Seri', value: 'Gurme' },
      { key: 'Ürün Tipi', value: 'Hazır Noodle (Ramen Erişte)' },
      { key: 'Aroma', value: 'Soya Soslu' },
      { key: 'Net Miktar', value: '80 g' },
      { key: 'Porsiyon', value: '80 g (1 paket)' },
      { key: 'Ambalaj', value: 'Paket (plastik film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'ADKOTURK Gıda Sanayi ve Ticaret Limited Şirketi' },
      {
        key: 'Üretici Adresi',
        value:
          'Çerkezköy Organize Sanayi Bölgesi, Karaağaç Mahallesi Fatih Bulvarı No:40, 59510 Kapaklı / Tekirdağ',
      },
      { key: 'Tüketici Hattı', value: '+90 282 758 22 72' },
      { key: 'Marka Sahibi', value: 'PT Indofood Sukses Makmur Tbk (Endonezya)' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN (tekli)', value: 'B08QSM7THY' },
      { key: 'Amazon ASIN (40’lı koli)', value: 'B08TBZ8VYF' },
      {
        key: 'Amazon Satış Biçimi',
        value: '40’lı koli (40 × 80 g = 3,2 kg); bu kayıt tekli 80 g paketi tanımlar',
      },
      { key: 'Koli Ölçüleri', value: '34,7 × 24,7 × 20,8 cm' },
      { key: 'Alerjen Beyanı', value: 'Gluten, soya fasulyesi ve susam içerir' },
      { key: 'Soya Sosu Oranı', value: 'Tatlı soya sosu <%2' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'Helal, ISO 22000, gıda ile temasa uygun, temiz tutunuz, geri dönüştürülebilir',
      },
      { key: 'Hazırlama Talimatları', value: 'Ambalajın arka yüzünde belirtilmiştir' },
      { key: 'Saklama Koşulları', value: 'Ambalaj üzerinde belirtilmiştir' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 40’lı koli 789,45 TL (3 Kasım 2026; paket başına ≈19,74 TL)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday), soya fasulyesi ve susam içerir. Bu alerjenlere duyarlı kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ambalajı açılmış, delinmiş veya yırtılmış ürünleri satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünleri tüketmeyiniz.',
      },
    ],
    model: 'B08QSM7THY',
    sku: 'AMZ-B08QSM7THY',
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Ambalaj bilgi paneli' },
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
