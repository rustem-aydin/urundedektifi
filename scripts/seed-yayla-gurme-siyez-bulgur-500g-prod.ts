import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Siyez Bulgur 500 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08265CJ5K + ürün ambalajı (EAN-13 8693374243030,
 * arka yüzdeki barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu ambalajda 100 g ÇİĞ ürün içindir (1421 kJ / 340 kcal). Enerji
 * makro toplamıyla doğrulandı: 64,9×4 + 9,9×4 + 1,8×9 + 9,7×2 = 334,8 ≈ 340 kcal.
 * Ön yüzdeki 60 g porsiyon özeti (204 kcal) 340 kcal'in %60'ı ile tutarlı.
 *
 * Alerjen: ambalaj "Gluten İçerir / Contains Wheat Gluten" beyan eder → Gluten.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-gurme-siyez-bulgur-500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374243030'
const ASIN = 'B08265CJ5K'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-siyez-bulgur-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g ön yüz; tekli 500 g paket, magnezyum, demir, lif ve protein kaynağı',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g ürün beyanı: siyez bulgur, gluten içerir, menşei Türkiye',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g besin değerleri tablosu (100 g çiğ: 1421 kJ / 340 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g ambalaj sembolleri: PP 5, gıda ile temasa uygun, temiz tutunuz, güneş almayan',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g arka yüz: pişirme yöntemi, besin tablosu, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Siyez Bulgur 500 g barkod numarası 8693374243030',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl
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
  niacin: 30,
  folate: 32,
  potassium: 35,
  phosphorus: 38,
  iron: 39,
} as const

const SIYEZ_ALIASES = ['Siyez bulgur', 'Siyez bulghur', 'Einkorn bulgur', 'Siyez buğdayı bulguru']

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

/**
 * Kanonik siyez bulguru kaydı: OFF'tan gelen "Siyez bulghur" (slug siyez-bulghur)
 * kaydı Türkçe ad ve arama takma adlarıyla güncellenir; yoksa oluşturulur.
 */
async function resolveSiyezBulguru(client: PayloadClient): Promise<number> {
  const aliases = SIYEZ_ALIASES.map((alias) => ({ alias }))
  const existing =
    (await client.findOne('ingredients', { slug: { equals: 'siyez-bulghur' } })) ??
    (await client.findOne('ingredients', {
      and: [{ name: { equals: 'Siyez bulguru' } }, { slug: { equals: 'siyez-bulghur' } }],
    }))

  if (existing) {
    await client.update('ingredients', existing.id, { name: 'Siyez bulguru', aliases })
    return existing.id
  }

  const created = await client.create('ingredients', {
    name: 'Siyez bulguru',
    slug: 'siyez-bulghur',
    aliases,
  })
  console.log(`  + içindekiler: Siyez bulguru (${created.id})`)
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
    token: TOKEN || undefined,
  })
  await client.login()
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  const siyezId = await resolveSiyezBulguru(client)
  console.log(`İçindekiler: siyez bulguru ${siyezId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Siyez Bulgur 500 g',
    description:
      'Yayla Gurme Siyez Bulgur, Kastamonu bölgesinde yetiştirilen ve günümüz buğday çeşitlerinin atası sayılan siyez buğdayından üretilen iri pilavlık bulgurdur. 500 g’lık tekli pakettir; gluten içerir.\n\nEtiket bilgisi: 100 g çiğ ürün 1421 kJ / 340 kcal’dir; magnezyum, demir, lif ve protein kaynağıdır. Bulgura göre daha koyu renklidir ve biraz daha geç pişer; 1:2 oranında su ile pişirilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08265CJ5K) ve ürün ambalajı (EAN-13 8693374243030).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '500 g',
    packaging: 'Plastik ambalaj (doypack)',
    items: [{ ingredients: siyezId }],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1421, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 340, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 64.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 9.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.niacin, amount: 4.21, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.folate, amount: 26, unit: 'µg' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 404, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 160, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.iron, amount: 4.21, unit: 'mg' },
      ],
    },
    labels: ['halal-certified', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla (Gurme serisi)' },
      { key: 'Ürün Tipi', value: 'Siyez bulguru (iri pilavlık bulgur)' },
      { key: 'Net Miktar', value: '500 g' },
      {
        key: 'Porsiyon',
        value: 'Etiket porsiyonu 60 g (204 kcal); 500 g paket yaklaşık 8 porsiyon',
      },
      { key: 'Menşe', value: 'Türkiye (Kastamonu bölgesi siyez buğdayı)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No: 1, Toroslar / MERSİN / TÜRKİYE',
      },
      { key: 'Üretici Telefonu', value: '+90 324 221 62 76 (pbx), faks +90 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Standart', value: 'Türk Gıda Kodeksi Bulgur Tebliği’ne uygundur' },
      {
        key: 'Sertifikalar',
        value:
          'TS-EN ISO 9001, TS-EN ISO 22000, BRC ve IFS belgeli tesiste üretilmiştir; ürün helal sertifikalıdır',
      },
      {
        key: 'Pişirme Yöntemi',
        value:
          'Bulgura göre daha koyu renkli olan siyez bulguru 1:2 oranında su eklenerek pişirilir; bulgura göre biraz daha geç pişer',
      },
      {
        key: 'Kullanım Alanları',
        value:
          'Bulgur pilavında, dolma içinde, çorbalarda ve haşlanarak salatalarda kullanılabilir',
      },
      {
        key: 'Saklama Koşulları',
        value:
          'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız',
      },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      {
        key: 'Alerjen Beyanı',
        value: 'Ambalaj: “Gluten İçerir / Contains Wheat Gluten” (buğday gluteni)',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Arka yüzdeki “Enerji ve Besin Öğeleri” tablosu (100 g çiğ: 1421 kJ / 340 kcal) esas alındı; enerji makro toplamıyla doğrulandı (64,9×4 + 9,9×4 + 1,8×9 + 9,7×2 = 334,8 ≈ 340 kcal). Ön yüzdeki 60 g porsiyon özeti farklı bir set veriyor (100 g için 1352 kJ / 322 kcal, yağ 0,5 g/60 g); bu çelişki ambalajda basılı olduğu gibi belgelendi, kayda arka yüz tablosu yazıldı.',
      },
      {
        key: 'Ambalaj Beyanı',
        value:
          'Karton ambalajda “Koruyucu ve Renklendirici içermez / No preservatives and colorants added” yazar',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value:
          'Tekli 500 g; aynı listede 500 g × 2 ve 500 g × 8 paketleri de satılıyor',
      },
      { key: 'Ürün Ölçüleri', value: '19,1 × 13 × 5 cm (paket, Amazon ölçümü); 530 g' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 165,75 TL (500 g; kg başına 331,50 TL, önceki fiyat 195,00 TL, %15 indirim, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (buğday gluteni); çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) ve parti numarası ambalajın üzerindedir; tüketim öncesi kontrol edilmelidir.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Bulgura göre daha koyu renkli olan siyez bulguru 1:2 oranında su eklenerek pişirilir ve bulgura göre biraz daha geç pişer. Bulgur pilavında, dolma içinde, çorbalarda ve haşlanarak salatalarda kullanılabilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 165.75, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: pişirme yöntemi, besin tablosu ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8693374243030' },
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
