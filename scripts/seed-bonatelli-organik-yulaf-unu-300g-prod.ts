import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Bonatelli Organik Yulaf Unu 300 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0CMXVP272 + ürün ambalajı (EAN-13 8691533125937)
 * ve üreticinin ürün sayfası (pastabonatelli.com/organik-yulaf-unu-300-gr).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-bonatelli-organik-yulaf-unu-300g-prod.ts
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

const BARCODE = '8691533125937'
const GTIN = '8691533125937'
const ASIN = 'B0CMXVP272'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'bonatelli-organik-yulaf-unu-300g')

const IMAGES = [
  {
    key: 'front',
    file: 'bonatelli-yulaf-unu-front.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g ambalaj görseli',
  },
  {
    key: 'ingredients',
    file: 'bonatelli-yulaf-unu-ingredients.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g içindekiler: organik yulaf unu (tek bileşen)',
  },
  {
    key: 'nutrition',
    file: 'bonatelli-yulaf-unu-nutrition.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g besin değerleri tablosu (100 g için)',
  },
  {
    key: 'badges',
    file: 'bonatelli-yulaf-unu-badges.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g etiket beyanları: vegan, gluten içerir, katkı maddesi içermez, koruyucu içermez',
  },
  {
    key: 'producer',
    file: 'bonatelli-yulaf-unu-producer.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g ORSER organik sertifika bilgisi, menşei Türkiye ve QR kod',
  },
  {
    key: 'barcode',
    file: 'bonatelli-yulaf-unu-barcode.jpg',
    alt: 'Bonatelli Organik Yulaf Unu 300 g barkod numarası 8691533125937',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 725 // Yulaf Unu (yulaf-unu)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 977 // Bonatelli
const CATEGORY_ID = 52 // Baklagil & Tahıl › Un & İrmik
const COUNTRY_ID = 1 // Türkiye
const GLUTEN_ID = 1 // Gluten (etiket: "Gluten içerir")

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

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Bonatelli Organik Yulaf Unu 300 g',
    description:
      'Bonatelli Organik Yulaf Unu, ORSER tarafından sertifikalandırılmış organik yulafın öğütülmesiyle elde edilen tek bileşenli (organik yulaf unu) 300 g’lık pakettir. Katkı maddesi ve koruyucu içermez; vegan olup gluten içerir. Kek, kurabiye, pankek ve ekmek gibi fırın ürünlerinde, ayrıca yulaf lapası ve smoothie’lerde kullanılır.\n\nEtiket değerlerine göre 100 g üründe 1632,5 kJ (390 kcal) enerji, 7,1 g yağ, 63,9 g karbonhidrat, 9 g lif ve 0,9 g şeker bulunur. Etikette protein 2,6 g ve tuz 2,5 g basılmıştır; bu iki değer hem enerji hesabıyla hem de yulaf ununun bilinen bileşimiyle çelişir ve teknik özelliklerde belgelenmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CMXVP272), ürün ambalajı (EAN-13 8691533125937) ve üreticinin ürün sayfası (pastabonatelli.com).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Bonatelli Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '300 g',
    packaging: 'Metalize stand-up poşet (doypack)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    allergens: GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1632.5, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 390, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 7.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 63.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 2.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2.5, unit: 'g' },
      ],
    },
    labels: ['organic', 'vegan', 'vegetarian', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Bonatelli' },
      { key: 'Ürün Tipi', value: 'Organik yulaf unu (%100 öğütülmüş organik yulaf)' },
      {
        key: 'Sertifika',
        value:
          'Organik — Tarım ve Orman Bakanlığınca yetkilendirilmiş ORSER (TR-OT-011); Müteşebbis Kodu TR-OT-011/İ-10-049; 5262 sayılı Organik Tarım Kanunu kapsamında',
      },
      { key: 'Net Miktar', value: '300 g (10,6 OZ)' },
      { key: 'Ambalaj', value: 'Metalize stand-up poşet (doypack)' },
      { key: 'Menşe', value: 'Türkiye (Türk Malı)' },
      { key: 'Gıda İşletmecisi', value: 'Bonatelli Gıda San. ve Tic. A.Ş.' },
      { key: 'Adres', value: 'Yeniköy Mah. Yeniköy Sok. No: 469/B, Karesi / Balıkesir' },
      { key: 'Telefon', value: '+90 266 246 14 50' },
      { key: 'E-posta', value: 'info@pastabonatelli.com' },
      { key: 'Web', value: 'www.pastabonatelli.com' },
      { key: 'İşletme Kayıt No', value: 'TR-33-K-03768' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      {
        key: 'Besin Değerleri Bazı',
        value:
          '100 g için; % değerleri ortalama yetişkin referans alım düzeyine (8400 kJ / 2000 kcal) göredir',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette protein 2,6 g ve tuz 2,5 g basılı; üreticinin ürün sayfasında da aynı değerler yazıyor. Enerji hesabı tutmuyor: 63,9×4 + 2,6×4 + 7,1×9 + 9×2 ≈ 348 kcal (etiket 390 kcal); protein ≈12,6 g alınırsa ≈388 kcal olur. Ayrıca saf yulaf ununda tuz beklenen değeri ~0’dır. Değerler etiketteki hâliyle yazıldı, düzeltilmedi.',
      },
      {
        key: 'Beyan',
        value:
          'Vegan; gluten içerir; katkı maddesi içermez; koruyucu içermez; organik (ambalaj ve üretici sayfası)',
      },
      {
        key: 'Semboller',
        value:
          'Vegan (✓), Gluten içerir (✗), Katkı maddesi içermez, Koruyucu içermez, ORSER organik logosu, TÜRK MALI, QR kod (organik sertifika)',
      },
      { key: 'Alerjen Beyanı', value: 'Gluten içerir (yulaf)' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 300 g paket; satıcı Amazon.com.tr' },
      {
        key: 'Paket Ölçüleri',
        value: '26,4 × 15,4 × 3,4 cm; 320 g (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 153,00 TL (300 g, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (yulaf). Çölyak hastaları ve gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz; parti no ve TETT ambalaj üzerindedir.',
      },
    ],
    storage: 'Serin ve kuru yerde muhafaza ediniz. Doğrudan güneş ışığına maruz bırakmayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 153, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.badges, caption: 'Etiket beyanları: vegan, gluten içerir, katkı maddesi içermez, koruyucu içermez' },
      { image: media.producer, caption: 'ORSER organik sertifikası, menşei ve QR kod' },
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
