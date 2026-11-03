import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla İri Pilavlık Bulgur 1 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07Z75PCYQ + ürün ambalajı (EAN-13 8693374999005).
 * Prod'da bu barkod yok; betik yeni kayıt açar (yayla-pilavlik-bulgur-1-kg, barcode
 * 8693374011141, ayrı bir varyanttır — karıştırılmamalı).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-iri-pilavlik-bulgur-1000g-prod.ts
 *   (veya hazır admin jetonu: SEED_TOKEN=...)
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_EMAIL ve SEED_PASSWORD (veya SEED_TOKEN) gerekli.')
  process.exit(1)
}

const BARCODE = '8693374999005'
const GTIN = '8693374999005'
const ASIN = 'B07Z75PCYQ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-iri-pilavlik-bulgur-1kg')
const PRODUCT_NAME = 'Yayla İri Pilavlık Bulgur 1 kg'

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
    file: 'front.jpg',
    alt: `${PRODUCT_NAME} ön yüz: Yayla logosu, "İri Pilavlık Bulgur" bandı, Yerli ve Yeni ürün rozetleri`,
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: `${PRODUCT_NAME} ürün bileşimi ve üretici bilgisi yakın çekim: Ürün: Bulgur, Çeşit: Sade Bulgur, Tane İrilği: İri Pilavlık`,
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: `${PRODUCT_NAME} besin değerleri tablosu (pişmemiş ürün, 100 g)`,
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: `${PRODUCT_NAME} geri dönüşüm ve ambalaj sembolleri: PP 5, 2502, gıda temasına uygunluk, güneşten uzak, kuru tutun`,
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: tadında bilgiler, besin değerleri, pişirme önerisi, helal işareti ve barkod`,
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8693374999005`,
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler) ve prod master kimlikleri.
 * 1557 kaydının adı prod'da "Pi̇lavlik bulgur" (bozuk noktalı İ) olarak duruyor;
 * bu yüzden doğrulama ad yerine slug üzerinden yapılır.
 */
