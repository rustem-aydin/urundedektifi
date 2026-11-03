import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0DY1R6KXV + ürün ambalajı (EAN-13 8693374265551).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-haslanmis-suzulmus-nohut-150g-prod.ts
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

const BARCODE = '8693374265551'
const GTIN = '8693374265551'
const ASIN = 'B0DY1R6KXV'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-haslanmis-suzulmus-nohut-150g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g içindekiler: haşlanmış nohut (su, nohut) %97, bitkisel yağ (ayçiçek yağı)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g besin değerleri tablosu (100 g için)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g ambalaj sembolleri: PP 5 geri dönüşüm, helal, gıda ile temasa uygun, kuru ve güneşsiz saklama',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g arka yüz: içindekiler, besin değerleri, üretici, saklama ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g barkod numarası 8693374265551',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan içindekiler (su ve yağ alt bileşen olarak ayrı bağlanır). */
const INGREDIENT_IDS = {
  chickpeas: 1170, // Nohut
  water: 278, // Su
  sunflowerOil: 298, // Ayçiçek yağı
} as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
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
    name: 'Yayla Haşlanmış Suyu Süzülmüş Nohut 150 g',
    description:
      'Yayla Haşlanmış Suyu Süzülmüş Nohut, haşlanıp suyu süzülmüş nohudun tek porsiyonluk (150 g) paketidir. Haşlanmış nohut (su, nohut) %97 ve bitkisel yağ (ayçiçek yağı) içerir; renklendirici ve koruyucu içermez. Ambalajı açıp doğrudan çorbalara, yemeklere ve salatalara eklenebilir.\n\nEtiket değerlerine göre 100 g üründe 582 kJ (139 kcal) enerji, 2,0 g yağ, 16,8 g karbonhidrat, 11,1 g lif ve 7,8 g protein bulunur; tuz 0,1 g\'dır. Ürün vegan ve helal logosu taşır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DY1R6KXV) ve ürün ambalajı (EAN-13 8693374265551).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '150 g',
    packaging: 'Tekli poşet (4 katlı BPA’sız koruyucu ambalaj)',
    items: [
      { ingredients: INGREDIENT_IDS.chickpeas, percent_estimate: 97 },
      { ingredients: INGREDIENT_IDS.water },
      { ingredients: INGREDIENT_IDS.sunflowerOil },
    ],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 582, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 139, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 16.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 11.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış suyu süzülmüş nohut (kullanıma hazır)' },
      { key: 'Net Miktar', value: '150 g' },
      { key: 'Porsiyon', value: 'Paket tek porsiyondur (1 porsiyon / 1 portion, 150 g)' },
      { key: 'Ambalaj', value: 'Tekli poşet, 4 katlı BPA’sız koruyucu ambalaj' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN' },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Web', value: 'www.yaylaagro.com (ambalajda “yaylabakliyat” sosyal medya hesapları)' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      { key: 'Standart', value: 'Gıda Kodeksi’ne uygundur' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette değer sütunu bir satır kaymış basılmıştır. Enerji (582 kJ / 139 kcal) ve %RA sütunuyla doğrulanan eşleme yazıldı: yağ 2,0 g (%3), doymuş yağ 0,3 g (%2), karbonhidrat 16,8 g (%6), şeker 0 g (%0), lif 11,1 g (%44), protein 7,8 g (%16), tuz 0,1 g (%2).',
      },
      { key: 'Besin Değerleri Bazı', value: '100 g ürün için; 1 porsiyon 150 g' },
      {
        key: 'Beyan',
        value:
          'Protein ve lif içerir; renklendirici ve koruyucu içermez; katkı maddesi içermez; vegan',
      },
      { key: 'Hazırlama', value: 'Aç ve çorbalara, yemeklere, salatalara ekle (ambalaj önerisi)' },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, yeşil nokta, helal, QR kod',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Ambalajda alerjen uyarısı yok; Amazon ürün detayında “Gluten içerebilir” yazar',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli paket (150 g); aynı ürün ailesinde 3’lü paket ve 150 g × 12 varyantları da satılıyor',
      },
      {
        key: 'Ürün Ölçüleri',
        value: '15,1 × 4,8 × 3,5 cm (paket, Amazon ölçümü); paket ağırlığı 0,19 kg',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 54,95 TL (150 g, 100 g başına 36,63 TL, 3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ambalajda alerjen uyarısı ve içindekiler listesinde gluten kaynağı yoktur; Amazon ürün detayında “Gluten içerebilir” beyanı yer alır. Çölyak hastaları ve gluten duyarlılığı olanlar üreticiye danışmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Şişmiş ve sızıntılı ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında, güneş ışığından uzak ortamda saklayınız. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Ambalajı açıp çorbalara, yemeklere ve salatalara ekleyin; yemeğe ekstra zenginlik katar. Isıtılarak da tüketilebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 54.95, date: '2026-11-03T00:00:00.000Z' }],
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
