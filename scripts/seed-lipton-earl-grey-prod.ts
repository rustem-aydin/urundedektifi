import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Lipton Earl Grey Demlik Poşet Çay 100'lü ürününü (Amazon.com.tr ASIN B07K8XP123)
 * UZAK Payload REST API'sine yazar: kategori/içindekiler master kayıtları,
 * ürün fotoğrafları (Amazon CDN'inden indirilir) ve ürün dokümanı.
 *
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-lipton-earl-grey-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api').replace(
  /\/$/,
  '',
)
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8720608631315'
const GTIN_TR = '8690639001336'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'lipton-earl-grey')

/** Ambalaj EAN-13'ü 8720608631315; Amazon "üretici referansı" 8690639001336 model alanında. */
const IMAGES = [
  {
    key: '616UF94wM3L',
    alt: 'Lipton Earl Grey demlik poşet çay 100’lü kutu ön yüzü',
    size: '._AC_SL1000_.jpg',
  },
  {
    key: '414w8oabxzL',
    alt: 'Lipton Earl Grey kutu arka yüzü: içindekiler, besin değerleri ve barkod',
    size: '._AC_SL1000_.jpg',
  },
  {
    key: '41PqkHc7MFL',
    alt: 'Besin değerleri tablosu ve içindekiler listesi yakın çekim',
    size: '._AC_SL1000_.jpg',
  },
  { key: '41KAZAO4dKL', alt: 'Lipton Earl Grey 100’lü kutu açılı görünüm', size: '._AC_SL1000_.jpg' },
  { key: '41uZoQKNuPL', alt: 'Lipton Earl Grey 100’lü kutu yan açılı görünüm', size: '._AC_SL1000_.jpg' },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

const CategoryDoc = z.object({ id: z.number(), name: z.string() }).loose()

async function ensureCategory(client: PayloadClient, name: string, parent?: number): Promise<number> {
  const where: Record<string, unknown> = { name: { equals: name } }
  if (parent) where.parent = { equals: parent }
  const existing = await client.findOne('categories', where)
  if (existing) return existing.id
  const created = CategoryDoc.parse(
    await client.create('categories', { name, ...(parent ? { parent } : {}) }),
  )
  console.log(`  + kategori: ${name} (${created.id})`)
  return created.id
}

async function ensureIngredient(client: PayloadClient, name: string): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: name } })
  if (existing) return existing.id
  const created = await client.create('ingredients', { name })
  console.log(`  + içindekiler: ${name} (${created.id})`)
  return created.id
}

