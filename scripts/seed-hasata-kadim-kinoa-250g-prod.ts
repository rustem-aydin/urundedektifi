import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Hasata Kadim Kinoa Tohumu 250 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0FHQ6ZD24 + ürün ambalajı (EAN-13 8684252801497).
 * Mevcut OFF taslağı (barkod 8684252801497) güncellenir; yeni kayıt açılmaz.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-hasata-kadim-kinoa-250g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8684252801497'
const ASIN = 'B0FHQ6ZD24'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'hasata-kadim-kinoa-250g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g içindekiler: kinoa tohumu ve muhafaza koşulları',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g ambalaj sembolleri: gıda ile temasa uygun, çevreyi koruyunuz, güneş ışığından koruyunuz, kuru tutunuz, geri dönüşüm',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g arka yüz: besin değerleri, pişirme önerisi, üretici ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Hasata Kadim Kinoa Tohumu 250 g barkod numarası 8684252801497',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 847 // kinoa (kinoa)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1098 // Hasata
const CATEGORY_ID = 28 // Baklagil & Tahıl
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
  potassium: 35,
  phosphorus: 38,
  iron: 39,
  magnesium: 40,
  zinc: 41,
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
    name: 'Hasata Kadim Kinoa Tohumu 250 g',
    description:
      "Hasata Kadim Kinoa Tohumu, ayıklanmış kinoa tanesinin 250 g'lık paketidir. Tek bileşenden oluşur; katkı maddesi ve tuz içermez. Ambalajda ürün «Yüksek Lif (High Fiber), Yüksek Demir (High Fe), Yüksek Magnezyum (High Mg), Glutensiz (Gluten Free)» olarak tanımlanır.\n\n100 g'ında 10,8 g protein, 7,7 g lif ve 5,8 mg demir bulunur. Kısır, bowl, salata ve smoothie tariflerinde kullanılır; pişirmeden önce yıkanır. Hasata paketleri kontrollü atmosfer teknolojisiyle paketlenir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FHQ6ZD24) ve ürün ambalajı (EAN-13 8684252801497).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Danem Gıda San. ve Tic. A.Ş. (Tiryaki kuruluşu)',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: 'Plastik ambalaj (doypack poşet)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    labels: ['gluten-free'],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1600, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 383, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 9.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 60.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 7.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 478, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 362, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 170, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.iron, amount: 5.8, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.zinc, amount: 2.8, unit: 'mg' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Hasata' },
      { key: 'Ürün Tipi', value: 'Kinoa tohumu (bütün tane)' },
      { key: 'Net Miktar', value: '250 g' },
      { key: 'Ambalaj', value: 'Plastik doypack poşet; kontrollü atmosfer teknolojisiyle paketlenmiştir' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Gıda İşletmecisi', value: 'Danem Gıda San. ve Tic. A.Ş. (Tiryaki kuruluşu)' },
      {
        key: 'Üretici Adresi',
        value:
          'Mersin Tarsus Organize Sanayi Bölgesi - Gelişme Alanı, Burhan OSB Mah. Kadri Şaman Bulvarı No: 5, Akdeniz / Mersin',
      },
      { key: 'Telefon', value: '+90 324 241 53 00' },
      { key: 'Faks', value: '+90 324 241 53 25' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-034701' },
      { key: 'Tüketici Hattı', value: 'Hasata Müşteri İletişim Merkezi 0800 211 11 02' },
      { key: 'E-posta', value: 'info@hasata.com.tr' },
      { key: 'Web', value: 'www.hasata.com.tr' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Formu (Amazon)', value: 'Bütün' },
      { key: 'Ürün / Paket Ağırlığı (Amazon)', value: '0,25 kg (birim: 1 paket)' },
      {
        key: 'Beyanlar',
        value:
          'Yüksek lif, yüksek demir, yüksek magnezyum, glutensiz; 100 g’da 10,8 g protein ve 7,7 g lif',
      },
      {
        key: 'Besin Değerleri Bazı',
        value:
          '100 g kuru ürün. Ambalajdaki tablo: «100g için*» ve «100g için RA**» sütunları; * kuru ürün değeri, ** yetişkinlerin günlük referans alım miktarı',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Gıda ile temasa uygun (çatal-bardak), çevreyi koruyunuz (Tidyman), güneş ışığından koruyunuz, kuru tutunuz (şemsiye), geri dönüşüm',
      },
      { key: 'Üretim / Parti Bilgisi', value: 'ÜT, TETT, ürün yılı, parti no ve menşe ambalaj üzerine kodlanmıştır' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr listesinde 4 Kasım 2026 itibarıyla satın alma seçeneği yok (yalnız «Satın Alma Seçeneklerini Gör»); fiyat kaydedilmedi',
      },
      {
        key: 'Katalog Notu',
        value:
          'Amazon listesinde «Çeşitlilik: Kadife Fasulye» ve «Ürün Ağırlığı: 250 Kilogram» gibi hatalı alanlar var; kayıt ambalaj bilgilerine göre dolduruldu',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Üretim tarihi (ÜT), tavsiye edilen tüketim tarihi (TETT), ürün yılı ve parti no ambalaj üzerindedir; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage: 'Serin ve kuru ortamda, gün ışığından uzak yerde muhafaza edilmelidir.',
    usage:
      'Pişirme önerisi: İyice yıkayıp iki katı su ile kaynatın, suyunu çekene kadar yaklaşık 15 dakika pişirerek tariflerinizde kullanabilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
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

  console.log(`\nÜrün ${existing ? `güncellendi (id ${existing.id})` : 'oluşturuldu'}: ${product.id}`)
  console.log(`https://barkoddedektifi.com/urun/${BARCODE}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
