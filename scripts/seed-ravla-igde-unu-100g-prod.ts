import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Ravla İğde Unu 100 g ürününü UZAK Payload REST API'sine yazar: marka, master
 * içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0F18RFKK9 + ürün ambalajı (Ravla'nın ürün
 * görsellerindeki arka yüz; EAN-13 8685228120031 okundu ve kontrol hanesi
 * doğrulandı).
 *
 * Besin tablosu uyarısı: etiket 100 g için 1184 kJ / 283 kcal basar; makro
 * toplamı (77×4 + 14,8×4 + 11,7×9 = 472,5 kcal; lifle 510,5) ile çelişir.
 * Kayda etiketteki değerler basıldığı gibi yazıldı, çelişki belgelendi.
 *
 * Alerjen: yalnızca “iz miktarda gluten, süt ürünleri, sert kabuklu meyve ve yer
 * fıstığı içeren ortamda üretilmiştir” beyanı vardır → allergens boş bırakıldı.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-ravla-igde-unu-100g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8685228120031'
const ASIN = 'B0F18RFKK9'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'ravla-igde-unu-100g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Ravla İğde Unu 100 g ön yüz; cam kavanoz, iğde ve çekirdeğinden elde edilmiştir',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Ravla İğde Unu 100 g içindekiler ve alerjen beyanı: iğde ve çekirdeği unu (%100), iz miktarda gluten, süt ürünleri, sert kabuklu meyve ve yer fıstığı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Ravla İğde Unu 100 g besin değerleri tablosu (100 g: 1184 kJ / 283 kcal)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Ravla İğde Unu 100 g arka yüz: besin tablosu, içindekiler, saklama koşulları, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Ravla İğde Unu 100 g barkod numarası 8685228120031',
  },
] as const

const CATEGORY_ID = 52 // Baklagil & Tahıl › Un & İrmik
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

/** Marka kaydı: slug ile bulur, yoksa oluşturur (idempotent). */
async function resolveBrand(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('brands', { slug: { equals: 'ravla' } })
  if (existing) return existing.id
  const created = await client.create('brands', {
    name: 'Ravla',
    slug: 'ravla',
    description: 'Doğal ve bitkisel gıda ürünleri markası (Ravla Gıda Tarım San. ve Tic. A.Ş.).',
    website: 'https://ravla.com',
  })
  console.log(`  + marka: Ravla (${created.id})`)
  return created.id
}

/** İçindekiler kaydı: ad + slug ile bulur, yoksa oluşturur (idempotent). */
async function resolveIngredient(client: PayloadClient): Promise<number> {
  const name = 'İğde unu'
  const slug = 'igde-unu'
  const aliases = [
    'İğde ve çekirdeği unu',
    'İğde tozu',
    'Oleaster flour',
    'Silverberry flour',
  ].map((alias) => ({ alias }))

  const existing = await client.findOne('ingredients', {
    and: [{ name: { equals: name } }, { slug: { equals: slug } }],
  })
  if (existing) return existing.id
  const created = await client.create('ingredients', { name, slug, aliases })
  console.log(`  + içindekiler: ${name} (${created.id})`)
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

  const brandId = await resolveBrand(client)
  const ingredientId = await resolveIngredient(client)
  console.log(`Marka ${brandId}, içindekiler ${ingredientId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Ravla İğde Unu 100 g',
    description:
      'Ravla İğde Unu, Akdeniz iklimine sahip bölgelerde yetişen iğdenin meyvesi ve çekirdeğinin birlikte taş değirmende öğütülmesiyle elde edilen %100 iğde unudur. 100 g’lık cam kavanozda sunulur.\n\nİçindekiler tek bileşendir: iğde ve çekirdeği unu (%100). Ambalaj, iz miktarda gluten, süt ürünleri, sert kabuklu meyve ve yer fıstığı içeren ortamda üretildiğini belirtir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F18RFKK9) ve ürün ambalajı (EAN-13 8685228120031).',
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: 'Ravla Gıda Tarım San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Cam kavanoz',
    items: [{ ingredients: ingredientId }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1184, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 283, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 11.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 77, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 52.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 19, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 14.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Ravla' },
      { key: 'Ürün Tipi', value: 'İğde unu (iğde meyvesi ve çekirdeği birlikte öğütülmüş)' },
      { key: 'Net Miktar', value: '100 g' },
      { key: 'Ambalaj', value: 'Cam kavanoz' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Gıda İşletmecisi', value: 'Ravla Gıda Tarım San. ve Tic. A.Ş.' },
      {
        key: 'Adres',
        value: 'Yayalar Mah. Yayalar Cad. 68/A-B, 34909 Pendik / İSTANBUL',
      },
      { key: 'Müşteri İletişim Hattı', value: '0850 259 0 785 (RVL)' },
      { key: 'Web', value: 'info@ravla.com — ravla.com' },
      { key: 'İşletme Kayıt No.', value: 'TR-34-K-299594' },
      {
        key: 'İçindekiler Beyanı',
        value: 'İğde ve Çekirdeği Unu (%100) — iğde ve çekirdeği birlikte öğütülerek elde edilmiştir',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda “iz miktarda gluten, süt ürünleri, sert kabuklu meyve ve yer fıstığı içeren ortamda üretilmiştir” uyarısı yer alır; içindekiler arasında alerjen yoktur',
      },
      {
        key: 'Saklama Koşulları',
        value:
          'Serin, kuru ve güneş ışığından uzak ortamda, kapağı kapalı olarak muhafaza ediniz; TETT ve parti numarası ambalajın üzerindedir',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etiket 100 g için 1184 kJ / 283 kcal, yağ 11,7 g, doymuş yağ 0 g, karbonhidrat 77 g, şeker 52,5 g, lif 19 g, protein 14,8 g, tuz 0 g basar. Enerji, makro toplamıyla (77×4 + 14,8×4 + 11,7×9 = 472,5 kcal; lifle 510,5) uyuşmuyor; kayda etiketteki değerler basıldığı gibi yazıldı.',
      },
      { key: 'Barkod Kaynağı', value: 'Ambalajın arka yüzü — EAN-13 8685228120031' },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 100 g kavanoz' },
      { key: 'Ürün Ölçüleri', value: 'Paket ağırlığı 0,4 kg (Amazon ölçümü); ürün ağırlığı 321 g' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 408,85 TL (100 g, 4 Kasım 2026); Ravla’nın kendi mağazasında 481,00 TL',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ambalaj, iz miktarda gluten, süt ürünleri, sert kabuklu meyve ve yer fıstığı içeren ortamda üretildiğini belirtir; çölyak hastaları ve alerjisi olanlar üreticiye danışmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Serin, kuru ve güneş ışığından uzak ortamda, kapağı kapalı olarak saklayın; TETT ve parti numarasını kontrol edin.',
      },
    ],
    storage:
      'Serin, kuru ve güneş ışığından uzak ortamda, kapağı kapalı olarak muhafaza ediniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 408.85, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: besin tablosu, içindekiler ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8685228120031' },
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
