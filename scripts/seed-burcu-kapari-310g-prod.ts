import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Burcu Kapari 310 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B00N0YO7B6 + ürün ambalajı (EAN-13 8691573079610);
 * ön yüz görseli üreticinin kendi mağazasından (burcuonline.com, 310 g ürün sayfası).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-burcu-kapari-310g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-burcu-kapari-310g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8691573079610'
const ASIN = 'B00N0YO7B6'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'burcu-kapari-310g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Burcu Kapari 310 g cam kavanoz ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Burcu Kapari 310 g içindekiler şeridi (Kapari, Su, Tuz, Sirke — çok dilli)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Burcu Kapari 310 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Burcu Kapari 310 g arka yüz: içindekiler, besin değerleri, üretici bilgileri ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Burcu Kapari 310 g barkod numarası 8691573079610',
  },
] as const

/** Etiketten okunan içindekiler; kapari master listede yoksa oluşturulur. */
const INGREDIENTS = [
  { name: 'Kapari', slug: 'kapari', aliases: ['Capers', 'Kapern', 'Kapari tomurcuğu'] },
  { name: 'Su', slug: 'su' },
  { name: 'tuz', slug: 'tuz' },
  { name: 'sirke', slug: 'sirke' },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 193 // Burcu
const CATEGORY_ID = 59 // Temel Gıda & Mutfak › Konserve & Turşu
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

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', {
    name: entry.name,
    slug: entry.slug,
    ...('aliases' in entry && entry.aliases
      ? { aliases: entry.aliases.map((alias) => ({ alias })) }
      : {}),
  })
  console.log(`  + içindekiler: ${entry.name} (${created.id})`)
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

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds: number[] = []
  for (const entry of INGREDIENTS) ingredientIds.push(await ensureIngredient(client, entry))

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Burcu Kapari 310 g',
    description:
      "Burcu Kapari, sirke ve tuzlu suda salamura edilmiş kapari tomurcuklarının 310 g'lık cam kavanozda sunulduğu konservedir. Kavanozun süzme ağırlığı 185 g'dır. İçindekiler kapari, su, tuz ve sirkedir; katkı maddesi, koruyucu veya alerjen beyanı yoktur.\n\nAmbalajda Türk Gıda Kodeksi'ne uygunluk, işletme kayıt numarası ve BURCU GIDA KONSERVECİLİK VE SALÇA SAN. A.Ş. üretici bilgileri yer alır. Tuz oranı 100 g'da 7,9 g'dır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B00N0YO7B6) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Burcu Gıda Konservecilik ve Salça San. A.Ş.',
    country: COUNTRY_ID,
    size: '310 g (süzme 185 g)',
    packaging: 'Cam kavanoz (metal kapaklı)',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 95.5, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 22.8, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 4.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 2.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 7.9, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Burcu' },
      { key: 'Ürün Tipi', value: 'Kapari (salamura, cam kavanoz)' },
      { key: 'Boyut', value: 'Orta boy kapari tomurcuğu' },
      { key: 'Net Miktar', value: '310 g (ambalajda “Net: 310 g e”)' },
      { key: 'Süzme Ağırlık', value: '185 g' },
      { key: 'Ambalaj', value: 'Cam kavanoz (metal kapaklı)' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'Burcu Gıda Konservecilik ve Salça San. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Kocacami Mah. Eski Hükümet Cad. No: 69, Burhaniye / Balıkesir',
      },
      { key: 'Telefon', value: '+90 266 412 59 71 (faks +90 266 412 89 01)' },
      { key: 'Web', value: 'www.burcu.com' },
      { key: 'E-posta', value: 'info@burcu.com' },
      { key: 'İşletme Kayıt No', value: 'TR-10-K-000038' },
      {
        key: 'Uygunluk Beyanı',
        value: "Türk Gıda Kodeksi'ne uygun olarak üretilmiştir",
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yoktur' },
      {
        key: 'Tuz Notu',
        value: 'Tuz içeriği 100 g’da 7,9 g’dır (ambalajdaki besin değerleri tablosu)',
      },
      {
        key: 'Saklama Beyanı',
        value:
          'Serin ve rutubetsiz yerde, doğrudan güneş ışığı almayan ortamda saklayınız; şişmiş veya sızıntılı ambalajları satın almayınız',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 310 g cam kavanoz (Amazon.com.tr listesi)' },
      {
        key: 'Amazon Ölçümler',
        value: 'Paket ağırlığı 0,52 kg; boyut “Orta” (Amazon.com.tr ürün detayı)',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 166,46 TL (310 g, 5 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Şişmiş veya sızıntılı ambalajları satın almayınız ve tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) ve parti numarası kapakta/ambalajda yer alır; süresi geçmiş ürünü tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Tuz oranı yüksektir (100 g’da 7,9 g); tuz kısıtlaması olan kişiler porsiyona dikkat etmelidir.',
      },
    ],
    storage:
      'Serin ve rutubetsiz yerde, doğrudan güneş ışığına maruz bırakmadan saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 166.46, date: '2026-11-05T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
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
