import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr "Gazlı İçecekler" kategorisinden (node 22380535031) barkodu
 * doğrulanmış ürünleri UZAK Payload REST API'sine yazar.
 *
 * Kapsam: kategorinin 10 sayfası (223 sonuç) tarandı, 468 galeri görseli ZXing
 * ile katmanlı olarak okundu ve tüm ürün bilgisi metinlerinde 13 hane arandı.
 * Yalnızca EAN-13'ü ambalajdan veya Amazon "Ürün Model Numarası" alanından
 * doğrulanan ürünler yazılır; barkodu doğrulanamayan listingler eklenmedi.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-gazli-icecek-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const IMAGE_ROOT = path.join(process.cwd(), '.seed-images')
const CATEGORY_ID = 36 // Gazlı İçecekler
const PRICE_DATE = '2026-11-21T00:00:00.000Z'
const REQUEST_GAP_MS = Number(process.env.SEED_GAP_MS ?? 450)
const MAX_RETRIES = 4
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type IngredientRef = { id?: number; name: string; slug?: string }
type BrandRef = { id?: number; name: string; slug: string; country?: string }

type ProductSeed = {
  asin: string
  barcode: string
  name: string
  slug: string
  size: string
  packaging: string
  price: number
  description: string
  brand: BrandRef
  manufacturer: string
  countryId: number
  items: IngredientRef[]
  additives: number[]
  storage: string
  usage: string
  specifications: { key: string; value: string }[]
  media: { key: string; file: string; alt: string }[]
  additional: { key: string; caption: string }[]
}

