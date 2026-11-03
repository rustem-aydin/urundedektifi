import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Patlayan Mısır (Cin Mısır) 500 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0F6YBL7YQ (4'lü paket listesi) + 500 g tekil ambalaj
 * (EAN-13 8693374236414, kontrol hanesi doğrulandı).
 *
 * Kayıt zaten OFF aktarımından var (id 15365): eksik alanlar doldurulur, düşük
 * çözünürlüklü OFF görseli yerine ambalaj fotoğrafları yazılır. Çoklu paket
 * listesi tek ürün kaydı açmaz; demet bilgisi teknik özelliklere işlenir.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-patlayan-misir-500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374236414'
const GTIN = '8693374236414'
const ASIN = 'B0F6YBL7YQ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-cin-misir-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Patlayan Mısır (Cin Mısır) 500 g ön yüz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Patlayan Mısır 500 g besin değerleri tablosu (100 g pişmemiş mısır)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Patlayan Mısır 500 g ambalaj ve geri dönüşüm sembolleri (PP 5, 2502)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Patlayan Mısır 500 g arka yüz: üretici bilgileri, pişirme önerisi, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Patlayan Mısır 500 g barkod numarası 8693374236414',
  },
  {
    key: 'bundle',
    file: 'bundle.jpg',
    alt: 'Yayla Patlayan Mısır 500 g dörtlü koli (4 × 500 g) ambalaj görseli',
  },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_CORN_ID = 631 // Cin mısır

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
  phosphorus: 38,
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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Patlayan Mısır (Cin Mısır) 500 g',
    description:
      "Yayla Patlayan Mısır, sıcak tavada veya düdüklü tencerede patlatılarak tüketilen 500 g'lık cin mısır (patlatmalık mısır) paketidir. Tek bileşenli, katkı maddesi içermeyen bir tahıl ürünüdür; yağsız ve az tuzla patlatıldığında kalorisi düşük bir atıştırmalığa dönüşür.\n\nAmbalajda ürün, Türkiye'de üretilmiş cin mısır (TS 3415) olarak tanımlanır; kırmızı tasarımlı güncel pakette 15 porsiyon ve doğal lif/mineral/protein kaynağı beyanları yer alır. Amazon listesinde ürün 4'lü paket (4 × 500 g) olarak satılır; bu kayıt tekil 500 g ambalajın EAN'ini taşır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F6YBL7YQ) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Plastik paket (PP 5, geri dönüştürülebilir)',
    items: [{ ingredients: INGREDIENT_CORN_ID, percent_estimate: 100 }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1618, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 387, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 4.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 77.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.87, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 15, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 358, unit: 'mg' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Cin Mısır (patlatmalık/patlayan mısır)' },
      { key: 'Net Miktar', value: '500 g (ambalajda "500 g e")' },
      { key: 'Porsiyon', value: 'Kırmızı tasarımlı ambalajda 15 porsiyon (yaklaşık 33 g)' },
      { key: 'Sınıf', value: '1' },
      { key: 'Menşe', value: "Türkiye (TS 3415; Türk Gıda Kodeksi'ne uygundur)" },
      { key: 'Üretici', value: 'Yayla Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327 Kazan / ANKARA / TÜRKİYE',
      },
      { key: 'Telefon', value: '+90 312 815 49 50 (pbx)' },
      { key: 'Faks', value: '+90 312 815 47 90' },
      { key: 'İşletme Kayıt No', value: 'TR-06-K-000171' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: `${ASIN} (4'lü paket listesi)` },
      { key: 'Amazon Satış Biçimi', value: "4'lü paket: 4 × 500 g = 2 kg" },
      {
        key: 'Fiyat Kaynağı',
        value:
          "Amazon.com.tr — 4'lü paket 136,44 TL (68,22 TL/kg; 500 g tekil karşılığı 34,11 TL), 3 Kasım 2026. Listede '90 günün en düşük fiyatı' etiketi vardı.",
      },
      {
        key: 'Besin Değerleri Notu',
        value: 'Tablo 100 g pişmemiş (uncooked) mısır için verilmiştir; patlatıldıktan sonra değerler değişir.',
      },
      {
        key: 'Beyanlar',
        value:
          'Katkı maddesi içermez, GDO içermez, %100 yerli; ön yüzde yüksek antioksidan, B grubu vitaminleri ve yüksek lif vurgusu (mor tasarımlı paket)',
      },
      { key: 'Helal', value: 'Amazon listesinde "Diyet Türü: Helal"; ambalajda helal işareti yok' },
      { key: 'Ambalaj Sembolleri', value: 'PP 5, 2502 geri dönüşüm, cam/çatal, çöp kutusu, güneş, şemsiye' },
      {
        key: 'Ambalaj Tasarımı',
        value:
          'Amazon galerisinde iki tasarım var: mor (eski) ve kırmızı (güncel, 15 porsiyon). Etiket verileri ve barkod mor tasarımlı 500 g paketten okundu.',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'TETT, parti no (PN) ve ürün yılı ambalajın üzerindedir; son tüketim tarihi geçmiş ürünü tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Üretici, mısırın mikrodalgada poşet içinde değil tencere/düdüklü yöntemiyle patlatılmasını önerir.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Düdüklü tencereye mısırları koyup üzerine çıkacak kadar sıvı yağ ekleyiniz, kapağını kapatıp orta ateşte patlayana kadar pişiriniz; kapağı açıp sıcak servis ediniz. Yağsız ve az tuzla patlatıldığında kalorisi düşük, besin değeri yüksek bir atıştırmalık olur.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 34.11, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: null,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
      { image: media.bundle, caption: "Amazon satış biçimi: 4'lü koli (4 × 500 g)" },
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
