/**
 * Yayla Haşlanmış Maş Fasulyesi 400 g ürününü UZAK Payload REST API'sine yazar:
 * mevcut OFF kaydını (barkod 8693374258430) etiket verisi ve fotoğraflarla günceller.
 *
 * Kaynak: Amazon.com.tr ASIN B08PLHNF3W + ürün ambalajı (EAN-13 8693374258430).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-yayla-haslanmis-mas-fasulyesi-400g-prod.ts
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

const BARCODE = '8693374258430'
const GTIN = '8693374258430'
const ASIN = 'B08PLHNF3W'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'yayla-haslanmis-mas-fasulyesi-400g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Yayla Haşlanmış Maş Fasulyesi 400 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Yayla Haşlanmış Maş Fasulyesi 400 g içindekiler ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Yayla Haşlanmış Maş Fasulyesi 400 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: "Yayla Haşlanmış Maş Fasulyesi 400 g geri dönüşüm ve ambalaj sembolleri (PP 5, BPA'sız)",
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Yayla Haşlanmış Maş Fasulyesi 400 g arka yüz: içindekiler, besin değerleri, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Yayla Haşlanmış Maş Fasulyesi 400 g barkod numarası 8693374258430',
  },
] as const

/** Etiketten okunan yaprak maddeler: haşlanmış maş fasulyesi (%55), su, tuz. */
const MASTER_INGREDIENT = { id: 1942, name: 'Maş fasulyesi' } as const
const WATER_ID = 278 // Su
const SALT_INGREDIENT = { id: 137, name: 'tuz' } as const

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
  magnesium: 40,
} as const

/** EAN-13 sağlama hanesi (tek haneler + 3 × çift haneler). */
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

async function assertIngredient(client: PayloadClient, id: number, expected: string): Promise<void> {
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

  await assertIngredient(client, MASTER_INGREDIENT.id, MASTER_INGREDIENT.name)
  await assertIngredient(client, SALT_INGREDIENT.id, SALT_INGREDIENT.name)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Haşlanmış Maş Fasulyesi 400 g',
    description:
      "Yayla Haşlanmış Maş Fasulyesi, maş fasulyesinin (mung bean) haşlanıp tuzlu suyla konserve edildiği 400 g'lık tekli pakettir. Süzme ağırlığı 220 g'dır ve pakette yaklaşık 2 porsiyon (1 porsiyon ~125 g) bulunur. Suda bekletmeden doğrudan yemek, pilav, çorba, salata, meze ve piyazlarda kullanılır.\n\nAmbalajda ürünün protein ve magnezyum kaynağı olduğu, koruyucu ve renklendirici içermediği belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08PLHNF3W) ve ürün ambalajı (EAN-13 8693374258430).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    size: '400 g',
    packaging: "4 katmanlı koruyucu plastik poşet (PP 5, BPA'sız)",
    items: [
      { ingredients: MASTER_INGREDIENT.id, percent_estimate: 55 },
      { ingredients: WATER_ID },
      { ingredients: SALT_INGREDIENT.id },
    ],
    allergens: null,
    additives: [] as number[],
    /* Etiket değerleri 100 g içindir; porsiyon bilgisi specifications'ta. */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 421, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 99, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 17.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 314.8, unit: 'mg' },
      ],
    },
    labels: ['halal-certified', 'bpa-free'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış maş fasulyesi konservesi (baklagil)' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Süzme Ağırlık', value: '220 g' },
      { key: 'Porsiyon', value: '1 porsiyon ~125 g; paket başına yaklaşık 2 porsiyon' },
      { key: 'Ambalaj', value: "4 katmanlı koruyucu plastik poşet (PP 5, BPA'sız)" },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mh. 102099. Sk. No: 1, Toroslar / Mersin' },
      { key: 'Tüketici Danışma Hattı', value: '0324 221 62 76 (pbx) — Faks: 0324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '17,8 × 11,9 × 3,4 cm' },
      { key: 'Brüt Ağırlık', value: '410 g' },
      {
        key: 'Etiket Beyanları',
        value:
          "Protein kaynağı; magnezyum kaynağı; koruyucu ve renklendirici içermez; BPA'sız ambalaj; 4 katmanlı koruyucu ambalaj; helal işareti",
      },
      {
        key: 'Etiket Sembolleri',
        value:
          '5 PP (polipropilen), gıda ile temasa uygunluk (çatal-bardak), evsel atık (çöp adam), güneşten koruyunuz, kuru tutunuz',
      },
      {
        key: 'Besin Tablosu',
        value:
          'Etiket değerleri 100 g içindir; 1 porsiyon ~125 g. Magnezyum 314,8 mg (%84) olarak beyan edilir.',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 66,95 TL (3 Kasım 2026; kg başına 167,38 TL)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Etikette alerjen uyarısı yer almıyor; baklagil alerjisi olan kişiler ambalaj etiketini kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Şişmiş ve sızdıran konserveleri tüketmeyiniz.' },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Oda sıcaklığında, güneş ışığından uzakta muhafaza ediniz. Açıldıktan sonra buzdolabında (+4 °C) saklayınız ve 2 gün içinde tüketiniz.',
    usage:
      'Suda bekletmeden doğrudan kullanılır: yemek, pilav, çorba, salata, meze ve piyazlara ekleyin. Ürün içindeki suyu da yemeklerinize ekleyebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 66.95, date: '2026-11-03' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: içindekiler, besin değerleri, kullanım, saklama ve üretici bilgileri',
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