const PRODUCTS: ProductSeed[] = [
  {
    asin: "B0H4NTZ4Z5",
    barcode: "8690574119189",
    name: "Pepsi Limon Aromalı Kola Kutu 330 ml",
    slug: "pepsi-limon-kutu-330ml",
    size: "330 ml",
    packaging: "Alüminyum kutu",
    price: 52.0,
    description: "Pepsi Limon, limon aromalı koladır. 330 ml alüminyum kutuda sunulur.\n\nEtiketteki içindekiler (ambalaj): su, şeker, karbondioksit, limon suyu konsantresi, renklendirici (amonyum sülfit karamel), aroma vericiler, asit (fosforik asit), asitlik düzenleyici (trisodyum sitrat), koruyucu (sodyum benzoat), tatlandırıcılar (asesülfam K, sukraloz), kafein (0,1 g/L).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H4NTZ4Z5) ve ürün ambalajı; EAN-13 8690574119189 ambalajın arka yüzündeki barkoddan okundu (8 690574 119189) ve kontrol hanesi doğrulandı.",
    brand: { id: 300, name: "Pepsi", slug: "pepsi" },
    manufacturer: "PepsiCo",
    items: [
      { id: 278, name: "Su" },
      { name: "Şeker", slug: "seker" },
      { name: "Karbondioksit", slug: "karbondioksit" },
      { name: "Limon suyu konsantresi", slug: "limon-suyu-konsantresi" },
    ],
    additives: [13, 15, 17, 55, 56],
    countryId: 1,
    storage: "Serin ve kuru yerde saklayın; güneş ışığından koruyun (ambalaj).",
    usage: "Soğuk servis edilir (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Pepsi" },
      { key: "Ürün Tipi", value: "Aromalı kola, gazlı içecek" },
      { key: "Aroma", value: "Limon" },
      { key: "Net Miktar", value: "330 ml" },
      { key: "Ambalaj", value: "Alüminyum kutu" },
      { key: "Üretici", value: "PepsiCo" },
      { key: "Kafein", value: "0,1 g/L (etiket)" },
      { key: "İçindekiler (Etiket)", value: "Su, şeker, karbondioksit, limon suyu konsantresi, renklendirici (amonyum sülfit karamel), aroma vericiler, asit (fosforik asit), asitlik düzenleyici (trisodyum sitrat), koruyucu (sodyum benzoat), tatlandırıcılar (asesülfam K, sukraloz), kafein (0,1 g/L)" },
      { key: "Ürün Ölçüleri", value: "5,8 × 5,8 × 14,55 cm" },
      { key: "EAN-13", value: "8690574119189" },
      { key: "Barkod Kaynağı", value: "Ürün ambalajı (arka yüz barkodu, görselden okundu)" },
      { key: "Amazon ASIN", value: "B0H4NTZ4Z5" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 52,00 TL (21 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "pepsi-limon-kutu-330ml-front.jpg", alt: "Pepsi Limon Aromalı Kola Kutu 330 ml — Ön yüz" },
      { key: "barkod", file: "pepsi-limon-kutu-330ml-barkod.jpg", alt: "Pepsi Limon Aromalı Kola Kutu 330 ml — Barkod 8690574119189" },
    ],
    additional: [
      { key: "barkod", caption: "Pepsi Limon Aromalı Kola Kutu 330 ml — Barkod 8690574119189" },
    ],
  },
  {
    asin: "B0H4P41CV1",
    barcode: "8690574119141",
    name: "Pepsi Limon Aromalı Kola PET 1 L",
    slug: "pepsi-limon-pet-1l",
    size: "1 L",
    packaging: "PET şişe",
    price: 176.68,
    description: "Pepsi Limon, limon aromalı koladır. 1 litre PET şişede sunulur.\n\nEtiketteki içindekiler (ambalaj): su, şeker, karbondioksit, limon suyu konsantresi, renklendirici (amonyum sülfit karamel), aroma vericiler, asit (fosforik asit), asitlik düzenleyici (trisodyum sitrat), koruyucu (sodyum benzoat), tatlandırıcılar (asesülfam K, sukraloz), kafein (0,1 g/L).\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H4P41CV1) ve ürün ambalajı; EAN-13 8690574119141 ambalaj etiketindeki barkoddan okundu (8 690574 119141) ve kontrol hanesi doğrulandı.",
    brand: { id: 300, name: "Pepsi", slug: "pepsi" },
    manufacturer: "PepsiCo",
    items: [
      { id: 278, name: "Su" },
      { name: "Şeker", slug: "seker" },
      { name: "Karbondioksit", slug: "karbondioksit" },
      { name: "Limon suyu konsantresi", slug: "limon-suyu-konsantresi" },
    ],
    additives: [13, 15, 17, 55, 56],
    countryId: 1,
    storage: "Serin ve kuru yerde saklayın; güneş ışığından koruyun (ambalaj).",
    usage: "Soğuk servis edilir (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Pepsi" },
      { key: "Ürün Tipi", value: "Aromalı kola, gazlı içecek" },
      { key: "Aroma", value: "Limon" },
      { key: "Net Miktar", value: "1 L" },
      { key: "Ambalaj", value: "PET şişe" },
      { key: "Üretici", value: "PepsiCo" },
      { key: "Kafein", value: "0,1 g/L (etiket)" },
      { key: "İçindekiler (Etiket)", value: "Su, şeker, karbondioksit, limon suyu konsantresi, renklendirici (amonyum sülfit karamel), aroma vericiler, asit (fosforik asit), asitlik düzenleyici (trisodyum sitrat), koruyucu (sodyum benzoat), tatlandırıcılar (asesülfam K, sukraloz), kafein (0,1 g/L)" },
      { key: "Ürün Ölçüleri", value: "8,15 × 8,15 × 27,6 cm" },
      { key: "EAN-13", value: "8690574119141" },
      { key: "Barkod Kaynağı", value: "Ürün etiketi (barkod görselden okundu)" },
      { key: "Amazon ASIN", value: "B0H4P41CV1" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 176,68 TL (21 Kasım 2026)" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "pepsi-limon-pet-1l-front.jpg", alt: "Pepsi Limon Aromalı Kola PET 1 L — Ön yüz" },
      { key: "barkod", file: "pepsi-limon-pet-1l-barkod.jpg", alt: "Pepsi Limon Aromalı Kola PET 1 L — Barkod 8690574119141" },
    ],
    additional: [
      { key: "barkod", caption: "Pepsi Limon Aromalı Kola PET 1 L — Barkod 8690574119141" },
    ],
  },
  {
    asin: "B00K6MJG3Y",
    barcode: "5449000043191",
    name: "Coca-Cola Orijinal Tat Cam Şişe 6 x 250 ml",
    slug: "coca-cola-cam-sise-6x250ml",
    size: "6 × 250 ml (1,5 L)",
    packaging: "Cam şişe, 6'lı koli",
    price: 334.95,
    description: "Coca-Cola Orijinal Tat, klasik lezzetiyle 6 adet 250 ml cam şişeden oluşan çoklu pakette sunulur.\n\nİçindekiler (Amazon ürün açıklaması): su, karbondioksit, renklendirici (karamel), asitliği düzenleyiciler (fosforik asit, sodyum sitrat), tatlandırıcılar (asesulfam-K, sukraloz), aroma vericiler, koruyucu (sodyum benzoat), kafein (maks. 0,150 g/l).\n\nVeri kaynağı: Amazon.com.tr (ASIN B00K6MJG3Y); EAN-13 5449000043191 Amazon 'Ürün Model Numarası' alanından alındı, kontrol hanesi doğrulandı ve Open Food Facts kaydı (6 x 250 ml Coca-Cola) ile teyit edildi. Koli, aynı barkodu taşıyan 6 × 250 ml cam şişe ambalajıdır.",
    brand: { id: 8, name: "Coca Cola", slug: "coca-cola-17" },
    manufacturer: "Coca-Cola Satış ve Dağıtım A.Ş.",
    items: [
      { id: 278, name: "Su" },
      { name: "Karbondioksit", slug: "karbondioksit" },
    ],
    additives: [13, 15, 26, 17, 55, 56],
    countryId: 19,
    storage: "Serin ve kuru yerde saklayın; güneş ışığından koruyun.",
    usage: "Soğuk servis edilir (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Coca Cola" },
      { key: "Ürün Tipi", value: "Gazlı içecek, kola" },
      { key: "Net Miktar", value: "6 × 250 ml (1,5 L)" },
      { key: "Ambalaj", value: "Cam şişe, 6'lı koli" },
      { key: "Üretici", value: "Coca-Cola Satış ve Dağıtım A.Ş." },
      { key: "Kafein", value: "Maks. 0,150 g/l (ürün açıklaması)" },
      { key: "İçindekiler (Ürün Açıklaması)", value: "Su, karbondioksit, renklendirici (karamel), asitliği düzenleyiciler (fosforik asit, sodyum sitrat), tatlandırıcılar (asesulfam-K, sukraloz), aroma vericiler, koruyucu (sodyum benzoat), kafein (maks. 0,150 g/l)" },
      { key: "Ürün Ölçüleri", value: "4,5 × 4,5 × 16,8 cm (tek şişe)" },
      { key: "EAN-13", value: "5449000043191" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Ürün Model Numarası (Open Food Facts ile teyitli)" },
      { key: "Amazon ASIN", value: "B00K6MJG3Y" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 334,95 TL (21 Kasım 2026)" },
      { key: "Ambalaj Notu", value: "Aynı ürünün kutu (teneke) 6x250 ml sürümü ayrı kayıtta (EAN 5449000116475); bu kayıt cam şişe sürümüdür" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "coca-cola-cam-sise-6x250ml-front.jpg", alt: "Coca-Cola Orijinal Tat Cam Şişe 6 x 250 ml — Ön yüz (6 × 250 ml cam şişe)" },
    ],
    additional: [

    ],
  },
  {
    asin: "B0FMG63C24",
    barcode: "4860019003111",
    name: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml",
    slug: "borjomi-limonati-tarhun-12x330ml",
    size: "12 × 330 ml (3,96 L)",
    packaging: "Alüminyum kutu, 12'li koli",
    price: 1440.0,
    description: "Borjomi Limonati Tarhun, Gürcistan'ın tarhun aromalı limonatasıdır; Borjomi doğal mineralli suyu ile hazırlanır. 12 adet 330 ml kutudan oluşur (toplam 3,96 L).\n\nÜrün bilgileri (Amazon açıklaması): doğal aromalı doğal mineralli gazlı içecek; menşe ülke Gürcistan; güneş ışığından korunarak 3-25 °C arasında muhafaza edilmesi, açıldıktan sonra 2-5 °C arasında saklanması ve bir gün içinde tüketilmesi önerilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FMG63C24); EAN-13 4860019003111 Amazon 'Ürün Model Numarası' alanından alındı ve kontrol hanesi doğrulandı. Galeride yasal arka panel (içindekiler/besin tablosu) bulunmadığı için içindekiler ve besin değerleri yazılmadı.",
    brand: { name: "Borjomi", slug: "borjomi", country: "Gürcistan" },
    manufacturer: "BORJOMI",
    items: [
      { name: "Maden suyu", slug: "maden-suyu" },
    ],
    additives: [],
    countryId: 69,
    storage: "Güneş ışığından korunarak 3-25 °C arasında saklanır; açıldıktan sonra 2-5 °C arasında muhafaza edilip bir gün içinde tüketilmelidir (ürün açıklaması).",
    usage: "İyice soğutulduktan sonra servis edilir (ürün açıklaması).",
    specifications: [
      { key: "Marka", value: "Borjomi" },
      { key: "Ürün Tipi", value: "Aromalı gazlı içecek (limonata)" },
      { key: "Aroma", value: "Tarhun" },
      { key: "Net Miktar", value: "12 × 330 ml (3,96 L)" },
      { key: "Ambalaj", value: "Alüminyum kutu, 12'li koli" },
      { key: "Menşe Ülke", value: "Gürcistan (ürün açıklaması)" },
      { key: "Üretici", value: "BORJOMI" },
      { key: "Taban İçerik", value: "Borjomi doğal mineralli suyu" },
      { key: "Saklama", value: "3-25 °C, güneş ışığından korunarak" },
      { key: "Servis", value: "İyice soğutulmuş olarak" },
      { key: "EAN-13", value: "4860019003111" },
      { key: "Barkod Kaynağı", value: "Amazon.com.tr ürün bilgileri, Ürün Model Numarası" },
      { key: "Amazon ASIN", value: "B0FMG63C24" },
      { key: "Fiyat Kaynağı", value: "Amazon.com.tr — 1.440,00 TL (12 × 330 ml, 21 Kasım 2026)" },
      { key: "Etiket Notu", value: "Galeride yalnız tanıtım görselleri var; yasal arka panel (içindekiler/besin tablosu) yok, bu alanlar boş bırakıldı" },
      { key: "Besin Tablosu", value: "Ambalaj görsellerinde besin değerleri tablosu yok" },
    ],
    media: [
      { key: "front", file: "borjomi-limonati-tarhun-12x330ml-front.jpg", alt: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml — Ön yüz (12 × 330 ml kutu)" },
      { key: "ek1", file: "borjomi-limonati-tarhun-12x330ml-ek1.jpg", alt: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml — Kutu detayı" },
      { key: "ek2", file: "borjomi-limonati-tarhun-12x330ml-ek2.jpg", alt: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml — Ürün görseli" },
    ],
    additional: [
      { key: "ek1", caption: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml — Kutu detayı" },
      { key: "ek2", caption: "Borjomi Limonati Tarhun Doğal Mineralli Gazlı İçecek 12 x 330 ml — Ürün görseli" },
    ],
  },]

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmali: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatali: ${code} (beklenen ${expected})`)
  }
}

async function paused<T>(fn: () => Promise<T>): Promise<T> {
  await sleep(REQUEST_GAP_MS)
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!/ 429:| 5\d\d:/.test(String(error))) throw error
      await sleep(1500 * (attempt + 1) * (attempt + 1))
    }
  }
  throw lastError
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await paused(() =>
    client.find('ingredients', { where: { id: { equals: id } }, limit: 1 }),
  )
  const found = doc.docs[0] as { name?: string } | undefined
  if (!found) throw new Error(`Icindekiler kaydi yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`Icindekiler adi uyusmuyor: ${id} -> ${String(found.name)} != ${name}`)
  }
}