async function downloadImages(): Promise<void> {
  await fs.mkdir(IMAGE_DIR, { recursive: true })
  for (const image of IMAGES) {
    const file = path.join(IMAGE_DIR, `${image.key}.jpg`)
    try {
      await fs.access(file)
      continue
    } catch {
      // indirilecek
    }
    const url = `https://m.media-amazon.com/images/I/${image.key}${image.size}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`görsel indirilemedi ${url}: ${res.status}`)
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
    console.log(`  ↓ ${image.key}.jpg`)
  }
}

async function ensureMedia(client: PayloadClient): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const image of IMAGES) {
    const where = { alt: { equals: image.alt } }
    const existing =
      (await client.findOne('media', where)) ??
      (await client.upload('media', path.join(IMAGE_DIR, `${image.key}.jpg`), { alt: image.alt }))
    ids.set(image.key, existing.id)
    console.log(`  görsel: ${image.key} → media ${existing.id}`)
  }
  return ids
}

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  console.log(`Hedef: ${client.api}`)
  await client.login()
  console.log(`  Giriş: ${EMAIL}`)

  await downloadImages()
  const media = await ensureMedia(client)

  const categoryId = await ensureCategory(client, 'Çaylar')
  const siyahCay = await ensureIngredient(client, 'Siyah Çay')
  const aromaVerici = await ensureIngredient(client, 'Aroma Verici')
  const bergamot = await ensureIngredient(client, 'Bergamot')
  const brand = await client.findOne('brands', { name: { equals: 'Lipton' } })
  const country = await client.findOne('countries', { name: { equals: 'Türkiye' } })
  if (!brand) throw new Error('Lipton markası bulunamadı')
  if (!country) throw new Error('Türkiye kaydı bulunamadı')

  const data = {
    name: 'Lipton Earl Grey Demlik Poşet Çay 100’lü (320 gr)',
    barcode: BARCODE,
    description:
      'Doğu Karadeniz’de yetişen siyah çay yapraklarının bergamot aromasıyla harmanlandığı demlik poşet çaydır. Kutu içinde 3,2 g’lık 100 poşet (320 g) bulunur; harman demlemeye hazırdır, ayrıca çay karıştırmak gerekmez. Orta düzeyde kafein içerir.',
    brand: brand.id,
    category: categoryId,
    country: country.id,
    manufacturer: 'Ekaterra Gıda Satış ve Pazarlama A.Ş.',
    items: [
      { ingredients: siyahCay },
      { ingredients: aromaVerici },
      { ingredients: bergamot },
    ],
    labels: ['vegan', 'vegetarian'],
    packaging: 'Karton kutu içinde demlik poşet',
    size: '100 x 3,2 g (320 g)',
    model: GTIN_TR,
    nutrition: {
      per: '100ml',
      items: [
        { nutrient: 1, amount: 1, unit: 'kcal' },
        { nutrient: 1, amount: 4, unit: 'kJ' },
        { nutrient: 2, amount: 0, unit: 'g' },
        { nutrient: 3, amount: 0, unit: 'g' },
        { nutrient: 4, amount: 0.5, unit: 'g (en fazla)' },
        { nutrient: 5, amount: 0.5, unit: 'g (en fazla)' },
        { nutrient: 6, amount: 0.5, unit: 'g (en fazla)' },
        { nutrient: 7, amount: 0, unit: 'g' },
      ],
    },
    specifications: [
      { key: 'Çay Çeşidi', value: 'Siyah' },
      { key: 'Ürün Formu', value: 'Demlik poşet' },
      { key: 'Aroma', value: 'Bergamot' },
      { key: 'Birim Sayısı', value: '100 Adet' },
      { key: 'Öğelerin Sayısı', value: '100' },
      { key: 'Konteyner Türü', value: 'Poşet' },
      { key: 'Kafein İçeriği', value: 'Orta Kafein' },
      { key: 'Diyet Türü', value: 'Helal, Vegan, Vejetaryen' },
      { key: 'Tatlılık Tanımı', value: 'Hafif tatlı' },
      { key: 'Orijin Ülke', value: 'Türkiye' },
      { key: 'Alerjen Bilgileri', value: 'Yulaf içermez' },
      { key: 'Yaş Aralığı', value: '13+' },
      { key: 'Ürün Ağırlığı', value: '0,36 kg' },
      { key: 'Ürün Boyutları', value: '18 x 11,5 x 9,6 cm' },
      { key: 'Paket Büyüklüğü', value: '100’lü' },
      { key: 'Türkiye GTIN (üretici referansı)', value: GTIN_TR },
      { key: 'ASIN', value: 'B07K8XP123' },
      {
        key: 'Üretici İletişim',
        value:
          'Ekaterra Gıda ve Satış A.Ş., Saray Mah. Dr. Adnan Büyükdeniz Cad. No:13, 34768 Ümraniye/İstanbul',
      },
    ],
    warnings: [
      {
        severity: 'medium',
        text: 'Kafein içerir; çocuklar veya hamile kadınlar için önerilmez.',
      },
    ],
    usage:
      '1. Suyu kaynatın. 2. Demliğe bir poşet Earl Grey çay koyun. 3. Üzerine kaynayan suyu dökün. 4. 3-5 dakika demlenmesini bekleyin. 5. Fincanlara servis edin. İsteğe bağlı olarak süt veya limon ekleyebilirsiniz.',
    prices: [{ amount: 180.87, date: '2026-10-29' }],
    frontImage: media.get('616UF94wM3L'),
    ingredientsImage: media.get('414w8oabxzL'),
    nutritionImage: media.get('41PqkHc7MFL'),
    additionalImages: [
      { image: media.get('41KAZAO4dKL'), caption: 'Kutu açılı görünüm' },
      { image: media.get('41uZoQKNuPL'), caption: 'Yan açılı görünüm' },
    ],
    status: 'published',
  }

  const product = await client.upsert('products', { barcode: { equals: BARCODE } }, data)
  console.log(`  ürün: ${product.id} — https://urundedektifi.elharezmi.com/urun/${BARCODE}`)

  const caseRes = await fetch(`${API}/products/case/${BARCODE}`)
  if (!caseRes.ok) throw new Error(`case okunamadı: ${caseRes.status}`)
  const productCase = (await caseRes.json()) as {
    verdict: { totalMatched: number; byTopic: { topic: { name: string }; matchedRules: { name: string; rating?: { name: string }; matchedValue?: string }[] }[] }
    gallery: { label: string }[]
  }
  console.log(
    '  eşleşme:',
    JSON.stringify({
      totalMatched: productCase.verdict.totalMatched,
      rules: productCase.verdict.byTopic.flatMap((topic) =>
        topic.matchedRules.map((rule) => `${rule.name} → ${rule.rating?.name} (${rule.matchedValue})`),
      ),
      gallery: productCase.gallery.map((image) => image.label),
    }),
  )
  console.log(`  görseller: ${ALT[IMAGES[0].key]} … (${ALT ? Object.keys(ALT).length : 0} kayıt)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
