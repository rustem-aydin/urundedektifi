import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Dola Keten Tohumu 400 g (glutensiz) ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0BV39NWXH + ürün ambalajının ön/arka yüzü
 * (EAN-13 8682843331521). Prod'da bu barkod yok; betik yeni kayıt açar.
 * Kardeş kayıtlar: Naturfoods Keten Tohumu 140 g (18079), Yayla Gurme Keten
 * Tohumu 500 g (17620) ve Nardem Keten Tohumu (10794) kategori 22'de duruyor.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekiler kaydını slug üzerinden doğrular.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-dola-keten-tohumu-400g-prod.ts
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

const BARCODE = '8682843331521'
const ASIN = 'B0BV39NWXH'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'dola-keten-tohumu-400g')
const PRODUCT_NAME = 'Dola Keten Tohumu 400 g Glutensiz'

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
    file: 'dola-keten-front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: Dola logosu, "Süperfood Keten Tohumu / Flax Seed" başlığı, 400 g e, glutensiz, katkısız ve vegan rozetleri`,
  },
  {
    key: 'ingredients',
    file: 'dola-keten-ingredients.jpg',
    alt: `${PRODUCT_NAME} içindekiler satırı: İçindekiler: Keten Tohumu / Ingredients: Flax Seed`,
  },
  {
    key: 'nutrition',
    file: 'dola-keten-nutrition.jpg',
    alt: `${PRODUCT_NAME} enerji ve besin öğeleri tablosu (100 g): 2234 kJ / 534 kcal, yağ 42 g, doymuş yağ 3,7 g, protein 18 g, karbonhidrat 29 g, şeker 1,6 g, tuz 0,01 g`,
  },
  {
    key: 'recycling',
    file: 'dola-keten-recycling.jpg',
    alt: `${PRODUCT_NAME} ambalaj sembolleri: geri dönüşüm üçgeni, yeşil gıda güvenliği mührü ve Türk Malı işareti; Menşei: Türkiye satırı`,
  },
  {
    key: 'back',
    file: 'dola-keten-back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: glutensiz/doğal/vegan rozetleri, içindekiler, besin tablosu, saklama koşulları, üretici bilgileri ve barkod`,
  },
  {
    key: 'barcode',
    file: 'dola-keten-barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8682843331521`,
  },
] as const

/** Etiketten okunan içindekiler: tek madde, keten tohumu. */
const INGREDIENTS = [{ id: 1804, name: 'Keten tohumu', slug: 'keten-tohumu', percent: null }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 5576 // Dola
const CATEGORY_ID = 22 // Atıştırmalık & Tatlı › Kuruyemiş (keten tohumu kümesi)
const COUNTRY_ID = 1 // Türkiye (etiket: Menşei Türkiye)

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

async function assertIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (!existing) throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    const doc = existing as { id: number; name?: string; slug?: string }
    if (doc.slug !== entry.slug) {
      throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
    }
    if (entry.id !== null && doc.id !== entry.id) {
      throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
    }
    ids.push(doc.id)
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

  const ingredientIds = await assertIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Dola Keten Tohumu, tek içerikli (keten tohumu) glutensiz bir süperfood ürünüdür; 400 g'lık şeffaf poşette satılır. Ambalajda glutensiz, doğal ve vegan rozetleri ile \"katkısız\" beyanı bulunur; ürün Türk Gıda Kodeksi'ne uygun olarak üretilir. Etiket besin değerlerini 100 g üzerinden verir: 2234 kJ / 534 kcal enerji, 42 g yağ (3,7 g doymuş), 18 g protein, 29 g karbonhidrat (1,6 g şeker) ve 0,01 g tuz.\n\nÜretici firma ambalajda ISO 9001 Kalite Yönetim Sistemi, ISO 22000 Gıda Güvenliği Yönetim Sistemi, GMP İyi Üretim Uygulamaları, HACCP Yönetim Sistemi standartları ve Helal Gıda Sertifikası sahibi olduğunu belirtir; ambalajda helal logosu yer almaz. Ürün yerli üretimdir ve ambalaj \"tazeliğini koruyan ambalaj\" olarak tanıtılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0BV39NWXH) ve ürün ambalajının ön/arka yüzü.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '400 g',
    packaging: 'Şeffaf poşet ambalaj (ürün görünür pencereli)',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent ?? undefined,
    })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2234, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 534, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 42, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 3.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 18, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 29, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.01, unit: 'g' },
      ],
    },
    labels: ['gluten-free', 'natural', 'vegan', 'no-additives'] as const,
    specifications: [
      { key: 'Marka', value: 'Dola' },
      { key: 'Ürün Tipi', value: 'Keten tohumu (süperfood)' },
      { key: 'İngilizce Adı', value: 'Flax Seed' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'İçerik', value: 'Keten tohumu (%100, tek içerik)' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Ambalaj', value: 'Şeffaf poşet ambalaj; ürün görünür, "tazeliğini koruyan ambalaj"' },
      { key: 'Üretici', value: 'Dola Gıda San. ve Dış Tic. Ltd. Şti.' },
      {
        key: 'Üretici Adresi',
        value: 'Ostim OSB Mahallesi 243. Cadde No: 7, Yenimahalle / Ankara / Türkiye',
      },
      { key: 'Telefon / Faks', value: '+90 312 472 42 12' },
      { key: 'E-posta', value: 'info@dolagida.com.tr' },
      { key: 'Web', value: 'www.dolagida.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-06-K-062933' },
      { key: 'Standart', value: "Türk Gıda Kodeksi'ne uygun olarak üretilmiştir" },
      {
        key: 'Sertifikalar',
        value:
          'ISO 9001, ISO 22000, GMP, HACCP standartları ve Helal Gıda Sertifikası (üretici beyanı; ambalajda helal logosu yok)',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ağırlığı', value: '400 g' },
      { key: 'Yerli Üretim', value: 'Türk Malı işareti ve "Menşei: Türkiye" satırı' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 140,00 TL (400 g tek paket, 4 Kasım 2026)',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalaj değerleri 100 g üzerindendir; tabloda enerji kcal/kg olarak (534 / 2234) basılmıştır',
      },
      { key: 'Gluten Beyanı', value: 'Glutensiz (ambalaj rozeti)' },
      { key: 'Vegan Beyanı', value: 'Vegan (ambalaj rozeti)' },
      { key: 'Doğallık Beyanı', value: 'Doğal (Natural Food rozeti) ve katkısız' },
      {
        key: 'TETT / Seri No',
        value: 'T.E.T.T. ve seri numarası ambalaj üzerindedir',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (T.E.T.T.) ve seri numarası ambalajın üzerindedir.',
      },
    ],
    storage:
      'Serin ve kuru bir yerde, güneş ışığına maruz kalmayacak şekilde muhafaza ediniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 140, date: '2026-11-04T00:00:00.000Z' }],
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
