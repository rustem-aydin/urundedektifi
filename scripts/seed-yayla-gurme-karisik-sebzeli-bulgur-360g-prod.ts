import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B081JNMJSL + ürün ambalajı (EAN-13 8693374242361).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-gurme-karisik-sebzeli-bulgur-360g-prod.ts
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

const BARCODE = '8693374242361'
const GTIN = '8693374242361'
const ASIN = 'B081JNMJSL'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'yayla-gurme-karisik-sebzeli-bulgur-360g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g içindekiler ve menşe beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g besin değerleri tablosu (100 g pişmemiş)',
  },
  {
    key: 'symbols',
    file: 'symbols.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g QR kod ve geri dönüşüm sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g arka yüz: hazırlanışı, besin değerleri ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g barkod numarası 8693374242361',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1027 // Yayla Gurme
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye (EAN-13 GS1 öneki 869)
const GLUTEN_ALLERGEN_ID = 1 // Gluten

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

/** Etiketin yaprak içindekiler maddeleri; master adları doğrulanır. */
const INGREDIENTS = [
  { id: 1557, name: 'Pilavlık bulgur' },
  { id: 882, name: 'havuç' },
  { id: 829, name: 'domates' },
  { id: 1946, name: 'Kırmızı biber' },
  { id: -1, name: 'Yeşil biber' }, // master'da yok, ensureIngredient oluşturur
  { id: 1156, name: 'pırasa' },
  { id: 464, name: 'soğan' },
] as const

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

async function ensureGreenPepper(client: PayloadClient): Promise<number> {
  const existing =
    (await client.findOne('ingredients', { slug: { equals: 'yesil-biber' } })) ??
    (await client.findOne('ingredients', { name: { equals: 'Yeşil biber' } }))
  if (existing) {
    console.log(`  = içindekiler: Yeşil biber (${existing.id})`)
    return existing.id
  }
  const created = await client.create('ingredients', {
    name: 'Yeşil biber',
    slug: 'yesil-biber',
    aliases: [
      { alias: 'Yeşil Biber' },
      { alias: 'Green pepper' },
      { alias: 'Green bell pepper' },
      { alias: 'Dolmalık yeşil biber' },
    ],
    description:
      'Taze veya kurutulmuş yeşil dolmalık biber. Sebze karışımlarında ve hazır bulgur/pilav harçlarında kullanılır.',
  })
  console.log(`  + içindekiler: Yeşil biber (${created.id})`)
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
  const greenPepperId = await ensureGreenPepper(client)

  const items: { ingredients: number }[] = []
  for (const ingredient of INGREDIENTS) {
    const id = ingredient.id === -1 ? greenPepperId : ingredient.id
    await assertIngredientName(client, id, ingredient.name)
    items.push({ ingredients: id })
  }

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Fit Karışık Sebzeli Bulgur 360 g',
    description:
      "Yayla Gurme Fit Karışık Sebzeli Bulgur, iri pilavlık bulgur ile kurutulmuş sebze karışımından (%8) oluşan hazır bulgur harcıdır. Sebze karışımında havuç, domates, kırmızı ve yeşil biber, pırasa ve soğan bulunur. Ambalajda 15 dakikada hazır olduğu, 6-8 porsiyon verdiği ve vegan olduğu belirtilir; ürün BRC ve IFS sertifikalı tesiste üretilmiş, helal sertifikalıdır (CTR 14-10004).\n\nHazırlanışı: tencerede 3 yemek kaşığı (32 g) sıvı yağ ve 1 yemek kaşığı (20 g) tereyağı eritilir, paketin tamamı eklenip 2 dakika kavrulur ve 1,5 tatlı kaşığı (12 g) tuz eklenir. Ardından 4 su bardağı (800 ml) sıcak su konup 10 dakika suyunu çekene kadar orta-kısık ateşte pişirilir; 10 dakika dinlendirilip servis edilir.\n\nEtiket değerlerine göre 100 g pişmemiş üründe 351,81 kcal, 64,33 g karbonhidrat, 8,03 g lif ve 12,01 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B081JNMJSL) ve ürün ambalajı (EAN-13 8693374242361).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '360 g',
    packaging: 'Ayaklı poşet (stand-up ambalaj)',
    items,
    allergens: GLUTEN_ALLERGEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1473.18, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 351.81, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.78, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 64.33, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.17, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.03, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.01, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
      ],
    },
    labels: ['vegan', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Hazır bulgur harcı (iri pilavlık bulgur + kurutulmuş sebze karışımı)' },
      { key: 'Sebze Karışımı', value: '%8; havuç, domates, kırmızı biber, yeşil biber, pırasa, soğan' },
      { key: 'Net Miktar', value: '360 g' },
      { key: 'Porsiyon', value: '6-8 porsiyon (ambalaj)' },
      { key: 'Hazırlama Süresi', value: '15 dakikada hazır (ambalaj)' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No: 1, Toroslar / Mersin / Türkiye',
      },
      { key: 'Telefon', value: '+90 324 221 62 76 (pbx)' },
      { key: 'Faks', value: '+90 324 221 62 78' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr - yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-001608' },
      {
        key: 'Kalite Belgeleri',
        value: 'BRC ve IFS sertifikalı tesiste üretilmiştir; helal sertifikası CTR 14-10004',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Paket Ölçüleri',
        value:
          '21,4 × 12,9 × 4,8 cm (Amazon.com.tr ürün detayı). Amazon "140 gram" yazıyor; ürünün net ağırlığı 360 g olduğu için bu değer esas alınmadı.',
      },
      { key: 'Besin Değerleri Bazı', value: '100 g pişmemiş (çiğ) ürün' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Tuz "<0,1 g" olarak basılı; kayıtta 0,1 g "en fazla" olarak tutuldu. İçindekiler listesinde tuz yok — 12 g tuz tarifin içinde tüketici tarafından ekleniyor.',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5, 22 PAP, cam-çatal (gıda ile temasa uygun), Tidyman, güneş ışığından koruyun, kuru yerde saklayın; QR kod',
      },
      {
        key: 'Ürün Beyanları',
        value:
          'VEGAN, YÜKSEK LİF (HIGH FIBER), YÜKSEK ANTİOKSİDAN (HIGH ANTIOXIDANT), ZENGİN MİNERAL (RICH MINERAL), 15 DAKİKADA HAZIR',
      },
      {
        key: 'Ambalaj Notu',
        value:
          'Amazon galerisindeki ikinci ambalaj görseli (25 DK\'DA HAZIRI / 6 PORSİYON) aynı ürünün farklı baskı varyantıdır; güncel ambalajda 15 dakika ve 6-8 porsiyon yazar. Galeriye güncel ambalaj alındı.',
      },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 360 g paket ("Tekli Paket" başlıkta belirtilmiş)',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 64,95 TL (4 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (buğday). Çölyak hastaları ve gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi (TETT), parti no (PN) ve ürün yılı ambalaj üzerinde basılıdır; TETT geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız. Ürünler özenle seçilerek YAYLA tesislerinde el değmeden paketlenmiştir.',
    usage:
      "1) Tencerede 3 yemek kaşığı (32 g) sıvı yağ ve 1 yemek kaşığı (20 g) tereyağı eritiniz. 2) Paketin tamamını tencereye boşaltıp 2 dakika orta ateşte kavurunuz ve 1,5 tatlı kaşığı (12 g) tuz ekleyiniz. 3) 4 su bardağı (800 ml) sıcak su ekleyerek 10 dakika suyunu çekene kadar orta-kısık ateşte pişiriniz. 10 dakika dinlendirip servis ediniz; isteğe göre baharat ekleyebilirsiniz.",
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 64.95, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.symbols,
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
