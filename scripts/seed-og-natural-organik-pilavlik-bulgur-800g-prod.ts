import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * OG Natural Organik Pilavlık Bulgur 800 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08ZNKV7FY + ürün ambalajı (EAN-13 8682792206826).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-og-natural-organik-pilavlik-bulgur-800g-prod.ts
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

const BARCODE = '8682792206826'
const GTIN = '8682792206826'
const ASIN = 'B08ZNKV7FY'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'og-natural-organik-pilavlik-bulgur-800g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g içindekiler ve alerjen beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g besin değerleri tablosu (100 g)',
  },
  {
    key: 'cert',
    file: 'cert.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g MET Ekolojik ve Organik Tarım sertifika logoları',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g arka yüz: içindekiler, besin değerleri, menşe ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'OG Natural Organik Pilavlık Bulgur 800 g barkod numarası 8682792206826',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_NAME = 'OG Natural'
const BRAND_SLUG = 'og-natural'
const CATEGORY_ID = 28 // Baklagil & Tahıl (bulgur ürünlerinin mevcut kümesi)
const COUNTRY_ID = 1 // Türkiye (EAN-13 GS1 öneki 868)
const INGREDIENT_ID = 1557 // Pilavlık bulgur
const GLUTEN_ALLERGEN_ID = 1 // Gluten

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  carbohydrate: 7,
  fiber: 18,
  protein: 19,
  sodium: 21,
  potassium: 35,
} as const

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

async function ensureBrand(client: PayloadClient): Promise<number> {
  const existing =
    (await client.findOne('brands', { name: { equals: BRAND_NAME } })) ??
    (await client.findOne('brands', { slug: { equals: BRAND_SLUG } }))
  if (existing) {
    console.log(`  = marka: ${BRAND_NAME} (${existing.id})`)
    return existing.id
  }
  const created = await client.create('brands', {
    name: BRAND_NAME,
    slug: BRAND_SLUG,
    description:
      "ECOLONİ Gıda ve Ekolojik Ürünler San. ve Tic. A.Ş.'nin organik gıda markası (Sakarya). Ambalajda OG NATURAL logosu kullanılır.",
  })
  console.log(`  + marka: ${BRAND_NAME} (${created.id})`)
  return created.id
}

