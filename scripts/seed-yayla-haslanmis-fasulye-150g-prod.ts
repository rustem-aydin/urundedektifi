import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g (tekli paket) ürününü UZAK Payload
 * REST API'sine yazar: master içindekiler, etiket fotoğrafları ve ürün dokümanı.
 *
 * Barkod 8693374265490 OFF importundan "Yayla Fasulye" (id 13756) olarak gelmişti;
 * betik bu kaydı günceller, yeni kayıt açmaz.
 *
 * Kaynak: Amazon.com.tr ASIN B0DY1P5CGY + ürün ambalajı (EAN-13 8693374265490).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-haslanmis-fasulye-150g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-haslanmis-fasulye-150g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374265490'
const ASIN = 'B0DY1P5CGY'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-haslanmis-fasulye-150g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g içindekiler listesi',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g besin değerleri tablosu (100 g ve 150 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: "Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g ambalaj sembolleri (PP 5, 2502, BPA'sız, helal)",
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g arka yüz: içindekiler, besin değerleri, üretici, barkod ve saklama',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g barkod numarası 8693374265490',
  },
] as const

/** Ambalajdan okunan içindekiler: "Haşlanmış fasulye (su, fasulye) (%97), bitkisel yağ (ayçiçek yağı)." */
const INGREDIENTS = [
  { id: 2446, name: 'Fasulye', percent: 97 },
  { id: 278, name: 'Su', percent: null },
  { id: 298, name: 'Ayçiçek yağı', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

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
    slug: 'yayla-haslanmis-suyu-suzulmus-fasulye-150-g',
    name: 'Yayla Haşlanmış Suyu Süzülmüş Fasulye 150 g',
    description:
      "Yayla Haşlanmış Suyu Süzülmüş Fasulye, 4 katlı BPA'sız koruyucu ambalajda paketlenmiş, kullanıma hazır haşlanmış beyaz fasulyedir (boiled white beans, drained). 150 g'lık tekli paket bir porsiyondur; ambalajı açıp çorbalara, yemeklere ve salatalara eklenir.\n\nEtikette renklendirici ve koruyucu içermediği, vegan olduğu ve açıp doğrudan kullanılabildiği (Yemeye Hazır / Aç Kullan) belirtilir. Lif ve protein kaynağıdır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DY1P5CGY) ve ürün ambalajı (EAN-13 8693374265490).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '150 g',
    packaging: "Tekli poşet, 4 katlı BPA'sız koruyucu ambalaj",
    items: INGREDIENTS.map((entry) =>
      entry.percent === null
        ? { ingredients: entry.id }
        : { ingredients: entry.id, percent_estimate: entry.percent },
    ),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 532, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 127, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 14.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 13.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış suyu süzülmüş fasulye (kullanıma hazır)' },
      { key: 'Net Miktar', value: '150 g' },
      { key: 'Porsiyon', value: 'Paket tek porsiyondur (1 porsiyon / 1 portion, 150 g)' },
      { key: 'Ambalaj', value: "Tekli poşet, 4 katlı BPA'sız koruyucu ambalaj" },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mh. 102099. Sk. No:1, Toroslar / Mersin',
      },
      { key: 'Tüketici Danışma Hattı', value: '0324 221 62 76 — Faks: 0324 221 62 78' },
      { key: 'Web', value: 'www.yaylaagro.com' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      {
        key: 'Etiket Beyanları',
        value:
          "Vegan; yemeye hazır (aç kullan); renklendirici ve koruyucu içermez; çorbalara, yemeklere, salatalara ekstra zenginlik katar; 1982'den beri; Yaşam Senin Sağlıklı Kal!",
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          "4 katlı BPA'sız koruyucu ambalaj, PP 5, 2502, çatal-bardak (gıda ile temasa uygun), çöp adam, güneşten koruyunuz, kuru tutunuz, helal",
      },
      {
        key: 'Besin Tablosu',
        value:
          '100 g değerleri; 1 porsiyon 150 g. Etikette değer sütunu bir satır aşağı basılmıştır; eşleştirme %RA/%RI oranlarıyla doğrulanmıştır (yağ 1,9 g %3, doymuş 0,4 g %2, karbonhidrat 14,6 g %6, şeker 1,2 g %1, lif 13,5 g %54, protein 6,2 g %12, tuz 0,1 g %2).',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '14,4 × 11,7 × 4 cm; 190 g (Amazon.com.tr)' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — Tekli paket 67,62 TL (45,08 TL/100 g, 4 Kasım 2026)',
      },
    ],
    warnings: [
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
      'Oda sıcaklığında, güneş ışığından uzak ortamda saklayınız. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Yemeye hazırdır; ambalajı açıp çorbalara, yemeklere ve salatalara ekleyin. Yemeklerinize ekstra zenginlik katar.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 67.62, date: '2026-11-04T00:00:00.000Z' }],
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
