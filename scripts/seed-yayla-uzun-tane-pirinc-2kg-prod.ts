import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Uzun Tane Pirinç 2 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Ürün OFF'tan gelen eksik bir kayıt olarak zaten var (id 17629, barkod
 * 8693374268811): kategori “Diğer”, içindekiler/besin/spesifikasyon boş.
 * Betik o kaydı zenginleştirir, yeni kayıt açmaz.
 *
 * Kaynak: Amazon.com.tr ASIN B0BQFCV4YH + ürün ambalajı (EAN-13 8693374268811,
 * arka yüzdeki barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu 100 g için 1445 kJ / 341 kcal. Enerji makro toplamıyla
 * doğrulandı: 75,7×4 + 6,8×4 + 0,4×9 + 3,5×2 = 340,6 ≈ 341 kcal.
 *
 * Menşe: Amazon ürün detayı “ithal menşeili uzun taneli pirinç” der; ambalajda
 * menşe ülke basılı değildir (üretim yeri kodu ambalaj üzerinde). Ülke alanı
 * barkod GS1 ön ekinden otomatik dolduğu için Türkiye olarak kalmıştır; durum
 * spesifikasyonda belgelendi.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-uzun-tane-pirinc-2kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374268811'
const ASIN = 'B0BQFCV4YH'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-uzun-tane-pirinc-2kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Uzun Tane Pirinç 2 kg ön yüz; pirinç taneleri ve 2 kg paket',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Uzun Tane Pirinç 2 kg besin değerleri tablosu (100 g: 1445 kJ / 341 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Uzun Tane Pirinç 2 kg ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, geri dönüşüm, helal',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Uzun Tane Pirinç 2 kg arka yüz: besin tablosu, tarifler, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Uzun Tane Pirinç 2 kg barkod numarası 8693374268811',
  },
] as const

const CATEGORY_ID = 27 // Baklagil & Tahıl › Makarna & Pirinç
const INGREDIENT_NAME = 'Uzun tane pirinç'
const INGREDIENT_SLUG = 'uzun-tane-pirinc'

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
  phosphorus: 38,
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

/** İçindekiler kaydı: ad + slug ile bulur, yoksa oluşturur (idempotent). */
async function resolveIngredient(client: PayloadClient): Promise<number> {
  const aliases = ['Uzun taneli pirinç', 'Pirinç', 'Long grain rice'].map((alias) => ({ alias }))
  const existing = await client.findOne('ingredients', {
    and: [{ name: { equals: INGREDIENT_NAME } }, { slug: { equals: INGREDIENT_SLUG } }],
  })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name: INGREDIENT_NAME,
    slug: INGREDIENT_SLUG,
    aliases,
  })
  console.log(`  + içindekiler: ${INGREDIENT_NAME} (${created.id})`)
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

  const ingredientId = await resolveIngredient(client)
  console.log(`İçindekiler: uzun tane pirinç ${ingredientId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Uzun Tane Pirinç 2 kg',
    description:
      'Yayla Uzun Tane Pirinç, ithal menşeli uzun taneli pirincin 2 kg’lık paketidir. Pilav ve benzeri yemeklerde kullanılır; paket üzerinde sebzeli pirinç pilavı tarifi ve pişirme önerisi bulunur.\n\nEtiket bilgisi: ürün TS 2408 ve Türk Gıda Kodeksi Pirinç Tebliği’ne uygundur; 100 g’da 1445 kJ / 341 kcal enerji, 3,5 g lif ve 113 mg fosfor içerir. Helal logosu taşır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0BQFCV4YH) ve ürün ambalajı (EAN-13 8693374268811).',
    category: CATEGORY_ID,
    manufacturer:
      'YAYLA Agro Gıda San. ve Tic. A.Ş. (merkez: Kahramankazan/Ankara; fabrika: Toroslar/Mersin)',
    size: '2 kg',
    packaging: 'Plastik ambalaj (doypack)',
    items: [{ ingredients: ingredientId }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1445, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 341, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 75.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 113, unit: 'mg' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Uzun taneli pirinç (ithal menşeli)' },
      { key: 'Net Miktar', value: '2 kg' },
      { key: 'Ambalaj', value: 'Plastik ambalaj (doypack)' },
      {
        key: 'Menşe',
        value:
          'Amazon ürün detayı “ithal menşeili uzun taneli pirinç” der; ambalajda menşe ülke basılı değildir (üretim yeri kısaltması ambalaj üzerine kodlanmıştır). Ülke alanı barkodun GS1 ön ekinden (869) otomatik doldurulmuştur.',
      },
      {
        key: 'Üretici',
        value: 'YAYLA Agro Gıda San. ve Tic. A.Ş.',
      },
      {
        key: 'Merkez Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / ANKARA',
      },
      {
        key: 'Fabrika Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN',
      },
      {
        key: 'Telefon',
        value: 'Merkez: 0 312 815 49 50 (faks 0 312 815 47 90) — Fabrika: 0 324 221 62 76 (faks 0 324 221 62 78)',
      },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web', value: 'yaylabakliyat.com (sosyal hesaplar: yaylabakliyat)' },
      {
        key: 'İşletme Kayıt Numarası',
        value: 'ANK: TR-06-K-000171 — MER: TR-33-K-001608',
      },
      { key: 'Standart', value: 'TS 2408; Türk Gıda Kodeksi Pirinç Tebliği’ne uygundur' },
      {
        key: 'Saklama Koşulları',
        value:
          'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız',
      },
      {
        key: 'Uyarı',
        value:
          'Tahıl, hububat ve pirinçler tarımsal kökenli ürünlerdir; tüketmeden önce gözle kontrol edilmelidir',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etiket değerleri 100 g içindir. Enerji makro toplamıyla doğrulandı (75,7×4 + 6,8×4 + 0,4×9 + 3,5×2 = 340,6 ≈ 341 kcal).',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yok' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 2 kg paket' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr’de 2 kg paket 4 Kasım 2026 itibarıyla stokta değil; fiyat kaydedilmedi',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'Tahıllar tarımsal kökenli olduğundan tüketmeden önce gözle kontrol edilmeli; TETT, parti no ve üretim yılı ambalajın üzerindedir.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [],
    frontImage: media.front,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: besin tablosu, tarifler ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8693374268811' },
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