const INGREDIENTS = [{ id: 1557, slug: 'pilavlik-bulgur' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl (kardeş kayıt: Yayla Pilavlık Bulgur 1 kg, id 15362)
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (etiket: "Alerjen Bilgileri: Gluten içerir.")

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

async function assertIngredients(client: PayloadClient): Promise<void> {
  const ids = INGREDIENTS.map((entry) => entry.id)
  const found = await client.find('ingredients', {
    where: { id: { in: ids } },
    limit: ids.length,
    select: { name: true, slug: true },
  })
  if (found.totalDocs !== ids.length) {
    throw new Error(`Master içindekiler eksik: ${ids.length} yerine ${found.totalDocs} kayıt bulundu`)
  }
  for (const entry of INGREDIENTS) {
    const doc = found.docs.find((candidate) => candidate.id === entry.id) as
      | { id: number; name?: string; slug?: string }
      | undefined
    if (doc?.slug !== entry.slug) {
      throw new Error(
        `İçindekiler kimliği kaydı: ${entry.id} → slug "${doc?.slug}" (beklenen "${entry.slug}")`,
      )
    }
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
  assertEan13(GTIN)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  await assertIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Yayla İri Pilavlık Bulgur, durum buğdayının kaynatılıp kurutulması ve iri taneli öğütülmesiyle üretilen pilavlık bulgurdur; 1 kg'lık şeffaf pencereli plastik ambalajda satılır. Ürün TS 2284 standardına göre durum buğdayından elde edilir ve Türk Gıda Kodeksi Bulgur Tebliği'ne uygundur. İçindekiler tek maddedir: pilavlık bulgur.\n\nBulgur yarı pişmiş bir üründür; pilavda kaynatılarak, salata ve köftelerde sıcak suyla ıslatılarak kullanılır. Ambalaj üzerindeki beyanlara göre ürün protein kaynağıdır, yüksek lif kaynağıdır ve düşük doymuş yağ içerir. Etiket besin değerlerini pişmemiş ürün için 100 g üzerinden verir (357 kcal).\n\nVeri kaynağı: Amazon.com.tr (ASIN B07Z75PCYQ) ve ürün ambalajı (EAN-13 8693374999005).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Şeffaf pencereli plastik ambalaj (geri dönüşüm kodu PP 5)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1495, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 357, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 65, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
      ],
    },
    labels: ['halal-certified'] as const,
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Bulgur (İri Pilavlık)' },
      { key: 'İngilizce Adı', value: 'Coarse Bulgur for Pilaf' },
      { key: 'Net Miktar', value: '1 kg (1.000 g)' },
      { key: 'Çeşit', value: 'Sade bulgur' },
      { key: 'Tane İrilği', value: 'İri pilavlık' },
      { key: 'Hammadde', value: 'Durum buğdayı (TS 2284)' },
      { key: 'Menşei', value: 'Türkiye' },
      { key: 'Ambalaj', value: 'Şeffaf pencereli plastik ambalaj, geri dönüşüm kodu PP 5' },
      {
        key: 'Üretici',
        value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
      },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / Ankara / Türkiye',
      },
      { key: 'Telefon', value: '+90 312 815 49 50 (pbx)' },
      { key: 'Faks', value: '+90 312 815 47 90' },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numaraları', value: 'Ankara (ANK) TR-06-K-000171, Mersin TR-33-K-001608' },
      { key: 'Standart', value: "TS 2284; Türk Gıda Kodeksi Bulgur Tebliği'ne uygundur" },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Ölçü Seçenekleri',
        value: '1 Kg (tekli, bu kayıt), 1 Kg 2li paket, 1 Kg 4lü paket, 1 Kg x 16',
      },
      { key: 'Ürün Ölçüleri', value: '22,8 × 16,8 × 4,3 cm' },
      { key: 'Kargo Ağırlığı', value: '1 kg' },
      {
        key: 'Besin Tablosu Notu',
        value: 'Ambalaj değerleri pişmemiş ürün için 100 g üzerindendir',
      },
      { key: 'Gluten Beyanı', value: 'Gluten içerir (durum buğdayı)' },
      { key: 'Helal Beyanı', value: 'Ambalaj üzerinde helal işareti bulunur' },
      {
        key: 'Sağlık Beyanları',
        value: 'Protein kaynağıdır, yüksek lif kaynağıdır, düşük doymuş yağ içerir',
      },
      {
        key: 'TETT / Parti',
        value: 'Tavsiye edilen tüketim tarihi, parti numarası ve üretim yılı ambalaj üzerindedir',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 97,46 TL (1 kg tekli paket, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (durum buğdayı). Çölyak hastalığı veya gluten hassasiyeti olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Tahıl, hububat ve pirinçler tarımsal kökenli ürünlerdir; tüketmeden önce gözle kontrol edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihi, parti numarası ve üretim yılı ambalajın üzerindedir.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      "Salçalı bulgur pilavı: 1 büyük kuru soğanı 2 yemek kaşığı tereyağında kavurun; 2 adet sivri biber ve 2 yemek kaşığı biber salçası ekleyip 5 dakika daha kavurun. 1 litre kemik suyunu ilave edip kaynatın, 1 su bardağı Yayla İri Pilavlık Bulgur'u ekleyip kapağı kapatın ve kısık ateşte pişmeye bırakın. 1 tatlı kaşığı tuz ve 1 çay kaşığı karabiber ekleyin; suyunu çekince ocağı kapatın, 30 dakika dinlendirip harmanlayın.\n\nPişirme önerisi (ambalaj): bulgur yarı pişmiş bir üründür; kaynatarak haşlamaya gerek kalmadan sıcak suyla ıslatıp salata ve köftelerde kullanabilirsiniz.",
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 97.46, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz' },
      { image: media.barcode, caption: `Barkod ${GTIN}` },
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
