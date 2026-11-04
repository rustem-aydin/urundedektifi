import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Kenton Kakao 100 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B088WSQL69 + ürün ambalajı (EAN-13 8690547101012).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-kenton-kakao-100g-prod.ts
 *   veya SEED_EMAIL / SEED_PASSWORD ile.
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690547101012'
const GTIN = '8690547101012'
const ASIN = 'B088WSQL69'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'kenton-kakao-100g')

const IMAGES = [
  {
    key: 'front',
    file: 'kenton-kakao-front.jpg',
    alt: 'Kenton Kakao 100 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'kenton-kakao-ingredients.jpg',
    alt: 'Kenton Kakao 100 g ürün tanımı: yağı azaltılmış kakao tozu, en az %10 kakao yağı, alkalize işlem görmüştür',
  },
  {
    key: 'symbols',
    file: 'kenton-kakao-symbols.jpg',
    alt: 'Kenton Kakao 100 g ambalaj sembolleri: PP 5 geri dönüşüm ve gıda ile temasa uygunluk',
  },
  {
    key: 'halal',
    file: 'kenton-kakao-halal.jpg',
    alt: 'Kenton Kakao 100 g helal logosu, Türk Malı ibaresi ve tüketici hattı 0800 261 66 05',
  },
  {
    key: 'back',
    file: 'kenton-kakao-back.jpg',
    alt: 'Kenton Kakao 100 g arka yüz: kullanılışı, menşe, üretici, saklama, barkod ve tiramisu tarifi',
  },
  {
    key: 'barcode',
    file: 'kenton-kakao-barcode.jpg',
    alt: 'Kenton Kakao 100 g barkod numarası 8690547101012',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 594 // Kakao (kakao)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1625 // Kenton
const CATEGORY_ID = 58 // Temel Gıda & Mutfak › Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye (ithal kakao çekirdeği, Türkiye'de üretim)

/** EAN-13 kontrol hanesi. */
function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`Geçersiz EAN-13: ${code}`)
  const digits = [...code].map(Number)
  const check = digits.pop()!
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== check) throw new Error(`EAN-13 kontrol hanesi hatalı: ${code}`)
}

async function ensureMedia(client: PayloadClient): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of IMAGES) {
    const alt = ALT[image.key]!
    const existing = await client.findOne('media', { alt: { equals: alt } })
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await client.upload('media', path.join(IMAGE_DIR, image.file), { alt })
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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Kenton Kakao 100 g',
    description:
      'Kenton Kakao, yağı azaltılmış ve alkalize işlem görmüş kakao tozudur (en az %10 kakao yağı). İthal kakao çekirdekleri kullanılarak Türkiye’de üretilir; tek bileşen kakao olup domuz yağı ve domuzdan elde edilmiş hiçbir ürün içermez, ambalajında helal logosu taşır.\n\nKek, kurabiye, pasta, hamurlu ve sütlü tatlılar ile dondurma yapımında kullanılır; su veya süt ile sıcak içecek olarak da tüketilebilir. Ambalaj üzerinde tiramisu tarifi yer alır.\n\nAmbalajda besin değerleri tablosu basılı değildir; bu nedenle kayıtta besin değeri uydurulmamış, boş bırakılmıştır. Veri kaynağı: Amazon.com.tr (ASIN B088WSQL69) ve ürün ambalajı (EAN-13 8690547101012).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Kenton Gıda Sanayi A.Ş. (Sultanlar Group)',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Nem geçirmez plastik poşet (PP 5, kilitli)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Kenton' },
      {
        key: 'Ürün Tipi',
        value: 'Yağı azaltılmış, alkalize işlem görmüş kakao tozu (en az %10 kakao yağı)',
      },
      { key: 'Net Miktar', value: '100 g' },
      { key: 'Ambalaj', value: 'Nem geçirmez plastik poşet (PP 5, kilitli)' },
      {
        key: 'Menşe',
        value: 'İthal kakao çekirdekleri kullanılarak Türkiye’de üretilmiştir',
      },
      { key: 'Üretici', value: 'Kenton Gıda Sanayi A.Ş. (Sultanlar Group)' },
      { key: 'Adres', value: 'Ankara Cad. No: 344, 34906 Kurtköy / Pendik - İstanbul' },
      { key: 'Telefon', value: '+90 216 595 05 00' },
      { key: 'Tüketici Hattı', value: '0800 261 66 05' },
      { key: 'E-posta', value: 'kenton@kenton.com.tr' },
      { key: 'Web', value: 'www.kenton.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-001165' },
      { key: 'Kalite Belgeleri', value: 'ISO 9001 ve ISO 22000' },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      {
        key: 'Beyan',
        value:
          'Domuz yağı ve domuzdan elde edilmiş hiçbir ürün içermez; TÜRK MALI (ambalaj)',
      },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      {
        key: 'Besin Değerleri',
        value:
          'Ambalajda besin değerleri tablosu basılı değildir; kayıtta besin değeri boş bırakıldı',
      },
      {
        key: 'Kullanım',
        value:
          'Her çeşit kek, pasta, hamurlu ve sütlü tatlı ile dondurma yapımında; sıcak içecek olarak su veya süt ile (ambalaj)',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'PP 5 geri dönüşüm, gıda ile temasa uygunluk, helal, TÜRK MALI, tiramisu tarifi',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 100 g paket; satıcı Amazon.com.tr' },
      {
        key: 'Paket Ölçüleri',
        value: '16,6 × 12,1 × 2,5 cm; 80 g (Amazon.com.tr ürün detayı)',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 138,26 TL (100 g, 4 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz; TETT ve parti no ambalaj üzerindedir.',
      },
    ],
    storage:
      'Serin ve kuru ortamda, güneş ışığına maruz kalmayacak şekilde, her türlü yabancı tat ve koku veren maddelerden uzakta muhafaza ediniz.',
    usage:
      'Her çeşit kek, pasta, hamurlu ve sütlü tatlı ile dondurma yapımında kullanılır; sıcak içecek olarak su veya süt ile tüketilebilir. Ambalaj üzerinde tiramisu tarifi bulunur.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 138.26, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    recyclingImage: media.symbols,
    additionalImages: [
      { image: media.halal, caption: 'Helal logosu, Türk Malı ve tüketici hattı' },
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
