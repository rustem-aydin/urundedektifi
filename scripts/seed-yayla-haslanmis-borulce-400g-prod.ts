import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Börülce 400 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08PLHTDL4 + ürün ambalajı (EAN-13 8693374258416,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu uyarısı: ambalajdaki tabloda değer sütunu etiket sütununa göre bir
 * satır kaymış basılmıştır ("Şekerler" hizasında 18,1 g görünür). Kayda, enerji
 * (450 kJ / 106 kcal) ve %RA sütunuyla doğrulanan eşleme yazılır: karbonhidrat
 * 18,1 g (%7), lif 2,2 g (%9), protein 7,3 g (%15), tuz 2,0 g (%33).
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-haslanmis-borulce-400g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-haslanmis-borulce-400g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374258416'
const ASIN = 'B08PLHTDL4'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-haslanmis-borulce-400g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g ön yüz; süzme ağırlık 220 g, protein ve magnezyum kaynağı, vegan',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g içindekiler: haşlanmış börülce (%55), su, tuz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g besin değerleri tablosu (100 g: 450 kJ / 106 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g ambalaj sembolleri: güneş almayan, rutubetsiz, PP 5, gıda ile temasa uygun, yeşil nokta',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g arka yüz: tarifler, saklama koşulları, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Börülce 400 g barkod numarası 8693374258416',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_WATER_ID = 278 // Su
const INGREDIENT_SALT_ID = 137 // tuz

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
  magnesium: 40,
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

async function ensureIngredient(client: PayloadClient, name: string, slug: string): Promise<number> {
  const existing = await client.findOne('ingredients', {
    and: [{ name: { equals: name } }, { slug: { equals: slug } }],
  })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name,
    slug,
    aliases: [
      { alias: 'Börülce' },
      { alias: 'Black eyed beans' },
      { alias: 'Black eye peas' },
      { alias: 'Cowpea' },
    ],
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

  const borulceId = await ensureIngredient(client, 'Börülce', 'borulce')
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Haşlanmış Börülce 400 g',
    description:
      "Yayla Haşlanmış Börülce, konserve olarak pişirilmiş börülcenin (siyah gözlü bakla) 400 g'lık konserve kutusudur; süzme ağırlığı 220 g'dır. Islatma veya haşlama gerektirmeden doğrudan yemeklere eklenebilir.\n\nİçindekiler haşlanmış börülce (%55), su ve tuzdan oluşur. Etiket, ürünü protein ve magnezyum kaynağı olarak tanımlar; koruyucu ve renklendirici içermez, vegan uygundur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08PLHTDL4) ve ürün ambalajı (EAN-13 8693374258416).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '400 g (süzme ağırlık 220 g)',
    packaging: 'Metal konserve kutusu (4 katlı BPA’sız koruyucu ambalaj)',
    items: [
      { ingredients: borulceId, percent_estimate: 55 },
      { ingredients: INGREDIENT_WATER_ID },
      { ingredients: INGREDIENT_SALT_ID },
    ],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 450, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 106, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 18.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 2.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 7.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 365.5, unit: 'mg' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış Börülce (konserve)' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Süzme Ağırlık', value: '220 g' },
      {
        key: 'Porsiyon',
        value: 'Paket başına yaklaşık 2 porsiyon; 1 porsiyon yaklaşık 130 g',
      },
      { key: 'Ambalaj', value: 'Metal konserve kutusu, 4 katlı BPA’sız koruyucu ambalaj' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN',
      },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      {
        key: 'Merkez Adresi',
        value:
          'İstanbul Yolu 30. Km, Saray Mah. Fatih Sultan Mehmet Blv. No: 327, P.K. 06980, Kahramankazan / ANKARA',
      },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Web', value: 'www.yaylabakliyat.com' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      { key: 'Standart', value: 'Gıda Kodeksi’ne uygundur' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette değer sütunu bir satır kaymış basılmıştır. Enerji (450 kJ / 106 kcal) ve %RA sütunuyla doğrulanan eşleme yazıldı: karbonhidrat 18,1 g (%7), lif 2,2 g (%9), protein 7,3 g (%15), tuz 2,0 g (%33), magnezyum 365,5 mg (%97).',
      },
      { key: 'Beyan', value: 'Protein kaynağı, magnezyum kaynağı, koruyucu ve renklendirici içermez' },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, yeşil nokta',
      },
      { key: 'Alerjen Beyanı', value: 'Etikette alerjen uyarısı yok; Amazon ürün detayında “Gluten içerebilir” yazar' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '17,6 × 13 × 6,5 cm (paket, Amazon ölçümü); paket ağırlığı 0,41 kg' },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 74,95 TL (400 g, 100 g başına 18,74 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ambalajda alerjen uyarısı ve içindekiler listesinde gluten kaynağı yoktur; Amazon ürün detayında “Gluten içerebilir” beyanı yer alır. Çölyak hastaları ve gluten duyarlılığı olanlar üreticiye danışmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Şişmiş ve sızıntılı ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Açıldıktan sonra buzdolabında (+4 °C) saklayın ve 2 gün içinde tüketin.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında (25 °C) güneş ışığından uzak ortamda saklayınız. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Islatma veya haşlama gerekmez; yemeklerinizde hemen kullanabilirsiniz. Kutudaki suyu da yemeklerinize ekleyebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 74.95, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: tarifler, saklama koşulları ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8693374258416' },
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
