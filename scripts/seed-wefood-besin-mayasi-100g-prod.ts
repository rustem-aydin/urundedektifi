import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Wefood Besin Mayası 100 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0CL4SBDRD + ürün ambalajı (EAN-13 8683347031580).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-wefood-besin-mayasi-100g-prod.ts
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

const BARCODE = '8683347031580'
const GTIN = '8683347031580'
const ASIN = 'B0CL4SBDRD'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'wefood-besin-mayasi-100g')

const IMAGES = [
  {
    key: 'front',
    file: 'wefood-besin-mayasi-front.jpg',
    alt: 'Wefood Besin Mayası 100 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'wefood-besin-mayasi-ingredients.jpg',
    alt: 'Wefood Besin Mayası 100 g içindekiler: besin mayası (%100 inaktif kuru maya, Saccharomyces cerevisiae) ve saklama bilgisi',
  },
  {
    key: 'nutrition',
    file: 'wefood-besin-mayasi-nutrition.jpg',
    alt: 'Wefood Besin Mayası 100 g besin değerleri ve vitamin-mineral tablosu (100 g için)',
  },
  {
    key: 'recycling',
    file: 'wefood-besin-mayasi-recycling.jpg',
    alt: 'Wefood Besin Mayası 100 g ambalaj geri dönüşüm işareti: 90 C/LDPE',
  },
  {
    key: 'back',
    file: 'wefood-besin-mayasi-back.jpg',
    alt: 'Wefood Besin Mayası 100 g arka yüz: içindekiler, besin değerleri, kullanım, işletmeci bilgileri ve barkod',
  },
  {
    key: 'barcode',
    file: 'wefood-besin-mayasi-barcode.jpg',
    alt: 'Wefood Besin Mayası 100 g barkod numarası 8683347031580',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 161 // Wefood
const CATEGORY_ID = 58 // Temel Gıda & Mutfak › Baharat & Çeşni
const COUNTRY_ID = 1 // Türkiye (ithal hammadde, Türkiye'de paketlenmiş)

/** Etiketten okunan içindekiler; master'da yoksa betik oluşturur. */
const INGREDIENT = {
  name: 'Besin mayası',
  slug: 'besin-mayasi',
  aliases: [
    'Nutritional yeast',
    'İnaktif kuru maya',
    'Inaktif kuru maya',
    'Deaktif maya',
    'Saccharomyces cerevisiae',
  ],
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
  vitaminB1: 28,
  vitaminB2: 29,
  vitaminB3: 30,
  vitaminB12: 33,
  pantothenicAcid: 34,
  zinc: 41,
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

async function ensureIngredient(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('ingredients', { name: { equals: INGREDIENT.name } })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name: INGREDIENT.name,
    slug: INGREDIENT.slug,
    aliases: INGREDIENT.aliases.map((alias) => ({ alias })),
  })
  console.log(`  + içindekiler: ${INGREDIENT.name} (${created.id})`)
  return created.id
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

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientId = await ensureIngredient(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Wefood Besin Mayası 100 g',
    description:
      'Wefood Besin Mayası, %100 inaktif kuru mayadan (Saccharomyces cerevisiae) oluşan, B vitaminleri ve çinko bakımından zengin 100 g’lık doypack paketidir. Ambalajda glutensiz, vegan ve koruyucu içermez olarak tanımlanır; yüksek protein ve yüksek lif beyanı taşır. Peynirsi tat vericisi olarak salatalara, yemeklere, patlamış mısıra, soslara ve smoothielere eklenir.\n\nEtiket değerlerine göre 100 g üründe 1554 kJ (370 kcal) enerji, 5,5 g yağ, 25 g karbonhidrat, 20 g lif, 45 g protein ve 0,2 g tuz bulunur; şeker 0 g’dır. Aynı porsiyonda B1 4,5 mg, B2 1,8 mg, B3 34 mg, B5 14 mg, B12 0,044 mg ve çinko 3,5 mg yer alır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CL4SBDRD) ve ürün ambalajı (EAN-13 8683347031580).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Doğavera Gıda A.Ş. (Wefood)',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Doypack poşet (LDPE, geri dönüşüm işareti 90 C/LDPE)',
    items: [{ ingredients: ingredientId, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1554, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 370, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 25, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 20, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 45, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.vitaminB1, amount: 4.5, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.vitaminB2, amount: 1.8, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.vitaminB3, amount: 34, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.pantothenicAcid, amount: 14, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.vitaminB12, amount: 0.044, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.zinc, amount: 3.5, unit: 'mg' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'gluten-free'],
    specifications: [
      { key: 'Marka', value: 'Wefood' },
      { key: 'Ürün Tipi', value: 'Besin mayası (inaktif kuru maya, Saccharomyces cerevisiae)' },
      { key: 'Net Miktar', value: '100 g' },
      { key: 'Porsiyon', value: 'Bir yetişkin için günde 1 yemek kaşığı (10 g)' },
      { key: 'Ambalaj', value: 'Doypack poşet (LDPE); geri dönüşüm işareti 90 C/LDPE' },
      {
        key: 'Menşe',
        value: 'İthal hammaddeler kullanılarak Türkiye’de paketlenmiştir (ambalaj beyanı)',
      },
      { key: 'Gıda İşletmecisi', value: 'Doğavera Gıda A.Ş.' },
      { key: 'Adres', value: 'İkitelli OSB Mah. Atatürk Blv. No: 102, Başakşehir / İstanbul' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-237229' },
      { key: 'E-posta', value: 'info@wefood.com.tr' },
      { key: 'Web', value: 'www.wefood.com.tr' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      { key: 'Besin Değerleri Bazı', value: '100 g ürün için' },
      {
        key: 'Vitamin ve Mineral Beyanı',
        value:
          '100 g için: B1 4,5 mg (%409 BRD), B2 1,8 mg (%128 BRD), B3 34 mg (%213 BRD), B5 14 mg (%233 BRD), B12 0,044 mg (%1760 BRD), çinko 3,5 mg (%35 BRD)',
      },
      {
        key: 'Beyan',
        value:
          'Yüksek protein, yüksek lif, yüksek B12/B1/B2/B3/B5 ve yüksek çinko; glutensiz; vegan; koruyucu içermez (ambalaj)',
      },
      { key: 'Kullanım', value: 'Çiğ ya da pişirilerek; salata, yemek, patlamış mısır, sos ve smoothielere' },
      {
        key: 'Amazon Verisi Notu',
        value:
          'Amazon “Ürün Formu: Toz”, “Konteyner Türü: Kutu”, “Ürün Ağırlığı 0,5 kg”, “İçindekiler: Gıda” yazar. Ambalaj doypack poşettir, net miktar 100 g’dır; içindekiler ambalajdan alınmıştır.',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı bulunmuyor' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli 100 g paket; satıcı Wefood, gönderim Amazon Fulfillment (2’li paket ayrı ASIN)',
      },
      { key: 'Katkı Maddesi', value: 'E kodu / katkı maddesi içermez' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 434,50 TL (100 g, 100 g başına 434,50 TL, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Doğrudan güneş ışığına maruz bırakmayınız; serin ve kuru yerde muhafaza ediniz.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage: 'Serin ve kuru yerde muhafaza ediniz. Doğrudan güneş ışığına maruz bırakmayınız.',
    usage:
      'Çiğ ya da pişirerek kullanabilirsiniz; salatalara, yemeklere, patlamış mısırlara, soslara ve smoothielere ekleyebilirsiniz. Bir yetişkin için günde 1 yemek kaşığı (10 g) tüketim yeterlidir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 434.5, date: '2026-11-04T00:00:00.000Z' }],
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
