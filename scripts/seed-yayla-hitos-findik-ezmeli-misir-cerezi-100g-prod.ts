import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi 100 g ürününü
 * UZAK Payload REST API'sine yazar: görseller ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0H5CP2GNF + ürün ambalajı (EAN-13 8693374283593).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-hitos-findik-ezmeli-misir-cerezi-100g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374283593'
const GTIN = '8693374283593'
const ASIN = 'B0H5CP2GNF'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-hitos-findik-ezmeli')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi 100 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi içindekiler ve alerjen uyarısı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi besin değerleri tablosu (100 g ve 25 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi ambalaj ve geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi arka yüz: besin değerleri, içindekiler, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi barkod numarası 8693374283593',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'Mısır irmiği', slug: 'misir-irmigi', percentEstimate: undefined },
  { name: 'Yer-fıstığı ezmesi', slug: 'yer-fistigi-ezmesi', percentEstimate: 24 },
  { name: 'Ayçiçek yağı', slug: 'aycicek-yagi', percentEstimate: undefined },
  { name: 'Şeker', slug: 'seker', percentEstimate: undefined },
  { name: 'tuz', slug: 'tuz', percentEstimate: undefined },
  { name: 'Kakao', slug: 'kakao', percentEstimate: undefined },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_PEANUT_ID = 4 // Yer Fıstığı

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

/** EAN-13 kontrol hanesi doğrulaması (ilk 12 hane üzerinden). */
function assertEan13(barcode: string): void {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 13 haneli değil: ${barcode}`)
  const digits = barcode.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  if (check !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${barcode} (beklenen ${check})`)
  }
}

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
    name: 'Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi 100 g',
    description:
      "Yayla Hitos Yer Fıstığı Ezmeli Mısır Çerezi, mısır irmiğinden hazırlanan çıtır çerezlerin yer fıstığı ezmesi (%24), ayçiçek yağı, şeker, tuz ve kakao ile kaplanmasıyla üretilen 100 g'lık atıştırmalıktır.\n\nÜrün Türkiye'de üretilir, koruyucu atmosferde ambalajlanır ve ambalajında helal işareti taşır. Etikette trans yağ içermediği, ürünlerin hiçbir çeşidine alkol, domuz yağı ve türevlerinin katılmadığı beyan edilir. Yer fıstığı içerir; eser miktarda gluten ve süt ürünü içerebilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H5CP2GNF) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Plastik paket (PP 5, koruyucu atmosfer)',
    items: INGREDIENTS.map((entry, index) => ({
      ingredients: ingredientIds[index],
      ...(entry.percentEstimate === undefined
        ? {}
        : { percent_estimate: entry.percentEstimate }),
    })),
    allergens: ALLERGEN_PEANUT_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2105, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 502, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 62, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.4, unit: 'g' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Mısır Çerezi (Cips)' },
      { key: 'Aroma', value: 'Yer Fıstığı Ezmeli' },
      { key: 'Seri', value: 'Hitos' },
      {
        key: 'Net Miktar',
        value:
          '100 g (ambalaj görselinde gramaj basılı değil; Amazon.com.tr paket ağırlığı 0,1 kg ve aynı EAN ailesindeki Hitos Nacho Mısır Cipsi 100 g ile uyumlu)',
      },
      { key: 'Porsiyon', value: '25 g (paket başına 4 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket, PP 5, koruyucu atmosferde ambalajlanmış' },
      { key: 'Üretim Yeri', value: "Türkiye (yerli ve ithal hammadde kullanılarak üretilmiştir)" },
      { key: 'Üretici', value: 'Yayla Agro Gıda Sanayi ve Ticaret A.Ş.' },
      { key: 'Üretici Adresi', value: 'Niğde OSB 12. Cadde No.: 1 Merkez / Niğde' },
      { key: 'İşletme Kayıt No', value: 'TR-51-K-006543' },
      { key: 'Tüketici Hattı', value: '444 4 330' },
      { key: 'Web', value: 'yaylaagro.com' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Ürün Ölçüleri', value: '26,1 × 15,5 × 7,2 cm' },
      {
        key: 'Alerjen Beyanı',
        value: 'Yer fıstığı içerir; eser miktarda gluten ve süt ürünü içerebilir',
      },
      {
        key: 'Trans Yağ Beyanı',
        value: 'Trans yağ yoktur (toplam yağın 100 gramında 1 gramdan azdır)',
      },
      {
        key: 'Domuz Yağı ve Alkol Beyanı',
        value:
          'Ürünlerin hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır; formülasyonlarda bu bileşenler bulunmaz',
      },
      { key: 'Helal', value: 'Ambalaj üzerinde helal işareti (HALAL) bulunur' },
      { key: 'Ambalaj Sembolleri', value: 'PP 5, cam/çatal, geri dönüşüm, HALAL' },
      { key: 'Saklama', value: 'Doğrudan güneş ışığına maruz bırakmayınız, serin ve rutubetsiz yerde muhafaza ediniz' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 55,00 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Yer fıstığı içerir. Eser miktarda gluten ve süt ürünü içerebilir; alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Paketi açılmış veya delinmiş ürünleri satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'Son tüketim tarihi (TETT) geçmiş ürünleri satın almayınız; ambalaj açıldıktan sonra ürün doğrudan tüketilebilir.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    usage: 'Ambalaj açıldıktan sonra ürün doğrudan tüketilebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 55, date: '2026-11-03T00:00:00.000Z' }],
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
