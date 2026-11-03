import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Green Life Fesleğen Mini Yastık 15 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08RB5378P + ürün ambalajı (EAN-13 8681425201252).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-green-life-feslegen-mini-yastik-15g-prod.ts
 *   (veya geçerli bir JWT ile: SEED_TOKEN=... node --import tsx/esm ...)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8681425201252'
const GTIN = '8681425201252'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'green-life-feslegen-mini-yastik-15g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Green Life Fesleğen Mini Yastık 15 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Green Life Fesleğen 15 g içindekiler, alerjen ve saklama bilgileri yakın çekim',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Green Life Fesleğen 15 g geri dönüşüm ve ambalaj sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Green Life Fesleğen 15 g arka yüz: üretici, işletme kayıt no, barkod ve semboller',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Green Life Fesleğen 15 g barkod numarası 8681425201252',
  },
] as const

/** Etiketten okunan içindekiler; master listede yoksa oluşturulur. */
const INGREDIENTS = [{ name: 'Fesleğen', slug: 'feslegen' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1762 // Greenlife
const CATEGORY_ID = 58 // Temel Gıda & Mutfak › Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye

async function ensureIngredient(
  client: PayloadClient,
  entry: (typeof INGREDIENTS)[number],
): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: entry.name } })
  if (existing) return existing.id

  const created = await client.create('ingredients', { name: entry.name, slug: entry.slug })
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
  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientIds = []
  for (const entry of INGREDIENTS) {
    ingredientIds.push(await ensureIngredient(client, entry))
  }

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Green Life Fesleğen Mini Yastık 15 g',
    description:
      "Green Life Fesleğen Mini Yastık, 15 g'lık mini yastık (sachet) ambalajında kurutulmuş fesleğen baharatıdır. Ambalajdaki içindekiler listesi tek maddedir: fesleğen. Etikette renklendirici, koruyucu veya aroma verici katkı maddesi belirtilmemiştir.\n\nÜrün, Noor Asia Gıda Sanayi ve Tic. A.Ş. tarafından Türkiye'de üretilir; ambalajda ISO 9001:2015 kalite yönetim sistemi ve ISO 22000:2018 gıda güvenliği yönetim sistemi sertifikalarına sahip olunduğu ve ürünün Türk Gıda Kodeksi Baharat Tebliği'ne uygun olduğu belirtilir. Etikette eser miktarda glüten, süt ürünü, yumurta, hardal, soya, susam, fıstık ve kereviz içerebileceği uyarısı yer alır.\n\nAmbalajda besin değerleri tablosu bulunmaz; parti no, tavsiye edilen tüketim tarihi, hasat yılı ve menşe ülke alanları üretim sırasında basılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08RB5378P) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Noor Asia Gıda Sanayi ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '15 g',
    packaging: 'Mini yastık poşet (sachet), plastik film',
    items: ingredientIds.map((ingredients) => ({ ingredients })),
    additives: [] as number[],
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Green Life (Greenlife)' },
      { key: 'Ürün Tipi', value: 'Kuru baharat (fesleğen)' },
      { key: 'Aroma', value: 'Fesleğen / Basil' },
      { key: 'Form', value: 'Mini yastık poşet (sachet), kurutulmuş yaprak' },
      { key: 'Net Miktar', value: '15 g' },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'Noor Asia Gıda Sanayi ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'İkitelli OSB Mah. Avkosan San. Sit. 2. Kısım 15. Ada A Blok Kat: 0-1-2-3 Merkez-Başakşehir / İstanbul',
      },
      { key: 'Üretici Telefonu', value: '0212 549 23 63' },
      { key: 'Tüketici Hattı', value: '0850 433 63 22' },
      { key: 'Web', value: 'www.greenlife.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-107359' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: 'B08RB5378P' },
      { key: 'Ürün Ölçüleri', value: '0,5 × 8,5 × 13,5 cm (paket ağırlığı 20 g)' },
      {
        key: 'Alerjen Beyanı',
        value:
          'Eser miktarda glüten, süt ürünü, yumurta, hardal, soya, susam, fıstık (yer fıstığı) ve kereviz içerebilir',
      },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi Baharat Tebliği'ne uygundur" },
      {
        key: 'Sertifikalar',
        value:
          'ISO 9001:2015 Kalite Yönetim Sistemi, ISO 22000:2018 Gıda Güvenliği Yönetim Sistemi',
      },
      { key: 'Besin Değerleri', value: 'Ambalajda besin değerleri tablosu yer almıyor' },
      {
        key: 'Üretim Bilgileri',
        value:
          'Parti no, üretim tarihi, tavsiye edilen tüketim tarihi, hasat yılı ve menşe ülke alanları ambalaj üzerine basılır',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'LDPE (04) geri dönüşüm üçgeni, FSC logosu, TÜRK MALI, gıda ile temas uygunluğu sembolü',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 12,12 TL (3 Kasım 2026); liste fiyatı 13,38 TL' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Etikette eser miktarda glüten, süt ürünü, yumurta, hardal, soya, susam, fıstık ve kereviz içerebileceği belirtilir. Bu alerjenlere duyarlı kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ambalaj açılmış veya delinmiş ise satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT) ambalaj üzerine basılır; TETT geçtikten sonra tüketmeyiniz.',
      },
    ],
    storage: 'Serin, kuru ve kokusuz ortamda, ışık almayan yerde muhafaza ediniz.',
    model: 'B08RB5378P',
    sku: 'AMZ-B08RB5378P',
    prices: [{ amount: 12.12, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: 'Barkod 8681425201252' },
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
