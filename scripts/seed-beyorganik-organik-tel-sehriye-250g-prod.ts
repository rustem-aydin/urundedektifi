import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Beyorganik Organik Tel Şehriye 250 g ürününü UZAK Payload REST API'sine yazar:
 * marka, master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B097R3PQ3L + ürün ambalajı (EAN-13 8680419375382,
 * ambalajdaki barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu 100 g için: 1476 kJ / 348 kcal. Enerji makro toplamıyla
 * doğrulandı: 71×4 + 12×4 + 1,1×9 + 3×2 = 347,9 ≈ 348 kcal.
 *
 * İçindekiler: organik durum buğday irmiği. Alerjen: gluten (ambalaj ayrıca
 * “süt ürünleri bulunan ortamda paketlenmiştir” uyarısı taşır).
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-beyorganik-organik-tel-sehriye-250g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8680419375382'
const ASIN = 'B097R3PQ3L'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'beyorganik-organik-tel-sehriye-250g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Beyorganik Organik Tel Şehriye 250 g ön yüz; organik tarım logosu, 250 g',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Beyorganik Organik Tel Şehriye içindekiler ve parti bilgileri: organik durum buğday irmiği, gluten içerir',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Beyorganik Organik Tel Şehriye besin değerleri tablosu (100 g: 348 kcal / 1476 kJ)',
  },
  {
    key: 'seal',
    file: 'organic-seal.jpg',
    alt: 'Beyorganik Organik Tel Şehriye ambalajındaki Organik Tarım / T.C. logosu',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Beyorganik Organik Tel Şehriye barkod numarası 8680419375382',
  },
] as const

const CATEGORY_ID = 27 // Baklagil & Tahıl › Makarna & Pirinç
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

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

function assertEan13(barcode: string): string {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 13 hane olmalı: ${barcode}`)
  const digits = [...barcode].map(Number)
  const check = digits[12]
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (check !== expected) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${barcode} (beklenen ${expected}, bulunan ${check})`)
  }
  return barcode
}

/** Marka kaydı: slug ile bulur, yoksa oluşturur (idempotent). */
async function resolveBrand(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('brands', { slug: { equals: 'beyorganik' } })
  if (existing) return existing.id
  const created = await client.create('brands', {
    name: 'Beyorganik',
    slug: 'beyorganik',
    description: 'Organik tarım sertifikalı gıda markası.',
  })
  console.log(`  + marka: Beyorganik (${created.id})`)
  return created.id
}

/**
 * Kanonik durum buğdayı irmiği kaydı (1197, 36 üründe kullanılıyor). Master
 * adındaki “ırmığı” yazım hatası Türkçe doğru yazımla düzeltilir; eski yazım
 * arama için takma ad olarak korunur.
 */
async function resolveSemolina(client: PayloadClient): Promise<number> {
  const aliases = [
    { alias: 'Durum buğdayı ırmığı' },
    { alias: 'Durum buğday irmiği' },
    { alias: 'Organik durum buğday irmiği' },
  ]
  const byName = await client.findOne('ingredients', {
    and: [{ name: { equals: 'Durum buğdayı irmiği' } }, { slug: { equals: 'durum-bugdayi-irmigi' } }],
  })
  if (byName) {
    await client.update('ingredients', byName.id, { name: 'Durum buğdayı irmiği', aliases })
    return byName.id
  }
  const bySlug = await client.findOne('ingredients', { slug: { equals: 'durum-bugdayi-irmigi' } })
  if (bySlug) {
    await client.update('ingredients', bySlug.id, { name: 'Durum buğdayı irmiği', aliases })
    return bySlug.id
  }
  const created = await client.create('ingredients', {
    name: 'Durum buğdayı irmiği',
    slug: 'durum-bugdayi-irmigi',
    aliases,
  })
  console.log(`  + içindekiler: Durum buğdayı irmiği (${created.id})`)
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

  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  const brandId = await resolveBrand(client)
  const semolinaId = await resolveSemolina(client)
  console.log(`Marka ${brandId}, içindekiler ${semolinaId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Beyorganik Organik Tel Şehriye 250 g',
    description:
      'Beyorganik Organik Tel Şehriye, organik durum buğdayı irmiğinden üretilen ince (tel) şehriyedir. 250 g’lık tekli poşettir; ambalajında Organik Tarım / T.C. logosu bulunur.\n\nİçindekiler tek bileşendir: organik durum buğday irmiği. Etiket “gluten içerir” ve “süt ürünleri bulunan ortamda paketlenmiştir” uyarılarını taşır; katkı maddesi ve koruyucu içermez.\n\nVeri kaynağı: Amazon.com.tr (ASIN B097R3PQ3L) ve ürün ambalajı (EAN-13 8680419375382).',
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: 'Beyorganik',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: 'Plastik ambalaj (şeffaf poşet)',
    items: [{ ingredients: semolinaId }],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1476, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 348, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 71, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.01, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Beyorganik' },
      { key: 'Ürün Tipi', value: 'Organik tel şehriye' },
      { key: 'Net Miktar', value: '250 g' },
      { key: 'İçindekiler Beyanı', value: 'Organik durum buğday irmiği' },
      { key: 'Ambalaj', value: 'Şeffaf plastik poşet; Organik Tarım / T.C. logosu' },
      { key: 'Menşe', value: 'Türkiye' },
      {
        key: 'Üretici',
        value:
          'Beyorganik (ambalajda firma adı basılı değil; yalnız işletme kayıt numarası yer alıyor)',
      },
      {
        key: 'Adres',
        value: 'Şehit Kamil Balkan Caddesi No: 142, Bayrampaşa / İSTANBUL (Amazon ürün detayı)',
      },
      { key: 'İşletme Kayıt No.', value: 'TR-34-K-195953' },
      { key: 'Parti No.', value: 'Ambalajda 083 olarak basılı' },
      { key: 'TETT', value: 'Ambalajda 06/2026 olarak basılı' },
      {
        key: 'Katkı Maddesi',
        value: 'Ambalaj: “Katkı maddesi ve koruyucu içermez”',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalaj: “Gluten içerir” ve “Süt ürünleri bulunan ortamda paketlenmiştir”',
      },
      { key: 'Standart', value: 'Türk Gıda Kodeksi’ne uygun olarak üretilmiştir' },
      { key: 'Saklama Koşulları', value: 'Serin ve kuru yerde saklayınız' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etiket değerleri 100 g içindir. Enerji makro toplamıyla doğrulandı (71×4 + 12×4 + 1,1×9 + 3×2 = 347,9 ≈ 348 kcal).',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 250 g paket' },
      { key: 'Ürün Ölçüleri', value: '9 × 5 × 19 cm (paket, Amazon ölçümü); 104 g' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 312,90 TL (250 g, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir; çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Ambalajda “süt ürünleri bulunan ortamda paketlenmiştir” uyarısı vardır; süt alerjisi olanlar dikkatli olmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Serin ve kuru yerde saklayın; ambalajdaki parti no (083) ve TETT (06/2026) bilgisini tüketim öncesi kontrol edin.',
      },
    ],
    storage: 'Serin ve kuru yerde saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 312.9, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.seal, caption: 'Organik Tarım / T.C. logosu' },
      { image: media.barcode, caption: 'Barkod 8680419375382' },
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
