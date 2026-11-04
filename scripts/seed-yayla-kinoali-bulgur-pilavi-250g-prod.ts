import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Kinoalı Bulgur Pilavı 250 g (tekli paket) ürününü UZAK Payload REST
 * API'sine yazar: mevcut OFF kaydını (id 10864) zenginleştirir, fotoğrafları yükler.
 *
 * Kaynak: Amazon.com.tr ASIN B07STMNMG4 (tekli 250 g) ve B0F6Y97LZQ (6'lı paket)
 * + ürün ambalajı. Barkod arka yüz görselinden okundu (8693374253626) ve EAN-13
 * kontrol hanesi doğrulandı. Amazon listesi 6 × 250 g demettir; kayıt tekli
 * ambalajı tanımlar, demet bilgisi spesifikasyona yazılır.
 *
 * Besin tablosu uyarısı: bir baskıda değer sütunu etiket sütununa göre bir satır
 * kaymıştır; hizalı baskı ile enerji (648 kJ / 154 kcal) ve %RA sütunu
 * eşlemeyi doğrular.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-kinoali-bulgur-pilavi-250g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-kinoali-bulgur-pilavi-250g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374253626'
const ASIN = 'B07STMNMG4'
const BUNDLE_ASIN = 'B0F6Y97LZQ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-kinoali-bulgur-pilavi-250g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g ön yüz; 2 dakikada hazır, 2 porsiyon, koruyucu ve renklendirici içermez',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g içindekiler: su, bulgur (%32), bitkisel yağ (%7), domates (%2), kinoa (%2), tuz',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g besin değerleri tablosu (100 g: 648 kJ / 154 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g ambalaj sembolleri: PP 5 geri dönüşüm, gıda ile temasa uygun, serin ve kuru yerde saklayın, helal',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g arka yüz: içindekiler, besin tablosu, ısıtma talimatı ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Kinoalı Bulgur Pilavı 250 g barkod numarası 8693374253626',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 24 // Temel Gıda & Mutfak › Hazır Yemek
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

const INGREDIENTS = {
  water: 278, // Su
  bulgur: 1557, // Pilavlık bulgur
  vegetableOil: 182, // Bitkisel yağ
  sunflowerOil: 298, // Ayçiçek yağı
  oliveOil: 515, // Zeytinyağı
  tomato: 829, // domates
  quinoa: 847, // kinoa
  salt: 137, // tuz
} as const

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
  transFat: 52,
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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Kinoalı Bulgur Pilavı 250 g',
    description:
      "Yayla Kinoalı Bulgur Pilavı, 3 katlı BPA'sız koruyucu ambalajda (retort poşet) paketlenmiş, ısıtılıp tüketilen hazır bulgur pilavıdır. 250 g'lık paket 2 porsiyondur (1 porsiyon 125 g); ambalajı açmadan mikrodalgada 2 dakikada, tencerede 3 dakikada veya kaynar suda 5 dakikada ısıtılır.\n\nBulgur (%32), su, bitkisel yağ (%7; ayçiçek yağı ve zeytinyağı), domates (%2), kinoa (%2) ve tuz içerir. Etikette koruyucu ve renklendirici içermediği, ambalajın BPA'sız ve helal olduğu beyan edilir. Gluten (buğday) içerir.\n\nVeri kaynağı: Amazon.com.tr (tekli 250 g ASIN B07STMNMG4, 6'lı paket ASIN B0F6Y97LZQ) ve ürün ambalajı (EAN-13 8693374253626).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '250 g',
    packaging: "3 katlı BPA'sız esnek ambalaj (retort poşet)",
    items: [
      { ingredients: INGREDIENTS.water },
      { ingredients: INGREDIENTS.bulgur, percent_estimate: 32 },
      { ingredients: INGREDIENTS.vegetableOil, percent_estimate: 7 },
      { ingredients: INGREDIENTS.sunflowerOil },
      { ingredients: INGREDIENTS.oliveOil },
      { ingredients: INGREDIENTS.tomato, percent_estimate: 2 },
      { ingredients: INGREDIENTS.quinoa, percent_estimate: 2 },
      { ingredients: INGREDIENTS.salt },
    ],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 648, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 154, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 26, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 2.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 4.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 1, unit: 'g' },
      ],
    },
    labels: ['halal-certified', 'bpa-free', 'recyclable', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Hazır pilav (kinoalı bulgur, ısıtılıp tüketilir)' },
      { key: 'Aroma', value: 'Kinoalı' },
      { key: 'Net Miktar', value: '250 g' },
      { key: 'Porsiyon', value: '2 porsiyon; 1 porsiyon 125 g' },
      { key: 'Ambalaj', value: "3 katlı BPA'sız koruyucu esnek ambalaj (retort poşet)" },
      { key: 'Üretim Yeri', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      { key: 'Üretici Adresi', value: 'Yalınayak Mh. 102099. Sk. No: 1, Toroslar / MERSİN' },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 pbx. (faks 0 324 221 62 78)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Web', value: 'www.yaylabakliyat.com' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN (tekli 250 g)', value: ASIN },
      {
        key: 'Amazon Çoklu Paket',
        value:
          'B0F6Y97LZQ — 6 × 250 g (1,5 kg) demet; Amazon.com.tr fiyatı 308,88 TL (205,92 TL/kg). Kayıt tekli 250 g ambalajı tanımlar.',
      },
      { key: 'Diyet Türü', value: 'Helal' },
      { key: 'Katkı Beyanı', value: 'Koruyucu ve renklendirici içermez' },
      {
        key: 'Ambalaj Sembolleri',
        value: "PP 5 geri dönüşüm, 2502, gıda ile temasa uygun, güneş almayan, BPA'sız, helal",
      },
      {
        key: 'Isıtma',
        value:
          'Mikrodalga: paketin üst köşesini 2-3 cm açıp dik olarak 800 W fırında 2 dakika. Tencere: ürünü boşaltıp hafif ateşte 3 dakika. Kaynar su: ambalajı açmadan 5 dakika bekletme.',
      },
      {
        key: 'İçindekiler Notu',
        value:
          "Ambalajda sıra \"Su, bulgur (%32), bitkisel yağ (ayçiçek yağı, zeytinyağı) (%7), domates (%2), kinoa (%2), tuz\" şeklindedir. Amazon.com.tr listesi suyu %56, kinoayı \"kırmızı kinoa (%1)\" ve domatesi \"domates kurusu (%2)\" olarak yazar; kayda ambalaj esas alındı.",
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalajın bir baskısında değer sütunu etiket sütununa göre bir satır kaymıştır; hizalı baskıda 100 g için enerji 154 kcal (RA %8), yağ 3,0 g (%4), doymuş yağ 1,3 g (%6), trans yağ 0,1 g, karbonhidrat 26,0 g (%10), şeker 2,3 g (%3), lif 2,1 g (%8), protein 4,6 g (%9), tuz 1,0 g (%17). Enerji kJ değeri bir baskıda 648, diğerinde 631 yazılıdır; 154 kcal ile aritmetik olarak tutarlı olan 648 kJ kayda yazıldı.',
      },
      { key: 'Alerjen Beyanı', value: 'Gluten (buğday) içerir; süt ürünleri içerebilir' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — tekli 250 g 59,16 TL (100 g başına 23,66 TL), 4 Kasım 2026',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten (buğday) içerir. Çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Ambalajda “süt ürünleri içerebilir” uyarısı vardır; süt alerjisi olanlar dikkatli olmalıdır.',
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
      'Şişmiş ve sızıntılı ürünleri tüketmeyiniz. Oda sıcaklığında (25 °C) güneş ışığından uzak ortamda saklayabilirsiniz. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      '1) Paketi hafifçe eziniz, üst köşesinden 2-3 cm açıp dik olarak mikrodalga fırında 800 W’ta 2 dakika ısıtınız. 2) Tencereye boşaltıp hafif ateşte 3 dakika ısıtınız. 3) Ambalajı açmadan kaynar suda 5 dakika bekletiniz. İsteğe göre baharat veya tuz ekleyebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 59.16, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: içindekiler, besin tablosu, ısıtma talimatı ve üretici bilgileri' },
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
