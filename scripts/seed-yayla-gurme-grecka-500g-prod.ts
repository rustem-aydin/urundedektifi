/**
 * Yayla Gurme Greçka (Karabuğday) 500 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08D797NT7 + ürün ambalajı (EAN-13 8693374236070).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-yayla-gurme-grecka-500g-prod.ts
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

const BARCODE = '8693374236070'
const ASIN = 'B08D797NT7'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-grecka-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g ürün ve üretici bilgileri',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g geri dönüşüm ve ambalaj sembolleri (PP 5, 2502)',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g arka yüz: pişirme, saklama, tüketim, besin değerleri ve barkod',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Yayla Gurme Greçka (Karabuğday) 500 g barkod numarası 8693374236070',
  },
] as const

/** Etiket tek içindekili: Ürün / Product — Karabuğday / Buckwheat. */
const BUCKWHEAT = { id: 610, name: 'karabuğday' } as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl (bulgur ve greçka kümesi)
const COUNTRY_ID = 1 // Türkiye (üretim yeri; hammadde menşei Rusya)

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
  magnesium: 40,
  zinc: 41,
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

  await assertIngredient(client, BUCKWHEAT.id, BUCKWHEAT.name)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Greçka (Karabuğday) 500 g',
    description:
      "Yayla Gurme Greçka, kavuzu alınmış karabuğday (buckwheat) çekirdeğinin 500 g'lık tekli paketidir. Karabuğday Rusya menşelidir; ürün Mersin'deki Yayla tesislerinde el değmeden, koruyucu atmosferde paketlenir. Tek içindekili üründür (karabuğday).\n\nPirinç ve bulgur yerine pilav, yemek ve salatalarda kullanılır; öğütülmüş unu ekmek, makarna ve tarhana yapımına eklenir. Ambalajda lif, protein, çinko ve potasyum kaynağı olduğu, magnezyum kaynağı olduğu, glutensiz ve vegan olduğu belirtilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08D797NT7) ve ürün ambalajı (EAN-13 8693374236070).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    size: '500 g',
    packaging: 'Şeffaf pencereli plastik poşet (PP 5), koruyucu atmosferde paketlenmiş',
    items: [{ ingredients: BUCKWHEAT.id }],
    additives: [] as number[],
    /* Etiket değerleri pişmemiş (çiğ) 100 g içindir; porsiyon bilgisi specifications'ta. */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1453, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 346, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 2.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 66.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 395.8, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 189.6, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.zinc, amount: 2.5, unit: 'mg' },
      ],
    },
    labels: ['gluten-free', 'vegan', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Greçka (kavuzu alınmış karabuğday çekirdeği)' },
      { key: 'Net Miktar', value: '500 g' },
      {
        key: 'Porsiyon',
        value:
          '1 porsiyon 60 g (pişmemiş); 1 porsiyon için RA: enerji %10, yağ %2, doymuş yağ %2, şeker %1, tuz %0',
      },
      {
        key: 'Ambalaj',
        value: 'Şeffaf pencereli plastik poşet (PP 5), koruyucu atmosferde paketlenmiş',
      },
      { key: 'Üretim Yeri', value: 'Türkiye (Mersin)' },
      { key: 'Hammadde Menşei', value: 'Rusya (ambalaj ön yüzünde RUSSIA haritası)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mah. 1099. Sok. No: 1, Toroslar / Mersin' },
      { key: 'Tüketici Danışma Hattı', value: '0324 221 62 76 (pbx) — Faks: 0324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr — yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Paket Ölçüleri', value: '19,8 × 13,4 × 5,8 cm' },
      { key: 'Brüt Ağırlık', value: '510 g' },
      {
        key: 'Etiket Beyanları',
        value:
          'Lif kaynağı; protein kaynağı; çinko kaynağı; potasyum kaynağı; magnezyum kaynağı; glutensiz; vegan; helal; 1982’den beri',
      },
      {
        key: 'Etiket Sembolleri',
        value:
          '5 PP (polipropilen), 2502 (plastik), gıda ile temasa uygunluk (çatal-bardak), evsel atık (çöp adam), güneşten koruyunuz, kuru tutunuz, helal',
      },
      {
        key: 'Besin Tablosu',
        value:
          'Etiket değerleri pişmemiş (çiğ) 100 g içindir; 1 porsiyon 60 g. RA yüzdeleri etiketteki yetişkin referans alımına göredir.',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Etikette alerjen uyarısı veya "eser miktarda içerebilir" beyanı bulunmuyor; ürün glutensiz olarak beyan edilmiştir',
      },
      {
        key: 'Amazon Satış Biçimi',
        value:
          "Tekli 500 g paket; aynı ASIN ailesinde 2'li paket (B0FG2SC3LH) ayrıca listelenir",
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          "Amazon.com.tr listesi 3 Kasım 2026 itibarıyla stokta değil (\"Şu anda mevcut değil\"), fiyat beyan edilmedi",
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT) ve parti numarası ambalaj üzerindedir; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torba içinde saklayınız.',
    usage:
      'Pişirme önerisi: karabuğdayı 1:3 oranında limonlu ılık suda 7 saate kadar bekletin, yıkayıp kısık ateşte 15-20 dakika pişirin (1 bardak suya 1 çay kaşığı limon suyu). Pirinç ve bulgur yerine yemeklerde ve salatalarda kullanabilirsiniz; öğütülmüş unu ekmek, makarna ve tarhana yapımına eklenebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption:
          'Arka yüz: pişirme yöntemi, önemli notlar, tüketim önerisi, saklama, besin değerleri ve barkod',
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
