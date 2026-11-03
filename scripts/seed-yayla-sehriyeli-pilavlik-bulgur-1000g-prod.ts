import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Şehriyeli Pilavlık Bulgur 1 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B07SSLWQHS + ürün ambalajının arka yüzü
 * (EAN-13 8693374999012). Prod'da bu barkod yok; betik yeni kayıt açar.
 * Kardeş kayıtlar (karıştırılmamalı): Yayla Pilavlık Bulgur 1 kg → 8693374011141,
 * Yayla İri Pilavlık Bulgur 1 kg → 8693374999005.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur,
 * içindekiler kayıtlarını slug üzerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-sehriyeli-pilavlik-bulgur-1000g-prod.ts
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

const BARCODE = '8693374999012'
const ASIN = 'B07SSLWQHS'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-sehriyeli-pilavlik-bulgur-1kg')
const PRODUCT_NAME = 'Yayla Şehriyeli Pilavlık Bulgur 1 kg'

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
    alt: `${PRODUCT_NAME} ön yüz: Yayla logosu, "Şehriyeli Pilavlık Bulgur" başlığı, 1 kg e, doğal lif/mineral/protein kaynağı rozetleri`,
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: `${PRODUCT_NAME} ürün bileşimi yakın çekim: Ürün: Şehriyeli Pilavlık Bulgur, Çeşit: Çeşnili Bulgur, İçindekiler: Pilavlık Bulgur (%90), Tel Şehriye (%10), gluten uyarısı`,
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: `${PRODUCT_NAME} besin değerleri tablosu (pişmemiş ürün, 100 g; enerji, yağ, karbonhidrat, lif, protein, tuz, magnezyum ve fosfor)`,
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: `${PRODUCT_NAME} geri dönüşüm ve ambalaj sembolleri: güneşten uzak, kuru tutun, çöpe atmayın, gıda temasına uygunluk, PP 5, geri dönüşüm ve helal işareti`,
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: `${PRODUCT_NAME} arka yüz: besin değerleri, saklama koşulları, tel şehriyeli bulgur pilavı tarifi, pişirme önerisi, üretici bilgileri ve barkod`,
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: `${PRODUCT_NAME} barkod numarası 8693374999012`,
  },
] as const

/**
 * Etiketten okunan içindekiler (yaprak maddeler) ve prod master kimlikleri.
 * "Pilavlık bulgur" prod'da 1557 numaralı kayıttır (adı "Pi̇lavlik bulgur"
 * biçiminde bozuk noktalı İ taşıdığı için doğrulama slug üzerinden yapılır).
 * Tel şehriye master'da yok; betik slug'dan bulur, yoksa oluşturur.
 */
const INGREDIENTS = [
  { id: 1557, name: 'Pi̇lavlik bulgur', slug: 'pilavlik-bulgur', percent: 90 },
  { id: null, name: 'Tel şehriye', slug: 'tel-sehriye', percent: 10 },
] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl (kardeş bulgur kayıtlarıyla aynı kategori)
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten (etiket: "Gluten içerir.")

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
  phosphorus: 38,
} as const

