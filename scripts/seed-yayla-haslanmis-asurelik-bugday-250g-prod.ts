import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Aşurelik Buğday 250 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Amazon teklifi "2'li paket" (2 × 250 g); demetin kendi barkodu yok, ambalajda
 * 250 g tekli paketin EAN'i (8693374260907) basılı. Bu yüzden kanonik 250 g
 * kaydı yazılır, çoklu paket bilgisi specifications'a işlenir.
 *
 * Kaynak: Amazon.com.tr ASIN B0F1G77QSZ + ürün ambalajı (EAN-13 8693374260907).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-haslanmis-asurelik-bugday-250g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-haslanmis-asurelik-bugday-250g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374260907'
const ASIN = 'B0F1G77QSZ'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'yayla-haslanmis-asurelik-bugday-250g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Haşlanmış Aşurelik Buğday 250 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Aşurelik Buğday 250 g içindekiler ve gluten uyarısı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Aşurelik Buğday 250 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: "Yayla Haşlanmış Aşurelik Buğday 250 g ambalaj rozetleri (lif kaynağı, protein kaynağı, düşük yağ, BPA'sız)",
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Aşurelik Buğday 250 g arka yüz: içindekiler, besin değerleri, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Aşurelik Buğday 250 g barkod numarası 8693374260907',
  },
] as const

/** Ambalajdan okunan içindekiler: "Su, aşurelik buğday (%49), tuz." */
const INGREDIENTS = [
  { id: 278, name: 'Su', percent: null },
  { id: 4757, name: 'Aşurelik buğday', percent: 49 },
  { id: 137, name: 'tuz', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl (Yayla Aşurelik Buğday 1 kg ile aynı küme)
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (etiket: "Gluten içerir.")

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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    slug: 'yayla-haslanmis-asurelik-bugday-250-g',
    name: 'Yayla Haşlanmış Aşurelik Buğday 250 g',
    description:
      "Yayla Haşlanmış Aşurelik Buğday, 4 katlı BPA'sız koruyucu ambalajda paketlenmiş, suda bekletmeden kullanılabilen haşlanmış kabuğu soyulmuş buğdaydır (boiled peeled wheat). 250 g'lık tekli paket; aşure, yemek, çorba ve salatalarda kullanılır.\n\nEtikette lif kaynağı, protein kaynağı ve düşük yağ olarak tanımlanır; koruyucu ve renklendirici içermediği, vegan olduğu ve gluten içerdiği belirtilir. Ürünün içindeki su da yemeklerde kullanılabilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F1G77QSZ, 2'li paket teklifi) ve ürün ambalajı (EAN-13 8693374260907).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: "Tekli poşet, 4 katlı BPA'sız koruyucu ambalaj",
    items: INGREDIENTS.map((entry) =>
      entry.percent === null
        ? { ingredients: entry.id }
        : { ingredients: entry.id, percent_estimate: entry.percent },
    ),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 596, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 142, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 36.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 19.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 5.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.5, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış aşurelik buğday (kabuğu soyulmuş, kullanıma hazır)' },
      { key: 'Net Miktar', value: '250 g (tekli paket)' },
      { key: 'Ambalaj', value: "Tekli poşet, 4 katlı BPA'sız koruyucu ambalaj" },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No:1, Toroslar / Mersin',
      },
      { key: 'Tüketici Danışma Hattı', value: '0 324 221 62 76 (pbx) — Faks: 0 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr — yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      {
        key: 'Etiket Beyanları',
        value:
          'Lif kaynağı; protein kaynağı; düşük yağ; vegan; koruyucu ve renklendirici içermez; suda bekletmeden hemen kullanabilirsiniz',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          "4 katlı BPA'sız koruyucu ambalaj, PP 5, 2502, çatal-bardak, çöp adam, güneşten koruyunuz, kuru tutunuz, helal",
      },
      {
        key: 'Besin Tablosu',
        value:
          '100 g değerleri ve %RA oranları etikettekiyle birebir aynıdır; enerji %RA 2000 kcal üzerinden hesaplanır.',
      },
      { key: 'Alerjen Beyanı', value: 'Etikette kalın harflerle "Gluten içerir" yazar.' },
      {
        key: 'Amazon Satış Biçimi',
        value: "2'li paket (2 × 250 g); demetin kendi barkodu yok, ambalajda 250 g tekli paketin EAN'i basılı.",
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'TETT Notu',
        value:
          'Tavsiye edilen tüketim tarihi (TETT), parti no. (P.N.) ve menşe ülke ambalaj üzerindedir',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          "Amazon.com.tr — 2'li paket 114,87 TL (paket başına 57,44 TL; 500 g toplam, 22,97 TL/100 g), 4 Kasım 2026",
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir. Çölyak hastalığı veya gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Şişmiş ve sızdıran ambalajdaki ürünü tüketmeyiniz.',
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
      'Oda sıcaklığında (25 °C), güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Suda bekletmeden hemen kullanabilirsiniz. Ambalajı açıp yemeklere, çorbalara ve salatalara ekleyin; ürünün içindeki suyu da yemeklerinizde kullanabilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 114.87, date: '2026-11-04T00:00:00.000Z' }],
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
