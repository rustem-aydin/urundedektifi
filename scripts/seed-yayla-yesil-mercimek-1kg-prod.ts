/**
 * Yayla Yeşil Mercimek 1 kg ürününü UZAK Payload REST API'sine yazar:
 * mevcut OFF kaydını (barkod 8693374011080) etiket verisi ve fotoğraflarla günceller.
 *
 * Kaynak: Amazon.com.tr ASIN B07STMFVHF + ürün ambalajı (EAN-13 8693374011080).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-yayla-yesil-mercimek-1kg-prod.ts
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

const BARCODE = '8693374011080'
const ASIN = 'B07STMFVHF'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-yesil-mercimek-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg ürün içeriği ve Türk Gıda Kodeksi Mercimek Tebliği uygunluk beyanı',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg geri dönüşüm, saklama ve TSE sembolleri',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg arka yüz: besin değerleri, üretici, pişirme önerisi ve barkod',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Yayla Yeşil Mercimek 1 kg barkod numarası 8693374011080',
  },
] as const

/** Etiketten okunan içerik: tek yaprak madde. */
const INGREDIENT_NAME = 'Yeşil Mercimek'

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye (EAN 869 öneki)
const INGREDIENT_ID = 3064 // Yeşil Mercimek

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
  potassium: 35,
  iron: 39,
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

  await assertIngredient(client, INGREDIENT_ID, INGREDIENT_NAME)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Yeşil Mercimek 1 kg',
    description:
      "Yayla Yeşil Mercimek, Kanada menşeli yeşil mercimeğin Türkiye'deki modern tesislerde işlenip 1 kg'lık şeffaf plastik pakette ambalajlandığı kuru baklagil ürünüdür. Islatmaya gerek kalmadan yaklaşık 30 dakikada pişer; çorba, salata, pilav ve etli yemeklerde kullanılır.\n\nAmbalajda ürünün doğal lif, mineral ve protein kaynağı olduğu, demir ve potasyum kaynağı olarak 100 g'da 7,7 mg demir (%55 BRD) ve 967 mg potasyum (%48 BRD) içerdiği belirtilir. Etiket değerlerine göre 100 g'da 26 g lif (%104 BRD), 23 g protein (%46 BRD) ve yalnızca 0,9 g yağ bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07STMFVHF) ve ürün ambalajı (EAN-13 8693374011080).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    size: '1 kg',
    packaging: 'Plastik paket (PP 5)',
    items: [{ ingredients: INGREDIENT_ID }],
    allergens: null,
    additives: [] as number[],
    /* Etiket 100 g için verir; kJ ve kcal ayrı satırlarda yazılıdır (1250 kJ / 299 kcal). */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1250, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 299, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 36.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 26, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.iron, amount: 7.7, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 967, unit: 'mg' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Yeşil mercimek (kuru baklagil)' },
      { key: 'Ürün / Çeşit / Sınıf', value: 'Ürün: Mercimek · Çeşit: Yeşil Mercimek · Sınıfı: 1. Sınıf TS 143' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Ambalaj', value: 'Şeffaf plastik paket (PP 5 geri dönüşümlü)' },
      { key: 'Menşei', value: 'Kanada' },
      { key: 'Üretim Yeri', value: "Türkiye'de işlenip ambalajlanmıştır" },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Saray Mahallesi, Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / ANKARA',
      },
      {
        key: 'Fabrika Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN',
      },
      { key: 'Telefon', value: '0 312 815 49 50 (pbx) · Fabrika: 0 324 221 62 76' },
      { key: 'Faks', value: '0 312 815 47 90 · Fabrika: 0 324 221 62 78' },
      { key: 'Web', value: 'yaylabakliyat.com (@yaylabakliyat)' },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30 (alkoçlar)' },
      { key: 'İşletme Kayıt Numarası', value: '(ANK) TR-06-K-000171 · (MER) TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: 'Türk Gıda Kodeksi Mercimek Tebliğine uygundur · TSE' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '21,6 × 16,1 × 5,3 cm' },
      { key: 'Ağırlık', value: '1 kg (net)' },
      {
        key: 'Etiket Beyanları',
        value:
          'Doğal lif kaynağı · Doğal mineral kaynağı · Doğal protein kaynağı · Demir ve potasyum kaynağıdır',
      },
      {
        key: 'Besin Tablosu',
        value:
          "Etiket değerleri 100 g içindir. %BRD: yağ %1, doymuş yağ %2, karbonhidrat %14, şeker %4, lif %104, protein %46, tuz %2, demir %55, potasyum %48. 'BRD / NRV' = Referans Alım Düzeyi.",
      },
      { key: 'Alerjen Beyanı', value: 'Etikette alerjen uyarısı bulunmuyor' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 1 kg 86,99 TL (86,99 TL/kg), 3 Kasım 2026',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Tahıl, hububat ve pirinçler tarımsal kökenli ürünler olup, tüketmeden önce gözle kontrol edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Etikette alerjen uyarısı yer almıyor; alerjisi olan kişiler ambalaj etiketini kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      "Lütfen rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.",
    usage:
      'Pişirmeden önce bolca yıkayınız; ıslatmaya gerek yoktur, yaklaşık 30 dakikada pişer. Kabuğunun açılmaması için tuzu pişmeye yakın ekleyin.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 86.99, date: '2026-11-03' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: besin değerleri, üretici bilgileri, pişirme önerisi ve barkod',
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
