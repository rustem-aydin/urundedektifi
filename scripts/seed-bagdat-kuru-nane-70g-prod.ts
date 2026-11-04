import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Bağdat Kuru Nane 70 g (Ekonomik Boy) ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08TC3SWLV + ürün ambalajı (EAN-13 8690560019110).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-bagdat-kuru-nane-70g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-bagdat-kuru-nane-70g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690560019110'
const ASIN = 'B08TC3SWLV'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'bagdat-kuru-nane-70g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Bağdat Kuru Nane 70 g Ekonomik Boy ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Bağdat Kuru Nane 70 g içindekiler ve menşe beyanı (Kuru Nane / Dried Mint / Getrocknete Minze)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Bağdat Kuru Nane 70 g arka yüz: üretici bilgileri, saklama koşulu, tarif ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Bağdat Kuru Nane 70 g barkod numarası 8690560019110',
  },
] as const

/** Etiketten okunan içindekiler: tek madde — kuru nane. */
const INGREDIENTS = [{ id: 710, name: 'nane' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1006 // Bağdat
const CATEGORY_ID = 58 // Temel Gıda & Mutfak › Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye

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
    name: 'Bağdat Kuru Nane 70 g',
    description:
      "Bağdat Kuru Nane, kurutulup öğütülmüş nane yapraklarının 70 g'lık ekonomik boy doypack poşette sunulduğu tek bileşenli baharattır. Ambalajda TS 3498 ve ISO 2256 standartlarına, 1. sınıf ürüne uygunluk belirtilir; menşei Türkiye'dir.\n\nSebzeli ve sulu yemeklerde, cacık ve salatalarda kullanılır. Poşetin arka yüzünde labne, mayonez, sarımsak ve nane ile hazırlanan naneli cips sosu tarifi yer alır. Katkı maddesi, koruyucu veya alerjen beyanı yoktur; ambalajda besin değerleri tablosu bulunmaz.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TC3SWLV) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Bağdat Baharatları Gıda San. ve Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '70 g',
    packaging: 'Plastik doypack poşet (şeffaf pencereli)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    additives: [] as number[],
    nutrition: { per: '100g' as const, items: [] },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Bağdat' },
      { key: 'Ürün Tipi', value: 'Kuru nane (öğütülmüş baharat)' },
      { key: 'Boy', value: 'Ekonomik Boy' },
      { key: 'Net Miktar', value: '70 g' },
      { key: 'Ambalaj', value: 'Plastik doypack poşet (şeffaf pencereli)' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'Bağdat Baharatları Gıda San. ve Tic. Ltd. Şti.' },
      {
        key: 'Üretici Adresi',
        value: 'Ahi Evran OSB Mah. Oğuz Cad. No: 32-34, Sincan / Ankara',
      },
      { key: 'Üretici Telefonu', value: '+90 (312) 267 67 00 (pbx), faks +90 (312) 267 67 10' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-06-K-012834' },
      { key: 'Standart', value: 'TS 3498 ve ISO 2256; Sınıf 1' },
      {
        key: 'Uygunluk Beyanı',
        value: 'Türk Gıda Kodeksi Baharat Tebliği’ne uygun üretilmiştir',
      },
      { key: 'Kullanım Alanları', value: 'Sebzeli ve sulu yemeklerde, cacık ve salatalarda' },
      {
        key: 'Tarif Önerisi',
        value:
          'Naneli cips sosu: 6 kaşık labne, 2 kaşık mayonez, 1 diş sarımsak, 1 kahve kaşığı kuru nane',
      },
      {
        key: 'TETT ve Parti No.',
        value: 'Ambalajın üzerindedir (örnek baskı: TETT 02/2026, PNO G/021621-01)',
      },
      { key: 'İçindekiler Beyanı', value: 'Kuru Nane / Dried Mint / Getrocknete Minze (tek bileşen)' },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yoktur' },
      {
        key: 'Besin Tablosu Notu',
        value: 'Ambalajda besin değerleri tablosu bulunmaz; besin değerleri uydurulmadı',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'Ambalajda geri dönüşüm sembolü bulunmaz',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 70 g paket (Amazon.com.tr listesi)',
      },
      {
        key: 'Amazon Ölçümler',
        value: 'Paket ağırlığı 0,07 kg; boyut 70 g (Amazon.com.tr ürün detayı)',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 89,95 TL (70 g, 4 Kasım 2026)' },
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
    usage:
      'Sebzeli ve sulu yemeklerde, cacık ve salatalarda kullanılır. Naneli cips sosu için labne, mayonez, sarımsak ve kuru naneyi karıştırın.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 89.95, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
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
