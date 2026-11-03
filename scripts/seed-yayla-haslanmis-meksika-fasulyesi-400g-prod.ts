import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Meksika Fasulyesi 400 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0B49HR7JC + ürün ambalajı (EAN-13 8693374262505,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Barkod OFF import'undan "Yayla Red Kidney Beans" adıyla zaten gelmişti (id 13570);
 * betik aynı kaydı günceller, yeni ürün açmaz.
 *
 * Besin tablosu uyarısı: ambalajdaki tabloda değer sütunu etiket sütununa göre bir
 * satır kaymış basılmıştır ("Yağ / Fat" satırı boş görünür, 1,4 g Doymuş Yağ hizasında
 * durur). Kayda %RA sütunuyla doğrulanan eşleme yazılır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-haslanmis-meksika-fasulyesi-400g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-haslanmis-meksika-fasulyesi-400g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374262505'
const ASIN = 'B0B49HR7JC'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'yayla-haslanmis-meksika-fasulyesi-400g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g ön yüz; süzme ağırlık 220 g, vegan, protein–fosfor–demir kaynağı',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g içindekiler: kırmızı fasulye (%55), su, tuz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g besin değerleri tablosu (100 g: 492 kJ / 117 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g arka yüz: içindekiler, besin tablosu, saklama koşulları ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Meksika Fasulyesi 400 g barkod numarası 8693374262505',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_KIDNEY_BEAN_ID = 1935 // Red kidney beans (kırmızı fasulye)
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
  iron: 39,
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

async function assertIngredient(
  client: PayloadClient,
  id: number,
  name: string,
): Promise<void> {
  const doc = await client.find('ingredients', {
    where: { and: [{ id: { equals: id } }, { name: { equals: name } }] },
    limit: 1,
    select: { name: true },
  })
  if (doc.totalDocs !== 1) {
    throw new Error(`İçindekiler eşleşmedi: id ${id} ≠ ${name}`)
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

  await assertIngredient(client, INGREDIENT_KIDNEY_BEAN_ID, 'Red kidney beans')
  await assertIngredient(client, INGREDIENT_WATER_ID, 'Su')
  await assertIngredient(client, INGREDIENT_SALT_ID, 'tuz')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Haşlanmış Meksika Fasulyesi 400 g',
    description:
      "Yayla Haşlanmış Meksika Fasulyesi, haşlanmış kırmızı fasulyenin (red kidney bean) 400 g'lık doypack ambalajıdır; süzme ağırlığı 220 g, ambalajda yaklaşık 3 porsiyon (1 porsiyon ~125 g) olduğu belirtilir. Islatma veya haşlama gerekmeden doğrudan yemeklere eklenebilir.\n\nİçindekiler kırmızı fasulye (%55), su ve tuzdan oluşur. Etiket ürünü protein, lif, demir ve fosfor kaynağı olarak tanımlar; koruyucu ve renklendirici içermez, BPA'sız 4 katlı ambalajda sunulur ve vegandır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0B49HR7JC) ve ürün ambalajı (EAN-13 8693374262505).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '400 g (süzme ağırlık 220 g)',
    packaging: 'Doypack poşet (4 katlı BPA’sız koruyucu ambalaj)',
    items: [
      { ingredients: INGREDIENT_KIDNEY_BEAN_ID, percent_estimate: 55 },
      { ingredients: INGREDIENT_WATER_ID },
      { ingredients: INGREDIENT_SALT_ID },
    ],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 492, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 117, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 13, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.iron, amount: 2.2, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 455.2, unit: 'mg' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış kırmızı fasulye (konserve / doypack)' },
      { key: 'Net Miktar', value: '400 g' },
      { key: 'Süzme Ağırlık', value: '220 g' },
      {
        key: 'Porsiyon',
        value: 'Ambalaj başına yaklaşık 3 porsiyon; 1 porsiyon yaklaşık 125 g',
      },
      { key: 'Ambalaj', value: 'Doypack poşet, 4 katlı BPA’sız koruyucu ambalaj' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN',
      },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'Web', value: 'www.yaylaagro.com' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      { key: 'Standart', value: 'Türk Gıda Kodeksi’ne uygundur' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette değer sütunu bir satır kaymış basılmıştır (%RA sütunuyla doğrulandı): yağ 1,4 g (%2), doymuş yağ 0,5 g (%3), karbonhidrat 13 g (%5), şeker 1 g (%1), lif 8,3 g (%33), protein 9 g (%18), tuz 0,5 g (%8), demir 2,2 mg (%16), fosfor 455,2 mg (%65). Etiketteki tablo 1 porsiyon (~125 g) ve 100 g için ayrı değer verir; site karşılaştırılabilirliği için 100 g sütunu yazıldı.',
      },
      {
        key: 'Beyan',
        value:
          'Protein, lif, demir ve fosfor kaynağı; koruyucu ve renklendirici içermez; BPA’sız ambalaj; vegan',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, dairesel yaprak-ok çevre sembolü',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda alerjen beyanı yoktur; içindekiler kırmızı fasulye, su ve tuzdan oluşur',
      },
      {
        key: 'İçindekiler Çelişkisi',
        value:
          'Amazon ürün açıklaması içindekileri “Kırmızı fasulye (%55)” olarak verirken A+ içerik metni “%57” yazar; ambalajdaki Türkçe ve İngilizce beyan %55’tir ve kayda %55 yazıldı.',
      },
      {
        key: 'Üretici Adresi Çelişkisi',
        value:
          'Amazon ürün detayı üreticiyi “Saray Mah. FSM Bul. No: 327, Kahramankazan / Ankara” olarak verir; ambalajdaki üretici adresi Toroslar / Mersin’dir ve kayda ambalaj yazıldı.',
      },
      {
        key: 'Kullanım Çelişkisi',
        value:
          'Amazon açıklaması “kavanozda kaynatma” talimatı verir; ürün kavanoz değil doypack poşettir ve ambalaj ısıtma talimatı içermez, “yemeklerinizde hemen kullanabilirsiniz” der.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value: '17,9 × 12,7 × 3,5 cm (paket, Amazon ölçümü); paket ağırlığı 0,42 kg',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 75,61 TL (400 g, kg başına 189,03 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
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
      'Oda sıcaklığında güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Islatma veya haşlama gerekmez; yemeklerinizde hemen kullanabilirsiniz. Ürünün içindeki suyu da yemeklerinize ekleyebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 75.61, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: içindekiler, besin tablosu, saklama koşulları ve üretici bilgileri',
      },
      { image: media.barcode, caption: 'Barkod 8693374262505' },
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
