import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Koçbaşı Nohut 1 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07SVMJWJT + ürün ambalajı (EAN-13 8693374011158,
 * ambalaj görselinde barkodun yanında "1kg e" basılı).
 *
 * Mevcut kayıt: prod'da bu ürün Open Food Facts aktarımından id 17628 olarak
 * duruyor, ancak barkodu 8693374266626 (doğrulanmamış OFF değeri) ve verisi
 * neredeyse boş. Etiket fotoğrafındaki barkod esas alınarak aynı kayıt güncellenir;
 * eski OFF barkodu `specifications` içinde belgelenir, ikinci bir ürün açılmaz.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-kocbasi-nohut-1kg-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-kocbasi-nohut-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374011158'
/** Etiket görselinde doğrulanmış barkod; OFF kaydındaki farklı değer eskidir. */
const SUPERSEDED_BARCODE = '8693374266626'
const ASIN = 'B07SVMJWJT'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-kocbasi-nohut-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg ön yüz: 1 kg paket, koçbaşı nohut',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg ürün bildirimi: ürün nohut, tip koçbaşı, 1. sınıf, menşe Türkiye',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg 100 g besin değerleri tablosu (enerji 1396 kJ / 334 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg ambalaj sembolleri: güneş almayan, rutubetsiz, PP 5, HALAL, TSE',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg arka yüz: etli nohut tarifi, pişirme önerisi, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Koçbaşı Nohut 1 kg barkod numarası 8693374011158',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_NO_HUT_ID = 1170 // Nohut

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
} as const

function assertEan13(barcode: string): string {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 13 hane olmalı: ${barcode}`)
  const digits = [...barcode].map(Number)
  const check = digits[12]
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (check !== expected) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${barcode} (beklenen ${expected}, bulunan ${check})`)
  }
  return barcode
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
    token: TOKEN || undefined,
  })
  await client.login()
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Koçbaşı Nohut 1 kg',
    description:
      "Yayla Koçbaşı Nohut, 1. sınıf iri taneli nohudun 1 kg'lık şeffaf pencereli ambalajıdır. Tek içerikli bir baklagil ürünüdür; katkı maddesi içermez, Türkiye'de yetiştirilen nohutlardan üretilir.\n\nEtiket, ürünü potasyum ve folik asit kaynağı olarak tanımlar (100 g'da 1171 mg potasyum, 46 µg folik asit). Etli nohut yemeği, pilav ve çorbalarda kullanılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07SVMJWJT) ve ürün ambalajı (EAN-13 8693374011158).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik paket (şeffaf pencereli)',
    items: [{ ingredients: INGREDIENT_NO_HUT_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1396, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 334, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 41.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 18.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 1171, unit: 'mg' },
      ],
    },
    labels: ['no-additives', 'non-gmo'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Koçbaşı Nohut' },
      { key: 'Sınıf', value: '1. Sınıf' },
      { key: 'Tane Boyu', value: 'A (çok iri) boy' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Porsiyon', value: '50 g kuru (paket başına yaklaşık 20 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket, şeffaf pencereli' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Saray Mahallesi, Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / ANKARA',
      },
      { key: 'Üretici Telefonu', value: '0 312 815 49 50 (faks 0 312 815 47 90)' },
      {
        key: 'Mersin Fabrikası',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN — 0 324 221 62 76',
      },
      {
        key: 'İşletme Kayıt Numarası',
        value: '(ANK) TR-06-K-000171, (MER) TR-33-K-001608',
      },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web', value: 'www.yaylabakliyat.com' },
      { key: 'Standart', value: 'TS 142 — Gıda Kodeksine uygundur' },
      { key: 'Folik Asit', value: '46 µg / 100 g (folik asit kaynağı)' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Önceki Barkod',
        value: `${SUPERSEDED_BARCODE} — Open Food Facts kaydından gelen, ambalaj görseliyle doğrulanmamış değer`,
      },
      { key: 'Ürün Ölçüleri', value: '22,5 × 16 × 5 cm (paket, Amazon ölçümü)' },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      { key: 'GDO', value: 'İçermez' },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      { key: 'Ambalaj Sembolleri', value: 'Güneş almayan, rutubetsiz, PP 5, yeşil nokta, TSE, helal' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 100,35 TL (kg başına 100,35 TL, liste fiyatı 111,50 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tahıl ve baklagil ürünleri tarımsal kökenlidir; tüketmeden önce gözle kontrol edilmelidir.',
      },
      { severity: 'low' as const, text: 'Ambalajı açılmış veya delinmiş ürünü satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage: 'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Soğuk suda 10-12 saat ıslatın. Düdüklü tencerede yaklaşık 30-40 dakikada, normal tencerede 1-1,5 saatte pişer.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 100.35, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: tarif, pişirme önerisi ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8693374011158' },
    ],
    status: 'published' as const,
  }

  const byBarcode = await client.findOne('products', { barcode: { equals: BARCODE } })
  const byLegacyBarcode = byBarcode
    ? undefined
    : await client.findOne('products', { barcode: { equals: SUPERSEDED_BARCODE } })
  const existing = byBarcode ?? byLegacyBarcode

  const product = existing
    ? await client.update('products', existing.id, data)
    : await client.create('products', data)

  const source = byBarcode
    ? 'barkod eşleşmesi'
    : byLegacyBarcode
      ? `eski barkod ${SUPERSEDED_BARCODE}`
      : 'yeni kayıt'
  console.log(`\nÜrün ${existing ? 'güncellendi' : 'oluşturuldu'}: ${product.id} (${source})`)
  console.log(`https://barkoddedektifi.com/urun/${BARCODE}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
