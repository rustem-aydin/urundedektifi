import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Beyorganik Organik Pilavlık Bulgur 1 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0H41SB3TY + ürün ambalajı (EAN-13 8680419375399,
 * ambalajdaki dikey barkoddan okundu ve kontrol hanesi doğrulandı) + Amazon
 * galerisindeki organik tarım müteşebbis sertifikası görseli.
 *
 * Marka master'da yoktur; betik "Beyorganik" markasını bir kez oluşturur.
 * Amazon'un "İçindekiler" alanı "Zeytinyağı" yazar; ambalaj "Organik pilavlık
 * bulgur" der ve kayda ambalaj yazılır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-beyorganik-organik-pilavlik-bulgur-1kg-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-beyorganik-organik-pilavlik-bulgur-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8680419375399'
const ASIN = 'B0H41SB3TY'
const IMAGE_DIR = path.join(
  process.cwd(),
  '.seed-images',
  'beyorganik-organik-pilavlik-bulgur-1kg',
)

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Beyorganik Organik Pilavlık Bulgur 1 kg ön yüz; organik pilavlık bulgur, Mardin-Derik',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Beyorganik Organik Pilavlık Bulgur içindekiler ve etiket bilgileri: organik pilavlık bulgur, parti 003, TETT 07/2026, gluten içerir',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Beyorganik Organik Pilavlık Bulgur besin değerleri tablosu (100 g: 358 kcal / 1513 kJ)',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Beyorganik Organik Pilavlık Bulgur barkod numarası 8680419375399',
  },
  {
    key: 'certificate',
    file: 'certificate.jpg',
    alt: 'Beyorganik (Zehra Güzelocak) organik tarım müteşebbis sertifikası, MET Ekolojik, sertifika no TR-OT-42-MSİ-1590-2024-014',
  },
  {
    key: 'claims',
    file: 'claims.jpg',
    alt: 'Beyorganik organik bulgur tanıtım görseli: pestisit ve aflatoksin analizli, ağır metal içermez, BPA içermeyen ambalaj',
  },
] as const

const BRAND_NAME = 'Beyorganik'
const BRAND_SLUG = 'beyorganik'
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_BULGUR_ID = 1557 // Pilavlık bulgur
const ALLERGEN_GLUTEN_ID = 1 // Gluten

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

async function ensureBrand(client: PayloadClient): Promise<number> {
  const existing = await client.findOne('brands', { slug: { equals: BRAND_SLUG } })
  if (existing) return existing.id
  const created = await client.create('brands', {
    name: BRAND_NAME,
    slug: BRAND_SLUG,
    country: 'Türkiye',
    description:
      'Beyorganik (BEYORGANİK) — Mardin-Derik yöresinden organik bulgur üreten, MET Ekolojik sertifikalı Türk organik gıda markası.',
  })
  console.log(`  + marka: ${BRAND_NAME} (${created.id})`)
  return created.id
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

  const brandId = await ensureBrand(client)
  await assertIngredient(client, INGREDIENT_BULGUR_ID, 'Pilavlık bulgur')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Beyorganik Organik Pilavlık Bulgur 1 kg',
    description:
      "Beyorganik Organik Pilavlık Bulgur, Mardin-Derik yöresinden temin edilen organik buğdaydan üretilen 1 kg'lık pilavlık bulgurdur. Tek bileşen organik pilavlık bulgurdur; katkı maddesi ve koruyucu içermez, Türk Gıda Kodeksi'ne uygun olarak üretilir.\n\nMarka, ürünün her partisinin pestisit ve aflatoksin analizinden geçirildiğini, ağır metal içermediğini ve BPA içermeyen ambalaj kullanıldığını belirtir. 100 g'da 358 kcal, 5,8 g lif ve 12 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H41SB3TY), ürün ambalajı (EAN-13 8680419375399) ve MET Ekolojik organik tarım müteşebbis sertifikası.",
    brand: brandId,
    category: CATEGORY_ID,
    manufacturer: 'Beyorganik (Zehra Güzelocak)',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik poşet (BPA içermeyen ambalaj)',
    items: [{ ingredients: INGREDIENT_BULGUR_ID }],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 358, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1513, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.fat, amount: 4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 65, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 5.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['organic', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Beyorganik (BEYORGANİK)' },
      { key: 'Ürün Tipi', value: 'Organik pilavlık bulgur' },
      { key: 'Net Miktar', value: '1000 g (ambalajda “Net: 1000 g e”)' },
      { key: 'Menşe', value: 'Türkiye — Mardin, Derik yöresi' },
      { key: 'İçindekiler', value: 'Organik pilavlık bulgur (tek bileşen)' },
      {
        key: 'Alerjen Beyanı',
        value:
          'Gluten içerir; süt ürünleri bulunan ortamda paketlenmiştir (ambalajdaki “Alerjen Bilgisi”)',
      },
      { key: 'Katkı Maddesi', value: 'Katkı maddesi ve koruyucu içermez' },
      { key: 'Standart', value: 'Türk Gıda Kodeksi’ne uygun olarak üretilmiştir' },
      { key: 'Parti No.', value: '003 (ambalaj üzerindeki baskı)' },
      { key: 'TETT', value: '07/2026 (ambalaj üzerindeki baskı; partiye göre değişir)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-34-K-195953' },
      { key: 'Üretici', value: 'Beyorganik — Zehra Güzelocak' },
      {
        key: 'İşletme Adresi',
        value: 'Yıldırım Mah. Ali Fuat Başgil Cad. No: 141/A-B, Bayrampaşa / İSTANBUL',
      },
      {
        key: 'Depo Adresi',
        value:
          'Yıldırım Mah. Şht. Kâmil Balkan Cad. Hoca Gıda No: 142, Bayrampaşa / İSTANBUL',
      },
      {
        key: 'Organik Sertifika',
        value:
          'MET Ekolojik Kontrol ve Sertifikasyon Ltd. Şti. (TÜRKAK AB-0085-U, TS EN ISO/IEC 17065) — Sertifika No: TR-OT-42-MSİ-1590-2024-014; Müteşebbis Kodu: TR-OT-42-1590; sertifika 12.07.2024–12.07.2025 dönemi için düzenlenmiştir (Amazon galerisindeki sertifika görseli)',
      },
      {
        key: 'Analiz ve Ambalaj Beyanları',
        value:
          'Her üretim partisi pestisit ve aflatoksin analizinden geçirilir; ağır metal içermez; BPA içermeyen ambalaj (Amazon ürün açıklaması)',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Değerler ambalajdaki 100 g sütunundan yazıldı; etikette enerji “Enerji(kcal/kJ) 358/1513” olarak basılmıştır.',
      },
      {
        key: 'İçindekiler Çelişkisi',
        value:
          'Amazon ürün açıklamasının “İçindekiler” alanı “Zeytinyağı” yazar; ambalajda içindekiler “Organik pilavlık bulgur” olarak basılmıştır ve kayda ambalaj yazıldı.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value: '20 × 15 × 8 cm; 1 kg paket (Amazon ölçümü)',
      },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 412,90 TL (1000 g, 4 Kasım 2026)',
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
    prices: [{ amount: 412.9, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: null,
    additionalImages: [
      {
        image: media.certificate,
        caption: 'Organik tarım müteşebbis sertifikası (MET Ekolojik, TR-OT-42-MSİ-1590-2024-014)',
      },
      {
        image: media.claims,
        caption: 'Marka tanıtım görseli: pestisit/aflatoksin analizli, ağır metal içermez, BPA içermeyen ambalaj',
      },
      { image: media.barcode, caption: 'Barkod 8680419375399' },
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
