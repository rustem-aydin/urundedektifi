import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Kuru Yeşil Chia Tohumu 150 g ürününü
 * UZAK Payload REST API'sine yazar: fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0DZJ13VGC + ürün ambalajı (EAN-13 8683649320214).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-kuru-yesil-chia-tohumu-150g-prod.ts
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

const BARCODE = '8683649320214'
const GTIN = '8683649320214'
const ASIN = 'B0DZJ13VGC'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'kuru-yesil-chia-tohumu-150g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g ambalaj tanıtım bloğu: Chia Tohumu / Chia Seeds',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g besin değerleri tablosu (100 g için)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g ambalaj sembolleri: şekersiz, glutensiz, GDO’suz, katkısız, %100 memnuniyet garantisi',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g arka yüz: besin değerleri, kullanım, uyarılar, üretici, menşe ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Kuru Yeşil Chia Tohumu 150 g barkod numarası 8683649320214',
  },
] as const

const ALT = Object.fromEntries(IMAGES.map((image) => [image.key, image.alt])) as Record<
  string,
  string
>

/** Etiketten okunan tek içindekiler maddesi (master kayıt prod'da doğrulandı). */
const INGREDIENT_ID = 2686 // Chia tohumu (chia-tohumu)

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 1656 // Kuru Yeşil
const CATEGORY_ID = 22 // Atıştırmalık & Tatlı › Kuruyemiş
const COUNTRY_ID = 27 // Brezilya (ambalajda "Menşei: Brezilya")

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
    name: 'Kuru Yeşil Chia Tohumu 150 g',
    description:
      'Kuru Yeşil Chia Tohumu, tek bileşenli (chia tohumu) 150 g’lık fermuarlı doypack paketidir. Ambalajda şekersiz, glutensiz, GDO’suz ve katkısız olduğu belirtilir; chia tohumu lif, bitkisel protein ve omega-3 yağ asitleri açısından zengindir. Smoothie, yoğurt, salata ve soslara eklenerek veya su/sütle karıştırılarak tüketilir.\n\nEtiket değerlerine göre 100 g üründe 486 kcal enerji, 30,7 g yağ, 42 g karbonhidrat, 42 g lif ve 16,5 g protein bulunur; şeker ve tuz 0 g’dır. Etikette lif değeri toplam karbonhidratla aynı (42 g) basılmıştır ve enerji makro besinlerden hesaplanan değerle tam örtüşmez; bu durum teknik özelliklerde belgelenmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DZJ13VGC, satıcı Kuru Yeşil) ve ürün ambalajı (EAN-13 8683649320214).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Kuru Yeşil Gıda Tarım İç ve Dış Tic. Ltd. Şti.',
    country: COUNTRY_ID,
    size: '150 g',
    packaging: 'Doypack poşet (fermuarlı, “hoop aç, hoop kapa”)',
    items: [{ ingredients: INGREDIENT_ID, percent_estimate: 100 }],
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 2033, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 486, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 30.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 42, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 42, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 16.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: ['sugar-free', 'gluten-free', 'non-gmo', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Kuru Yeşil' },
      { key: 'Ürün Tipi', value: 'Chia tohumu (Salvia hispanica), bütün' },
      { key: 'Net Miktar', value: '150 g' },
      { key: 'Ambalaj', value: 'Doypack poşet, fermuarlı (“hoop aç, hoop kapa”)' },
      {
        key: 'Menşe',
        value: 'Brezilya (ambalajda “Menşei: Brezilya”); Amazon “Orijin Ülke: Türkiye” yazar',
      },
      { key: 'Üretici', value: 'Kuru Yeşil Gıda Tarım İç ve Dış Tic. Ltd. Şti.' },
      { key: 'Üretici Adresi', value: 'Adalet Mah. Alparsan Cad. No: 28/5, Merkezefendi / Denizli' },
      { key: 'İşletme Kayıt No', value: 'TR-20-K-018096' },
      { key: 'Web', value: 'kuruyesil.com' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir (parti no ile aynı)' },
      {
        key: 'Besin Değerleri Bazı',
        value: '100 g için; etikette kJ satırı yok, 2033 kJ kcal × 4,184 ile hesaplandı',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette lif 42 g basılı ve toplam karbonhidratla (42 g) aynı; USDA chia verisinde lif 34,4 g’dır. Enerji de makrolarla tam tutmuyor (4×42 + 4×16,5 + 9×30,7 = 510 kcal; lif 2 kcal/g sayılırsa 426 kcal; etiket 486 kcal). Etiket değerleri yazıldı, düzeltme yapılmadı.',
      },
      {
        key: 'Beyan',
        value:
          'Şekersiz, glutensiz, GDO’suz, katkısız, %100 doğal; yüksek lif ve bitkisel protein kaynağı; omega-3 ve antioksidan içerir (ambalaj ve Amazon beyanı)',
      },
      {
        key: 'Ambalaj Beyanları',
        value:
          '“Kas toparlanmasını hızlandırır, ince ve uzun kas yapısını destekler, açlığı yatıştırır, kas kapasitesini geliştirir” — ambalajdaki pazarlama ifadeleridir, bağımsız doğrulanmamıştır',
      },
      {
        key: 'Ambalaj Hatası',
        value:
          '“Nasıl Kullanırım?” metni “Bezelye Proteinini…” diye başlıyor; ürün chia tohumu, bezelye proteini değil (şablon hatası). Ambalajda ayrı “İçindekiler” satırı basılı değil; ürün adı “Chia Tohumu / Chia Seeds”.',
      },
      {
        key: 'Ambalaj Uyarısı',
        value:
          'Beklenmeyen bir etki görüldüğünde doktora başvurun; hamilelikte veya kronik rahatsızlıkta kullanmadan önce doktora danışın',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Şekersiz, glutensiz, GDO’suz, katkısız, %100 memnuniyet garantisi, RAW FOOD damgası',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda ve Amazon listesinde alerjen beyanı yok' },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli paket (150 g); Amazon.com.tr’de Kuru Yeşil satıcı, gönderim Amazon Fulfillment',
      },
      {
        key: 'Ürün Ölçüleri',
        value: '20,4 × 12,5 × 7,8 cm (paket, Amazon ölçümü); paket ağırlığı 200 g',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 179,55 TL (150 g, 100 g başına 119,70 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Hamileyseniz veya kronik bir rahatsızlığınız varsa kullanmadan önce doktorunuza başvurun.',
      },
      {
        severity: 'low' as const,
        text: 'Beklenmeyen bir etki gördüğünüzde doktorunuza başvurun.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz.',
      },
    ],
    usage:
      'Ambalajın kullanım önerisi: chia tohumunu sevdiğiniz smoothielere, yoğurda, salataya veya suya ekleyip her gün kullanabilirsiniz; faydasını tam alabilmek için düzenli kullanım önerilir. Kahvaltıya ekleyin, tariflerde ve soslarda kullanın; su veya sütle karıştırıldığında jel kıvamına gelir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 179.55, date: '2026-11-03T00:00:00.000Z' }],
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
