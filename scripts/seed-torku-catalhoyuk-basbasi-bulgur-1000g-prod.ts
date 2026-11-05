import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Torku Çatalhöyük Tane Pilavlık Başbaşı Bulgur 1000 g ürününü UZAK Payload
 * REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08TY4B4LV + ürün ambalajının ön/arka yüzü
 * (EAN-13 8690120073194). Prod'da bu barkod OFF import'undan "Torku Catalhoyuk"
 * adıyla, Fransızca artık içindekiler ve boş besin tablosuyla duruyor (id 10134);
 * betik o kaydı günceller, yenisini açmaz.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekiler kaydını slug üzerinden doğrular.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-torku-catalhoyuk-basbasi-bulgur-1000g-prod.ts
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

const BARCODE = '8690120073194'
const ASIN = 'B08TY4B4LV'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'torku-basbasi-bulgur-1000g')
const PRODUCT_NAME = 'Torku Çatalhöyük Tane Pilavlık Başbaşı Bulgur 1000 g'

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
    file: 'torku-basbasi-front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: Torku Çatalhöyük logosu, başbaşı bulgur taneleri, 1000 g e, yüksek lif ve helal işaretleri`,
  },
  {
    key: 'ingredients',
    file: 'torku-basbasi-ingredients.jpg',
    alt: `${PRODUCT_NAME} içindekiler satırı: Tane Pilavlık Bulgur (Gluten içerir), durum buğdayından taş değirmende sadece su ve buğday kullanılarak üretilmiştir`,
  },
  {
    key: 'nutrition',
    file: 'torku-basbasi-nutrition.jpg',
    alt: `${PRODUCT_NAME} enerji ve besin öğeleri tablosu: 100 g için 1654 kJ / 382 kcal; yağ, karbonhidrat, şeker, lif, protein ve tuz değerleri ile 68 g porsiyon kolonu`,
  },
  {
    key: 'recycling',
    file: 'torku-basbasi-recycling.jpg',
    alt: `${PRODUCT_NAME} ambalaj sembolleri: Türk Malı, geri dönüşüm 2149, PP 5, gıda temasına uygunluk, çöpe atmayın ve helal işaretleri`,
  },
  {
    key: 'back',
    file: 'torku-basbasi-back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: içindekiler, besin tablosu, pişirme ve saklama bilgisi, üretici künyesi ve barkod`,
  },
  {
    key: 'barcode',
    file: 'torku-basbasi-barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8690120073194`,
  },
] as const

/** Etiketten okunan içindekiler: tek madde, tane pilavlık bulgur. */
const INGREDIENTS = [{ id: 1557, name: 'Pilavlık bulgur', slug: 'pilavlik-bulgur', percent: null }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 27 // Torku
const CATEGORY_ID = 28 // Baklagil & Tahıl (Torku Çatalhöyük 5 kg ve diğer bulgurlarla aynı)
const COUNTRY_ID = 1 // Türkiye (etiket: Menşei Türkiye)
const ALLERGEN_GLUTEN_ID = 1 // Gluten

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
} as const

async function assertIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (!existing) throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    const doc = existing as { id: number; name?: string; slug?: string }
    if (doc.slug !== entry.slug) {
      throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
    }
    if (entry.id !== null && doc.id !== entry.id) {
      throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
    }
    ids.push(doc.id)
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

  const ingredientIds = await assertIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Torku Çatalhöyük Tane Pilavlık Başbaşı Bulgur, durum buğdayından taş değirmende sadece su ve buğday kullanılarak üretilen tane pilavlık bulgurdur; 1000 g'lık plastik ambalajda satılır. Ambalaj \"yüksek lif\" ve helal işaretleri taşır; ürün Kodeks Bulgur Tebliği'ne uygun olarak üretilir. İçindekiler tek maddedir ve gluten içerir. Etiket besin değerlerini 100 g ve 1 porsiyon (68 g) için verir; 100 g'da 382 kcal, 6,3 g lif ve 11,1 g protein bulunur. Bir paket yaklaşık 17 porsiyon içerir.\n\nKullanım: ambalaj, en iyi lezzet için bulgurun kullanmadan önce yıkanmamasını önerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TY4B4LV) ve ürün ambalajının ön/arka yüzü. Kayıt daha önce Open Food Facts'ten \"Torku Catalhoyuk\" adıyla, Fransızca artık içindekiler ve boş besin tablosuyla gelmişti; bu betik aynı EAN kaydını ambalaj verisiyle doldurur.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Konya Şeker Sanayi ve Ticaret A.Ş. Karapınar Bulgur Üretim Tesisi Şubesi',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Plastik ambalaj (geri dönüşüm kodu PP 5, Türk Malı)',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent ?? undefined,
    })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1654, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 382, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 75.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['halal-certified'] as const,
    specifications: [
      { key: 'Marka', value: 'Torku (Konya Şeker)' },
      { key: 'Ürün Tipi', value: 'Tane pilavlık bulgur (başbaşı)' },
      { key: 'İngilizce Adı', value: 'Extra extra coarse bulgur' },
      { key: 'Net Miktar', value: '1000 g' },
      { key: 'Tane İrilği', value: 'Tane pilavlık (başbaşı)' },
      {
        key: 'Hammadde',
        value: 'Durum buğdayı; taş değirmende sadece su ve buğday kullanılarak üretilmiştir',
      },
      { key: 'Menşei', value: 'Türkiye' },
      {
        key: 'Ambalaj',
        value: 'Plastik ambalaj; geri dönüşüm kodu PP 5, Türk Malı',
      },
      {
        key: 'Üretici',
        value: 'Konya Şeker Sanayi ve Ticaret A.Ş. Karapınar Bulgur Üretim Tesisi Şubesi',
      },
      {
        key: 'Üretici Adresi',
        value: 'İpekçi Mah. 130913 Sk. No: 7A Daire: 1, Merkez Karapınar / Konya / Türkiye',
      },
      { key: 'Web', value: 'www.torku.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-42-K-020100' },
      { key: 'Standart', value: "Kodeks Bulgur Tebliğine uygun olarak üretilmiştir" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ağırlığı', value: '1000 g' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 5 Kasım 2026 itibarıyla öne çıkan teklif/fiyat görünmüyor ("Diğer satıcılar"; sayfada "Şu anda mevcut değil" notu ve 6 adet stok bilgisi). Fiyat kaydı eklenmedi',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalaj 100 g ve 1 porsiyon (68 g) değerlerini verir; 1 porsiyon 229 kcal. Bir paket yaklaşık 17 porsiyon içerir',
      },
      { key: 'Gluten Beyanı', value: 'Gluten içerir (durum buğdayı)' },
      { key: 'Helal Beyanı', value: 'Ambalaj üzerinde helal işareti bulunur' },
      {
        key: 'Üretim Özellikleri',
        value:
          'Taş değirmende üretilmiştir; doğal rengi, az seçilmiş kabuğundan; durum buğdayından',
      },
      { key: 'Sağlık Beyanı', value: 'Yüksek lif (100 g’da 6,3 g)' },
      { key: 'Kullanım Notu', value: 'Kullanmadan önce yıkamayınız' },
      {
        key: 'TETT / Parti',
        value: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalaj üzerindedir',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (durum buğdayı). Çölyak hastalığı veya gluten hassasiyeti olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi ve parti numarası ambalajın üzerindedir.',
      },
    ],
    storage:
      'Serin, rutubetsiz ve kokusuz yerde muhafaza ediniz. Doğrudan güneş ışığı alan ortamlardan uzak tutunuz.',
    usage: 'Kullanmadan önce yıkamayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as unknown[],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
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
