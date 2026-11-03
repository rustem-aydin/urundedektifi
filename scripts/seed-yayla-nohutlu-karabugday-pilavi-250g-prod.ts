import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0F6YG3YLC (6'lı paket listesi) + ürün ambalajı
 * (EAN-13 8693374258881). Kayıt OFF'tan gelen boş bir taslak olarak açılmıştı;
 * betik onu ambalaj verisiyle doldurur, yeni kayıt açmaz.
 *
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-nohutlu-karabugday-pilavi-250g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-nohutlu-karabugday-pilavi-250g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374258881'
const ASIN = 'B0F6YG3YLC'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-nohutlu-karabugday-pilavi-250g')

/** Ürünün mevcut ön yüz görseli (OFF'tan geldi) — yeniden yüklememek için alt metniyle aranır. */
const FRONT_ALT = 'Yayla Nohutlu Karabuğday Pilavı — ön yüz'

const IMAGES = [
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g içindekiler listesi (Türkçe ve İngilizce)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g besin değerleri tablosu (100 g ve porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g ambalaj sembolleri (PP 5 ve 2502 geri dönüşüm, gıda ile temasa uygun, güneşten ve nemden koruyun)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g arka yüz: içindekiler, besin değerleri, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g barkod numarası 8693374258881',
  },
] as const

/** Etiketten okunan içindekiler: Su, karabuğday (%30), nohut (%11), bitkisel yağ (%6), tuz, soğan, sarımsak, beyaz biber. */
const INGREDIENTS = [
  { id: 278, name: 'Su', percent: null },
  { id: 610, name: 'karabuğday', percent: 30 },
  { id: 1170, name: 'Nohut', percent: 11 },
  { id: 182, name: 'Bitkisel yağ', percent: 6 },
  { id: 298, name: 'Ayçiçek yağı', percent: null },
  { id: 515, name: 'Zeytinyağı', percent: null },
  { id: 137, name: 'tuz', percent: null },
  { id: 464, name: 'soğan', percent: null },
  { id: 466, name: 'Sarımsak', percent: null },
  { id: 2990, name: 'Beyaz biber', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 24 // Temel Gıda & Mutfak › Hazır Yemek
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
  zinc: 41,
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

  const front = await client.findOne('media', { alt: { equals: FRONT_ALT } })
  ids.front = front
    ? front.id
    : (
        await client.upload('media', path.join(IMAGE_DIR, 'front.jpg'), {
          alt: FRONT_ALT,
        })
      ).id

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
    name: 'Yayla Glutensiz Nohutlu Karabuğday Pilavı 250 g',
    description:
      "Yayla Glutensiz Nohutlu Karabuğday Pilavı, karabuğday ve nohutla hazırlanmış, ısıtılıp doğrudan servis edilen hazır yemektir. 250 g'lık yemek hazır poşette 2 porsiyon bulunur; mikrodalgada 2 dakikada, tavada 3 dakikada veya poşet açılmadan sıcak suda 5 dakikada hazırlanır.\n\nEtikette ürünün glütensiz ve vegan olduğu, koruyucu ve renklendirici içermediği belirtilir; ambalajın BPA'sız olduğu beyan edilir. İçindekiler su, karabuğday (%30), nohut (%11), bitkisel yağ (ayçiçek yağı, zeytinyağı) (%6), tuz, soğan, sarımsak ve beyaz biberdir. Alerjen beyanı yoktur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F6YG3YLC) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: 'Yemek hazır retort poşet (BPA’sız)',
    items: INGREDIENTS.map((entry) => ({
      ingredients: entry.id,
      ...(entry.percent === null ? {} : { percent_estimate: entry.percent }),
    })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 742, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 177, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 31.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.zinc, amount: 2.4, unit: 'mg' },
      ],
    },
    labels: [
      'gluten-free',
      'vegan',
      'vegetarian',
      'halal-certified',
      'no-additives',
      'bpa-free',
    ] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Hazır yemek (pilav)' },
      { key: 'Çeşni', value: 'Nohutlu karabuğday' },
      { key: 'Net Miktar', value: '250 g' },
      { key: 'Porsiyon', value: '2 porsiyon (paket başına)' },
      { key: 'Ambalaj', value: 'Yemek hazır retort poşet (BPA’sız)' },
      { key: 'Hazırlama', value: 'Mikrodalga 2 dk, tava 3 dk veya poşet açılmadan sıcak suda 5 dk' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No:1 Toroslar / Mersin',
      },
      { key: 'Telefon', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      {
        key: 'Uygunluk Beyanı',
        value: 'Gıda Kodeksi’ne uygundur; TETT, parti no ve ürün yılı ambalaj üzerindedir',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: '6’lı paket (6 × 250 g, toplam 1500 g; Amazon.com.tr listesi)',
      },
      {
        key: 'Amazon Ölçümler',
        value: 'Paket ağırlığı 1,62 kg; ürün sayısı 6 (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Besin Beyanları',
        value: 'Glütensiz, vegan, koruyucu içermez, renklendirici içermez',
      },
      { key: 'Ambalaj Beyanı', value: 'BPA’sız ambalaj' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5 ve 2502 geri dönüşüm, gıda ile temasa uygun (çatal-bardak), çöpe atınız, güneşten ve nemden koruyun, helal',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 6’lı paket 249,32 TL (3 Kasım 2026); tekil 250 g liste fiyatı yok, birim yaklaşık 41,55 TL',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Şişmiş ve sızıntılı ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Poşet açıldıktan sonra buzdolabında (+4 °C) saklanmalı ve 2 gün içinde tüketilmelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında (25 °C), güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Mikrodalgada 2 dakika (poşetin kenarını 2-3 cm açarak), tavada 3 dakika veya poşet açılmadan sıcak suda 5 dakika bekletilerek ısıtılır. İsteğe göre baharat veya tuz eklenebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
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
