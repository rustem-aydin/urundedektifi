import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Beyorganik Organik Basmati Pirinç 1000 g ürününü UZAK Payload REST API'sine
 * yazar: yeni ürün dokümanı (barkod daha önce kayıtlı değil) + fotoğraflar.
 *
 * Kaynak: Amazon.com.tr ASIN B0FR9T7Q67 + ambalaj etiketi. Barkod etiketten
 * okundu (8682125480701, dikey basılı; 90° döndürülerek okundu) ve EAN-13
 * kontrol hanesi doğrulandı. Ürün Amazon'da "Şu anda mevcut değil", bu yüzden
 * prices boş bırakıldı.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-beyorganik-organik-basmati-pirinc-1000g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-beyorganik-organik-basmati-pirinc-1000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8682125480701'
const ASIN = 'B0FR9T7Q67'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'beyorganik-organik-basmati-pirinc-1000g',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Beyorganik Organik Basmati Pirinç 1000 g ön yüz; organik tarım logolu kilitli poşet, pestisit analizli',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Beyorganik Organik Basmati Pirinç 1000 g etiket bilgileri: içindekiler organik basmati pirinç, alerjen ve saklama beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Beyorganik Organik Basmati Pirinç 1000 g besin değerleri (100 g: 345 kcal / 1436 kJ)',
  },
  {
    key: 'certificate',
    file: 'certificate.jpg',
    alt: 'Beyorganik Organik Basmati Pirinç 1000 g organik tarım sertifikası TR-OT-42-MSİ-1590-2024-014',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Beyorganik Organik Basmati Pirinç 1000 g barkod numarası 8682125480701',
  },
] as const

const BRAND_ID = 5577 // Beyorganik
const CATEGORY_ID = 27 // Baklagil & Tahıl › Makarna & Pirinç
const COUNTRY_ID = 76 // İran (etiket: Menşe İran)
const INGREDIENT_BASMATI_ID = 1938 // Basmati rice

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
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
    name: 'Beyorganik Organik Basmati Pirinç 1000 g',
    description:
      "Beyorganik Organik Basmati Pirinç, İran menşeli, uzun ve ince taneli organik basmati pirincin 1 kg'lık kilitli (ziplock) poşetidir. Etiket tek içerik bildirir: organik basmati pirinç. Katkı maddesi ve koruyucu içermez; ambalajda organik tarım logosu bulunur ve ürün pestisit ve aflatoksin analizinden geçirilmiş olarak satılır.\n\nTane tane pişen dokusu ve hafif aromasıyla pilav, salata ve sıcak garnitürlerde kullanılır. Etiket gluten ve süt ürünleri bulunan ortamda paketlendiğini belirtir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FR9T7Q67) ve ürün ambalaj etiketi (EAN-13 8682125480701).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Beyorganik (Zehra Güzelocak)',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Kilitli (ziplock) poşet',
    items: [{ ingredients: INGREDIENT_BASMATI_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1436, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 345, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 74.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 1.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 8.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.05, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Beyorganik' },
      { key: 'Ürün Tipi', value: 'Organik basmati pirinç (uzun taneli)' },
      { key: 'Çeşit', value: 'Basmati' },
      { key: 'Net Miktar', value: '1000 g' },
      { key: 'Ambalaj', value: 'Kilitli (ziplock) poşet, şeffaf pencereli' },
      { key: 'Menşe', value: 'İran' },
      { key: 'Üretici / İşletmeci', value: 'Beyorganik — Zehra Güzelocak' },
      {
        key: 'İşletme Adresi',
        value: 'Yıldırım Mah. Ali Fuat Başgil Cad. No: 141/A-B, Bayrampaşa / İstanbul',
      },
      { key: 'İşletme Kayıt Numarası', value: 'TR-34-K-195953' },
      { key: 'Stok Kodu', value: '1223' },
      { key: 'Parti No.', value: '07322025' },
      { key: 'TETT', value: '08/2026 (ambalaj baskısı); 2024 mahsulüdür' },
      {
        key: 'Organik Sertifika',
        value:
          'TR-OT-42-MSİ-1590-2024-014 (Amazon galerisindeki sertifika): düzenleme 12.07.2024, geçerlilik bitişi 12.07.2025. Sertifika 4 Kasım 2026 itibarıyla süresi dolmuştur; işletmenin güncel sertifikası doğrulanmadı.',
      },
      { key: 'Beyan', value: 'Organik, katkı maddesi ve koruyucu içermez' },
      {
        key: 'Analiz Beyanı',
        value:
          'Amazon başlığında “Pestisit ve Aflatoksin Analizli” yazar; analiz raporu ürün sayfasında paylaşılmamıştır.',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Etikette “Gluten ve süt ürünleri bulunan ortamda paketlenmiştir” yazar.',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Tablo 100 g içindir: 345 kcal / 1436 kJ, yağ 1,1 g, karbonhidrat 74,5 g, şeker 0,3 g, lif 1,5 g, protein 8,5 g, tuz 0,05 g. Etikette doymuş yağ satırı basılı değildir.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '22,1 × 15,2 × 6,4 cm; 1 kg (Amazon ölçümü)' },
      {
        key: 'Fiyat Bilgisi',
        value:
          'Amazon.com.tr’de 4 Kasım 2026 itibarıyla “Şu anda mevcut değil” — fiyat gösterilmiyor.',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Etikette “Gluten ve süt ürünleri bulunan ortamda paketlenmiştir” yazar; gluten ve süt alerjisi olanlar için çapraz bulaşma riski vardır.',
      },
      {
        severity: 'low' as const,
        text: 'Serin ve kuru yerde saklanmalıdır; TETT (08/2026) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage: 'Serin ve kuru yerde saklayınız.',
    usage: null,
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      {
        image: media.certificate,
        caption: 'Organik tarım sertifikası TR-OT-42-MSİ-1590-2024-014 (12.07.2024 – 12.07.2025)',
      },
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
