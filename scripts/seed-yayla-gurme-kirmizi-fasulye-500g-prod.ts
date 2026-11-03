/**
 * Yayla Gurme Kırmızı Fasulye 500 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B081JLMQKM + ürün ambalajı (EAN-13 8693374239194).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-yayla-gurme-kirmizi-fasulye-500g-prod.ts
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

const BARCODE = '8693374239194'
const ASIN = 'B081JLMQKM'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-kirmizi-fasulye')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g ürün, menşe ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g besin değerleri tablosu (pişmemiş 100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g geri dönüşüm ve ambalaj sembolleri (PP 5, 2502)',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g arka yüz: pişirme, saklama, tesis sertifikaları ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Yayla Gurme Kırmızı Fasulye 500 g barkod numarası 8693374239194',
  },
] as const

/** Master kaydı İngilizce: "Red kidney beans" (1935); etiket "Kırmızı Fasulye" yazar. */
const RED_KIDNEY = { id: 1935, name: 'Red kidney beans' } as const
const RED_KIDNEY_ALIASES = ['Kırmızı fasulye', 'Kırmızı barbunya'] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye (üretim yeri; menşe Meksika)

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
  thiamine: 28, // B1 Vitamini (Tiamin)
  potassium: 35,
  iron: 39,
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

/** Etiket adını master kayda eşleştirir; eksik alternatif adları ekler (idempotent). */
async function ensureIngredientAliases(
  client: PayloadClient,
  id: number,
  wanted: readonly string[],
): Promise<void> {
  const doc = (await client.find('ingredients', {
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number; aliases?: Array<{ alias: string }> }> }
  const current = doc.docs[0]?.aliases ?? []
  const existing = new Set(current.map((entry) => entry.alias))
  const missing = wanted.filter((alias) => !existing.has(alias))
  if (missing.length === 0) return
  await client.update('ingredients', id, {
    aliases: [...current.map((entry) => ({ alias: entry.alias })), ...missing.map((alias) => ({ alias }))],
  })
  console.log(`  ~ içindekiler ${id}: alternatif ad eklendi → ${missing.join(', ')}`)
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

  await assertIngredient(client, RED_KIDNEY.id, RED_KIDNEY.name)
  await ensureIngredientAliases(client, RED_KIDNEY.id, RED_KIDNEY_ALIASES)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Kırmızı Fasulye 500 g',
    description:
      "Yayla Gurme Kırmızı Fasulye, Meksika menşeli kuru kırmızı fasulyenin (red kidney bean) 500 g'lık tekli paketidir. Ürün Mersin'deki Yayla tesislerinde el değmeden paketlenir. Tek içindekili üründür (kırmızı fasulye).\n\nPişirmeden önce en az 8 saat soğuk suda ıslatılır; düdüklü tencerede tuz eklemeden haşlanarak yemek, salata ve garnitürlerde kullanılır. Ambalajda yüksek protein, yüksek lif ve güçlü flavonoid içerdiği, düşük glisemik indeksli, glutensiz ve vegan olduğu belirtilir; ürün 'fonksiyonel gıda' olarak tanımlanır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B081JLMQKM) ve ürün ambalajı (EAN-13 8693374239194).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    size: '500 g',
    packaging: 'Şeffaf pencereli plastik poşet (PP 5)',
    items: [{ ingredients: RED_KIDNEY.id }],
    additives: [] as number[],
    /* Etiket değerleri pişmemiş (çiğ) 100 g içindir; porsiyon bilgisi specifications'ta. */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1222, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 291, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 35.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 30.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 20.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.thiamine, amount: 0.6, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 1413, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.iron, amount: 6.1, unit: 'mg' },
      ],
    },
    labels: ['gluten-free', 'vegan', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Kuru kırmızı fasulye (red kidney bean)' },
      { key: 'Net Miktar', value: '500 g' },
      { key: 'Boy / Sınıf', value: 'Boy B (Küçük), Sınıf 1, TS 141' },
      { key: 'Menşei', value: 'Meksika' },
      {
        key: 'Porsiyon',
        value:
          '1 porsiyon 50 g (pişmemiş); 1 porsiyon için RA: enerji %7, karbonhidrat %4, doymuş yağ %1, şeker %0, tuz %2',
      },
      { key: 'Ambalaj', value: 'Şeffaf pencereli plastik poşet (PP 5)' },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No: 1, Toroslar / Mersin / Türkiye',
      },
      { key: 'Tüketici Danışma Hattı', value: '+90 324 221 62 76 (pbx) — Faks: +90 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr — yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      {
        key: 'Tesis Sertifikaları',
        value:
          'TS-EN ISO 9001 (kalite yönetimi), TS-EN ISO 22000 (gıda güvenliği), BRC, IFS ve Helal Gıda Sertifikası (NİS-H034) sahibi belgelendirilmiş tesiste paketlenmiştir',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '21,7 × 14,3 × 6 cm' },
      { key: 'Brüt Ağırlık', value: '500 g' },
      {
        key: 'Etiket Beyanları',
        value:
          'Yüksek protein; yüksek lif; güçlü flavonoidler; düşük glisemik indeks; fonksiyonel gıda; glutensiz; vegan; helal; 1982’den beri',
      },
      {
        key: 'Etiket Sembolleri',
        value:
          '5 PP (polipropilen), 2502 (plastik), gıda ile temasa uygunluk (çatal-bardak), evsel atık (çöp adam), güneşten koruyunuz, kuru tutunuz',
      },
      {
        key: 'Besin Tablosu',
        value:
          'Etiket değerleri pişmemiş (çiğ) 100 g içindir; 1 porsiyon 50 g. Tiamin (B1) 0,6 mg, potasyum 1413 mg, demir 6,1 mg olarak beyan edilir.',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 159,00 TL (3 Kasım 2026; kg başına 318,00 TL)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT), parti numarası ve ürün yılı ambalaj üzerindedir; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torba içinde saklayınız.',
    usage:
      'Pişirmeden önce soğuk suda bolca yıkayıp en az 8 saat ıslatınız (pişme süresini kısaltır, besin değerini artırır ve gaz yapıcı bileşenleri uzaklaştırır). Besin kaybını azaltmak için düdüklü tencerede tuz eklemeden kısa sürede haşlayınız; suyu ile birlikte tüketebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 159, date: '2026-11-03' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption:
          'Arka yüz: pişirme yöntemi, önemli notlar, tüketim önerisi, tesis sertifikaları ve üretici bilgileri',
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
