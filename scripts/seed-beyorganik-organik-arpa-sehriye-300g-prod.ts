import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Beyorganik Organik Arpa Şehriye 300 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0FR96NR3W + ürün ambalajı (EAN-13 8680419375467,
 * ambalajdaki dikey barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Ambalaj görseli 1200×1800 (soneksiz URL) indirilip etiket bölgeleri oradan
 * kırpıldı; 1500 px sürümünde besin tablosunun enerji satırı okunamıyordu.
 *
 * Amazon "İçindekiler" metni "Organik buğday un, su, kaya tuzu" der; ambalaj
 * yalnız "Organik durum buğdayı irmiği" yazar. Kayda ambalaj yazılır.
 *
 * Marka (Beyorganik, id 5577) ve organik sertifika görseli önceki kayıtlardan
 * yeniden kullanılır; kopya medya yüklenmez.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-beyorganik-organik-arpa-sehriye-300g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-beyorganik-organik-arpa-sehriye-300g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8680419375467'
const ASIN = 'B0FR96NR3W'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'beyorganik-organik-arpa-sehriye-300g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Beyorganik Organik Arpa Şehriye 300 g ön yüz; organik tarım logolu şeffaf poşet',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Beyorganik Organik Arpa Şehriye etiket bilgileri: içindekiler (organik durum buğdayı irmiği), parti 20212025, TETT 06/2026, alerjen beyanı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Beyorganik Organik Arpa Şehriye besin değerleri tablosu (100 g: 385 kcal / 1609 kJ)',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Beyorganik Organik Arpa Şehriye 300 g barkod numarası 8680419375467',
  },
] as const

const BRAND_ID = 5577 // Beyorganik
const CATEGORY_ID = 27 // Makarna & Pirinç
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_SEMOLINA_ID = 4524 // Durum buğday irmiği
const ALLERGEN_GLUTEN_ID = 1 // Gluten

const CERTIFICATE_ALT_PREFIX =
  'Beyorganik (Zehra Güzelocak) organik tarım müteşebbis sertifikası'

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

async function assertIngredient(
  client: PayloadClient,
  id: number,
  name: string,
): Promise<void> {
  const doc = await client.find('ingredients', {
    where: { and: [{ id: { equals: id } }, { name: { equals: name } }] },
    limit: 1,
    select: { name: true },
  })
  if (doc.totalDocs !== 1) {
    throw new Error(`İçindekiler eşleşmedi: id ${id} ≠ ${name}`)
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

async function findSharedCertificate(client: PayloadClient): Promise<number | undefined> {
  const found = await client.find('media', {
    where: { alt: { like: CERTIFICATE_ALT_PREFIX } },
    limit: 1,
    select: { alt: true },
  })
  return found.docs[0]?.id
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

  await assertIngredient(client, INGREDIENT_SEMOLINA_ID, 'Durum buğday irmiği')

  const media = await ensureMedia(client)
  const certificateId = await findSharedCertificate(client)

  const data = {
    barcode: BARCODE,
    name: 'Beyorganik Organik Arpa Şehriye 300 g',
    description:
      "Beyorganik Organik Arpa Şehriye, organik durum buğdayı irmiğinden üretilen 300 g'lık arpa şehriyedir (şehriye şekli «arpa» olarak adlandırılır; içinde arpa yoktur). Sütsüz ve yumurtasızdır; katkı maddesi, koruyucu, renklendirici, şeker, nişasta ve kimyasal içermez.\n\nTek bileşen organik durum buğdayı irmiğidir ve Türk Gıda Kodeksi'ne uygun olarak üretilir; ambalajda organik tarım logosu yer alır. 100 g'da 385 kcal, 3,5 g şeker ve 3 g lif bulunur. Gluten içerir; süt ürünleri bulunan ortamda paketlenmiştir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0FR96NR3W) ve ürün ambalajı (EAN-13 8680419375467).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Beyorganik (Zehra Güzelocak)',
    country: COUNTRY_ID,
    size: '300 g',
    packaging: 'Şeffaf plastik poşet (organik tarım logolu)',
    items: [{ ingredients: INGREDIENT_SEMOLINA_ID }],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 385, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1609, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 74, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 3.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.01, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Beyorganik (BEYORGANİK)' },
      { key: 'Ürün Tipi', value: 'Organik arpa şehriye (sütsüz, yumurtasız)' },
      { key: 'Net Miktar', value: '300 g (ambalajda “300 g e”)' },
      { key: 'İçindekiler', value: 'Organik durum buğdayı irmiği (tek bileşen)' },
      {
        key: 'Adlandırma Notu',
        value:
          'Ambalajın İngilizce adı “Organic Barley Noodle” olsa da içindekiler arpa değil durum buğdayı irmiğidir; “arpa” şehriyenin şekil adıdır.',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Gluten içerir; süt ürünleri bulunan ortamda paketlenmiştir (ambalajdaki “Alerjen Bilgisi”)',
      },
      {
        key: 'Katkı Maddesi',
        value:
          'Katkı maddesi, koruyucu, renklendirici, şeker, nişasta ve kimyasal içermez',
      },
      { key: 'Standart', value: 'Türk Gıda Kodeksi’ne uygun olarak üretilmiştir' },
      { key: 'Parti No.', value: '20212025 (ambalaj üzerindeki baskı)' },
      { key: 'TETT', value: '06/2026 (ambalaj üzerindeki baskı; partiye göre değişir)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-34-K-195953' },
      { key: 'Üretici', value: 'Beyorganik — Zehra Güzelocak' },
      {
        key: 'İşletme Adresi',
        value: 'Yıldırım Mah. Ali Fuat Başgil Cad. No: 141/A-B, Bayrampaşa / İSTANBUL (organik sertifika)',
      },
      {
        key: 'Menşe',
        value: 'Türkiye (ambalajda “Menşe: Türkiye”); Amazon açıklamasında yöre “Ege Bölgesi” olarak verilir',
      },
      {
        key: 'Organik Sertifika',
        value:
          'MET Ekolojik Kontrol ve Sertifikasyon Ltd. Şti. (TÜRKAK AB-0085-U, TS EN ISO/IEC 17065) — Sertifika No: TR-OT-42-MSİ-1590-2024-014; Müteşebbis Kodu: TR-OT-42-1590',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Değerler ambalajdaki 100 g sütunundan yazıldı; etikette enerji “Enerji(kcal/kJ) 385/1609” olarak basılmıştır.',
      },
      {
        key: 'İçindekiler Çelişkisi',
        value:
          'Amazon ürün açıklaması içindekileri “Organik buğday un, su, kaya tuzu” olarak verir; ambalajda yalnız “Organik durum buğdayı irmiği” yazar ve kayda ambalaj yazıldı.',
      },
      {
        key: 'Saklama (Amazon)',
        value:
          'Amazon açıklaması, koruyucu içermeyen organik ürünlerin serin/buzdolabı ortamında saklanmasını önerir; ambalaj “serin ve kuru yerde saklayınız” der.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 300 g paket' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 324,90 TL (300 g, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ürün gluten içerir; çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Süt ürünleri bulunan ortamda paketlenmiştir; süt alerjisi olanlar için çapraz bulaşma riski vardır.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage: 'Serin ve kuru yerde saklayınız.',
    usage: null,
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 324.9, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: null,
    additionalImages: [
      ...(certificateId
        ? [
            {
              image: certificateId,
              caption:
                'Organik tarım müteşebbis sertifikası (MET Ekolojik, TR-OT-42-MSİ-1590-2024-014)',
            },
          ]
        : []),
      { image: media.barcode, caption: 'Barkod 8680419375467' },
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
