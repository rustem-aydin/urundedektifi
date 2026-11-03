import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Eti Gong Çilekli Yoğurtlu Kaplamalı Pirinç Patlağı 30 g ürününü
 * UZAK Payload REST API'sine yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0GCFPHPRK + ürün ambalajı (EAN-13 8690526588452).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-eti-gong-cilekli-yogurtlu-30g-prod.ts
 *   (veya SEED_EMAIL / SEED_PASSWORD ile)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL/SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690526588452'
const GTIN = '8690526588452'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'eti-gong-cilek-yogurtlu-30g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu Kaplamalı Pirinç Patlağı 30 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu 30 g arka yüz içindekiler listesi',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu 30 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu 30 g trans yağ içermez ve geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu 30 g arka yüz: içindekiler, besin değerleri, barkod ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Eti Gong Çilekli Yoğurtlu 30 g barkod numarası 8690526588452',
  },
] as const

type IngredientRef =
  | { id: number }
  | { name: string; slug: string; aliases?: readonly string[] }

/**
 * Etiket sırasıyla içindekiler. Mevcut master kayıtlar kimlikle, eksikler
 * ad + slug ile verilir; eksik olanlar `ensureIngredient` ile oluşturulur.
 */
const INGREDIENTS: readonly IngredientRef[] = [
  { id: 673 }, // pirinç
  { id: 182 }, // Bitkisel yağ
  { id: 4723 }, // Tam Hidrojenize Palm Yağı
  { id: 186 }, // Şeker
  { id: 401 }, // Tam Yağlı Süt Tozu
  { id: 501 }, // Laktoz
  { id: 230 }, // peynir altı suyu tozu
  { name: 'Yoğurt Tozu', slug: 'yogurt-tozu' },
  { id: 1719 }, // Çilek tozu
  {
    name: 'Pancar Kökü Kırmızısı',
    slug: 'pancar-koku-kirmizisi',
    aliases: ['Pancar Kırmızısı', 'Beetroot Red', 'E162'],
  },
  { id: 4724 }, // Ayçiçek Lesitini
  { id: 971 }, // fındık yağı
  { id: 4694 }, // Aroma Verici
  { id: 137 }, // tuz
]

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 42 // Eti
const CATEGORY_ID = 8 // Atıştırmalık & Tatlı › Atıştırmalık
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_MILK_ID = 3 // Süt
const ADDITIVE_IDS = {
  lecithin: 10, // E322 Lesitinler (Ayçiçek Lesitini)
  beetrootRed: 53, // E162 Pancar Kırmızısı (Betanin)
} as const

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  transFat: 52,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
} as const

async function ensureIngredient(
  client: PayloadClient,
  entry: Extract<IngredientRef, { name: string }>,
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    ...(entry.aliases ? { aliases: entry.aliases.map((alias) => ({ alias })) } : {}),
  })
  console.log(`  + içindekiler: ${entry.name} (${created.id})`)
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
  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    ...(TOKEN ? { token: TOKEN } : {}),
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredients = []
  for (const entry of INGREDIENTS) {
    ingredients.push('id' in entry ? entry.id : await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Eti Gong Çilekli Yoğurtlu Kaplamalı Pirinç Patlağı 30 g',
    description:
      "Eti Gong Çilekli Yoğurtlu Kaplamalı Pirinç Patlağı, pirinç patlağının çilekli yoğurtlu kaplamayla buluştuğu 30 g'lık pakettir. Her pakette 2 adet kaplamalı pirinç patlağı bulunur.\n\nEtikete göre ürünün %49,7'si pirinç, %49,7'si çilekli yoğurtlu kaplamadır. Kaplamanın ana bileşenleri tam hidrojenize palm yağı ve şekerdir; çilek tozu %1, yoğurt tozu %1,7 oranındadır. Renklendirici olarak pancar kökü kırmızısı (E162), emülgatör olarak ayçiçek lesitini (E322) kullanılır. Fındık yağı içerir.\n\nÜrün, yerli ve ithal pirinç kullanılarak Eskişehir'deki Eti tesisinde Türkiye'de üretilir. Etikette trans yağ içermediği ve domuz yağı/domuzdan elde edilmiş katkı maddesi kullanılmadığı beyan edilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GCFPHPRK) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Eti Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '30 g',
    packaging: 'Plastik paket (metalleştirilmiş film), 2 adet kaplamalı pirinç patlağı',
    items: ingredients.map((item) => ({ ingredients: item })),
    allergens: ALLERGEN_MILK_ID,
    additives: [ADDITIVE_IDS.lecithin, ADDITIVE_IDS.beetrootRed],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2012, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 479, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 19, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 17, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 72, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 26, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 5.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.83, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Eti' },
      { key: 'Ürün Tipi', value: 'Kaplamalı pirinç patlağı' },
      { key: 'Aroma', value: 'Çilekli yoğurtlu' },
      { key: 'Net Miktar', value: '30 g' },
      { key: 'Paket İçeriği', value: '2 adet kaplamalı pirinç patlağı' },
      { key: 'Ambalaj', value: 'Plastik paket (metalleştirilmiş film)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Eti Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Bütünleşik Tahıl İşleme Fabrikası, Organize Sanayi Bölgesi 11. Cadde No: 6, Eskişehir / Türkiye',
      },
      { key: 'Tüketici Hattı', value: '0800 211 0 384 / 0216 651 0 384' },
      { key: 'Web', value: 'www.etietieti.com' },
      { key: 'İşletme Kayıt No', value: 'TR-26-K-000309' },
      { key: 'Ürün Kodu', value: '3516016' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B0GCFPHPRK' },
      { key: 'Ürün Ölçüleri', value: '12,8 × 9,7 × 2,8 cm (paket)' },
      { key: 'Pirinç Oranı', value: '%49,7' },
      { key: 'Çilekli Yoğurtlu Kaplama Oranı', value: '%49,7' },
      { key: 'Trans Yağ Beyanı', value: 'Trans yağ içermez' },
      {
        key: 'Domuz Yağı Beyanı',
        value: 'Ürünlerimizin hiçbir çeşidine alkol, domuz yağı ve türevleri katılmamıştır',
      },
      {
        key: 'Menşe Beyanı',
        value: "Yerli ve ithal pirinç kullanılarak Türkiye'de üretilmiştir",
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 19,61 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Süt ve süt ürünleri (tam yağlı süt tozu, laktoz, peynir altı suyu tozu, yoğurt tozu) içerir. Süt alerjisi veya laktoz intoleransı olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Fındık yağı içerir. Fındık alerjisi olan kişiler dikkatli olmalıdır.',
      },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    model: 'B0GCFPHPRK',
    sku: 'AMZ-B0GCFPHPRK',
    prices: [{ amount: 19.61, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8690526588452' },
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