async function ensureBrand(client: PayloadClient, brand: BrandRef): Promise<number> {
  if (brand.id) {
    const doc = await paused(() =>
      client.find('brands', { where: { id: { equals: brand.id } }, limit: 1 }),
    )
    const found = doc.docs[0] as { name?: string } | undefined
    if (!found) throw new Error(`Marka kaydi yok: ${brand.id}`)
    if (String(found.name).toLocaleLowerCase('tr') !== brand.name.toLocaleLowerCase('tr')) {
      throw new Error(`Marka adi uyusmuyor: ${brand.id} -> ${String(found.name)} != ${brand.name}`)
    }
    return brand.id
  }
  const bySlug = await paused(() => client.findOne('brands', { slug: { equals: brand.slug } }))
  if (bySlug) return bySlug.id
  const byName = await paused(() => client.findOne('brands', { name: { equals: brand.name } }))
  if (byName) return byName.id
  const created = await paused(() =>
    client.create('brands', {
      name: brand.name,
      slug: brand.slug,
      country: brand.country ?? 'Türkiye',
    }),
  )
  console.log(`  + marka: ${brand.name} (${created.id})`)
  return created.id
}

async function ensureIngredient(client: PayloadClient, ref: IngredientRef): Promise<number> {
  if (ref.id) {
    await assertIngredient(client, ref.id, ref.name)
    return ref.id
  }
  const byName = await paused(() => client.findOne('ingredients', { name: { equals: ref.name } }))
  if (byName) return byName.id
  if (ref.slug) {
    const bySlug = await paused(() =>
      client.findOne('ingredients', { slug: { equals: ref.slug } }),
    )
    if (bySlug) return bySlug.id
  }
  const created = await paused(() => client.create('ingredients', { name: ref.name, slug: ref.slug }))
  console.log(`  + icindekiler: ${ref.name} (${created.id})`)
  return created.id
}

