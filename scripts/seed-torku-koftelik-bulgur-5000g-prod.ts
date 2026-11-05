import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Torku Çatalhöyük Köftelik Bulgur 5 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08TY49NMK + ürün ambalajı (EAN-13 8690120072470).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-torku-koftelik-bulgur-5000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690120072470'
const ASIN = 'B08TY49NMK'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'torku-koftelik-bulgur-5000g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg içindekiler ve alerjen beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg ambalaj sembolleri (PP 5 geri dönüşüm, gıda ile temasa uygun)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg arka yüz: içindekiler, besin değerleri, üretici, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Torku Çatalhöyük Köftelik Bulgur 5 kg barkod numarası 8690120072470',
  },
] as const

/** Etiketten okunan içindekiler: "Köftelik (Kısırlık) Bulgur (Gluten İçerir)". */
const INGREDIENTS = [
  { name: 'Köftelik bulgur', slug: 'koftelik-bulgur', aliases: ['Kısırlık bulgur'] },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 27 // Torku
const CATEGORY_ID = 28 // Baklagil & Tahıl (bulgur ürünlerinin yerleşik kümesi)
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  monounsaturatedFat: 49,
  polyunsaturatedFat: 50,
  transFat: 52,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
  sodium: 21,
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

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    aliases: entry.aliases.map((alias) => ({ alias })),
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

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) ingredientIds.push(await ensureIngredient(client, entry))

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Torku Çatalhöyük Köftelik Bulgur 5 kg',
    description:
      "Torku Çatalhöyük Köftelik Bulgur, durum buğdayının taş değirmende yalnızca su ve buğday kullanılarak işlenmesiyle üretilen 5 kg'lık ince (köftelik/kısırlık) bulgurdur. Etikette 'Köftelik (Kısırlık) Bulgur' olarak tanımlanır; 100 g'da 11 g protein ve 6,3 g lif içerir. Trans yağ değeri 0 g'dır.\n\nAmbalaj çok dilli (TR/EN/DE/FR/NL/SV/AR) alerjen beyanı taşır; gluten içerir. Torku, Konya Şeker'in markasıdır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TY49NMK) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'PAN-GEV Tarım Hayvancılık Sanayi ve Ticaret A.Ş. (Torku / Konya Şeker)',
    country: COUNTRY_ID,
    size: '5 kg',
    packaging: 'Plastik ambalaj (PP 5)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 379, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1584, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.monounsaturatedFat, amount: 0.34, unit: 'g' },
        { nutrient: NUTRIENT_IDS.polyunsaturatedFat, amount: 0.84, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 74, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 0.04, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Torku' },
      { key: 'Seri', value: 'Çatalhöyük' },
      { key: 'Ürün Tipi', value: 'Köftelik (kısırlık) bulgur — ince bulgur' },
      { key: 'Hammadde', value: 'Durum buğdayı (taş değirmende, yalnızca su ve buğday)' },
      { key: 'Net Miktar', value: '5000 g (176,4 oz)' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (PP 5)' },
      { key: 'Menşei', value: 'Türkiye' },
      {
        key: 'Üretici',
        value: 'PAN-GEV Tarım Hayvancılık Sanayi ve Ticaret A.Ş. (Torku / Konya Şeker)',
      },
      {
        key: 'Üretici Adresi',
        value: 'İpekçi Mah. İpek OSB Mah. 2. Sok. No:3 Merkez Karapınar / Konya',
      },
      { key: 'İşletme Kayıt No', value: 'TR-42-K-020100' },
      { key: 'Tüketici Hattı', value: '444 75 50 — torku@torku.com.tr' },
      { key: 'Web', value: 'www.torku.com.tr' },
      { key: 'Uygunluk Beyanı', value: 'Türk Gıda Kodeksi Bulgur Tebliğine uygun olarak üretilmiştir' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Mamul Kodu', value: '404860' },
      {
        key: 'Amazon Ürün Ölçüleri',
        value: '44,6 × 28,6 × 9 cm; 5,08 kg (Amazon.com.tr ürün detayı)',
      },
      { key: 'Beyanlar', value: 'Durum buğdayından, taş değirmende yalnızca su ve buğday ile üretim' },
      { key: 'Alerjen', value: 'Gluten içerir (buğday); ambalajda çok dilli alerjen uyarısı' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'PP 5 geri dönüşüm, gıda ile temasa uygun (çatal-bardak), çöp adam, pan plast',
      },
      {
        key: 'Amazon Satış Biçimi',
        value: "5 kg tek paket (3'lü paket varyantı ayrı ASIN: B0GYVH647P)",
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — listeleme 5 Kasım 2026 itibarıyla "Şu anda mevcut değil", fiyat yok',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (durum buğdayı). Çölyak hastalığı veya gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalajı delinmiş veya hasarlı ürünü satın almayınız; serin, rutubetsiz ve kokusuz yerde, doğrudan güneş ışığından uzak saklayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir; TETT ve parti numarası ambalaj üzerindedir.',
      },
    ],
    storage:
      'Serin, rutubetsiz ve kokusuz yerde muhafaza ediniz. Doğrudan güneş ışığı alan ortamlardan uzak tutunuz.',
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

  console.log(`\nÜrün ${existing ? 'güncellendi' : 'oluşturuldu'}: ${product.id}`)
  console.log(`https://barkoddedektifi.com/urun/${BARCODE}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
