/**
 * Burcu Haşlanmış Nohut 600 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0FNFB31ND ("600 gr 2li paket") + cam kavanoz etiketi
 * (EAN-13 8691573030321, tekil 600 g kavanozun barkodu).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-burcu-haslanmis-nohut-600g-prod.ts
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

const BARCODE = '8691573030321'
const ASIN = 'B0FNFB31ND'
const SINGLE_ASIN = 'B08RQ9VX1L'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'burcu-haslanmis-nohut-600g')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g cam kavanoz ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g içindekiler: nohut, su, tuz',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g cam ambalaj ve geri dönüşüm sembolleri (GL 70 / 1100)',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g arka yüz: içindekiler, besin değerleri, kullanım, saklama, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Burcu Haşlanmış Nohut 600 g barkod numarası 8691573030321',
  },
] as const

/** Etiket: Nohut, Su, Tuz. */
const INGREDIENTS = [
  { id: 1170, name: 'Nohut' },
  { id: 278, name: 'Su' },
  { id: 137, name: 'tuz' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 193 // Burcu
const CATEGORY_ID = 20 // Meyve & Sebze (haşlanmış baklagil konserveleri kümesi)
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

async function assertIngredient(
  client: PayloadClient,
  id: number,
  expected: string,
): Promise<void> {
  const doc = (await client.find('ingredients', {
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number; name: string }> }
  const name = doc.docs[0]?.name
  if (name !== expected) {
    throw new Error(`İçindekiler ${id} beklenen "${expected}" değil: ${String(name)}`)
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

  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    ...(TOKEN ? { token: TOKEN } : {}),
  })
  await client.login()
  console.log(`API: ${API}`)

  for (const ingredient of INGREDIENTS) {
    await assertIngredient(client, ingredient.id, ingredient.name)
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Burcu Haşlanmış Nohut 600 g',
    description:
      "Burcu Haşlanmış Nohut, nohutun su ve tuzla haşlanıp cam kavanozda konserve edildiği 600 g'lık üründür. Süzme ağırlığı 360 g'dır. Harç ilave edildikten sonra orta ateşte pişirilir; meze ve salatalarda ezilerek veya doğrudan kullanılabilir.\n\nAmazon.com.tr'de bu barkod '600 gr 2li paket' (2 × 600 g) olarak satılır; tekil 600 g kavanoz aynı EAN-13'ü taşır. Menşei Türkiye'dir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FNFB31ND) ve cam kavanoz etiketi (EAN-13 8691573030321).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'BURCU GIDA KONSERVECİLİK VE SALÇA SAN. A.Ş.',
    size: '600 g',
    packaging: 'Cam kavanoz (600 g net, 360 g süzme)',
    items: INGREDIENTS.map((ingredient) => ({ ingredients: ingredient.id })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 348, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 83.5, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 10, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 7.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.8, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Burcu' },
      { key: 'Ürün Tipi', value: 'Haşlanmış nohut konservesi (cam kavanoz)' },
      { key: 'Net Miktar', value: '600 g' },
      { key: 'Süzme Ağırlık', value: '360 g' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Ambalaj', value: 'Cam kavanoz — cam ambalaj işareti GL 70 / 1100' },
      { key: 'Üretim Yeri', value: 'Türkiye (Burhaniye, Balıkesir)' },
      { key: 'Üretici', value: 'BURCU GIDA KONSERVECİLİK VE SALÇA SAN. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Kocacami Mah. Eski Hükümet Cad. No: 69, Burhaniye / Balıkesir / Türkiye',
      },
      { key: 'Tüketici Danışma Hattı', value: '+90 266 412 59 71 (5 hat) — Faks: +90 266 412 89 01' },
      { key: 'Web', value: 'www.burcu.com — info@burcu.com' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-10-K-000038' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygun olarak üretilmiştir" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: `2'li paket (2 × 600 g); tekil 600 g kavanoz ASIN ${SINGLE_ASIN}`,
      },
      { key: 'Paket Ölçüleri', value: "17,2 × 10 × 7,8 cm (2'li paket kargo ölçüsü)" },
      { key: 'Brüt Ağırlık', value: "1,88 kg (2'li paket)" },
      {
        key: 'Etiket Sembolleri',
        value:
          'Gıda ile temasa uygun cam işareti, cam ambalaj geri dönüşüm işareti (GL 70 / 1100), evsel atık (temiz tutunuz) sembolü',
      },
      {
        key: 'Besin Tablosu',
        value: 'Etiket değerleri 100 g içindir; kavanoz 600 g net / 360 g süzme ağırlık taşır.',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          "Amazon.com.tr — 2'li paket 215,62 TL (3 Kasım 2026; kg başına 179,68 TL)",
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Bombalı (şişmiş) ve sızıntılı ambalajları satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi ve parti numarası kapaktadır; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Direkt güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    usage:
      'Harç ilave edildikten sonra orta ateşte pişirilmesi önerilir. Meze ve salatalar için ezilerek veya direkt kullanıma uygundur.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 215.62, date: '2026-11-03' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption:
          'Arka yüz: içindekiler, besin değerleri, kullanım ve saklama koşulları, üretici bilgileri ve barkod',
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