async function ensureMedia(
  client: PayloadClient,
  seed: ProductSeed,
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of seed.media) {
    const existing = await paused(() => client.findOne('media', { alt: { equals: image.alt } }))
    if (existing) {
      ids[image.key] = existing.id
      continue
    }
    const created = await paused(() =>
      client.upload('media', path.join(IMAGE_ROOT, seed.slug, image.file), { alt: image.alt }),
    )
    console.log(`  + medya: ${image.file} (${created.id})`)
    ids[image.key] = created.id
  }
  return ids
}

async function seedProduct(client: PayloadClient, seed: ProductSeed): Promise<void> {
  assertEan13(seed.barcode)
  console.log(`\n== ${seed.name} (${seed.barcode})`)

  const brandId = await ensureBrand(client, seed.brand)
  const itemIds: number[] = []
  for (const item of seed.items) itemIds.push(await ensureIngredient(client, item))
  const media = await ensureMedia(client, seed)

  const data: Record<string, unknown> = {
    barcode: seed.barcode,
    name: seed.name,
    description: seed.description,
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: seed.manufacturer,
    country: seed.countryId,
    size: seed.size,
    packaging: seed.packaging,
    items: itemIds.map((id) => ({ ingredients: id })),
    additives: seed.additives,
    labels: [],
    specifications: seed.specifications,
    warnings: [],
    storage: seed.storage,
    usage: seed.usage,
    model: seed.asin,
    sku: `AMZ-${seed.asin}`,
    prices: [{ amount: seed.price, date: PRICE_DATE }],
    frontImage: media.front,
    additionalImages: seed.additional.map((entry) => ({
      image: media[entry.key],
      caption: entry.caption,
    })),
    status: 'published' as const,
  }

  const existing = await paused(() =>
    client.findOne('products', { barcode: { equals: seed.barcode } }),
  )
  const product = existing
    ? await paused(() => client.update('products', existing.id, data))
    : await paused(() => client.create('products', data))

  console.log(`  ${existing ? 'guncellendi' : 'olusturuldu'}: id ${product.id}`)
  console.log(`  https://barkoddedektifi.com/urun/${seed.barcode}`)
}

async function main(): Promise<void> {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  let ok = 0
  const failed: string[] = []
  for (const seed of PRODUCTS) {
    try {
      await seedProduct(client, seed)
      ok++
    } catch (error) {
      failed.push(`${seed.barcode} ${seed.name}: ${String(error).slice(0, 300)}`)
      console.error(`  !! HATA: ${String(error).slice(0, 300)}`)
    }
  }
  console.log(`\nBitti: ${ok}/${PRODUCTS.length} basarili`)
  if (failed.length) {
    console.log('Basarisizlar:')
    for (const f of failed) console.log(' -', f)
    process.exitCode = 1
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
