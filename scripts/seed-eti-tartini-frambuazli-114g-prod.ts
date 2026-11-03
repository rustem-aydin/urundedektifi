import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Eti Tartini Frambuazlı Turta 114 g ürününü (Amazon.com.tr ASIN B0DK92W799)
 * UZAK Payload REST API'sine yazar: eksik master içindekiler, fotoğraflar,
 * besin değerleri ve etiket bilgileri.
 *
 * Ürün zaten OFF içe aktarımından geldiği için barkoda göre GÜNCELLENİR;
 * mevcut katkı maddesi ve alerjen bağları korunur.
 *
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-eti-tartini-frambuazli-114g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690526288758'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'eti-tartini-frambuazli-114g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Eti Tartini Frambuazlı Turta 114 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.png',
    alt: 'Eti Tartini Frambuazlı Turta 114 g içindekiler ve alerjen bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.png',
    alt: 'Eti Tartini Frambuazlı Turta 114 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Eti Tartini Frambuazlı Turta 114 g arka yüz: içindekiler, besin değerleri, barkod ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.png',
    alt: 'Eti Tartini Frambuazlı Turta 114 g barkod 8690526288758',
  },
  {
    key: 'lifestyle',
    file: 'lifestyle.jpg',
    alt: 'Eti Tartini Frambuazlı Turta 114 g paket ve frambuazlı mini turtalar',
  },
] as const

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'buğday unu', slug: 'bugday-unu', id: 181 },
  { name: 'Bitkisel yağ', slug: 'bitkisel-yag', id: 182 },
  { name: 'Palm yağı', slug: 'palm-yagi', id: 499 },
  { name: 'Ayçiçek yağı', slug: 'aycicek-yagi', id: 298 },
  { name: 'Pamuk yağı', slug: 'pamuk-yagi', aliases: ['Cottonseed oil'] },
  { name: 'kanola yağı', slug: 'kanola-yagi', id: 639 },
  { name: 'Şeker', slug: 'seker', id: 5 },
  { name: 'yumurta', slug: 'yumurta', id: 222 },
  { name: 'Buğday nişastası', slug: 'bugday-nisastasi', aliases: ['Wheat starch'] },
  {
    name: 'İnvert şeker şurubu',
    slug: 'invert-seker-surubu',
    aliases: ['Invert sugar syrup'],
  },
  { name: 'Tereyağı', slug: 'tereyagi', id: 554 },
  { name: 'peynir altı suyu tozu', slug: 'peynir-alti-suyu-tozu', id: 230 },
  { name: 'tuz', slug: 'tuz', id: 137 },
  { name: 'Gliserol', slug: 'gliserol', id: 2337 },
  { name: 'SORBITOL', slug: 'sorbitol', id: 75 },
  { name: 'Arpa malt özü', slug: 'arpa-malt-ozu', id: 3685 },
  { name: 'Aroma Verici', slug: 'aroma-verici', id: 4694 },
  {
    name: 'Sodyum asit pirofosfat',
    slug: 'sodyum-asit-pirofosfat',
    aliases: ['Disodyum difosfat', 'Disodium diphosphate', 'E450'],
  },
  {
    name: 'Sodyum hidrojen karbonat',
    slug: 'sodyum-hidrojen-karbonat',
    aliases: ['Yemek sodası', 'E500'],
  },
  { name: 'Sitrik asit', slug: 'sitrik-asit', id: 538 },
  { name: 'Ayçiçek Lesitini', slug: 'aycicek-lesitini', id: 4724 },
  { name: 'Frambuaz Sos', slug: 'frambuaz-sos', id: 3390 },
  { name: 'Frambuaz Püresi', slug: 'frambuaz-puresi', id: 3394 },
  { name: 'Vişne pulpu', slug: 'visne-pulpu', aliases: ['Sour cherry pulp'] },
  { name: 'Dekstroz', slug: 'dekstroz', id: 549 },
  { name: 'Pektin', slug: 'pektin', id: 884 },
  { name: 'Trikalsiyum sitrat', slug: 'trikalsiyum-sitrat', aliases: ['E333'] },
  {
    name: 'Renklendirici Pancar kökü kırmızısı',
    slug: 'renklendirici-pancar-koku-kirmizisi',
    id: 3435,
  },
] as const

const BRAND_ID = 42 // Eti
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
  if ('id' in entry) return entry.id

  const bySlug = await client.findOne('ingredients', { slug: { equals: entry.slug } })
  if (bySlug) return bySlug.id

  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    ...('aliases' in entry && entry.aliases
      ? { aliases: entry.aliases.map((alias) => ({ alias })) }
      : {}),
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
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Eti Tartini Frambuazlı Turta 114 g',
    description:
      "Eti Tartini Frambuazlı Turta, 6 adet 19 g'lık mini turtadan oluşan 114 g'lık tekli pakettir. Gevrek tart hamuru ve yoğun frambuaz sosuyla hazırlanır; çay saatleri ve ikramlar için uygundur.\n\nÜrün, Eti Gıda Sanayi ve Ticaret A.Ş. tarafından Türkiye'de üretilir. Gluten, süt ürünü ve yumurta içerir; eser miktarda soya ve sert kabuklu meyveler içerebilir. Paket üzerinde trans yağ içermediği belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DK92W799) ve ürün ambalajı.",
    brand: BRAND_ID,
    country: COUNTRY_ID,
    manufacturer: 'Eti Gıda Sanayi ve Ticaret A.Ş.',
    size: '114 g (6 × 19 g)',
    packaging: 'Plastik paket (tekli)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1794, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 427, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 14, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 7.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 70, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 34, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.4, unit: 'g' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Eti' },
      { key: 'Ürün Tipi', value: 'Frambuazlı turta (mini tart)' },
      { key: 'Seri', value: 'Tartini' },
      { key: 'Aroma', value: 'Frambuaz' },
      { key: 'Adet', value: '6 × 19 g' },
      { key: 'Net Miktar', value: '114 g' },
      { key: 'Ambalaj', value: 'Plastik paket (tekli)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Eti Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: '4. Eylül Mahallesi, Özcan Sokak No: 13, 11800 Bozüyük / Bilecik',
      },
      { key: 'Tüketici Hattı', value: '0216 851 0 384 / 0 282 655 15 15' },
      { key: 'Web', value: 'www.etitiketi.com' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: 'B0DK92W799' },
      { key: 'Paket Ölçüleri', value: '20 × 11,8 × 3,1 cm' },
      { key: 'Porsiyon', value: '1 adet (19 g)' },
      { key: 'Diyet Türü', value: 'Helal (Amazon ürün bilgisi)' },
      { key: 'Trans Yağ Beyanı', value: 'Trans yağ içermez (paket üzerinde)' },
      {
        key: 'Alerjen Beyanı',
        value:
          'Gluten, süt ürünü ve yumurta içerir; eser miktarda soya, Antep fıstığı, ceviz, fındık, kaju ve yer fıstığı içerebilir',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 35,90 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten, süt ürünü ve yumurta içerir. Eser miktarda soya, Antep fıstığı, ceviz, fındık, kaju ve yer fıstığı içerebilir. Alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Serin ve rutubetsiz yerde, doğrudan güneş ışığından uzakta muhafaza ediniz.',
      },
    ],
    storage: 'Serin ve rutubetsiz yerde muhafaza ediniz.',
    usage: 'Çay saatlerinde ve ikramlarda servis edilir.',
    model: 'B0DK92W799',
    sku: 'AMZ-B0DK92W799',
    prices: [{ amount: 35.9, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690526288758' },
      { image: media.lifestyle, caption: 'Paket ve mini turtalar' },
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
