import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Beyorganik Organik Köftelik Bulgur 2,5 kg ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0CQC34NJQ + ürün ambalajı (EAN-13 8682125484662)
 * ve ambalajdaki organik tarım sertifikası.
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-beyorganik-organik-koftelik-bulgur-2-5kg-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-beyorganik-organik-koftelik-bulgur-2-5kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8682125484662'
const ASIN = 'B0CQC34NJQ'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'beyorganik-organik-koftelik-bulgur-2-5kg',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg etiket bilgileri: içindekiler, parti no, TETT, alerjen ve net miktar',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg besin değerleri tablosu (100 g)',
  },
  {
    key: 'certificate',
    file: 'certificate.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg organik tarım müteşebbis sertifikası (MET Ekolojik, TR-OT-42-MSİ-1590-2023-029)',
  },
  {
    key: 'labelVariant',
    file: 'label-variant.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg ikinci etiket baskısı (Parti No 147, BPA içermez logosu)',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Beyorganik Organik Köftelik Bulgur 2,5 kg barkod numarası 8682125484662',
  },
] as const

/** Etiketten okunan içindekiler: tek bileşen — organik köftelik bulgur. */
const INGREDIENTS = [{ id: 1504, name: 'Bulgur' }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 5577 // Beyorganik
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1 // Gluten

const NUTRIENT_IDS = {
  energyKcal: 2,
  fat: 4,
  carbohydrate: 7,
  protein: 19,
} as const

function assertEan13(code: string): void {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 13 hane olmalı: ${code}`)
  const digits = code.split('').map(Number)
  const sum = digits
    .slice(0, 12)
    .reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0)
  const expected = (10 - (sum % 10)) % 10
  if (expected !== digits[12]) {
    throw new Error(`EAN-13 kontrol hanesi hatalı: ${code} (beklenen ${expected})`)
  }
}

async function assertIngredient(client: PayloadClient, id: number, name: string) {
  const doc = await client.find('ingredients', { where: { id: { equals: id } }, limit: 1 })
  const found = doc.docs[0]
  if (!found) throw new Error(`İçindekiler kaydı yok: ${id}`)
  if (String(found.name).toLocaleLowerCase('tr') !== name.toLocaleLowerCase('tr')) {
    throw new Error(`İçindekiler adı uyuşmuyor: ${id} → ${String(found.name)} ≠ ${name}`)
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
  assertEan13(BARCODE)

  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })
  await client.login()
  console.log(`API: ${API}`)

  for (const entry of INGREDIENTS) await assertIngredient(client, entry.id, entry.name)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Beyorganik Organik Köftelik Bulgur 2,5 kg',
    description:
      "Beyorganik Organik Köftelik Bulgur, Mardin-Derik yöresinden organik olarak üretilen ince (köftelik) bulgurun 2,5 kg'lık kilitli ambalajda sunulduğu tek bileşenli tahıldır. Ambalajda organik tarım müteşebbis sertifikası basılıdır (MET Ekolojik, sertifika no TR-OT-42-MSİ-1590-2023-029, müteşebbis kodu TR-OT-42-1590).\n\nEtikette ürünün katkı maddesi ve koruyucu içermediği, BPA içermeyen ambalajda sunulduğu belirtilir; gluten içerir ve süt ürünleri bulunan ortamda paketlenmiştir. 100 g'da 354 kcal enerji, 1,39 g yağ, 78,2 g karbonhidrat ve 10,44 g protein içerir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0CQC34NJQ) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Beyorganik (Zehra Güzelocak)',
    country: COUNTRY_ID,
    size: '2,5 kg',
    packaging: 'Kilitli plastik poşet (BPA içermeyen ambalaj)',
    items: INGREDIENTS.map((entry) => ({ ingredients: entry.id })),
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 354, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.39, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 78.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 10.44, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives', 'bpa-free'] as string[],
    specifications: [
      { key: 'Marka', value: 'Beyorganik' },
      { key: 'Ürün Tipi', value: 'Organik köftelik (ince) bulgur' },
      { key: 'Net Miktar', value: '2,5 kg (ambalajda “Net: 2,5 kg e”)' },
      { key: 'Menşe', value: 'Türkiye — Mardin, Derik yöresi' },
      { key: 'İçindekiler', value: 'Organik köftelik bulgur (tek bileşen)' },
      {
        key: 'Alerjen Beyanı',
        value: 'Gluten içerir; süt ürünleri bulunan ortamda paketlenmiştir',
      },
      { key: 'Katkı Maddesi', value: 'Katkı maddesi ve koruyucu içermez' },
      { key: 'Ambalaj Beyanı', value: 'BPA içermeyen kilitli ambalaj' },
      { key: 'Standart', value: 'Türk Gıda Kodeksi’ne uygun olarak üretilmiştir' },
      { key: 'Parti No.', value: '17252025 (ambalaj üzerindeki baskı)' },
      { key: 'TETT', value: '07/2026 (ambalaj üzerindeki baskı; partiye göre değişir)' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-195953' },
      { key: 'Üretici', value: 'Beyorganik — Zehra Güzelocak' },
      {
        key: 'İşletme Adresi',
        value: 'Yıldırım Mah. Ali Fuat Başgil Cad. No: 141/A-B, Bayrampaşa / İstanbul',
      },
      {
        key: 'Depo Adresi',
        value: 'Yıldırım Mah. Şht. Kâmil Balkan Cad. Hoca Gıda No: 142, Bayrampaşa / İstanbul',
      },
      {
        key: 'Organik Sertifika',
        value:
          'MET Ekolojik Kontrol ve Sertifikasyon Ltd. Şti. — Organik Tarım Müteşebbis Sertifikası, Sertifika No: TR-OT-42-MSİ-1590-2023-029, Müteşebbis Kodu: TR-OT-42-1590',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette tek enerji satırı “Enerji/kcal(kJ) 354” olarak basılmıştır; değer 100 g için 354 kcal kabul edildi, kJ karşılığı basılı değildir',
      },
      {
        key: 'Etiket Varyantı',
        value:
          'Aynı ürünün ikinci baskısında Parti No 147 ve “Son Kullanma Tarihi 18/02/2025” basılıdır; besin değerleri ve içindekiler aynıdır',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 2,5 kg paket (Amazon.com.tr listesi)' },
      {
        key: 'Amazon Ölçümler',
        value: 'Paket ağırlığı 2.996,08 g; ürün sayısı 1 (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Amazon Öne Çıkanlar',
        value:
          'Yerli tohum, organik üretim, BPA içermez ambalaj, kilitli ambalaj, koruyucu ve katkı maddesi içermez',
      },
      { key: 'Fiyat Kaynağı', value: 'Amazon.com.tr — 612,90 TL (2,5 kg, 4 Kasım 2026)' },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ürün gluten içerir; çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'medium' as const,
        text: 'Süt ürünleri bulunan ortamda paketlenmiştir; süt alerjisi olanlar için çapraz bulaşma riski vardır.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage: 'Serin ve kuru yerde saklayınız.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 612.9, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    additionalImages: [
      { image: media.certificate, caption: 'Organik tarım sertifikası' },
      { image: media.labelVariant, caption: 'İkinci etiket baskısı' },
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
