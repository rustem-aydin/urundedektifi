import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Soslu Mısır 120 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0DY1PHPWL + ürün ambalajının ön/arka yüzü
 * (EAN-13 8693374272269). Prod'da bu barkod OFF import'undan "Yayla Domates
 * Soslu Mısır" adıyla, boş içindekiler ve görsellerle duruyor (id 13337);
 * betik o kaydı günceller, yenisini açmaz.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekiler kayıtlarını slug üzerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-soslu-misir-120g-prod.ts
 *   (veya SEED_EMAIL / SEED_PASSWORD)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8693374272269'
const ASIN = 'B0DY1PHPWL'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-soslu-misir-120g')
const PRODUCT_NAME = 'Yayla Soslu Mısır 120 g'

/** EAN-13 doğrulama hanesini kontrol eder; yanlış barkodla yazmayı engeller. */
function assertEan13(value: string): void {
  if (!/^\d{13}$/.test(value)) throw new Error(`EAN-13 13 haneli olmalı: ${value}`)
  const digits = value.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  if (check !== digits[12]) throw new Error(`EAN-13 doğrulama hanesi hatalı: ${value}`)
}

const IMAGES = [
  {
    key: 'front',
    file: 'yayla-soslu-misir-front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: kırmızı ambalaj, "Soslu Mısır / Sweet Corn with Tomato Sauce" başlığı, 120 g e, kaşık paketin içinde, glutensiz ve doğal lif kaynağı rozetleri`,
  },
  {
    key: 'ingredients',
    file: 'yayla-soslu-misir-ingredients.jpg',
    alt: `${PRODUCT_NAME} içindekiler yakın çekim: Süt mısırı (%79), domates sosu (%21) ve sosun alt bileşenleri; "Süt ürünleri içerir" beyanı`,
  },
  {
    key: 'nutrition',
    file: 'yayla-soslu-misir-nutrition.jpg',
    alt: `${PRODUCT_NAME} enerji ve besin öğeleri tablosu (100 g için; enerji, yağ, karbonhidrat, şeker, lif, protein, tuz)`,
  },
  {
    key: 'recycling',
    file: 'yayla-soslu-misir-recycling.jpg',
    alt: `${PRODUCT_NAME} geri dönüşüm ve ambalaj sembolleri: güneşten uzak, kuru tutun, çöpe atmayın, gıda temasına uygunluk, PP 5, geri dönüşüm ve helal işareti`,
  },
  {
    key: 'back',
    file: 'yayla-soslu-misir-back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: açma adımları, içindekiler, besin tablosu, saklama koşulları, üretici bilgileri ve barkod`,
  },
  {
    key: 'barcode',
    file: 'yayla-soslu-misir-barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8693374272269`,
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler). Yüzdeler ürün toplamına göredir:
 * süt mısırı %79 + domates sosu %21; sosun içinde domates püresi %9,
 * süt kreması %3 ve sarımsak tozu %1 olarak basılmıştır.
 * "Süt mısırı" master'da yok; betik slug'dan bulur, yoksa oluşturur.
 */
const INGREDIENTS = [
  { id: null, name: 'Süt mısırı', slug: 'sut-misiri', percent: 79 },
  { id: 278, name: 'Su', slug: 'su', percent: null },
  { id: 298, name: 'Ayçiçek yağı', slug: 'aycicek-yagi', percent: null },
  { id: 399, name: 'Domates püresi', slug: 'domates-puresi', percent: 9 },
  { id: 351, name: 'Domates salçası', slug: 'domates-salcasi', percent: null },
  { id: 849, name: 'Süt kreması', slug: 'sut-kremasi', percent: 3 },
  { id: 137, name: 'tuz', slug: 'tuz', percent: null },
  { id: 217, name: 'mısır nişastası', slug: 'misir-nisastasi', percent: null },
  {
    id: 2690,
    name: 'Kurutulmuş sarımsak tozu',
    slug: 'kurutulmus-sarimsak-tozu',
    percent: 1,
  },
  { id: 4024, name: 'Kırmızı Toz Biber', slug: 'kirmizi-toz-biber', percent: null },
  { id: 4123, name: 'Acı toz kırmızı biber', slug: 'aci-toz-kirmizi-biber', percent: null },
  { id: 1844, name: 'Pancar şekeri', slug: 'pancar-sekeri', percent: null },
  { id: 2272, name: 'Elma sirkesi', slug: 'elma-sirkesi', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık (Thraki Soslu Mısır emsali)
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_MILK_ID = 3 // Süt (etiket: "Süt ürünleri içerir.")

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
  sodium: 21,
} as const

async function resolveIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (existing) {
      const doc = existing as { id: number; name?: string; slug?: string }
      if (doc.slug !== entry.slug) {
        throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
      }
      if (entry.id !== null && doc.id !== entry.id) {
        throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
      }
      ids.push(doc.id)
      continue
    }
    if (entry.id !== null) {
      throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    }
    const created = await client.create('ingredients', {
      name: entry.name,
      slug: entry.slug,
    })
    console.log(`  + içindekiler: ${entry.name} (${created.id})`)
    ids.push(created.id)
  }
  return ids
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

  const ingredientIds = await resolveIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Yayla Soslu Mısır, süt mısırının (%79) domates sosuyla (%21) hazırlanıp katlı BPAsız koruyucu ambalaja kaşıkla birlikte paketlendiği hazır atıştırmalıktır; 120 g'lık tek porsiyonluk pakette satılır. Sos; su, ayçiçek yağı, domates püresi, domates salçası, süt kreması, tuz, mısır nişastası, sarımsak tozu, kırmızı toz biber, acı kırmızı toz biber, pancar şekeri ve elma sirkesinden oluşur. Ürün koruyucu ve renklendirici içermez, glutensizdir ve süt ürünleri içerir.\n\nAmbalajda \"Doğal Lif Kaynağı\" beyanı ve kaşık paketin içinde servis kolaylığı bulunur; etiket 1 paketin (120 g) 106 kcal olduğunu belirtir, besin tablosu 100 g üzerindendir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DY1PHPWL) ve ürün ambalajının ön/arka yüzü. Kayıt daha önce Open Food Facts'ten \"Yayla Domates Soslu Mısır\" adıyla, boş içindekiler ve görsellerle gelmişti; bu betik aynı EAN kaydını ambalaj verisiyle doldurur. Amazon ürün detayında \"Gluten içerebilir\" beyanı yer alırken ambalaj GLUTENSİZ rozeti taşıyor; çelişki teknik özelliklerde ve uyarılarda açıkça yazılmıştır.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '120 g',
    packaging: 'Katlı BPAsız koruyucu ambalaj (kaşık paketin içinde, geri dönüşüm kodu PP 5)',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent ?? undefined,
    })),
    allergens: ALLERGEN_MILK_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 369, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 88, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 9.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 2.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 275, unit: 'mg' },
      ],
    },
    labels: ['gluten-free', 'no-additives', 'halal-certified'] as const,
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Soslu mısır (hazır atıştırmalık)' },
      { key: 'İngilizce Adı', value: 'Sweet Corn with Tomato Sauce' },
      { key: 'Net Miktar', value: '120 g (1 porsiyon)' },
      { key: 'Çeşni', value: 'Domates soslu' },
      {
        key: 'Bileşen Yapısı',
        value:
          'Süt mısırı %79; domates sosu %21 (sos içinde domates püresi %9, süt kreması %3, sarımsak tozu %1)',
      },
      { key: 'Menşei', value: 'Türkiye' },
      {
        key: 'Ambalaj',
        value:
          'Katlı BPAsız koruyucu ambalaj; kaşık paketin içinde, aç-eat kapaklı; geri dönüşüm kodu PP 5',
      },
      { key: 'Üretici', value: 'Yayla Agro Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 102099. Sokak No: 1, Toroslar / Mersin / Türkiye',
      },
      { key: 'Telefon', value: '+90 324 221 62 76 (pbx)' },
      { key: 'Faks', value: '+90 324 221 62 78' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Standart', value: "Gıda Kodeksi'ne uygundur" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ağırlığı', value: '120 g' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 74,95 TL (120 g tekli paket, 3 Kasım 2026; 100 g başına 62,46 TL)',
      },
      {
        key: 'Besin Tablosu Notu',
        value: 'Ambalaj değerleri 100 g üzerindendir; 1 paket (120 g) 106 kcal olarak belirtilir',
      },
      { key: 'Sodyum Notu', value: 'Ambalajda sodyum satırı yok; kayıttaki 275 mg OFF verisinden korunmuştur (0,7 g tuzla uyumlu)' },
      { key: 'Gluten Beyanı', value: 'Ambalajda GLUTENSİZ rozeti var; içindekilerde gluten kaynağı yok' },
      { key: 'Süt Beyanı', value: 'Süt ürünleri içerir (süt kreması)' },
      { key: 'Helal Beyanı', value: 'Ambalaj üzerinde helal işareti bulunur' },
      {
        key: 'Sağlık Beyanları',
        value:
          'Doğal lif kaynağı (ambalaj); düşük doymuş yağ içerir, lif içerir, düşük şeker içerir (Amazon ürün madde işaretleri)',
      },
      { key: 'Diyet', value: 'Vejetaryen (Amazon ürün detayı)' },
      { key: 'Servis', value: 'Kaşık paketin içindedir; ambalaj açılıp doğrudan tüketilir' },
      {
        key: 'TETT / Parti',
        value: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalaj üzerine kodlanmıştır',
      },
      {
        key: 'Amazon Alerjen Çelişkisi',
        value:
          'Amazon ürün detayı "Gluten içerebilir" diyor; ambalaj GLUTENSİZ rozeti taşıyor ve gluten kaynağı içermiyor. Bu kayıt ambalajı esas alır.',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Süt ürünleri içerir (süt kreması). Laktoz intoleransı veya süt alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Amazon ürün detayında "Gluten içerebilir" beyanı yer alırken ambalaj glutensiz olduğunu belirtiyor; çölyak hastalığı olanlar ambalajı teyit etmelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Şişmiş ve sızıntılı ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalajın üzerindedir.',
      },
    ],
    storage:
      "Oda sıcaklığında, güneş ışığından uzak ortamda saklayınız. Açıldıktan sonra buzdolabında (+4 °C) muhafaza ediniz ve 2 gün içinde tüketiniz.",
    usage:
      'Ambalajı açma çizgisinden yırtıp kapağını kaldırın; kaşık paketin içindedir, doğrudan ambalajından tüketebilirsiniz. Atıştırmalık olarak veya ana yemeklerin yanında servis edilebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 74.95, date: '2026-11-03T00:00:00.000Z' }],
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
