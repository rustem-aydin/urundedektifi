import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * TheLifeCo Spirulina Kelp & Nettle 60 kapsül ürününü UZAK Payload REST
 * API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08TXK6PW3 + ürün ambalajının ön/arka yüzü
 * (EAN-13 8682835610375). Prod'da bu barkod yok; betik yeni kayıt açar.
 * Takviye edici gıda olduğu için kategori 65 (İlaç › Vitamin & Takviye)
 * seçildi; bu kategori prod'da henüz başka ürün içermiyor.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekileri slug üzerinden bulur, eksik olanları oluşturur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-lifeco-spirulina-kelp-nettle-60-kapsul-prod.ts
 *   (veya SEED_EMAIL / SEED_PASSWORD)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8682835610375'
const ASIN = 'B08TXK6PW3'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'lifeco-spirulina-kelp-nettle-60-kapsul')
const PRODUCT_NAME = 'TheLifeCo Spirulina Kelp & Nettle 60 Kapsül'

/** EAN-13 doğrulama hanesini kontrol eder; yanlış barkodla yazmayı engeller. */
function assertEan13(value: string): void {
  if (!/^\d{13}$/.test(value)) throw new Error(`EAN-13 13 haneli olmalı: ${value}`)
  const digits = value.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  if (check !== digits[12]) throw new Error(`EAN-13 doğrulama hanesi hatalı: ${value}`)
}