async function resolveIngredients(client: PayloadClient): Promise<number[]> {
  const ids: number[] = []
  for (const entry of INGREDIENTS) {
    const existing = await client.findOne('ingredients', { slug: { equals: entry.slug } })
    if (existing) {
      const doc = existing as { id: number; name?: string; slug?: string }
      if (doc.slug !== entry.slug) {
        throw new Error(`İçindekiler kimliği kaydı: ${doc.id} → slug "${doc.slug}"`)
      }
      if (entry.id !== null && doc.id !== entry.id) {
        throw new Error(`"${entry.name}" beklenen id ${entry.id}, bulunan ${doc.id}`)
      }
      ids.push(doc.id)
      continue
    }
    if (entry.id !== null) {
      throw new Error(`Master içindekiler eksik: ${entry.name} (${entry.slug})`)
    }
    const created = await client.create('ingredients', {
      name: entry.name,
      slug: entry.slug,
    })
    console.log(`  + içindekiler: ${entry.name} (${created.id})`)
    ids.push(created.id)
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

  const ingredientIds = await resolveIngredients(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: PRODUCT_NAME,
    description:
      "Yayla Şehriyeli Pilavlık Bulgur, durum buğdayından üretilmiş pilavlık bulgur ile kavrulmuş tel şehriyenin karışımıdır (%90 pilavlık bulgur, %10 tel şehriye); 1 kg'lık şeffaf pencereli plastik ambalajda satılır. Ürün TS 2284 standardına göre durum buğdayından elde edilir ve Türk Gıda Kodeksi Bulgur Tebliği'ne uygundur. Ambalajda \"doğal lif kaynağı\", \"doğal mineral kaynağı\" ve \"doğal protein kaynağı\" beyanları bulunur. Etiket besin değerlerini pişmemiş ürün için 100 g üzerinden verir (358 kcal; 6,8 g lif, 12,1 g protein).\n\nVeri kaynağı: Amazon.com.tr (ASIN B07SSLWQHS) ve ürün ambalajının arka yüzü. Amazon listesinin \"İçindekiler\" alanı hem %75 pilavlık bulgur / %25 tel şehriye hem de \"%10 şehriye\" ifadesini taşıyor; ambalajda basılı oran %90 / %10 olduğu için bu kayıt ambalajı esas alır. Amazon'un 2'li paket varyantı (ASIN B0F1GDKKRY) aynı 1 kg ambalajın demetidir, kendi EAN'i yoktur.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Şeffaf pencereli plastik ambalaj (BPAsız koruyucu ambalaj, geri dönüşüm kodu PP 5)',
    items: ingredientIds.map((id, index) => ({
      ingredients: id,
      percent_estimate: INGREDIENTS[index].percent,
    })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1513, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 358, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 65, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 59, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 182, unit: 'mg' },
      ],
    },
    labels: ['halal-certified'] as const,
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Bulgur (Şehriyeli Pilavlık)' },
      { key: 'İngilizce Adı', value: 'Bulgur with Vermicelli for Pilaf' },
      { key: 'Net Miktar', value: '1 kg (1.000 g)' },
      { key: 'Çeşit', value: 'Çeşnili bulgur (tel şehriyeli)' },
      { key: 'Bileşen Oranları', value: 'Pilavlık bulgur %90, tel şehriye %10 (ambalaj)' },
      { key: 'Hammadde', value: 'Durum buğdayı (TS 2284)' },
      { key: 'Menşei', value: 'Türkiye' },
      {
        key: 'Ambalaj',
        value: 'Şeffaf pencereli plastik ambalaj, BPAsız koruyucu ambalaj, geri dönüşüm kodu PP 5',
      },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / Ankara / Türkiye',
      },
      {
        key: 'Mersin Fabrikası',
        value: 'Yalınayak Mahallesi 102099. Sokak No: 1, Toroslar / Mersin / Türkiye',
      },
      { key: 'Telefon', value: '+90 312 815 49 50 (pbx)' },
      { key: 'Faks', value: '+90 312 815 47 90' },
      { key: 'Mersin Telefon', value: '+90 324 221 62 76 (pbx)' },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      {
        key: 'İşletme Kayıt Numaraları',
        value: '(ANK) TR-06-K-000171, (MER) TR-33-K-001608',
      },
      { key: 'Standart', value: "TS 2284; Türk Gıda Kodeksi Bulgur Tebliği'ne uygundur" },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Ölçü Seçenekleri',
        value: "Tekli 1 kg (bu kayıt), 2'li paket (ASIN B0F1GDKKRY, 2 × 1 kg aynı ambalaj)",
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 85,47 TL (1 kg tekli paket, 3 Kasım 2026; kg başına 85,47 TL)',
      },
      {
        key: 'Besin Tablosu Notu',
        value: 'Ambalaj değerleri pişmemiş ürün için 100 g üzerindendir',
      },
      { key: 'Gluten Beyanı', value: 'Gluten içerir (durum buğdayı)' },
      { key: 'Helal Beyanı', value: 'Ambalaj üzerinde helal işareti bulunur' },
      {
        key: 'Sağlık Beyanları',
        value:
          'Ambalaj: doğal lif kaynağı, doğal mineral kaynağı, doğal protein kaynağı. Amazon açıklaması: yüksek lif, yüksek niasin, yüksek fosfor; çinko, magnezyum, B6, B1 ve potasyum kaynağı; düşük tuz, düşük doymuş yağ, düşük şeker içerir',
      },
      {
        key: 'Tarif Notu',
        value:
          'Ambalajdaki "Tel Şehriyeli Bulgur Pilavı" tarifinde tereyağı 500 gr olarak basılmıştır; kullanım metni etiketteki haliyle aktarılmıştır',
      },
      {
        key: 'İçindekiler Çelişkisi',
        value:
          'Amazon "İçindekiler" alanı %75 pilavlık bulgur / %25 kavrulmuş tel şehriye yazıyor; ambalajda %90 / %10 basılı. Bu kayıt ambalajı esas alır.',
      },
      {
        key: 'TETT / Parti',
        value:
          'Tavsiye edilen tüketim tarihi (TETT), parti numarası (PN), üretim yılı (ÜY) ve tane iriliği ambalaj üzerine kodlanmıştır',
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
      "Pişirme önerisi (ambalaj): Bulgur yarı pişmiş bir üründür. Yumuşatmak için az miktarda su yeterlidir. Kaynatılarak haşlanmasına gerek kalmadan sıcak su ile ıslatılarak kolaylıkla yumuşatıp salata ve köftelerde kullanabilirsiniz.\n\nTel Şehriyeli Bulgur Pilavı (ambalaj): 200 gr Yayla Şehriyeli Pilavlık Bulgur, 500 gr tereyağı, 1 çorba kaşığı ayçiçek yağında kavrulur. 1 çay kaşığı tuz ve bir tutam karabiber eklenir. Kaynar vaziyette olan 800 ml tavuk suyu eklenerek pişirmeye bırakılır. 10-12 dakika orta ateşte, sonra olabildiğince kısık ateşte suyunu çekene kadar bekletilir; suyunu tamamen çektiğinde ağzı kapalı 30 dakika dinlendirmeye bırakılır.",
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 85.47, date: '2026-11-03T00:00:00.000Z' }],
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
