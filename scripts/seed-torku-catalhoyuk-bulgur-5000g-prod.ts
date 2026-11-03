import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Torku Çatalhöyük Pilavlık Bulgur 5 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08TY54QZ9 + ürün ambalajı (EAN-13 8690120072418).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-torku-catalhoyuk-bulgur-5000g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-torku-catalhoyuk-bulgur-5000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690120072418'
const ASIN = 'B08TY54QZ9'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'torku-catalhoyuk-bulgur-5000g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg içindekiler ve alerjen beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg besin değerleri tablosu (100 g ve 60 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg ambalaj sembolleri (2149 PP geri dönüşüm, menşei, gıda ile temasa uygun)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg arka yüz: içindekiler, besin değerleri, üretici, sertifikalar ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg barkod numarası 8690120072418',
  },
] as const

/** Etiketten okunan içindekiler: "Pilavlık Bulgur (Gluten İçerir). Durum Buğdayından üretilmiştir." */
const INGREDIENTS = [{ id: 1557, name: 'Pilavlık bulgur' }] as const

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
    name: 'Torku Çatalhöyük Pilavlık Bulgur 5 kg',
    description:
      "Torku Çatalhöyük Pilavlık Bulgur, durum buğdayının taş değirmende yalnızca su ve buğday kullanılarak işlenmesiyle üretilen 5 kg'lık iri (coarse) bulgurdur. Az soyulmuş kabuğundan üretilir; ambalajda yüksek lif oranı (100 g'da 6,3 g) ve doğal rengi koruduğu beyan edilir. Pilav, kısır, çiğ köfte ve dolma içi gibi bulgur yemeklerinde kullanılır; paket yaklaşık 83 porsiyon (60 g) içerir.\n\nÜrün TS 2284 Tip 3'e göre üretilir; TSE ve TSE OIC/SMIIC 1 helal işaretleri basılıdır. Torku, Konya Şeker'in markasıdır. Gluten içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TY54QZ9) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer:
      'PAN-GEV Tarım Hayvancılık Sanayi ve Ticaret A.Ş. (Torku / Konya Şeker)',
    country: COUNTRY_ID,
    size: '5 kg',
    packaging: 'Plastik ambalaj (2149 PP)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1654, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 382, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 75.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Torku' },
      { key: 'Seri', value: 'Çatalhöyük' },
      { key: 'Ürün Tipi', value: 'Pilavlık bulgur (iri / coarse bulgur)' },
      { key: 'Hammadde', value: 'Durum buğdayı (taş değirmende, yalnızca su ve buğday)' },
      { key: 'Sınıf / Tip', value: "TS 2284 Tip 3'e göre üretim" },
      { key: 'Net Miktar', value: '5000 g (176,4 oz)' },
      { key: 'Porsiyon', value: '60 g (1 porsiyon); paket yaklaşık 83 porsiyon' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (2149 PP)' },
      { key: 'Menşei', value: 'Türkiye' },
      {
        key: 'Üretici',
        value: 'PAN-GEV Tarım Hayvancılık Sanayi ve Ticaret A.Ş. (Torku / Konya Şeker)',
      },
      {
        key: 'Üretici Adresi',
        value: 'İpekçi Mah. 130913 Sk. No:7A Daire:1 Merkez Karapınar / Konya',
      },
      { key: 'İşletme Kayıt No', value: 'TR-42-K-020100' },
      { key: 'Tüketici Hattı', value: '444 75 50 — torku@torku.com.tr' },
      { key: 'Web', value: 'www.torku.com.tr' },
      { key: 'Uygunluk Beyanı', value: 'Türk Gıda Kodeksi Bulgur Tebliğine uygun olarak üretilmiştir' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Model Numarası', value: '10012007' },
      { key: 'Mamul / Malzeme Kodu', value: '407812 / 207800' },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '43 × 27,3 × 8,6 cm; 5,03 kg (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Beyanlar',
        value:
          'Yüksek lif oranı (100 g\'da 6,3 g), doğal rengi, az soyulmuş kabuğundan, taş değirmende üretim',
      },
      { key: 'Alerjen', value: 'Gluten içerir (buğday)' },
      {
        key: 'Sertifikalar',
        value: 'TSE, TSE OIC/SMIIC 1 Helal, Türk Malı',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: '2149 PP geri dönüşüm, gıda ile temasa uygun (çatal-bardak), çöp adam',
      },
      { key: 'Kullanım Notu', value: 'En iyi lezzet için kullanmadan önce yıkamayınız' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 220,26 TL (44,05 TL/kg, 3 Kasım 2026)',
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
      'Serin, rutubetsiz ve kokusuz bir yerde, doğrudan güneş ışığı alan ortamlardan uzakta; ambalajı delinmeden ve bozulmadan muhafaza ediniz.',
    usage:
      'Pilav, kısır ve dolma içi gibi bulgur yemeklerinde kullanın. En iyi lezzet için pişirmeden önce yıkamayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 220.26, date: '2026-11-03T00:00:00.000Z' }],
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
