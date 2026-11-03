import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Aşurelik Buğday 1 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0F4Y3VL2F (2'li paket) / B07SVNTGSV (1 kg tekli)
 * + ürün ambalajı (EAN-13 8693374011196).
 *
 * Tek kayıt ilkesi: aynı ürünün eski EAN'li (8693374264783) OFF kaydı (id 13017)
 * yeni ambalaj verisiyle güncellenir; yeni ürün açılmaz.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-asurelik-bugday-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374011196'
const PREVIOUS_BARCODE = '8693374264783'
const ASIN_SINGLE = 'B07SVNTGSV'
const ASIN_BUNDLE = 'B0F4Y3VL2F'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-asurelik-bugday-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Aşurelik Buğday 1 kg ön yüz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Aşurelik Buğday 1 kg besin değerleri tablosu (100 g, pişmemiş) ve helal logosu',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Aşurelik Buğday 1 kg ambalaj sembolleri: güneş ışığından koru, kuru tut, ısı kaynağından uzak tut, gıda ile temasa uygun, PP 5 ve 22 PAP geri dönüşüm',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Aşurelik Buğday 1 kg arka yüz: ürün bilgisi, saklama, üretici ve menşe bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Aşurelik Buğday 1 kg barkod numarası 8693374011196',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi. */
const INGREDIENT_NAME = 'Aşurelik buğday'
const INGREDIENT_SLUG = 'asurelik-bugday'

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const GLUTEN_ID = 1 // Gluten

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

async function ensureIngredient(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: INGREDIENT_NAME } })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name: INGREDIENT_NAME,
    slug: INGREDIENT_SLUG,
    aliases: [{ alias: 'Aşurelik buğday tanesi' }],
  })
  console.log(`  + içindekiler: ${INGREDIENT_NAME} (${created.id})`)
  return created.id
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

  const ingredientId = await ensureIngredient(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Aşurelik Buğday 1 kg',
    description:
      "Yayla Aşurelik Buğday, aşure ve tatlılarda kullanılan ayıklanmış buğday tanesidir (orta taneli, tip 2). Tek bileşenden oluşur; ambalajda net 1 kg ürün bulunur. Etiket beyanına göre protein kaynağı, yüksek lif kaynağı ve düşük doymuş yağlı bir üründür; gluten içerir.\n\nÜretici tarafından yarı pişmiş olarak tanımlanır: kaynatmadan sıcak suyla ıslatıp yumuşatarak salata ve köftelerde kullanılabilir; ayrıca aşure, çorba ve keşkek yapımında kullanılır.\n\nAmazon'da 1 kg tekli (ASIN B07SVNTGSV), 2'li paket (B0F4Y3VL2F) ve 3'lü paket (B0G71F61MT) olarak satılır; barkod tekil 1 kg ambalajına aittir.\n\nVeri kaynağı: Amazon.com.tr ve ürün ambalajı (EAN-13 8693374011196).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik laminat poşet (şeffaf taneli pencere)',
    items: [{ ingredients: ingredientId, percent_estimate: 100 }],
    allergens: GLUTEN_ID,
    additives: [] as number[],
    labels: ['halal-certified'],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1305, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 313, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 61, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.01, unit: 'g' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Aşurelik buğday (ayıklanmış buğday tanesi)' },
      { key: 'Tane İriliği', value: 'Orta taneli, tip 2 (Amazon üretici açıklaması)' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Ambalaj', value: 'Plastik laminat poşet, şeffaf taneli pencere' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Standart', value: 'TS 13494' },
      { key: 'Üretici', value: 'YAYLA AGRO GIDA SANAYİ VE NAKLİYAT A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / Ankara',
      },
      { key: 'Telefon', value: '+90 312 815 49 50 (pbx)' },
      { key: 'Faks', value: '+90 312 815 47 90' },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      {
        key: 'İşletme Kayıt Numaraları',
        value:
          'Ankara (ANK) TR-06-K-000171, Mersin (MER) TR-33-K-001608; üretim yeri kısaltması ambalaj üzerine kodlanmıştır',
      },
      { key: 'EAN-13', value: BARCODE },
      {
        key: 'Önceki Barkod',
        value: `${PREVIOUS_BARCODE} (Open Food Facts kaydı; tek kayıt ilkesi gereği bu ürüne birleştirildi)`,
      },
      { key: 'Amazon ASIN (1 kg tekli)', value: ASIN_SINGLE },
      { key: 'Amazon ASIN (2’li paket)', value: ASIN_BUNDLE },
      { key: 'Amazon ASIN (3’lü paket)', value: 'B0G71F61MT' },
      { key: 'Amazon Ürün Sayısı', value: '2’li paket: 2 × 1 kg = 2000 g; 3’lü paket: 3 × 1 kg' },
      {
        key: 'Ürün Ölçüleri (Amazon)',
        value: 'Paket ağırlığı 1,32 kg (2’li paket), 0,66 kg (1 kg tekli); konteyner: BPAsız koruyucu ambalaj',
      },
      { key: 'Porsiyon', value: 'Amazon “hizmet aralığı”: 10-15 porsiyon (1 kg)' },
      {
        key: 'Besin Değerleri Bazı',
        value:
          '100 g pişmemiş (çiğ) ürün; tablo başlığı “Enerji ve Besin Öğeleri (100 g’da) / Average Nutrition Values (Uncooked Per 100 g)”',
      },
      {
        key: 'Beyanlar',
        value: 'Protein kaynağıdır, yüksek lif kaynağıdır, düşük doymuş yağ içerir',
      },
      { key: 'Alerjen Beyanı', value: 'Yapısında gluten içerir' },
      {
        key: 'Sertifika ve Uygunluk',
        value:
          'ISO 9001 Kalite Yönetim Sistemi, ISO 22000 Gıda Güvenliği Yönetim Sistemi, helal (ambalajda helal logosu); Türk Gıda Kodeksi’ne uygundur',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Gıda ile temasa uygun (çatal-bardak), PP 5 ve 22 PAP geri dönüşüm, güneş ışığından koruyunuz, kuru tutunuz, ısı kaynağından uzak tutunuz',
      },
      {
        key: 'Pişirme Önerisi',
        value:
          'Soğuk suda 10-12 saat ıslatıldıktan sonra düdüklü tencerede 15 dakika, normal tencerede 30-40 dakika haşlanır',
      },
      {
        key: 'Kullanım (üretici)',
        value:
          'Üretici açıklamasına göre ürün yarı pişmiştir: kaynatmadan sıcak suyla ıslatılıp yumuşatılarak salata ve köftelerde, ayrıca aşure, çorba ve keşkek yapımında kullanılır',
      },
      {
        key: 'Amazon Satış Biçimi',
        value:
          'Tekli 1 kg, 2’li paket ve 3’lü paket; çoklu paketler kendi barkodunu taşımaz, bu kayıt tekil 1 kg ambalajını tanımlar',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — tekli 1 kg 63,95 TL; 2’li paket 106,54 TL (53,27 TL/kg); 3 Kasım 2026, satıcı Amazon.com.tr',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (buğday ürünü). Çölyak hastaları ve gluten hassasiyeti olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi), parti no ve üretim yeri kısaltması ambalaj üzerine kodlanmıştır; son kullanma tarihi geçmiş ürünü tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Tahıl ve hububat ürünleri tüketilmeden önce gözle kontrol edilmelidir (ambalaj beyanı).',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Pişirme önerisi: Soğuk suda 10-12 saat ıslatıldıktan sonra düdüklü tencerede 15 dakika veya normal tencerede 30-40 dakika haşlayın. Ambalajdaki Aşure Tarifi: aşurelik buğday, kuru fasulye, nohut ve kuru üzüm bir gece önceden ıslatılır; buğday yumuşayana kadar kaynatılır, ayrı haşlanan fasulye ve nohut eklenir, ardından fıstık, kuru üzüm, kuru kayısı ve kuru incir katılır, toz şeker eklenip birkaç taşım kaynatılır. Sıcakken kaselere boşaltılır; soğuduktan sonra ceviz içi, Antep fıstığı ve kuş üzümü ile servis edilir. (Tarifin tam ölçüleri ambalaj üzerindedir.)',
    model: ASIN_SINGLE,
    sku: `AMZ-${ASIN_SINGLE}`,
    prices: [{ amount: 63.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: undefined,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
    ],
    status: 'published' as const,
  }

  const existing = await client.findOne('products', {
    barcode: { in: [BARCODE, PREVIOUS_BARCODE] },
  })
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
