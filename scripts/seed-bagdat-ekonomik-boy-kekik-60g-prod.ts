import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Bağdat Ekonomik Boy Kekik 60 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08G1SYR87 + ürün ambalajı (EAN-13 8690560019127,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Ambalajda besin değerleri tablosu ve geri dönüşüm sembolü yoktur; bu alanlar
 * boş bırakılır. İçindekiler tek bileşendir: Kekik (Thyme Rubbed / Oregano).
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-bagdat-ekonomik-boy-kekik-60g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690560019127'
const ASIN = 'B08G1SYR87'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'bagdat-kekik-60g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Bağdat Ekonomik Boy Kekik 60 g ön yüz; kuru kekik, ekonomik boy',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Bağdat Ekonomik Boy Kekik 60 g içindekiler: kekik / thyme rubbed / oregano',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Bağdat Ekonomik Boy Kekik 60 g arka yüz: içindekiler, saklama koşulları, üretici bilgileri, barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Bağdat Ekonomik Boy Kekik 60 g barkod numarası 8690560019127',
  },
] as const

const BRAND_ID = 1006 // Bağdat
const CATEGORY_ID = 58 // Temel Gıda & Mutfak › Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye

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

/** Master kaydı ad + slug ile bulur; yoksa oluşturur (idempotent). */
async function ensureIngredient(
  client: PayloadClient,
  name: string,
  slug: string,
  aliases: string[],
): Promise<number> {
  const existing = await client.findOne('ingredients', {
    and: [{ name: { equals: name } }, { slug: { equals: slug } }],
  })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name,
    slug,
    aliases: aliases.map((alias) => ({ alias })),
  })
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

  // Kanonik master kaydı: kekik (1961, 19 üründe kullanılıyor).
  const kekikId = await ensureIngredient(client, 'kekik', 'kekik', [
    'kekik',
    'Kekik',
    'Thyme',
    'Thyme rubbed',
  ])
  console.log(`İçindekiler: kekik ${kekikId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Bağdat Ekonomik Boy Kekik 60 g',
    description:
      'Bağdat Ekonomik Boy Kekik, kurutulup ovularak parça hâline getirilmiş kekiğin (İngilizce etikette “thyme rubbed / oregano”) 60 g’lık ekonomik boy poşetidir. Tek bileşenlidir; katkı maddesi içermez.\n\nEtiket bilgisi: TS 3786, Sınıfı 1, Grubu Parça, Tipi İşlenmiş; menşei Türkiye’dir. Etli ve sulu yemeklerde, ızgara çeşitlerinde kullanılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08G1SYR87) ve ürün ambalajı (EAN-13 8690560019127).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Bağdat Baharatları Gıda San. ve Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '60 g',
    packaging: 'Plastik doypack poşet',
    items: [{ ingredients: kekikId }],
    allergens: null,
    additives: [] as number[],
    specifications: [
      { key: 'Marka', value: 'Bağdat' },
      { key: 'Ürün Tipi', value: 'Kekik (kuru, ovulmuş / thyme rubbed, oregano)' },
      { key: 'Net Miktar', value: '60 g (ekonomik boy)' },
      { key: 'Ambalaj', value: 'Plastik doypack poşet' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'Bağdat Baharatları Gıda San. ve Tic. Ltd. Şti.' },
      {
        key: 'Üretici Adresi',
        value: 'Ahi Evran OSB Mah. Oğuz Cad. No: 32-34, Sincan / ANKARA',
      },
      { key: 'Üretici Telefonu', value: '+90 (312) 267 67 00 (pbx), faks +90 (312) 267 67 10' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-06-K-012834' },
      { key: 'Standart', value: 'TS 3786; Sınıfı 1, Grubu Parça, Tipi İşlenmiş' },
      {
        key: 'Uygunluk Beyanı',
        value: 'Türk Gıda Kodeksi Baharat Tebliği’ne uygun üretilmiştir',
      },
      {
        key: 'Kullanım Alanları',
        value: 'Etli ve sulu yemeklerde, ızgara çeşitlerinde kullanılır',
      },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir (örnek parti no: G/012721-05)' },
      { key: 'İçindekiler Beyanı', value: 'Kekik / Thyme Rubbed / Oregano (tek bileşen)' },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yoktur' },
      {
        key: 'Besin Tablosu Notu',
        value: 'Ambalajda besin değerleri tablosu bulunmaz; besin değerleri uydurulmadı',
      },
      { key: 'Ambalaj Sembolleri', value: 'Ambalajda geri dönüşüm sembolü bulunmaz' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 60 g paket; aynı listede 60 g × 2 paket varyantı da satılıyor',
      },
      { key: 'Ürün Ölçüleri', value: '19,5 × 10,7 × 5,8 cm (paket, Amazon ölçümü); 60 g' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 189,95 TL (60 g; 100 g başına 316,58 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Ambalajda alerjen beyanı yoktur; ambalaj bilgileri ve TETT (tavsiye edilen tüketim tarihi) tüketim öncesi kontrol edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Rutubetsiz, kuru, serin ve ışık almayan yerde saklayın.',
      },
    ],
    storage: 'Rutubetsiz, kuru, serin ve ışık almayan yerde muhafaza ediniz.',
    usage: 'Etli ve sulu yemeklerde, ızgara çeşitlerinde kullanılır.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 189.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: içindekiler, saklama koşulları, üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8690560019127' },
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
