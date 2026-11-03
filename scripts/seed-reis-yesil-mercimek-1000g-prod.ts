import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Reis Yeşil Mercimek 1000 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B00IEOLYXQ + ürün ambalajı (EAN-13 8690849820154).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-reis-yesil-mercimek-1000g-prod.ts
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

const BARCODE = '8690849820154'
const GTIN = '8690849820154'
const ASIN = 'B00IEOLYXQ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'reis-yesil-mercimek-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g ön yüz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g besin değerleri tablosu (1 bardak / 100 g pişmemiş ürün)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g TSE, ÇEVKO ve ambalaj sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g arka yüz: besin değerleri, saklama koşulları, tarif ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g barkod numarası 8690849820154',
  },
  {
    key: 'manufacturer',
    file: 'manufacturer.jpg',
    alt: 'Reis Yeşil Mercimek 1000 g üretici bilgileri, TSE/ISO belgeleri ve Tüketici Danışma Hattı',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 3064 // Yeşil Mercimek (yesil-mercimek)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 803 // Reis
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  cholesterol: 6,
  carbohydrate: 7,
  sugars: 8,
  addedSugars: 9,
  fiber: 18,
  protein: 19,
  sodium: 21,
  transFat: 52,
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

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Reis Yeşil Mercimek 1000 g',
    description:
      "Reis Yeşil Mercimek, Türkiye'de yetiştirilen Sultani çeşidi yeşil mercimeğin 1 kg'lık paketidir. Ürün tek bileşenden oluşur: yeşil mercimek. Katkı maddesi, tuz ve koruyucu eklenmemiştir; ambalajda TSE ve Türk Gıda Kodeksi'ne uygunluk beyanı yer alır. Ürün kabuklu, 1. sınıf (TS 143) olarak sınıflandırılmıştır.\n\nÇorba, salata ve yemeklerde kullanılır; pişirmeden önce ayıklanıp yıkanır. Etiket değerlerine göre 1 bardak (100 g) pişmemiş üründe 290 kcal, 34 g karbonhidrat, 28 g lif ve 22 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00IEOLYXQ) ve ürün ambalajı (EAN-13 8690849820154).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Şeffaf plastik paket',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1213, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 290, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.17, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.cholesterol, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 34, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 28, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.addedSugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 22, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Reis' },
      { key: 'Ürün Tipi', value: 'Yeşil mercimek (kabuklu, kuru baklagil)' },
      { key: 'Çeşit', value: 'Sultani Mercimek' },
      { key: 'Ürün Grubu / Sınıf', value: 'Kabuklu / 1. sınıf (TS 143)' },
      { key: 'Net Miktar', value: '1000 g' },
      { key: 'Porsiyon', value: '1 bardak (100 g); pakette yaklaşık 10 porsiyon' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Çakmaklı Mevkii, Akçaburgaz Mahallesi 3051. Sokak No: 7, 34522 Esenyurt / İstanbul',
      },
      { key: 'Telefon', value: '+90 212 671 97 00' },
      { key: 'Tüketici Danışma Hattı', value: '0212 671 97 10' },
      { key: 'E-posta', value: 'reis@reisgida.com.tr' },
      { key: 'Web', value: 'www.reisgida.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-048577' },
      { key: 'Kalite Belgeleri', value: 'TS-EN-ISO 9001 ve TS-EN-ISO 22000' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '25 × 4 × 16 cm' },
      { key: 'Ürün Ağırlığı', value: '1,03 kg (paket ağırlığı 1,04 kg)' },
      { key: 'Besin Değerleri Bazı', value: '1 bardak (100 g) pişmemiş yeşil mercimek' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette enerji yalnız kalori olarak basılı; kJ değeri kcal × 4,184 ile hesaplandı (1213 kJ). Lif 28 g, toplam karbonhidrat 34 g altında ayrı satır olarak basılı; enerji ancak lif ayrı sayıldığında tutuyor (34×4 + 28×2 + 22×4 + 0,5×9 ≈ 285 kcal).',
      },
      {
        key: 'Etiket Notu',
        value: 'Etiket beyanı: "Önemli miktarda vitamin D, kalsiyum, demir ve potasyum içermez".',
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Ambalajda ayrı "içindekiler" satırı basılı değil; ürün adı beş dilde "Yeşil Mercimek" olarak yazılı. Amazon listesinde içindekiler: YEŞİL MERCİMEK.',
      },
      { key: 'Pişirme İpucu', value: 'Limon suyu, mercimek kabuklarının dökülmesini önler (ambalaj).' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'TSE, ÇEVKO, doğa dostu ambalaj, Tidyman (çevremizi koruyalım), kuru yerde saklayın, güneş ışığından koruyun',
      },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 1 kg paket (Amazon.com.tr tarafından satılır ve gönderilir)' },
      { key: 'Liste Fiyatı', value: '177,95 TL' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 169,05 TL / kg (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Kullanmadan önce gözden geçiriniz; taş ve yabancı madde ayıklayıp yıkayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj hasarlı veya açılmışsa satın almayınız; bez torbada serin ve rutubetsiz yerde saklayınız.',
      },
    ],
    storage:
      'Bez torbada serin ve rutubetsiz yerde, güneş ışığından koruyarak saklayınız. Kullanmadan önce gözden geçiriniz.',
    usage:
      'Etiketteki Erişteli Yeşil Mercimek Yemeği tarifi — Malzemeler: 1 su bardağı yeşil mercimek, 1/2 su bardağı erişte, 1 adet soğan, 1 yemek kaşığı salça, 4 yemek kaşığı sıvı yağ, 5–6 su bardağı su, tuz. Yapılışı: Derin bir tencerede yağı kızdırıp yemeklik doğradığınız soğanı ve salçayı ilave ederek kavurunuz. Yıkayıp suyunu süzdüğünüz yeşil mercimeği ekleyip karıştırınız. 5 su bardağı su ekleyerek tencerenin kapağını kapatınız. Su kaynamaya başladıktan sonra 10–15 dk pişiriniz. Erişteleri ilave edip mercimekler ve erişteler yumuşayana kadar pişiriniz. Tuzunu ekleyerek bir taşım daha kaynatınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 169.05, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
      { image: media.manufacturer, caption: 'Üretici ve ambalaj bilgileri' },
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
