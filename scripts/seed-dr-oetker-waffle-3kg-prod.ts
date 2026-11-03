import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Dr. Oetker Waffle Toz Karışımı 3 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, etiket fotoğrafları ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0C11F1GGW + ürün ambalajı (EAN-13 8690629441081).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-dr-oetker-waffle-3kg-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-dr-oetker-waffle-3kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690629441081'
const ASIN = 'B0C11F1GGW'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'dr-oetker-waffle-3kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Dr. Oetker Professional Waffle Toz Karışımı 3 kg ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Dr. Oetker Waffle Toz Karışımı 3 kg içindekiler listesi',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Dr. Oetker Waffle Toz Karışımı 3 kg besin değerleri tablosu (100 g hazırlanmış waffle)',
  },
  {
    key: 'usage',
    file: 'usage.jpg',
    alt: 'Dr. Oetker Waffle Toz Karışımı 3 kg kullanım tablosu ve hazırlanış adımları',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Dr. Oetker Waffle Toz Karışımı 3 kg barkod numarası 8690629441081',
  },
] as const

/** Ambalajdan okunan içindekiler: "Buğday unu, şeker, modifiye patates nişastası, yağsız süt tozu, kabartıcılar (glukano delta lakton, sodyum bikarbonat), tuz, kıvam artırıcı (guar gam), vanilin." */
type IngredientEntry = { id: number | null; name: string; slug?: string; aliases?: string[] }

const INGREDIENTS: IngredientEntry[] = [
  { id: 181, name: 'buğday unu' },
  { id: 186, name: 'Şeker' },
  { id: 349, name: 'Modifiye patates nişastası' },
  { id: 229, name: 'yağsız süt tozu' },
  {
    id: null,
    name: 'Glukono delta lakton',
    slug: 'glukono-delta-lakton',
    aliases: ['Glukano delta lakton', 'Glucono delta lactone', 'E575'],
  },
  { id: 541, name: 'Sodyum bikarbonat' },
  { id: 137, name: 'tuz' },
  { id: 4417, name: 'Kıvam arttırıcı guar gam' },
  { id: 1234, name: 'Vanilin' },
]

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 180 // Dr.Oetker
const CATEGORY_ID = 5 // Atıştırmalık & Tatlı › Bisküvi & Gofret
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (buğday unu); süt ayrıca uyarılarda belirtilir
const ADDITIVE_IDS = {
  gluconoDeltaLactone: 179, // E575 Glukono-Delta-Lakton
  sodiumBicarbonate: 7, // E500II Sodyum Hidrojen Karbonat
  guarGum: 51, // E412 Guar Gamı
} as const

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

async function ensureIngredient(
  client: PayloadClient,
  entry: IngredientEntry,
): Promise<number> {
  if (entry.id !== null) return entry.id

  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  if (!entry.slug) throw new Error(`Yeni içindekiler için slug gerekli: ${entry.name}`)

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    aliases: (entry.aliases ?? []).map((alias) => ({ alias })),
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
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  for (const entry of INGREDIENTS) {
    if (entry.id !== null) await assertIngredient(client, entry.id, entry.name)
  }

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Dr. Oetker Waffle Toz Karışımı 3 kg',
    description:
      "Dr. Oetker Waffle Toz Karışımı, süt ve yumurta ile çırpılıp waffle makinesinde pişirilen hazır toz karışımdır. 3 kg'lık profesyonel (Dr.Oetker Professional) ambalaj, 1 pakete 3 litre süt ve 15 yumurta eklenerek hazırlanır; etiketteki tarif tablosuna göre bu miktar yaklaşık 120 porsiyon (150 g) waffle verir. Etikette çıtır yapı ve altın renkli sonuç olarak tanımlanır.\n\nKarışım buğday unu, şeker, modifiye patates nişastası, yağsız süt tozu, kabartıcılar, tuz, guar gam ve vanilin içerir. Servis önerisi olarak bal, reçel, kakaolu fındık kreması, pudra şekeri veya hazır meyveli/çikolatalı sos önerilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0C11F1GGW) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Dr. Oetker Türkiye',
    country: COUNTRY_ID,
    size: '3 kg',
    packaging: 'Esnek plastik poşet (laminant ambalaj)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [
      ADDITIVE_IDS.gluconoDeltaLactone,
      ADDITIVE_IDS.sodiumBicarbonate,
      ADDITIVE_IDS.guarGum,
    ],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1346, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 318, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 2.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 57, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 24, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.9, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Dr.Oetker' },
      { key: 'Ürün Tipi', value: 'Waffle toz karışımı (hazır toz)' },
      { key: 'Seri', value: 'Dr.Oetker Professional' },
      { key: 'Net Miktar', value: '3 kg' },
      { key: 'Hazırlanış Miktarı', value: '1 paket + 3 litre süt + 15 yumurta' },
      {
        key: 'Porsiyon',
        value: 'Yaklaşık 120 porsiyon (1 porsiyon ≈ 150 g; etiket tablosundaki 1000 g = 40 porsiyon üzerinden hesaplanmıştır)',
      },
      { key: 'Ambalaj', value: 'Esnek plastik poşet (laminant ambalaj)' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Dr. Oetker Türkiye (Amazon.com.tr ürün bilgisi)' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '37 × 28,4 × 9,4 cm (Amazon.com.tr paket ölçüsü)' },
      { key: 'Ürün Ağırlığı', value: '3,2 kg (paket ağırlığı, Amazon.com.tr)' },
      {
        key: 'Besin Değerleri Notu',
        value:
          'Etiketteki tablo 100 g tarife göre hazırlanmış waffle (toz karışım + süt + yumurta) içindir; kuru karışımın tek başına besin değerleri etikette verilmemiştir.',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda yağsız süt tozu vurgulanır; Amazon.com.tr ürün bilgisinde "Buğday içerir, süt ürünleri içerebilir" yazar.',
      },
      {
        key: 'Açıklama Çelişkisi',
        value:
          'Amazon.com.tr ürün açıklamasındaki içindekiler ve besin değerleri (şeker, nişasta, muz tozu, beta karoten) bu ambalajla uyuşmuyor; ürün sayfasına ambalajdaki veriler işlendi.',
      },
      {
        key: 'Hazırlanış Notu',
        value:
          'Amazon.com.tr madde işaretleri 210 g paket için (200 ml süt, 1 yumurta, 1-2 dakika) geçerlidir; 3 kg ambalajda 3 litre süt, 15 yumurta ve 2-3 dakika yazar.',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 405,76 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Buğday (gluten) ve süt içerir. Çölyak hastalığı ya da gluten/süt alerjisi olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj yırtılmış, delinmiş veya nemlenmişse ürünü kullanmayınız.',
      },
    ],
    usage:
      "1) Toz karışımı bir kaba boşaltın ve üzerine 3 litre süt ve 15 yumurta ilave edin. Mikserin çırpıcı uçları ile önce düşük, sonra yüksek devirde 2-3 dakika çırpın.\n2) Her bir waffle için ısınmış pişirme yüzeyine 2-3 yemek kaşığı hamur dökün ve kenarlarından taşmayacak şekilde yayın. Orta derecede altın rengine dönünceye kadar en az 4-5 dakika pişirin. Waffle makinenizin kullanım talimatlarına uyun.\n3) Bal, reçel, kakaolu fındık kreması, Dr. Oetker Pudra Şekeri, hazır çikolatalı veya böğürtlenli sos ile servis yapabilirsiniz.",
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 405.76, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.usage, caption: 'Kullanım tablosu ve hazırlanış' },
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