const IMAGES = [
  {
    key: 'front',
    file: 'lifeco-spirulina-front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: amber cam şişe, siyah kapak, TheLifeCo logosu, "Spirulina Kelp & Nettle Blend Dietary Supplement", 60 capsule / 44,16g`,
  },
  {
    key: 'ingredients',
    file: 'lifeco-spirulina-ingredients.jpg',
    alt: `${PRODUCT_NAME} içindekiler yakın çekim: Mavi Yeşil Alg, Hidroksipropil Metil Selüloz (bitkisel kapsül), Isırgan, Kelp, İnülin, Trikalsiyum Fosfat (E341iii), Askorbik Asit (E300) — TR ve EN listesi`,
  },
  {
    key: 'actives',
    file: 'lifeco-spirulina-actives.jpg',
    alt: `${PRODUCT_NAME} etken maddeler tablosu: günlük porsiyon (2 kapsül) için Mavi Yeşil Alg 1000 mg, Isırgan 100 mg, Kelp 40 mg`,
  },
  {
    key: 'iso',
    file: 'lifeco-spirulina-iso.jpg',
    alt: `${PRODUCT_NAME} üretim ve kalite bilgisi: ISO 22000 Kalite Standartları ve GMP Yönetim ile üretilmiştir; ISO 22000 işareti ve QR kod`,
  },
  {
    key: 'back',
    file: 'lifeco-spirulina-back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: ilaç değildir uyarısı, içindekiler, kullanım ve etken maddeler tablosu, menşe, saklama koşulları, üretici ve ürün sahibi bilgileri, barkod`,
  },
  {
    key: 'barcode',
    file: 'lifeco-spirulina-barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8682835610375`,
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler). Master'da bulunanlar id ile
 * doğrulanır; bulunmayanlar (Isırgan, Kelp, İnülin, HPMC, Trikalsiyum fosfat)
 * slug üzerinden aranır ve yoksa oluşturulur.
 */
const INGREDIENTS = [
  { id: 395, name: 'Spirulina', slug: 'spirulina', percent: null },
  { id: null, name: 'Hidroksipropil metil selüloz', slug: 'hidroksipropil-metil-seluloz', percent: null },
  { id: null, name: 'Isırgan', slug: 'isirgan', percent: null },
  { id: null, name: 'Kelp', slug: 'kelp', percent: null },
  { id: null, name: 'İnülin', slug: 'inulin', percent: null },
  { id: null, name: 'Trikalsiyum fosfat', slug: 'trikalsiyum-fosfat', percent: null },
  { id: 1158, name: 'askorbik asit', slug: 'askorbik-asit', percent: null },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1540 // Thelifeco
const CATEGORY_ID = 65 // İlaç › Vitamin & Takviye (takviye edici gıda)
const COUNTRY_ID = 1 // Türkiye (etiket: Menşei Türkiye)
const ADDITIVE_IDS = [24, 48] // E341III Trikalsiyum Fosfat, E300 Askorbik Asit

async function resolveIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (existing) {
      const doc = existing as { id: number; name?: string; slug?: string }
      if (doc.slug !== entry.slug) {
        throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
      }
      if (entry.id !== null && doc.id !== entry.id) {
        throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
      }
      ids.push(doc.id)
      continue
    }
    if (entry.id !== null) {
      throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    }
    const created = await client.create('ingredients', {
      name: entry.name,
      slug: entry.slug,
    })
    console.log(`  + içindekiler: ${entry.name} (${created.id})`)
    ids.push(created.id)
  }
  return ids
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

  const ingredientIds = await resolveIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "TheLifeCo Spirulina Kelp & Nettle, mavi yeşil alg (spirulina), kelp yosunu ve ısırgan otu bitki karışımı içeren takviye edici gıdadır; 60 kapsüllük (44,16 g) amber cam şişede satılır. Etiketteki günlük porsiyon 2 kapsüldür ve bu porsiyon 1000 mg mavi yeşil alg, 100 mg ısırgan ve 40 mg kelp sağlar. Kapsül, hidroksipropil metil selülozdan (bitkisel kapsül) üretilir; ürün ayrıca prebiyotik inülin, topaklanmayı önleyici trikalsiyum fosfat (E341iii) ve antioksidan askorbik asit (E300) içerir.\n\nAmbalaj ürünün ilaç olmadığını, hastalıkların önlenmesi veya tedavisi amacıyla kullanılmadığını belirtir; yetişkinlere yöneliktir ve tok karnına günde 2 kapsül önerilir. Üretici DÜAG Tarım, ürün sahibi Keyfii İşler Tur. Gıda Sağlık İnş. İç ve Dış Tic. A.Ş. (TheLifeCo)'dır; ürün ISO 22000 Kalite Standartları ve GMP Yönetim ile üretilmiştir. Etikette Teg onay numarası 001918-29.12.2016 olarak basılmıştır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TXK6PW3) ve ürün ambalajının ön/arka yüzü. Amazon sayfasında 4 Kasım 2026 itibarıyla öne çıkan teklif/fiyat görünmüyor (yalnız \"Diğer satıcılar\" bağlantısı ve 14 adet stok bilgisi var); bu nedenle fiyat kaydı eklenmedi.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'DÜAG Tarım Makine Bitkisel ve Mikrobiyolojik Ürünler AR-GE San. ve Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '60 kapsül (44,16 g)',
    packaging: 'Amber cam şişe, siyah plastik kapak; bitkisel selüloz kapsül',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent ?? undefined,
    })),
    additives: ADDITIVE_IDS,
    nutrition: { per: '100g' as const, items: [] },
    specifications: [
      { key: 'Marka', value: 'TheLifeCo' },
      { key: 'Ürün Tipi', value: 'Takviye edici gıda (bitkisel kapsül)' },
      { key: 'İngilizce Adı', value: 'Spirulina Kelp & Nettle Blend Dietary Supplement' },
      { key: 'Net Miktar', value: '60 kapsül / 44,16 g' },
      { key: 'Kapsül Başına Miktar', value: 'Yaklaşık 0,736 g (44,16 g ÷ 60 kapsül)' },
      { key: 'Günlük Porsiyon', value: 'Yetişkinler için tok karnına günde 2 kapsül' },
      {
        key: 'Etken Maddeler (günlük 2 kapsül)',
        value: 'Mavi Yeşil Alg 1000 mg, Isırgan 100 mg, Kelp 40 mg; BRD % belirtilmemiş (beslenme referans değeri yok)',
      },
      { key: 'İçerik', value: 'Mavi Yeşil Alg, Hidroksipropil Metil Selüloz (bitkisel kapsül), Isırgan, Kelp, İnülin (prebiyotik), Trikalsiyum Fosfat (E341iii), Askorbik Asit (E300)' },
      { key: 'Menşei', value: 'Türkiye (etiket notu: ana bileşen menşei iki ülkeden geldiği için menşe ülkesinden farklıdır)' },
      { key: 'Ambalaj', value: 'Amber cam şişe, siyah plastik kapak; kapsül formu' },
      { key: 'Üretici', value: 'DÜAG Tarım Makine Bitkisel ve Mikrobiyolojik Ürünler AR-GE San. ve Tic. Ltd. Şti.' },
      { key: 'Ürün Sahibi', value: "Keyfii İşler Tur. Gıda Sağlık İnş. İç ve Dış Tic. A.Ş. (TheLifeCo)" },
      { key: 'Ürün Sahibi Adresi', value: 'Nazmi Akbacı İş Merkezi No: 245, Maslak / Sarıyer 34398 İstanbul' },
      { key: 'Telefon', value: '0850 307 20 05' },
      { key: 'Faks', value: '+90 212 346 16 60' },
      { key: 'Web', value: 'www.thelifecoshop.com' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-35-K-035184' },
      { key: 'Teg Onay Numarası', value: '001918-29.12.2016' },
      { key: 'Üretim Standardı', value: 'ISO 22000 Kalite Standartları ve GMP Yönetim ile üretilmiştir' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Formu', value: 'Kapsül; yaş aralığı: yetişkin' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 4 Kasım 2026 itibarıyla öne çıkan teklif/fiyat görünmüyor (yalnız "Diğer satıcılar"); stokta 14 adet. Fiyat kaydı eklenmedi',
      },
      { key: 'İlaç Değildir', value: 'Hastalıkların önlenmesi veya tedavisi amacı ile kullanılmaz' },
      { key: 'TETT / Parti', value: 'TETT ve Parti No barkodun yanındadır' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Takviye edici gıdalar normal beslenmenin yerine geçemez. Tavsiye edilen günlük porsiyonu (2 kapsül) aşmayın.',
      },
      {
        severity: 'medium' as const,
        text: 'Hamilelik ve emzirme dönemi ile hastalık ve ilaç kullanımı durumlarında doktorunuza danışın.',
      },
      {
        severity: 'medium' as const,
        text: 'İlaç değildir. Hastalıkların önlenmesi veya tedavisi amacı ile kullanılmaz.',
      },
      {
        severity: 'low' as const,
        text: 'Çocukların ulaşamayacağı yerde, kuru ve güneş ışınlarından korunacak şekilde saklayın.',
      },
    ],
    storage:
      'Kuru ve güneş ışınlarından korunacak şekilde, çocukların ulaşamayacağı yerde muhafaza ediniz.',
    usage: 'Yetişkinlere yöneliktir; tok karnına günde 2 kapsül alınması önerilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as unknown[],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.actives,
    recyclingImage: media.iso,
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
