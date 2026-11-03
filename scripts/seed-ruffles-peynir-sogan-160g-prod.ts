import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ruffles Peynir ve Soğan Aromalı Patates Cipsi Parti Boy 160 g ürününü
 * UZAK Payload REST API'sine yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0DWFR3QM1 + ürün ambalajı (EAN-13 8690624106060).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-ruffles-peynir-sogan-160g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690624106060'
const GTIN = '8690624106060'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'ruffles-peynir-sogan-160g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Ruffles Peynir ve Soğan Aromalı Patates Cipsi 160 g Parti Boy ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.png',
    alt: 'Ruffles Peynir ve Soğan 160 g arka yüz içindekiler ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.png',
    alt: 'Ruffles Peynir ve Soğan 160 g besin değerleri tablosu (100 g ve 25 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.png',
    alt: 'Ruffles Peynir ve Soğan 160 g geri dönüşüm ve ambalaj sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ruffles Peynir ve Soğan 160 g arka yüz: içindekiler, besin değerleri, barkod ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.png',
    alt: 'Ruffles Peynir ve Soğan 160 g barkod numarası 8690624106060',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'patates', slug: 'patates' },
  { name: 'Bitkisel Yağlar', slug: 'bitkisel-yaglar' },
  { name: 'mısır yağı', slug: 'misir-yagi' },
  { name: 'Yüksek oleik asitli ayçiçek yağı', slug: 'yuksek-oleik-asitli-aycicek-yagi' },
  { name: 'kanola yağı', slug: 'kanola-yagi' },
  { name: 'Soğan Tozu', slug: 'sogan-tozu' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'Laktoz', slug: 'laktoz' },
  { name: 'Aroma Verici', slug: 'aroma-verici' },
  { name: 'Monosodyum Glutamat (MSG)', slug: 'monosodyum-glutamat-msg', aliases: ['MSG', 'E621'] },
  { name: 'Disodyum Guanilat', slug: 'disodyum-guanilat', aliases: ['E627'] },
  { name: 'Şeker', slug: 'seker' },
  { name: 'Potasyum klorür', slug: 'potasyum-klorur' },
  { name: 'Sitrik asit', slug: 'sitrik-asit' },
  { name: 'Peynir tozu', slug: 'peynir-tozu' },
  { name: 'Annatto', slug: 'annatto' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 170
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_MILK_ID = 3 // Süt
const ADDITIVE_IDS = {
  citricAcid: 1, // E330 Sitrik Asit
  msg: 36, // E621 Monosodyum Glutamat
  disodiumGuanylate: 37, // E627 Disodyum Guanilat
  potassiumChloride: 72, // E508 Potasyum Klorür
  annattoBixin: 223, // E160BI Annatto Biksin
} as const

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

async function ensureMedia(
  client: PayloadClient,
): Promise<Record<string, number>> {
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
    name: 'Ruffles Peynir ve Soğan Aromalı Patates Cipsi Parti Boy 160 g',
    description:
      "Ruffles Peynir ve Soğan Aromalı Patates Cipsi, tırtıklı patates dilimlerinin peynir ve soğan aromalı çeşniyle buluştuğu 160 g'lık Parti Boy pakettir. Maç geceleri, arkadaş buluşmaları ve kalabalık ikramlar için pratik ambalajıyla öne çıkar.\n\nÜrün, yerli patatesle Türkiye'de üretilir ve koruyucu atmosferde ambalajlanır. Etikette trans yağ içermediği ve domuz yağı/domuzdan elde edilmiş katkı maddesi kullanılmadığı beyan edilir. Süt türevi (laktoz) içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DWFR3QM1) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Frito Lay Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '160 g',
    packaging: 'Plastik paket (metalleştirilmiş film)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_MILK_ID,
    additives: [
      ADDITIVE_IDS.msg,
      ADDITIVE_IDS.disodiumGuanylate,
      ADDITIVE_IDS.potassiumChloride,
      ADDITIVE_IDS.citricAcid,
      ADDITIVE_IDS.annattoBixin,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2164, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 519, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 31, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 4.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0.12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 52, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 4.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.2, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Ruffles' },
      { key: 'Ürün Tipi', value: 'Patates Cipsi' },
      { key: 'Aroma', value: 'Peynir ve Soğan' },
      { key: 'Boy', value: 'Parti Boy (Orta)' },
      { key: 'Net Miktar', value: '160 g' },
      { key: 'Porsiyon', value: '25 g (paket başına yaklaşık 6,4 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Frito Lay Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Aydınlı Mah. Birlik OSB Mah. 4. Cad. No: 1 A Blok 34953 Tuzla / İstanbul',
      },
      { key: 'Tüketici Hattı', value: '0850 222 0 737' },
      { key: 'Web', value: 'www.ruffles.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0DWFR3QM1' },
      { key: 'Ürün Ölçüleri', value: '25 × 27 × 8 cm' },
      { key: 'Trans Yağ Beyanı', value: 'Trans yağ içermez' },
      {
        key: 'Domuz Yağı Beyanı',
        value: 'Domuz yağı ve domuzdan elde edilmiş hiçbir katkı maddesi içermez',
      },
      { key: 'Ambalaj Sembolleri', value: 'PP 5, CEYKO, cam/çatal geri dönüşüm' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 84,95 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Süt türevi (laktoz) içerir. Süt alerjisi veya laktoz intoleransı olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      { severity: 'low' as const, text: "Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir." },
    ],
    storage: 'Kuru ve serin ortamda saklayın. Ambalaj açıldıktan sonra ağzını kapatın.',
    model: 'B0DWFR3QM1',
    sku: 'AMZ-B0DWFR3QM1',
    prices: [{ amount: 84.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690624106060' },
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