async function assertIngredientName(
  client: PayloadClient,
  id: number,
  name: string,
): Promise<void> {
  const doc = (await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 }))
    .docs[0] as { name?: string } | undefined
  if (!doc || doc.name !== name) {
    throw new Error(`İçindekiler ${id} beklenen "${name}" değil: ${doc?.name ?? 'yok'}`)
  }
}

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const media = await ensureMedia(client)
  const brandId = await ensureBrand(client)
  await assertIngredientName(client, INGREDIENT_ID, 'Pilavlık bulgur')

  const data = {
    barcode: BARCODE,
    name: 'OG Natural Organik Pilavlık Bulgur 800 g',
    description:
      "OG Natural Organik Pilavlık Bulgur, atalık tohum buğdayların taş değirmende geleneksel yöntemle öğütülmesiyle elde edilen organik pilavlık bulgurdur. Ürün tek bileşenden oluşur: organik pilavlık bulgur. Ambalajda pestisit kullanılmadan yapılan organik tarım vurgulanır; ürün T.C. 5262 sayılı Organik Tarım Kanunu'na uygun olarak üretilmiş ve Met Ekolojik Kontrol Sertifikasyon Ltd. Şti. (TR-OT-42) tarafından sertifikalandırılmıştır.\n\nBuğday kaynaklı olduğu için gluten içerir. Etiket değerlerine göre 100 g üründe 347 kcal, 75,8 g karbonhidrat, 10,3 g lif ve 10,9 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08ZNKV7FY) ve ürün ambalajı (EAN-13 8682792206826).",
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: 'ECOLONİ Gıda ve Ekolojik Ürünler San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '800 g',
    packaging: 'Şeffaf plastik poşet',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    allergens: GLUTEN_ALLERGEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 347, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1452, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 75.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.56, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 10.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sodium, amount: 17, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 410, unit: 'mg' },
      ],
    },
    labels: ['organic'],
    specifications: [
      { key: 'Marka', value: 'OG Natural' },
      { key: 'Ürün Tipi', value: 'Pilavlık bulgur (organik, kuru gıda)' },
      { key: 'Üretim Yöntemi', value: 'Atalık tohum buğdaylardan taş değirmende geleneksel üretim' },
      { key: 'Net Miktar', value: '800 g' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'ECOLONİ Gıda ve Ekolojik Ürünler San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Küpçüler Mah. Küpçüler Cad. No: 111 İç Kapı No: 1, Erenler / Sakarya',
      },
      { key: 'Telefon', value: '0 264 241 22 54' },
      { key: 'Web', value: 'www.ecoloni.com' },
      { key: 'E-posta', value: 'info@ecoloni.com' },
      {
        key: 'Organik Sertifika',
        value:
          'TR-OT-42 — Ksk Kodu: TR-OT-42, Müteşebbis Kodu: TR-OT-42-2185, Sertifika Kodu: TR-OT-42-MSI-2185-2020-150',
      },
      {
        key: 'Sertifikasyon Kuruluşu',
        value: 'Met Ekolojik Kontrol Sertifikasyon Ltd. Şti. (TR-54-K 017511)',
      },
      {
        key: 'Organik Beyanı',
        value:
          "Bu ürün, T.C. 5262 sayılı Organik Tarım Kanunu ve İlgili Organik Tarımın Esasları ve Uygulanmasına İlişkin Yönetmeliğe uygun olarak üretilmiş olup, Tarım ve Orman Bakanlığı tarafından yetkilendirilmiş TR-OT-42 yetkili Met Ekolojik Kontrol Sertifikasyon Ltd. Şti. tarafından kontrol edilip sertifikalandırılmıştır.",
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value: '18,3 × 9,2 × 6,8 cm; 800 g (Amazon.com.tr ürün detayı)',
      },
      { key: 'Besin Değerleri Bazı', value: '100 g ürün' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette yalnız kcal basılı (347 kcal); kJ değeri kcal × 4,184 ile hesaplandı (1452 kJ). Tuz, şeker ve doymuş yağ satırı basılı değil; sodyum 17 mg (≈ 0,04 g tuz) olarak verilmiş. Makro toplamı (4×10,9 protein + 4×75,8 karbonhidrat + 9×1,56 yağ + 2×10,3 lif ≈ 381 kcal) etiket enerjisinden yüksek; kayıtta etiketteki değer esas alındı.',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Etiket: "Alerjenler altı çizilidir. Alerjen Uyarısı: Alerjen Buğday. Proteinli Yani Gluten İçerir."',
      },
      {
        key: 'Ambalaj Sembolleri',
        value: 'AB Organik Tarım yaprak logosu, Organik Tarım (T.C.) logosu, MET Ekolojik logosu, Taş Değirmen ve Atalık Tohum ikonları',
      },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 800 g paket; liste "Stokta sadece 1 adet kaldı" durumunda (3 Kasım 2026)',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 185,00 TL (3 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (buğday). Çölyak hastaları ve gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'T.E.T.T./S.K.T. tarihinden önce tüketilmelidir; ambalaj üzerindeki tarihi ve parti/seri numarasını kontrol ediniz.',
      },
    ],
    storage:
      'Güneşten koruyunuz. Serin, rutubetsiz, yabancı koku ve tat içeren maddelerden uzak tutunuz. Parti seri no T.E.T.T./S.K.T. ile aynıdır.',
    usage:
      'Pilavlık bulgurdur; pilav ve bulgur yemeklerinde kullanılır. Ambalajda pişirme tarifi basılı değildir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 185, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.cert,
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
