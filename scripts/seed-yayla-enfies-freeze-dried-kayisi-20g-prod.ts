import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Enfies Freeze Dried Kayısı 20 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B09HGX7CN7 + ürün ambalajı (EAN-13 8693374279794,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı) + marka
 * mağazası (aynı barkodlu kayıt: 20 g).
 *
 * Net miktar ambalaj fotoğrafında basılı değildir; 20 g bilgisi Yayla mağazasındaki
 * aynı barkodlu ürün kaydından alınmıştır (Amazon yalnız paket ağırlığını, 30 g verir).
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-enfies-freeze-dried-kayisi-20g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-enfies-freeze-dried-kayisi-20g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374279794'
const ASIN = 'B09HGX7CN7'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-enfies-kayisi-20g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı 20 g ön yüz; %100 meyve, vegan ve glutensiz, katkısız, şeker ilavesiz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı içindekiler: kayısı; doğal olarak şeker içerir',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı 20 g besin değerleri tablosu (100 g: 1423 kJ / 340 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı 20 g ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı 20 g arka yüz: içindekiler, saklama koşulları, besin tablosu ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Enfies Freeze Dried Kayısı 20 g barkod numarası 8693374279794',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 20 // Meyve & Sebze (kuru meyve)
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_APRICOT_ID = 907 // kayısı

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

async function assertIngredient(
  client: PayloadClient,
  id: number,
  name: string,
): Promise<void> {
  const doc = await client.find('ingredients', {
    where: { and: [{ id: { equals: id } }, { name: { equals: name } }] },
    limit: 1,
    select: { name: true },
  })
  if (doc.totalDocs !== 1) {
    throw new Error(`İçindekiler eşleşmedi: id ${id} ≠ ${name}`)
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
    token: TOKEN || undefined,
  })
  await client.login()
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  await assertIngredient(client, INGREDIENT_APRICOT_ID, 'kayısı')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Enfies Freeze Dried Kayısı 20 g',
    description:
      "Yayla Enfies Freeze Dried Kayısı, dondurularak kurutulmuş (freeze dried) kayısının 20 g'lık çıtır atıştırmalık paketidir. Tek içerik kayısıdır; şeker ilavesi, koruyucu ve katkı maddesi yoktur. Dondurularak kurutma meyvenin rengini, aromasını ve besin değerlerini korur; ambalajda paket içeriğinin yaklaşık 9 kat taze meyveden üretildiği belirtilir.\n\nÜrün 100 g'da 340 kcal, 12 g lif ve 53 g doğal şeker içerir; vegan ve glutensizdir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B09HGX7CN7), ürün ambalajı (EAN-13 8693374279794) ve Yayla mağazası (aynı barkodlu kayıt: 20 g).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '20 g',
    packaging: 'Doypack poşet (dondurularak kurutulmuş meyve)',
    items: [{ ingredients: INGREDIENT_APRICOT_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1423, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 340, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 74, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 53, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 3.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'gluten-free', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla (Enfies)' },
      { key: 'Ürün Tipi', value: 'Dondurularak kurutulmuş kayısı (freeze dried)' },
      { key: 'Net Miktar', value: '20 g' },
      {
        key: 'İçindekiler',
        value: 'Kayısı (tek içerik); şeker ilavesi, koruyucu ve katkı maddesi içermez',
      },
      {
        key: 'Üretim Teknolojisi',
        value:
          'Dondurularak kurutma (freeze dried); ambalajda paket içeriğinin yaklaşık 9 kat taze meyveden üretildiği belirtilir',
      },
      { key: 'Menşe', value: 'Türkiye’de üretilmiştir (yerli ve ithal hammadde)' },
      { key: 'Üretici', value: 'Yayla Agro Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Niğde Organize Sanayi Bölgesi, 12. Cadde No: 1, Merkez / NİĞDE',
      },
      { key: 'Danışma Hattı', value: '444 4 330' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-51-K-006543' },
      { key: 'Web', value: 'yaylabakliyat.com' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      {
        key: 'Beyan',
        value:
          'Yüzde yüz meyve, katkısız ve koruyucusuz, şeker ilavesi yok (doğal olarak şeker içerir), vegan, glutensiz, yüksek lif',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, dairesel yaprak-ok çevre sembolü',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Ambalajda alerjen beyanı yoktur; ürün tek içerikli kayısıdır',
      },
      {
        key: 'Helal Beyanı',
        value:
          'Amazon ürün açıklaması ürünlerde alkol ve domuz yağı türevlerinin kullanılmadığını belirtir; ambalajda helal logosu yoktur',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Değerler ambalajdaki 100 g sütunundan yazıldı; çıtır meyve olduğu için porsiyon bilgisi etikette yoktur, tüm paket 20 g’dır.',
      },
      {
        key: 'Net Miktar Kaynağı',
        value:
          'Ambalaj fotoğrafında net miktar basılı değildir; aynı barkodu (8693374279794) taşıyan Yayla mağazası kaydı “20 g” der, Amazon ise yalnız paket ağırlığını (30 g) verir',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value: '18,4 × 14 × 5,8 cm (paket, Amazon ölçümü); paket ağırlığı 30 g',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 84,51 TL (20 g, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Ambalajı açtıktan sonra hava almayacak şekilde muhafaza ediniz.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Şeker ilavesi yoktur ancak ürün doğal olarak şeker içerir (100 g’da 53 g); şeker alımını sınırlandıranlar porsiyona dikkat etmelidir.',
      },
    ],
    storage:
      'Ambalajı açmadan önce güneş görmeyen, serin ve kuru bir yerde saklayınız. Açtıktan sonra hava almayacak şekilde muhafaza ediniz.',
    usage:
      'Sporda, evde/okulda ve seyahatte atıştırmalık olarak tüketilebilir; paket üzerindeki QR kod okutularak enfies tariflerine ulaşılabilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 84.51, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: içindekiler, saklama koşulları, besin tablosu ve üretici bilgileri',
      },
      { image: media.barcode, caption: 'Barkod 8693374279794' },
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
