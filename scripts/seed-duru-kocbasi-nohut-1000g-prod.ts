import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Duru Yerli Koçbaşı Nohut 8 mm 1000 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08RXFK5NH + ürün ambalajı (EAN-13 8691440710448).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-duru-kocbasi-nohut-1000g-prod.ts
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

const BARCODE = '8691440710448'
const GTIN = '8691440710448'
const GTIN14 = '08691440710448'
const ASIN = 'B08RXFK5NH'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'duru-kocbasi-nohut-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Duru Yerli Koçbaşı Nohut 8 mm 1000 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Duru Koçbaşı Nohut 1000 g içindekiler: yerli koçbaşı nohut 8 mm (Chickpeas/Kichererbsen)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Duru Koçbaşı Nohut 1000 g besin değerleri tablosu (100 g pişmemiş nohut)',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Duru Koçbaşı Nohut 1000 g barkod numarası 8691440710448',
  },
  {
    key: 'usage',
    file: 'usage.jpg',
    alt: 'Duru Koçbaşı Nohut 1000 g kullanma talimatı ve etli nohut yemeği tarifi',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 1170 // Nohut (nohut)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 606 // Duru
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

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
    name: 'Duru Yerli Koçbaşı Nohut 8 mm 1000 g',
    description:
      "Duru Yerli Koçbaşı Nohut, Türkiye'de yetiştirilen koçbaşı nohudun 8 mm tane iriliğinde ayıklanmış hâlidir. Tek içindekiler maddesinden oluşur; katkı maddesi, koruyucu veya tuz eklenmemiştir.\n\nEtiketteki besin değerleri 100 g pişmemiş ürün için verilir: 19,8 g protein, 10,5 g lif, 1062 kJ (278 kcal) enerji. Pişirmeden önce 8 saat suda ıslatılması önerilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08RXFK5NH, model AT50201, GTIN 08691440710448) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Duru Bakliyat',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Plastik paket',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1062, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 278, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 30.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 10.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 19.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.06, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Duru' },
      { key: 'Ürün Tipi', value: 'Koçbaşı nohut (bütün tane)' },
      { key: 'Çeşit', value: 'Yerli koçbaşı nohut' },
      { key: 'Tane İriliği', value: '8 mm' },
      { key: 'Net Miktar', value: '1000 g' },
      { key: 'Ambalaj', value: 'Plastik paket' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'Duru Bakliyat' },
      { key: 'İşletme Kayıt No', value: 'TR-70-K-000090' },
      {
        key: 'AB İthalatçısı',
        value: 'Durkar Lebensmittel GmbH, Im Media Park 8, 50670 Köln / Almanya (www.durkargmbh.com)',
      },
      { key: 'Tarif Sitesi', value: 'www.durulezzetler.com' },
      { key: 'Besin Değerleri Bazı', value: '100 g pişmemiş (çiğ) nohut için' },
      { key: 'EAN-13', value: GTIN },
      { key: 'GTIN-14', value: GTIN14 },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Model Numarası', value: 'AT50201' },
      { key: 'Paket Ağırlığı', value: '0,98 kg' },
      { key: 'Amazon Ürün Özelliği', value: 'Vejetaryen' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 98,09 TL / kg (3 Kasım 2026); etiketli önceki fiyat 108,99 TL',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Çiğ tüketilmez; kullanmadan önce 8 saat suda ıslatılıp pişirilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj hasarlı veya açılmışsa ürünü satın almayınız; TETT (tavsiye edilen tüketim tarihi) geçmeden tüketiniz.',
      },
    ],
    storage: 'Güneş ışığı almayan, serin ve rutubetsiz yerde saklayınız.',
    usage:
      'Ürünü kullanmadan önce 8 saat boyunca ıslatınız. Etiketteki ETLİ NOHUT YEMEĞİ tarifi: 1,5 su bardağı Duru Yerli Koçbaşı Nohut 8 mm, 1 adet orta boy soğan, 500 g kuşbaşı doğranmış et, 1 yemek kaşığı domates salçası, 1 yemek kaşığı biber salçası, 2 yemek kaşığı ayçiçek yağı, ½ tatlı kaşığı tuz, 3 su bardağı sıcak su. Nohutu akşamdan ıslatın. Basınçlı tencerede eti pembeleşinceye kadar kavurun, ince doğradığınız soğanı ve ayçiçek yağını ekleyip kavurun; salçaları ilave ederek karıştırın. Islatılmış nohutu ekleyip karıştırın, 3 su bardağı su ve tuzu ilave edin. Düdüklü tencerede buhar çıkmaya başladıktan sonra kısık ateşte 35 dakika pişirin, ocağı kapatıp 10 dakika dinlendirdikten sonra servis yapın.',
    model: 'AT50201',
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 98.09, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
      { image: media.usage, caption: 'Kullanma talimatı ve tarif' },
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
