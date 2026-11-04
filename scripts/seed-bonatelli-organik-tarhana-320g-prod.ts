import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Bonatelli Organik Tarhana 320 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0GZL2X2NN + ürün ambalajı (EAN-13 8691533503445)
 * ve üreticinin ürün sayfası (pastabonatelli.com/organik-tarhana-320-g).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-bonatelli-organik-tarhana-320g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-bonatelli-organik-tarhana-320g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691533503445'
const ASIN = 'B0GZL2X2NN'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'bonatelli-organik-tarhana-320g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g ambalaj ön yüzü (etiket paneli)',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g içindekiler listesi (Türkçe ve İngilizce, oranlarla)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'label',
    file: 'label.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g etiket tasarımı: organik sertifika, besin tablosu, barkod ve üretici bilgileri',
  },
  {
    key: 'lifestyle',
    file: 'lifestyle.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g ambalaj ve pişirilmiş tarhana çorbası',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Bonatelli Organik Tarhana 320 g barkod numarası 8691533503445',
  },
] as const

/** Etiketten okunan içindekiler (Amazon'daki ambalaj fotoğrafı). */
const INGREDIENTS = [
  { id: 181, name: 'buğday unu', percent: 28.7 },
  { id: 2327, name: 'Buğday ruşeymi', percent: 20.5 },
  { id: 318, name: 'Süt', percent: 36.8 },
  { id: 1392, name: 'Biber salçası', percent: 6 },
  { id: 464, name: 'soğan', percent: 4 },
  { id: 882, name: 'havuç', percent: 4 },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 977 // Bonatelli
const CATEGORY_ID = 24 // Temel Gıda & Mutfak › Hazır Yemek
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

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
    name: 'Bonatelli Organik Tarhana 320 g',
    description:
      "Bonatelli Organik Tarhana, organik buğday unu, buğday ruşeymi, süt, kırmızı biber salçası, soğan ve havuçla hazırlanan, 320 g'lık doypack ambalajda sunulan tarhana çorbası karışımıdır. Ürün, 5262 sayılı Organik Tarım Kanunu kapsamında ORSER tarafından sertifikalandırılmıştır (müteşebbis kodu TR-OT-011/İ-10-049).\n\nAmbalajda katkı maddesi içermediği belirtilir; gluten ve laktoz içerir. Bir kase çorba için 1 çay bardağı su veya et suyuna 2 tatlı kaşığı tarhana eklenip karıştırılarak pişirilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GZL2X2NN), ürün ambalajı ve üreticinin ürün sayfası.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Bonatelli Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '320 g',
    packaging: 'Plastik doypack poşet',
    items: INGREDIENTS.map((entry) => ({
      ingredients: entry.id,
      percent_estimate: entry.percent,
    })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1414, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 338, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2.21, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 62.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 7.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 15.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.04, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives'] as string[],
    specifications: [
      { key: 'Marka', value: 'Bonatelli' },
      { key: 'Ürün Tipi', value: 'Tarhana (çorba karışımı)' },
      { key: 'Net Miktar', value: '320 g (11,29 oz)' },
      { key: 'Ambalaj', value: 'Plastik doypack poşet' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'Bonatelli Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yeniköy Mah. Yeniköy 51 Sok. O No: 184 Karesi / Balıkesir',
      },
      { key: 'İşletme Kayıt No', value: 'TR-10-K-029428' },
      { key: 'E-posta', value: 'info@pastabonatelli.com' },
      { key: 'Web', value: 'www.pastabonatelli.com' },
      {
        key: 'Organik Sertifika',
        value:
          'ORSER (TR-OT-011) — 5262 sayılı Organik Tarım Kanunu ve 27676 sayılı Resmî Gazete’de yayımlanan yönetmelik kapsamında; müteşebbis kodu TR-OT-011/İ-10-049',
      },
      { key: 'Kullanım', value: '1 kase çorba için 2 tatlı kaşığı tarhana, 1 çay bardağı su veya et suyu' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 320 g paket (Amazon.com.tr listesi)',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Gluten ve laktoz içerir (ambalaj beyanı)',
      },
      { key: 'Katkı Beyanı', value: 'Katkı maddesi içermez (ambalaj beyanı)' },
      {
        key: 'Etiket Notu',
        value:
          'Ambalajın Türkçe metninde kırmızı biber salçası (%2) basılmış; İngilizce metin (%6) ve %100 toplamı 6 değerini doğrular, kayıt 6 olarak girildi',
      },
      {
        key: 'Etiket Varyantı',
        value:
          'Üreticinin web sitesindeki etiket tasarımında oranlar farklıdır: buğday unu %45, buğday ruşeymi %23, süt %24,5, kırmızı biber salçası %4,5, soğan %1,5, havuç %1,5 (ana kayıt Amazon’daki ambalaj fotoğrafını izler)',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 204,85 TL (320 g, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten ve laktoz içerir. Çölyak hastalığı, gluten duyarlılığı veya laktoz intoleransı olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Doğrudan güneş ışığına maruz kalmayan serin ve kuru yerde muhafaza ediniz.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) ve parti numarası ambalajın üzerindedir; süresi geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz kalmayan serin ve kuru yerde muhafaza ediniz.',
    usage:
      'Bir kase çorba için 1 çay bardağı su veya et suyuna 2 tatlı kaşığı tarhana ekleyip karıştırın; istenen kıvama gelene kadar pişirin.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 204.85, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.label, caption: 'Etiket tasarımı' },
      { image: media.lifestyle, caption: 'Servis önerisi' },
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
