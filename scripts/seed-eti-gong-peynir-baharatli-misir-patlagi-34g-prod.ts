import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Eti Gong Peynir ve Acı Aroma Çeşnili Mısır ve Pirinç Patlağı 34 g ürününü
 * UZAK Payload REST API'sine yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0F4Y2SL39 (2'li paket listesi) + ürün ambalajı
 * (EAN-13 8690526004471, Kod No 2447). Bu kayıt tekli 34 g paketi tanımlar;
 * 2'li paket satış biçimi teknik özelliklere yazılır. Idempotent: barkoda göre upsert.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-eti-gong-peynir-baharatli-misir-patlagi-34g-prod.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-eti-gong-peynir-baharatli-misir-patlagi-34g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690526004471'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'eti-gong-peynir-baharatli-misir-patlagi-34g',
)

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

type ImageEntry = {
  key: string
  file: string
  alt: string
}

const IMAGES: readonly ImageEntry[] = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Eti Gong Peynir ve Acı Aroma Çeşnili Mısır ve Pirinç Patlağı 34 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Eti Gong Peynir ve Acı Aroma Çeşnili Mısır ve Pirinç Patlağı içindekiler ve alerjen bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Eti Gong Peynir ve Acı Aroma Çeşnili Mısır ve Pirinç Patlağı besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Eti Gong Mısır ve Pirinç Patlağı "trans yağ içermez" ve geri dönüşüm sembolleri ile tüketici hattı',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Eti Gong Peynir ve Acı Aroma Çeşnili Mısır ve Pirinç Patlağı arka yüz: içindekiler, besin değerleri ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Eti Gong Mısır ve Pirinç Patlağı barkod numarası 8690526004471',
  },
] as const

type IngredientEntry = {
  name: string
  slug: string
  percent?: number
}

