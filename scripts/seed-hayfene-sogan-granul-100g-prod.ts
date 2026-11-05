import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Hayfene Soğan Granül 100 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08KQK9L3F + ürün ambalajı (EAN-13 8690178022403).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-hayfene-sogan-granul-100g-prod.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-hayfene-sogan-granul-100g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690178022403'
const ASIN = 'B08KQK9L3F'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'hayfene-sogan-granul-100g')

const IMAGES = [
  { key: 'front', file: 'front.jpg', alt: 'Hayfene Soğan Granül 100 g ön yüz' },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Hayfene Soğan Granül 100 g içindekiler ve menşei (Soğan (Granül), Hindistan)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Hayfene Soğan Granül 100 g arka yüz: içindekiler, menşei, TETT/parti alanı ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Hayfene Soğan Granül 100 g barkod numarası 8690178022403',
  },
  {
    key: 'details',
    file: 'details.jpg',
    alt: 'Hayfene Soğan Granül 100 g alerjen uyarısı, saklama koşulları ve üretici bilgileri',
  },
] as const

/** Etiketten okunan içindekiler: "İçindekiler / Ingredients: Soğan (Granül) / Onion Flakes". */
const ONION_INGREDIENT_ID = 464 // soğan

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1959 // Hayfene
const CATEGORY_ID = 58 // Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye (EAN 869 öneki, Esenyurt / İstanbul'da paketleniyor)

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

async function assertBrand(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('brands', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0]
  if (!found) throw new Error(`Marka kaydı yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`Marka adı uyuşmuyor: ${id} → ${String(found.name)} ≠ ${name}`)
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

  await assertIngredient(client, ONION_INGREDIENT_ID, 'soğan')
  await assertBrand(client, BRAND_ID, 'Hayfene')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Hayfene Soğan Granül 100 g',
    description:
      'Hayfene Soğan Granül, kurutulup granül hâline getirilmiş soğandan oluşan tek içerikli bir çeşnidir. 100 g şeffaf plastik kavanozda sunulur; çorba, sos, et, tavuk, makarna ve mezelerde doğrudan kullanılır.\n\nAmbalajda "Işınlama Yok", "Katkısız" ve "Renklendirici İçermez" beyanları basılıdır. İçindekiler bölümünde tek madde olarak "Soğan (Granül) / Onion Flakes", menşei olarak Hindistan yazar; ürün Türkiye\'de (Esenyurt / İstanbul) paketlenmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08KQK9L3F) ve ürün ambalajı. Ambalajda besin değerleri tablosu bulunmaz.',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Ucuzcular Gıda Mad. San. Tic. A.Ş. (Hayfene)',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Şeffaf plastik kavanoz (vidalı kapak)',
    // Etiket tek madde veriyor; yüzde belirtilmemiş.
    items: [{ ingredients: ONION_INGREDIENT_ID }],
    // Etikette alerjen madde yok; yalnız aynı hatta üretim beyanı var (specifications + warnings).
    additives: [] as number[],
    // Ambalajda besin değerleri tablosu yok → uydurma yapılmaz.
    nutrition: { per: '100g' as const, items: [] },
    labels: ['no-additives'] as string[],
    specifications: [
      { key: 'Marka', value: 'Hayfene' },
      { key: 'Ürün Tipi', value: 'Kurutulmuş soğan granülü (çeşni)' },
      { key: 'Çeşitlilik', value: 'Soğan (granül / Onion Flakes)' },
      { key: 'Net Miktar', value: '100 g' },
      { key: 'Ambalaj', value: 'Şeffaf plastik kavanoz, vidalı kapak' },
      { key: 'Menşei (Ambalaj)', value: 'Hindistan' },
      { key: 'Üretim Yeri', value: 'Türkiye — Esenyurt / İstanbul' },
      { key: 'Üretici', value: 'Ucuzcular Gıda Mad. San. Tic. A.Ş. (Hayfene)' },
      {
        key: 'Üretici Adresi (Ambalaj)',
        value: 'Akçaburgaz Mahallesi 3028 Sokak No:1/26 Esenyurt / İstanbul',
      },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-056379' },
      {
        key: 'Kalite Belgeleri',
        value:
          'ISO 9001:2015 ve ISO 22000:2005 belgelerine sahip tesiste üretilmiştir (ambalaj beyanı)',
      },
      { key: 'İletişim', value: 'info@hayfene.com · 444 82 89' },
      {
        key: 'Etiket Beyanları',
        value: 'Işınlama yok · Katkısız · Renklendirici içermez',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda alerjen madde belirtilmemiştir; ürün kereviz, hardal, susam ve sert kabuklu meyveler içeren ürünlerle aynı hatta paketlenmiştir',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalajın hiçbir yüzünde besin değerleri tablosu bulunmuyor; bu nedenle besin değerleri boş bırakıldı',
      },
      {
        key: 'Kullanım Alanı Notu',
        value:
          'Ambalajdaki "Nerede Kullanılır?" paneli boş basılmış; kullanım bilgisi etiketten alınamadı',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri (Amazon)',
        value: '14,1 × 6,2 × 6,1 cm; 140 g (paket ağırlığı)',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          "Amazon.com.tr — 5 Kasım 2026: ürün \"Şu anda mevcut değil\" (stokta yok), bu yüzden fiyat kaydı eklenmedi. Listeleme sayfasındaki 192,44 TL başka bir ASIN'e (B0F8QKCB5Z) ait öneri kartındandır",
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ürün, kereviz, hardal, susam ve sert kabuklu meyveler içeren ürünlerle aynı hatta paketlenmiştir; bu alerjenlere karşı hassasiyeti olanlar dikkatli olmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (T.E.T.T.) ve parti numarası (P.No) etiket üzerinde belirtilmiştir; bu tarihten sonra tüketilmemelidir.',
      },
    ],
    storage:
      'Serin, karanlık ve rutubetsiz ortamda saklandığında tazeliğini tavsiye edilen tüketim tarihine kadar korur.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${BARCODE}` },
      { image: media.details, caption: 'Alerjen, saklama ve üretici bilgileri' },
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
