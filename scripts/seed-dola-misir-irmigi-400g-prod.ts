import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Dola Glutensiz Mısır İrmiği 400 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler/marka, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08H23DLBW + ürün ambalajı (EAN-13 8681314066740).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-dola-misir-irmigi-400g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-dola-misir-irmigi-400g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8681314066740'
const ASIN = 'B08H23DLBW'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'dola-misir-irmigi-400g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Dola Glutensiz Mısır İrmiği 400 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Dola Glutensiz Mısır İrmiği 400 g içindekiler ve glutensiz/doğal/vegan beyanları',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Dola Glutensiz Mısır İrmiği 400 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Dola Glutensiz Mısır İrmiği 400 g ambalaj sembolleri (geri dönüşüm, helal gıda sertifikası, Türk Malı, Yerli Üretim)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Dola Glutensiz Mısır İrmiği 400 g arka yüz: içindekiler, besin değerleri, üretici, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Dola Glutensiz Mısır İrmiği 400 g barkod numarası 8681314066740',
  },
] as const

/** Etiketten okunan içindekiler: "Mısır İrmiği / Polenta". */
const INGREDIENTS = [{ id: 848, name: 'Mısır irmiği' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND = { id: 0, name: 'Dola', slug: 'dola' }
const CATEGORY_ID = 28 // Baklagil & Tahıl (irmik ürünlerinin yerleşik kümesi: Banetti, Bendo)
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
  protein: 19,
  salt: 20,
} as const

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmalı: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${code} (beklenen ${expected})`)
  }
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0]
  if (!found) throw new Error(`İçindekiler kaydı yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`İçindekiler adı uyuşmuyor: ${id} → ${String(found.name)} ≠ ${name}`)
  }
}

async function ensureBrand(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('brands', { slug: { equals: BRAND.slug } })
  if (existing) return existing.id

  const created = await client.create('brands', { name: BRAND.name, slug: BRAND.slug })
  console.log(`  + marka: ${BRAND.name} (${created.id})`)
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

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  for (const entry of INGREDIENTS) await assertIngredient(client, entry.id, entry.name)

  const brandId = await ensureBrand(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Dola Glutensiz Mısır İrmiği 400 g',
    description:
      "Dola Glutensiz Mısır İrmiği, glutensiz beslenme için üretilen 400 g'lık mısır irmiğidir (polenta). Tek içerikli üründür; ambalajında glutensiz, katkısız, doğal ve vegan olduğu beyan edilir. Çorba, muhallebi ve hamur işlerinde kıvam verici olarak ya da polenta olarak pişirilerek kullanılır.\n\nAmbalajın arkasında paylaşılan akredite laboratuvar raporunda gluten miktarı < 6,07 mg/kg (LOQ altı, tespit edilemedi) olarak yer alır. Ürün ISO 9001, ISO 22000, GMP ve HACCP sertifikalı tesiste üretilir; helal gıda sertifikası ve 'Yerli Üretim' işaretleri basılıdır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08H23DLBW) ve ürün ambalajı.",
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '400 g',
    packaging: 'Plastik ambalaj (poşet)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 353.6, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1477.9, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.29, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6.74, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 78.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: ['gluten-free', 'vegan', 'no-additives', 'natural', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Dola' },
      { key: 'Ürün Tipi', value: 'Mısır irmiği (polenta)' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (poşet)' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Üretici', value: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.' },
      {
        key: 'Üretici Adresi',
        value: 'Ostim OSB Mah. 243. Cadde No: 7 Yenimahalle / Ankara',
      },
      { key: 'Tel / Faks', value: '0 312 472 42 12' },
      { key: 'Web', value: 'dolagida.com.tr — info@dola.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-06-K-062933' },
      {
        key: 'Uygunluk Beyanı',
        value: 'Türk Gıda Kodeksine uygun olarak üretilmiştir',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '22,4 × 14,3 × 6,8 cm; 410 g (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Beyanlar',
        value: 'Glutensiz, katkısız, doğal, vegan (ambalaj üzerindeki işaretler)',
      },
      {
        key: 'Sertifikalar',
        value: 'ISO 9001, ISO 22000, GMP, HACCP, Helal Gıda Sertifikası',
      },
      {
        key: 'Gluten Analizi',
        value:
          'Akredite laboratuvar raporu: gluten < 6,07 mg/kg (LOQ altı, tespit edilmedi) — Amazon ürün görselleri',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'Geri dönüşüm üçgeni, helal gıda sertifikası, Türk Malı, Yerli Üretim',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 145,00 TL (4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Ambalajı yırtılmış, delinmiş veya hasarlı ürünü satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir; TETT ve seri numarası ambalaj üzerindedir.',
      },
    ],
    storage:
      'Serin ve kuru bir yerde, güneş ışığına maruz kalmayacak şekilde muhafaza ediniz.',
    usage: 'Yemeklerde kıvam verici olarak kullanılabilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 145, date: '2026-11-04T00:00:00.000Z' }],
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