/** Etiketten okunan yaprak içindekiler (etiket sırası); master listede yoksa oluşturulur. */
const INGREDIENTS: readonly IngredientEntry[] = [
  { name: 'mısır', slug: 'misir', percent: 40.2 },
  { name: 'pirinç', slug: 'pirinc', percent: 36.5 },
  { name: 'Palm yağı', slug: 'palm-yagi' },
  { name: 'peynir altı suyu tozu', slug: 'peynir-alti-suyu-tozu' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'Dekstroz', slug: 'dekstroz' },
  { name: 'Maya Ekstraktı', slug: 'maya-ekstrakti' },
  { name: 'Tatlı kırmızı biber', slug: 'tatli-kirmizi-biber' },
  { name: 'Aroma Verici', slug: 'aroma-verici' },
  { name: 'Acı toz kırmızı biber', slug: 'aci-toz-kirmizi-biber', percent: 1 },
  { name: 'Soğan Tozu', slug: 'sogan-tozu' },
  { name: 'Sitrik asit', slug: 'sitrik-asit' },
  { name: 'Peynir tozu', slug: 'peynir-tozu', percent: 0.5 },
  { name: 'karabiber', slug: 'karabiber' },
  { name: 'Paprika Ekstraktı', slug: 'paprika-ekstrakti' },
  { name: 'Ayçiçek Lesitini', slug: 'aycicek-lesitini' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 42 // Eti
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_MILK_ID = 3 // Süt
const ADDITIVE_IDS = {
  citricAcid: 1, // E330 Sitrik Asit
  paprikaExtract: 34, // E160C Paprika Ekstraktı
  lecithin: 11, // E322I Lesitin
} as const

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

async function ensureIngredient(
  client: PayloadClient,
  entry: IngredientEntry,
): Promise<{ id: number; percent?: number }> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return { id: existing.id, percent: entry.percent }

  // Yazım varyantı: aynı kavram farklı büyük/küçük harfle kayıtlı olabilir.
  const sameSlug = await client.findOne('ingredients', { slug: { equals: entry.slug } })
  if (sameSlug) return { id: sameSlug.id, percent: entry.percent }

  const created = await client.create('ingredients', { name: entry.name, slug: entry.slug })
  console.log(`  + içindekiler: ${entry.name} (${created.id})`)
  return { id: created.id, percent: entry.percent }
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

  const items: { ingredients: number; percent_estimate?: number }[] = []
  for (const entry of INGREDIENTS) {
    const resolved = await ensureIngredient(client, entry)
    items.push(
      resolved.percent === undefined
        ? { ingredients: resolved.id }
        : { ingredients: resolved.id, percent_estimate: resolved.percent },
    )
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Eti Gong Peynir Ve Acı Aroma Çeşnili Mısır Ve Pirinç Patlağı 34 g',
    description:
      'Eti Gong serisinin peynir ve acı biber aromalı mısır ve pirinç patlağı. Mısır (%40,2) ve pirinç (%36,5) patlağının üzerine peynir altı suyu tozu, acı toz kırmızı biber, soğan tozu ve baharatlardan oluşan aroma çeşnisi kaplanır; ürün fırında patlatılıp sıkıştırılarak üretilir.\n\n34 g’lık tek porsiyonluk paket, trans yağ içermez; üretici alkol, domuz yağı ve türevi kullanılmadığını beyan eder. Eser miktarda hardal, kereviz ve gluten içerebilir. Eti Gıda tarafından Eskişehir’de üretilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F4Y2SL39, 2’li paket listesi) ve ürün ambalajı.',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Eti Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '34 g',
    packaging: 'Paket',
    items,
    allergens: ALLERGEN_MILK_ID,
    additives: [ADDITIVE_IDS.citricAcid, ADDITIVE_IDS.paprikaExtract, ADDITIVE_IDS.lecithin],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1859, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 442, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 15, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 6.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 68, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2.3, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Eti' },
      { key: 'Seri', value: 'Gong' },
      { key: 'Ürün Tipi', value: 'Mısır ve pirinç patlağı' },
      { key: 'Aroma', value: 'Peynir ve acı biber' },
      { key: 'Net Miktar', value: '34 g' },
      { key: 'Porsiyon', value: '34 g (1 paket)' },
      { key: 'Ambalaj', value: 'Paket' },
      { key: 'Üretim Yeri', value: 'Türkiye (yerli ve ithal pirinç kullanılarak)' },
      { key: 'Üretici', value: 'Eti Gıda Sanayi ve Ticaret A.Ş.' },
      { key: 'Üretici Adresi', value: 'Organize Sanayi Bölgesi, 26110 Eskişehir' },
      { key: 'Tüketici Hattı', value: '0800 211 0 384 / 0216 651 0 384' },
      { key: 'Web', value: 'www.etietieti.com' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Kod No', value: '2447' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-26-K-000309' },
      { key: 'Amazon ASIN', value: 'B0F4Y2SL39' },
      {
        key: 'Amazon Satış Biçimi',
        value: '2’li paket (2 × 34 g = 68 g); bu kayıt tekli 34 g paketi tanımlar',
      },
      {
        key: 'Ürün Beyanları',
        value: 'Trans yağ içermez; hiçbir çeşidine alkol, domuz yağı ve türevi katılmamıştır',
      },
      {
        key: 'Eser Alerjen Uyarısı',
        value: 'Eser miktarda hardal, kereviz ve gluten içerebilir',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 2’li paket 26,60 TL (4 Kasım 2026; paket başına 13,30 TL)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Süt ürünü (peynir altı suyu tozu, peynir tozu, aroma verici) içerir. Süt alerjisi veya laktoz intoleransı olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Eser miktarda hardal, kereviz ve gluten içerebilir.',
      },
      { severity: 'low' as const, text: 'Ambalajı açılmış veya hasarlı ürünleri satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünleri tüketmeyiniz.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    model: 'B0F4Y2SL39',
    sku: 'AMZ-B0F4Y2SL39',
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
