import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Reis Kuru Fasulye 1000 g ürününü UZAK Payload REST API'sine yazar:
 * fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07MMQYRCP + ürün ambalajı (EAN-13 8690849820079).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-reis-kuru-fasulye-1000g-prod.ts
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

const BARCODE = '8690849820079'
const ASIN = 'B07MMQYRCP'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'reis-kuru-fasulye-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Reis Kuru Fasulye 1000 g ön yüz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Reis Kuru Fasulye 1000 g besin değerleri tablosu (100 g / 1 su bardağı)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Reis Kuru Fasulye 1000 g ambalaj sembolleri: TSE, ÇEVKO, doğa dostu ambalaj, kuru tut, güneşten koru',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Reis Kuru Fasulye 1000 g arka yüz: besin değerleri, saklama, üretici ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Reis Kuru Fasulye 1000 g barkod numarası 8690849820079',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 2519 // Kuru fasulye (kuru-fasulye)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 803 // Reis
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  cholesterol: 6,
  carbohydrate: 7,
  sugars: 8,
  addedSugars: 9,
  fiber: 18,
  protein: 19,
  salt: 20,
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
    name: 'Reis Kuru Fasulye 1000 g',
    description:
      "Reis Kuru Fasulye, Türkiye'de yetiştirilen dermason çeşidi kuru fasulyenin ayıklanmış, tekli 1000 g'lık paketidir. Tek bileşenden oluşur; tuz, katkı maddesi ve koruyucu içermez. Ambalajda çeşit «Dermason», sınıf 1 ve boy «B (Küçük)» olarak belirtilmiştir.\n\nPişirmeden önce 8-10 saat suda bekletilmesi önerilir; haşlanarak kuru fasulye yemeği, pilaki ve salatalarda kullanılır. Paket, 1 su bardağı (100 g) porsiyon üzerinden 10 porsiyondur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07MMQYRCP) ve ürün ambalajı (EAN-13 8690849820079).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Plastik laminat poşet (şeffaf taneli pencere)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 270, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.29, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.cholesterol, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 26, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 35, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.addedSugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 22, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Reis' },
      { key: 'Ürün Tipi', value: 'Kuru fasulye (kuru baklagil)' },
      { key: 'Çeşit', value: 'Dermason, Sınıf 1, Boy B (Küçük), TS 141' },
      { key: 'Net Miktar', value: '1000 g (35,3 oz / 2 lbs 3,3 oz)' },
      { key: 'Ambalaj', value: 'Plastik laminat poşet, şeffaf taneli pencere' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'REİS TARIMSAL ÜRÜNLER SANAYİ VE TİCARET A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Çakmaklı Mevkii, Akçaburgaz Mahallesi 3051. Sokak No: 27, 34522 Esenyurt / İstanbul',
      },
      { key: 'Telefon', value: '+90 212 671 97 00 (PBX)' },
      { key: 'Faks', value: '+90 212 671 97 01' },
      { key: 'Tüketici Danışma Hattı', value: '0212 671 97 10' },
      { key: 'E-posta', value: 'reis@reisgida.com.tr' },
      { key: 'Web', value: 'www.reisgida.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-048577' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri (Amazon)', value: '25 × 4 × 16 cm' },
      { key: 'Ürün Ağırlığı (Amazon)', value: '1,04 kg (paket ağırlığı 1,04 kg)' },
      { key: 'Parti No', value: '0621 (ambalaj üzerine damgalı); Hasat Yılı alanı boş bırakılmış' },
      { key: 'Porsiyon', value: '1 su bardağı (100 g); paket 10 porsiyon' },
      { key: 'Besin Değerleri Bazı', value: '100 g (1 su bardağı) kuru fasulye' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalajdaki ABD tarzı besin tablosu kendi içinde tutarsız: diyet lif 35 g, toplam karbonhidrat 26 g olarak basılmış (lif karbonhidratın alt bileşenidir, toplamdan büyük olamaz) ve enerji kontrolü tutmuyor (26×4 + 22×4 + 1×9 ≈ 201 kcal; basılı değer 270 kcal). Protein gram değeri ambalaj kıvrımı nedeniyle okunamıyor; %44 günlük değerden 22 g hesaplandı. Değerler düzeltilmeden, basıldığı gibi kaydedildi.',
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Ambalajda ayrı içindekiler listesi basılı değil (tek bileşenli ürün); Amazon.com.tr listesinde «İçindekiler: KURU FASULYE» yazıyor.',
      },
      {
        key: 'Sertifika ve Uygunluk',
        value:
          'TSE, TS-EN-ISO 9001, TS-EN-ISO 22000; «TSE ve Türk Gıda Kodeksi’ne uygun olarak paketlenmektedir» beyanı',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'TSE, ÇEVKO (Yeşil Nokta), doğa dostu ambalaj (Möbius), çevremizi koruyalım (Tidyman), kuru tut (şemsiye), güneş ışığından koru, gıda ile temasa uygun (çatal-bardak), Türk Malı',
      },
      { key: 'Pişirme Önerisi', value: 'Fasulyelerin daha iyi pişmesi için 8-10 saat suda bekletilmesi önerilir' },
      {
        key: 'Amazon Satış Biçimi',
        value:
          'Tekli 1 kg; aynı listede 1 Kg (2 paketi) ve 1 Kg (3 paketi) varyantları ile Barbunya / Dermason aroma varyantları var',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 191,95 TL / 1 kg (3 Kasım 2026, satıcı Amazon.com.tr, stokta)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Çiğ tüketilmez; pişirmeden önce 8-10 saat suda bekletilip haşlanarak tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj hasarlı veya açılmışsa ürünü satın almayınız; TETT (tavsiye edilen tüketim tarihi) geçmeden tüketiniz.',
      },
      {
        severity: 'medium' as const,
        text: 'Ambalajdaki besin tablosu kendi içinde çelişkili: diyet lif (35 g) toplam karbonhidrattan (26 g) yüksek basılmış, enerji değeri makro besinlerle uyuşmuyor. Tablo değerlerine temkinli yaklaşın.',
      },
    ],
    storage:
      'Bez torbada serin ve rutubetsiz yerde, güneş ışığından koruyarak saklayınız. Kullanmadan önce gözden geçiriniz.',
    usage:
      'Pişirme önerisi: Fasulyelerin daha iyi pişmesi için 8-10 saat suda bekletin. Etiketteki Kuru Fasulye Yemeği tarifi — Malzemeler: 2 su bardağı kuru fasulye, 2 yemek kaşığı zeytinyağı, 1 yemek kaşığı tereyağı, 1 adet kuru soğan, 2 adet domates, 3-4 adet tatlı sivri biber, 1 yemek kaşığı domates salçası, 1 diş sarımsak, tuz, karabiber, 5-6 su bardağı su. Yapılışı: Bir gece önceden suda beklettiğiniz fasulyeleri süzünüz ve üstüne 2-3 parmak geçecek kadar su ilave ederek 25 dakika kadar haşlayınız. Başka bir tencerede zeytinyağı ve tereyağına doğranmış soğanı, biberleri ekleyerek kavurunuz. Domates salçasını ve doğranmış domatesleri bir diş sarımsak ekleyerek kavurmaya devam ediniz ve ardından su ekleyerek karıştırınız. Haşladığınız fasulyeleri ilave edip tencerenin kapağını kapatarak fasulyeler yumuşayıncaya kadar pişiriniz. Tuzunu ve biberini ilave ederek bir taşım daha kaynatıp servis ediniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 191.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
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
