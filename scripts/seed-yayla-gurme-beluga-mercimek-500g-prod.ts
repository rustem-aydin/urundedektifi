import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Beluga Mercimek 500 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08D3FBKZV + ürün ambalajı (EAN-13 8693374239354).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-gurme-beluga-mercimek-500g-prod.ts
 *   veya SEED_EMAIL / SEED_PASSWORD ile.
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374239354'
const GTIN = '8693374239354'
const ASIN = 'B08D3FBKZV'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'beluga-mercimek-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g ürün ve menşe beyanı: Beluga Mercimeği, İspanya',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g besin değerleri tablosu (100 g pişmemiş ürün)',
  },
  {
    key: 'symbols',
    file: 'symbols.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g sertifika, geri dönüşüm ve saklama sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g arka yüz: besin değerleri, pişirme önerisi, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Beluga Mercimek 500 g barkod numarası 8693374239354',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi; master kayıt yoksa bu betik oluşturur. */
const INGREDIENT_NAME = 'Beluga Mercimeği'
const INGREDIENT_SLUG = 'beluga-mercimegi'
const INGREDIENT_ALIASES = [
  'Beluga Mercimek',
  'Beluga Lentils',
  'Beluga Lentil',
  'Siyah Beluga Mercimeği',
  'Siyah Mercimek',
]

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1027 // Yayla Gurme
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye (EAN-13 GS1 öneki 869)

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
  thiamin: 28,
  niacin: 30,
  iron: 39,
} as const

/** EAN-13 kontrol hanesi. */
function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`Geçersiz EAN-13: ${code}`)
  const digits = [...code].map(Number)
  const check = digits.pop()!
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== check) throw new Error(`EAN-13 kontrol hanesi hatalı: ${code}`)
}

async function ensureMedia(client: PayloadClient): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of IMAGES) {
    const alt = ALT[image.key]!
    const existing = await client.findOne('media', { alt: { equals: alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_DIR, image.file), { alt })
    console.log(`  + medya: ${image.file} (${created.id})`)
    ids[image.key] = created.id
  }
  return ids
}

async function ensureIngredient(client: PayloadClient): Promise<number> {
  const existing =
    (await client.findOne('ingredients', { slug: { equals: INGREDIENT_SLUG } })) ??
    (await client.findOne('ingredients', { name: { equals: INGREDIENT_NAME } }))
  if (existing) {
    console.log(`  = içindekiler: ${INGREDIENT_NAME} (${existing.id})`)
    return existing.id
  }
  const created = await client.create('ingredients', {
    name: INGREDIENT_NAME,
    slug: INGREDIENT_SLUG,
    aliases: INGREDIENT_ALIASES.map((alias) => ({ alias })),
    description:
      'Beluga mercimeği, siyah ve parlak kabuğu nedeniyle havyara benzetilen küçük taneli bir mercimek çeşididir. Kabuğu ince olduğu için pişerken dağılmaz; salata, çorba ve pilavda kullanılır.',
  })
  console.log(`  + içindekiler: ${INGREDIENT_NAME} (${created.id})`)
  return created.id
}

