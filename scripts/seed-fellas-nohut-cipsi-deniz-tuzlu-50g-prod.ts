import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Fellas Fırınlanmış Nohut Cipsi Deniz Tuzlu 50 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0GWCVWKLW, ürün ambalajı (EAN-13 8684207695973)
 * ve üretici sitesi fellasfoods.com.tr (yüksek çözünürlüklü arka yüz / besin görselleri).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-fellas-nohut-cipsi-deniz-tuzlu-50g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
/** Hazır admin JWT (oturum sahibinin jetonu); verilirse yeniden giriş yapılmaz. */
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD ya da SEED_TOKEN gerekli.')
  process.exit(1)
}

const BARCODE = '8684207695973'
const GTIN = '8684207695973'
const ASIN = 'B0GWCVWKLW'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'fellas-nohut-cipsi-deniz-tuzlu-50g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Fellas Fırınlanmış Nohut Cipsi Deniz Tuzlu 50 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Fellas Nohut Cipsi Deniz Tuzlu 50 g içindekiler, saklama ve üretici bilgileri (Türkçe ve İngilizce)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Fellas Nohut Cipsi Deniz Tuzlu 50 g besin değerleri tablosu (100 g ve 25 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Fellas Nohut Cipsi Deniz Tuzlu 50 g menşe, helal ve geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Fellas Nohut Cipsi Deniz Tuzlu 50 g arka yüz: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Fellas Nohut Cipsi Deniz Tuzlu 50 g barkod numarası 8684207695973',
  },
] as const

/** Etiketten okunan içindekiler; master listede hazır kayıtlar. */
const INGREDIENTS = [
  { name: 'Nohut Unu', id: 611 },
  { name: 'Pirinç Unu', id: 616 },
  { name: 'Mercimek unu', id: 3843 },
  { name: 'Bezelye proteini', id: 2017 },
  { name: 'Zeytinyağı', id: 515 },
  { name: 'Ayçiçek yağı', id: 298 },
  { name: 'deniz tuzu', id: 623 },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 153 // Fellas
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık
const COUNTRY_ID = 1 // Türkiye

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
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id
  throw new Error(`Master içindekiler bulunamadı: ${entry.name} (${entry.id})`)
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
  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Fellas Fırınlanmış Nohut Cipsi Deniz Tuzlu 50 g',
    description:
      "Fellas Nohut Cipsi Deniz Tuzlu, nohut unu (%49) temelli hamurun deniz tuzuyla (%3) fırınlanmasıyla üretilen 50 g'lık çıtır atıştırmalıktır. Hamurda pirinç unu, mercimek unu ve bezelye proteini de yer alır; yağ olarak zeytinyağı ve ayçiçek yağı kullanılır.\n\nAmbalajda trans yağ içermediği, katkı maddesi ve koruyucu içermediği, vegan olduğu ve yüksek protein/lif kaynağı olduğu belirtilir. Ürünlerin hiçbirinde alkol, domuz yağı ve türevleri bulunmadığı beyan edilir. 1 paket 2 porsiyon (25 g) içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GWCVWKLW), ürün ambalajı (EAN-13 8684207695973) ve fellasfoods.com.tr.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'FELLAS GIDA VE SAĞLIK ÜRÜNLERİ SAN. VE TİC. A.Ş.',
    size: '50 g',
    packaging: 'Plastik paket (PP 5)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1726, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 413, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 52, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.8, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Fellas' },
      { key: 'Ürün Tipi', value: 'Fırınlanmış Nohut Cipsi' },
      { key: 'Çeşni', value: 'Deniz Tuzlu' },
      { key: 'Net Miktar', value: '50 g' },
      { key: 'Porsiyon', value: '25 g (1 paket 2 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (PP 5)' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'FELLAS GIDA VE SAĞLIK ÜRÜNLERİ SAN. VE TİC. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yunus Emre Mahallesi Sabır Caddesi, No:6, 34791 Sancaktepe / İstanbul',
      },
      { key: 'Web', value: 'www.fellasfoods.com.tr' },
      { key: 'Sosyal Medya', value: '/fellasfoods (Instagram, Facebook)' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '26 × 16 × 7,7 cm' },
      {
        key: 'Beyanlar',
        value:
          'Trans yağ içermez; katkısız ve koruyucusuz; vegan; yüksek protein ve yüksek lif; alkol, domuz yağı ve türevleri içermez',
      },
      { key: 'Helal', value: 'Ambalajda helal işareti bulunur' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 42,94 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Amazon satıcı beyanı ürünün fındık ve laktoz içerdiğini söylüyor; ancak ambalajın içindekiler listesinde süt türevi veya fındık adı geçmiyor ve ambalaj vegan olarak işaretlenmiş. Fındık alerjisi veya laktoz intoleransı olan kişiler tüketmeden önce üreticiye danışmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT), parti numarası (PNO) ve işletme kayıt numarası (İKN) ambalajın üzerindedir.',
      },
      { severity: 'low' as const, text: 'Ambalajı açılmış veya delinmiş ürünü satın almayınız.' },
    ],
    storage: 'Güneşten uzak, serin ve kuru yerde muhafaza ediniz.',
    usage: '1 paket 2 porsiyon (25 g) içerir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 42.94, date: '2026-11-03T00:00:00.000Z' }],
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
