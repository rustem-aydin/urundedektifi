import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Eti Form Hurma, İncir ve Çiyalı Tam Buğday Unlu Bisküvi 50 g ürününü
 * UZAK Payload REST API'sine yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0F4Y1FD7J (2 x 50 g paket) + ürün ambalajı
 * (EAN-13 8690526094205). Ürün OFF aktarımından 9035 olarak zaten var;
 * betik barkoda göre günceller, yeni kayıt açmaz.
 * Idempotent: görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-eti-form-hurma-incir-ciyali-50g-prod.ts
 *   (veya SEED_EMAIL / SEED_PASSWORD ile)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL/SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690526094205'
const GTIN = '8690526094205'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'eti-form-hurma-incir-ciyali-50g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Eti Form Hurma, İncir ve Çiyalı Tam Buğday Unlu Bisküvi 50 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Eti Form Hurma İncir Çiyalı Bisküvi 50 g arka yüz içindekiler, alerjen ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Eti Form Hurma İncir Çiyalı Bisküvi 50 g besin değerleri tablosu (1 paket 50 g ve 100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Eti Form Hurma İncir Çiyalı Bisküvi 50 g net miktar, kod no ve geri dönüşüm sembolü',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Eti Form Hurma İncir Çiyalı Bisküvi 50 g arka yüz: içindekiler, besin değerleri, barkod ve saklama bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Eti Form Hurma İncir Çiyalı Bisküvi 50 g barkod numarası 8690526094205',
  },
] as const

/** Etiketten okunan içindekiler sırası; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'buğday unu', id: 181 },
  { name: 'maltodekstrin', id: 121 },
  { name: 'Bitkisel yağ', id: 182 },
  { name: 'Şeker', id: 186 },
  { name: 'Tam buğday unu', id: 328 },
  { name: 'Yulaf Unu', id: 725 },
  { name: 'Hurma ezmesi', id: 933 },
  { name: 'İncir Ezmesi', slug: 'incir-ezmesi' },
  { name: 'çavdar unu', id: 684 },
  { name: 'Polidekstroz', id: 331 },
  { name: 'Çiya Tohumu', id: 3666 },
  { name: 'Amonyum Hidrojen Karbonat', id: 1983 },
  { name: 'Sodyum Hidrojen Karbonat', id: 250 },
  { name: 'Keçiboynuzu Unu', id: 726 },
  { name: 'Invert şeker şurubu', id: 185 },
  { name: 'fındık', id: 212 },
  { name: 'tarçın', id: 748 },
  { name: 'tuz', id: 137 },
  { name: 'aroma verici', id: 141 },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 42 // Eti
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten
const ADDITIVE_IDS = {
  polydextrose: 22, // E1200
  sodiumCarbonates: 6, // E500
  ammoniumCarbonates: 8, // E503
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
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  if ('id' in entry && entry.id) return entry.id

  const slug = 'slug' in entry ? entry.slug : undefined
  const existing = await client.findOne('ingredients', {
    or: [{ name: { equals: entry.name } }, ...(slug ? [{ slug: { equals: slug } }] : [])],
  })
  if (existing) return existing.id
  if (!slug) throw new Error(`Yeni içindekiler için slug gerekli: ${entry.name}`)

  const created = await client.create('ingredients', {
    name: entry.name,
    slug,
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
  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Eti Form Hurma, İncir ve Çiyalı Tam Buğday Unlu Bisküvi 50 g',
    description:
      "Eti Form Hurma, İncir ve Çiyalı Tam Buğday Unlu Bisküvi; tam buğday unu, yulaf unu ve çavdar unu temelinde hurma ezmesi (%4,2), incir ezmesi (%4,2) ve çiya tohumu (%2) içeren 50 g'lık bisküvidir. Fındık (%1,2) ve tarçın (%0,5) ile tatlandırılır.\n\nEtiket metnine göre şeker ve yağ miktarı piyasadaki meyveli bisküvilerin ortalamasına göre %30 azaltılmıştır; ön yüz rozetleri şekerde %37, yağda %34 azaltım belirtir. Ürün vejetaryendir; hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır. Gluten ve fındık içerir, eser miktarda süt ürünü içerebilir.\n\nEti Gıda Sanayi ve Ticaret A.Ş. tarafından Eskişehir'de üretilir (işletme kayıt no TR-26-K-000045). Amazon.com.tr'de B0F4Y1FD7J ASIN'i ile 2 x 50 g paket olarak satılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F4Y1FD7J) ve ürün ambalajı (EAN-13 8690526094205).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Eti Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '50 g',
    packaging: 'Akış paket (flow pack)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [
      ADDITIVE_IDS.polydextrose,
      ADDITIVE_IDS.sodiumCarbonates,
      ADDITIVE_IDS.ammoniumCarbonates,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1755, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 417, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 11, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 4.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 67, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 14, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 8.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.47, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Eti' },
      { key: 'Ürün Tipi', value: 'Bisküvi' },
      { key: 'Alt Tür', value: 'Tam Buğday Unlu Bisküvi' },
      { key: 'Aroma', value: 'Hurma, İncir ve Çiya' },
      { key: 'Net Miktar', value: '50 g' },
      { key: 'Amazon Satışı', value: "2 x 50 g paket (toplam 100 g)" },
      { key: 'Porsiyon', value: '1 paket (50 g)' },
      { key: 'Ambalaj', value: 'Akış paket (flow pack)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Eti Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Organize Sanayi Bölgesi Orhan Erden Bulvarı No:3 Eskişehir / Türkiye',
      },
      { key: 'İşletme Kayıt No', value: 'TR-26-K-000045' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0F4Y1FD7J' },
      { key: 'Ürün Ölçüleri', value: '16,2 x 6,2 x 2,2 cm (paket)' },
      { key: 'Paket Ağırlığı', value: '50 g' },
      { key: 'Kod No', value: '9420' },
      { key: 'Diyet Türü', value: 'Vejetaryen' },
      {
        key: 'Şeker ve Yağ Beyanı',
        value:
          'Etiket metni: şeker ve yağ, piyasadaki meyveli bisküvilerin ortalamasına göre %30 azaltılmıştır. Ön yüz rozetleri: şekerde %37, yağda %34 azaltım.',
      },
      {
        key: 'Domuz Yağı Beyanı',
        value: "Ürünlerin hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır",
      },
      { key: 'Saklama', value: 'Doğrudan güneş ışığına maruz bırakmayın; serin ve rutubetsiz yerde saklayın' },
      { key: 'Fiyat Kaynağı', value: "Amazon.com.tr — 2 x 50 g paket 32,22 TL (3 Kasım 2026)" },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten ve fındık içerir; eser miktarda süt ürünü içerebilir. Çölyak hastalığı, gluten duyarlılığı, fındık veya süt alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT ve parti numarası paketin ön yüzündedir; son kullanma tarihi geçmiş ürünü tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj açılmış veya delinmişse ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    model: 'B0F4Y1FD7J',
    sku: 'AMZ-B0F4Y1FD7J',
    prices: [{ amount: 32.22, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690526094205' },
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
