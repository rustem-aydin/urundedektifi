import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Yeşil Mercimek ve Domatesli Bulgur 360 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B08G1TX4Y3 + ürün ambalajı (EAN-13 8693374242408).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-gurme-mercimek-domatesli-bulgur-360g-prod.ts
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

const BARCODE = '8693374242408'
const GTIN = '8693374242408'
const ASIN = 'B08G1TX4Y3'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'yayla-gurme-mercimek-domatesli-bulgur-360g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g içindekiler ve menşe beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g besin değerleri tablosu (100 g pişmemiş)',
  },
  {
    key: 'symbols',
    file: 'symbols.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g geri dönüşüm ve saklama sembolleri',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g arka yüz: içindekiler, besin değerleri, sertifikalar ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g barkod numarası 8693374242408',
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
const ITEMS = [
  { id: 1557, name: 'Pilavlık bulgur', percent: undefined },
  { id: 4530, name: 'Kurutulmuş domates', percent: 9 },
  { id: 3064, name: 'Yeşil Mercimek', percent: undefined },
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

  const items: { ingredients: number; percent_estimate?: number }[] = []
  for (const item of ITEMS) {
    await assertIngredientName(client, item.id, item.name)
    items.push(
      item.percent === undefined
        ? { ingredients: item.id }
        : { ingredients: item.id, percent_estimate: item.percent },
    )
  }

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur 360 g',
    description:
      "Yayla Gurme Fit Yeşil Mercimek ve Domatesli Bulgur, iri pilavlık bulgur, kurutulmuş domates (%9) ve yeşil mercimekten oluşan hazır bulgur harcıdır. Ambalajda 25 dakikada hazır olduğu, 6 porsiyon verdiği ve vegan olduğu belirtilir; ürün BRC ve IFS sertifikalı tesiste üretilmiş, helal sertifikalıdır (CTR 14.10004).\n\nHazırlanışı: tencerede 3 yemek kaşığı (32 g) sıvı yağ ve 1 yemek kaşığı (20 g) tereyağı eritilir, paketin tamamı eklenip 2 dakika kavrulur ve 1,5 tatlı kaşığı (12 g) tuz eklenir. Ardından 4 su bardağı (800 ml) sıcak su konup 10 dakika suyunu çekene kadar orta-kısık ateşte pişirilir; 10 dakika dinlendirilip servis edilir.\n\nEtiket değerlerine göre 100 g pişmemiş üründe 345 kcal, 61,37 g karbonhidrat, 8,66 g lif ve 12,58 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08G1TX4Y3) ve ürün ambalajı (EAN-13 8693374242408).",
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
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1445, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 345, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.59, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.28, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 61.37, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.94, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.66, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.58, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
      ],
    },
    labels: ['vegan', 'halal-certified', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla Gurme' },
      { key: 'Ürün Tipi', value: 'Hazır bulgur harcı (iri pilavlık bulgur + kurutulmuş domates + yeşil mercimek)' },
      { key: 'İçerik Oranları', value: 'Kurutulmuş domates %9; bulgur ve yeşil mercimek için oran belirtilmemiş' },
      { key: 'Net Miktar', value: '360 g' },
      { key: 'Porsiyon', value: '6 porsiyon (ambalaj)' },
      { key: 'Hazırlama Süresi', value: '25 dakikada hazır (ön yüz); tarif toplamı 2 dk kavurma + 10 dk pişirme + 10 dk dinlendirme' },
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
        value: 'BRC ve IFS sertifikalı tesiste üretilmiştir; helal sertifikası CTR 14.10004',
      },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Ölçü Bilgisi',
        value:
          'Amazon.com.tr ürün detayı "0,13 × 0,22 × 0,06 cm; 380 gram" yazıyor; bu değerler ürünle uyuşmuyor, kayda alınmadı (net ağırlık 360 g).',
      },
      { key: 'Besin Değerleri Bazı', value: '100 g pişmemiş (çiğ) ürün' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Tuz "<0,1 g" olarak basılı; kayıtta 0,1 g "en fazla" olarak tutuldu. Tarifte 12 g tuz tüketici tarafından ekleniyor. Makro toplamı (4×12,58 + 4×61,37 + 9×3,59 + 2×8,66 ≈ 345 kcal) etiket enerjisiyle uyumlu.',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5, 2502, cam-çatal (gıda ile temasa uygun), Tidyman, güneş ışığından koruyun, kuru yerde saklayın',
      },
      {
        key: 'Ürün Beyanları',
        value:
          'VEGAN, PROTEİN KAYNAĞI, LİF KAYNAĞI, DÜŞÜK DOYMUŞ YAĞ, YÜKSEK LİF, YÜKSEK ANTİOKSİDAN, ZENGİN MİNERAL, 25 DAKİKADA HAZIR',
      },
      {
        key: 'Ambalaj Notu',
        value:
          'Ön yüzde "25 DAKİKADA HAZIR" yazıyor; arka yüzdeki hazırlanış görselinde "15 DAKİKADA HAZIR" rozeti var. Aynı ambalajın iki yüzü çelişiyor; kayıtta ön yüzdeki 25 dakika esas alındı.',
      },
      {
        key: 'Dış Koli Beyanı',
        value:
          'Amazon galerisindeki koli görselinde "Koruyucu ve Renklendirici İçermez" yazılı; ürünün içindekiler listesinde katkı maddesi yok.',
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
