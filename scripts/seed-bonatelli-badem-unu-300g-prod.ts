/**
 * Bonatelli Badem Unu 300 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0CMXV3Q4L + ürün ambalajı (EAN-13 8691533125951).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-bonatelli-badem-unu-300g-prod.ts
 */

import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN?.trim() ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691533125951'
const ASIN = 'B0CMXV3Q4L'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'bonatelli-badem-unu-300g')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Bonatelli Badem Unu 300 g ürün ambalajı: içindekiler, besin değerleri, üretici bilgileri ve barkod',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Bonatelli Badem Unu 300 g içindekiler: %100 badem unu',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Bonatelli Badem Unu 300 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'badges',
    file: 'out-badges.jpg',
    alt: 'Bonatelli Badem Unu 300 g etiket beyanları: yüksek lif, vegan, gluten içermez, katkı maddesi içermez, koruyucu içermez, Türk Malı',
  },
  {
    key: 'producer',
    file: 'out-producer.jpg',
    alt: 'Bonatelli Badem Unu 300 g gıda işletmecisi, adres ve iletişim bilgileri',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Bonatelli Badem Unu 300 g barkod numarası 8691533125951',
  },
] as const

/** Etiket: %100 Badem Unu (tek içindekili). */
const INGREDIENT_NAME = 'Badem unu'
const INGREDIENT_SLUG = 'badem-unu'
const INGREDIENT_ALIASES = ['Almond flour', 'Badem'] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 977 // Bonatelli
const CATEGORY_ID = 52 // Baklagil & Tahıl › Un & İrmik
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_ALMOND = 27 // Badem

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

/** EAN-13 sağlama hanesi (tek haneler + 3 × çift haneler; kontrol hanesi toplama katılmaz). */
function assertEan13(barcode: string): void {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 13 hane olmalı: ${barcode}`)
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(barcode[index])
    sum += index % 2 === 0 ? digit : digit * 3
  }
  const check = (10 - (sum % 10)) % 10
  if (check !== Number(barcode[12])) {
    throw new Error(`EAN-13 sağlama hanesi hatalı: ${barcode} (beklenen ${check})`)
  }
}

/** İçindekiler master kaydını adına göre bulur; yoksa oluşturur (idempotent). */
async function ensureIngredient(client: PayloadClient): Promise<number> {
  const found = (await client.find('ingredients', {
    where: { name: { equals: INGREDIENT_NAME } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number }> }
  if (found.docs[0]) return found.docs[0].id

  const created = await client.create('ingredients', {
    name: INGREDIENT_NAME,
    slug: INGREDIENT_SLUG,
    aliases: INGREDIENT_ALIASES.map((alias) => ({ alias })),
  })
  console.log(`  + içindekiler: ${INGREDIENT_NAME} (${created.id})`)
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
    ...(TOKEN ? { token: TOKEN } : {}),
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientId = await ensureIngredient(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Bonatelli Badem Unu 300 g',
    description:
      "Bonatelli Badem Unu, %100 bademden öğütülen 300 g'lık tekli pakettir. Tek içindekili üründür; katkı maddesi ve koruyucu içermez. Glutensiz ve vegan olarak beyan edilir, yüksek lif kaynağıdır.\n\nBadem unu, glutensiz unlu mamuller, pasta, kurabiye ve pane harçlarında buğday unu yerine kullanılır. Üretim yeri Türkiye'dir (Balıkesir).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CMXV3Q4L) ve ürün ambalajı (EAN-13 8691533125951).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'Bonatelli Gıda San. ve Tic. A.Ş.',
    size: '300 g',
    packaging: 'Metalize stand-up poşet (doypack)',
    items: [{ ingredients: ingredientId }],
    allergens: ALLERGEN_ALMOND,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2586, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 618, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 53.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 4.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 7.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 22.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['vegan', 'gluten-free', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Bonatelli' },
      { key: 'Ürün Tipi', value: 'Badem unu (%100 öğütülmüş badem)' },
      { key: 'Net Miktar', value: '300 g' },
      { key: 'Ölçü', value: '10,6 OZ — 300 gr' },
      { key: 'Menşei', value: 'Türkiye (Türk Malı)' },
      { key: 'Ambalaj', value: 'Metalize stand-up poşet (doypack)' },
      { key: 'Üretici', value: 'Bonatelli Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yeniköy Mah. Yeniköy Sok. No: 469/B, Karesi / Balıkesir / Türkiye',
      },
      { key: 'Tüketici Danışma Hattı', value: '+90 266 246 14 50' },
      { key: 'Web', value: 'www.pastabonatelli.com — info@pastabonatelli.com' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-03768' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '26,7 × 15,8 × 5,7 cm' },
      { key: 'Brüt Ağırlık', value: '310 g' },
      {
        key: 'Etiket Beyanları',
        value:
          'Yüksek lif; vegan; gluten içermez; katkı maddesi içermez; koruyucu içermez; Türk Malı',
      },
      {
        key: 'Saklama (etiket)',
        value:
          'Serin ve kuru yerde muhafaza ediniz; doğrudan güneş ışığına maruz bırakmayınız',
      },
      {
        key: 'Besin Tablosu',
        value:
          'Etiket değerleri 100 g içindir; % değerleri ortalama yetişkin referans alım düzeyine (8400 kJ / 2000 kcal) göredir.',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          "Etikette ayrıca alerjen uyarısı basılı değil; ürün %100 badem unundan üretilir (badem — sert kabuklu yemiş)",
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 359,55 TL (4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Badem (sert kabuklu yemiş) alerjisi olan kişiler için uygun değildir.',
      },
      {
        severity: 'low' as const,
        text: 'Parti numarası ve tavsiye edilen son tüketim tarihi etiket üzerindedir; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Serin ve kuru yerde muhafaza ediniz. Doğrudan güneş ışığına maruz bırakmayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 359.55, date: '2026-11-04' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      {
        image: media.badges,
        caption:
          'Etiket beyanları: yüksek lif, vegan, gluten içermez, katkı maddesi içermez, koruyucu içermez, menşei Türkiye',
      },
      {
        image: media.producer,
        caption: 'Gıda işletmecisi: Bonatelli Gıda San. ve Tic. A.Ş. — adres, telefon ve web bilgileri',
      },
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