/** Verilen id gerçekten beklenen madde mi (yanlış master eşleşmesini yakalar). */
async function assertIngredient(
  client: PayloadClient,
  id: number,
  name: string,
): Promise<void> {
  const doc = (await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 }))
    .docs[0] as { name?: string } | undefined
  if (!doc || doc.name !== name) {
    throw new Error(`İçindekiler ${id} beklenen "${name}" değil: ${doc?.name ?? 'yok'}`)
  }
}

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const media = await ensureMedia(client)
  const ingredientId = await ensureIngredient(client)
  await assertIngredient(client, ingredientId, INGREDIENT_NAME)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Beluga Mercimek 500 g',
    description:
      "Yayla Gurme Beluga Mercimek, İspanya menşeli siyah beluga mercimeğinin 500 g'lık paketidir. Ürün tek bileşenden oluşur: beluga mercimeği. Kabuğu ince ve parlak olduğu için havyar görünümlü mercimek olarak da anılır; pişerken dağılmadan kalır. Katkı maddesi eklenmemiştir, ambalajda vegan, glutensiz ve düşük glisemik indeks beyanları ile TS-EN ISO 9001, TS-EN-ISO 22000, BRC, IFS ve helal gıda sertifikalı tesiste paketlendiği bilgisi yer alır.\n\nPişirmeden önce bolca yıkanıp yaklaşık 20 dakika pişirilir; kabuğunun açılmaması için tuz pişmeye yakın eklenir. 1 bardak çiğ mercimekten 3 bardak pişmiş mercimek elde edilir. Salata, çorba, köfte, kek, ekmek, pilav ve pürede kullanılır. Etiket değerlerine göre 100 g pişmemiş üründe 327 kcal, 55,8 g karbonhidrat, 14,2 g lif ve 27,5 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08D3FBKZV) ve ürün ambalajı (EAN-13 8693374239354).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Ayaklı poşet (stand-up ambalaj)',
    items: [{ ingredients: ingredientId, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1381, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 327, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 55.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 14.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 27.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.thiamin, amount: 0.9, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.niacin, amount: 2.6, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.iron, amount: 7.9, unit: 'mg' },
      ],
    },
    labels: ['vegan', 'gluten-free', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Beluga mercimek (siyah mercimek, kuru baklagil)' },
      { key: 'Çeşit', value: 'Beluga mercimek' },
      { key: 'Net Miktar', value: '500 g' },
      { key: 'Porsiyon', value: '1 porsiyon (50 g); pakette yaklaşık 10 porsiyon' },
      { key: 'Menşe Ülke', value: 'İspanya' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No: 1, Toroslar / Mersin / Türkiye',
      },
      { key: 'Telefon', value: '+90 324 221 62 76 (pbx)' },
      { key: 'Faks', value: '+90 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      {
        key: 'Kalite Belgeleri',
        value:
          'TS-EN ISO 9001-2008, TS-EN-ISO 22000, BRC, IFS ve Helal Gıda sertifikalı tesiste paketlenmiştir',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '19,2 × 12,5 × 5,6 cm; 540 g (Amazon.com.tr ürün detayı)',
      },
      { key: 'Besin Değerleri Bazı', value: '100 g pişmemiş (çiğ) ürün' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette 1381 kJ / 327 kcal basılı. Makro toplamı (4×27,5 protein + 4×55,8 karbonhidrat + 9×2,5 yağ + 2×14,2 lif ≈ 384 kcal) etiket enerjisinden yüksek çıkıyor; ürün kaydında etiketteki değer esas alındı.',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5, 22 PAP 1802, cam-çatal (gıda ile temasa uygun), Tidyman, güneş ışığından koruyun, kuru yerde saklayın',
      },
      {
        key: 'Ürün Beyanları',
        value:
          'VEGAN, GLUTENSİZ (GLUTEN FREE), DÜŞÜK GLİSEMİK İNDEKS (LOW GLYCEMIC INDEX), FONKSİYONEL GIDA, YÜKSEK PROTEİN / YÜKSEK LİF / YÜKSEK ANTİOKSİDAN',
      },
      {
        key: 'Pişirme İpucu',
        value:
          'Pişirmeden önce bolca yıkayınız ve 20 dakika pişiriniz; kabuğunun açılmaması için tuzu pişmeye yakın ekleyiniz. 1 bardak çiğ mercimekten 3 bardak pişmiş beluga mercimek elde edilir.',
      },
      {
        key: 'Amazon Satış Biçimi',
        value:
          'Tekli 500 g paket. Amazon galerisindeki 2\'li paket görseli (2 × 500 g) ürün galerisine alınmadı.',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 75,95 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT), parti no (PN) ve ürün yılı ambalaj üzerinde basılıdır; TETT geçmiş ürünü tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalajı hasarlı, açılmış veya nemlenmiş ürünü satın almayınız; rutubetsiz ve güneş almayan serin bir yerde saklayınız.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız. Ürünler özenle seçilerek YAYLA tesislerinde el değmeden paketlenmiştir.',
    usage:
      'Pişirmeden önce bolca yıkayınız ve 20 dakika pişiriniz. Kabuğunun açılmaması için tuzu pişmeye yakın ekleyiniz. 1 bardaktan 3 bardak pişmiş beluga mercimek hazırlanır. Salata, çorba, köfte, kek, ekmek, pilav ve pürelerde kullanabilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 75.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.symbols,
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
