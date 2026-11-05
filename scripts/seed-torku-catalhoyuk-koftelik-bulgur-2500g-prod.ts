import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Torku Çatalhöyük Köftelik Bulgur 2500 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08TY3DCKM + ürün ambalajı (arka yüz görselinden
 * okunan EAN-13 8690120072432, kontrol hanesi doğrulandı).
 *
 * Kayıt OFF import'undan geliyor (id 16459, yalnız ön görsel + boş alanlar);
 * bu betik aynı barkodu günceller, yeni kayıt açmaz.
 *
 * Amazon listesi "Şu anda mevcut değil" der; fiyat yazılmaz, durum specifications'a işlenir.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-torku-catalhoyuk-koftelik-bulgur-2500g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690120072432'
const ASIN = 'B08TY3DCKM'
const SLUG = 'torku-catalhoyuk-koftelik-bulgur-2500g'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', SLUG)

const IMAGES = [
  {
    key: 'front',
    file: `${SLUG}-front.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur 2500 g ön yüz; çiğ köftelik / kısırlık ince bulgur paketi',
  },
  {
    key: 'ingredients',
    file: `${SLUG}-ingredients.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur içindekiler yakın çekim: Köftelik (Çiğ Köftelik - Kısırlık) Bulgur, gluten içerir, durum buğdayından taş değirmende üretilmiştir',
  },
  {
    key: 'nutrition',
    file: `${SLUG}-nutrition.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur besin değerleri tablosu (100 g: 1584 kJ / 379 kcal; 60 g porsiyon)',
  },
  {
    key: 'recycling',
    file: `${SLUG}-recycling.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur ambalaj sembolleri: TÜRK MALI, 2149 PP geri dönüşüm, cam/çatal, HELAL, TSE',
  },
  {
    key: 'back',
    file: `${SLUG}-back.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur 2500 g arka yüz: içindekiler, besin değerleri, üretici, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: `${SLUG}-barcode.jpg`,
    alt: 'Torku Çatalhöyük Köftelik Bulgur barkod numarası 8690120072432',
  },
] as const

const BRAND_ID = 27 // Torku
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_BULGUR_FOR_MEATBALLS_ID = 4235 // Bulgur for meatballs (köftelik bulgur)
const ALLERGEN_GLUTEN_ID = 1 // Gluten

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

async function main(): Promise<void> {
  assertEan13(BARCODE)

  const client = createPayloadClient({
    api: API,
    email: EMAIL,
    password: PASSWORD,
    token: TOKEN || undefined,
  })
  await client.login()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${client.getToken()}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  await assertIngredient(client, INGREDIENT_BULGUR_FOR_MEATBALLS_ID, 'Bulgur for meatballs')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Torku Çatalhöyük Köftelik Bulgur 2500 g',
    description:
      "Torku Çatalhöyük Köftelik Bulgur, durum buğdayından taş değirmende sadece su ve buğday kullanılarak üretilen ince (köftelik) bulgurdur. Çiğ köfte ve kısır yapımında kullanılır; pilavlık bulgura göre daha ince öğütülmüştür.\n\nAmbalajda yüksek lif oranı (%6,3) ve doğal rengini az soyulmuş kabuğundan aldığı belirtilir. Gluten içerir; durum buğdayına duyarlı kişiler tüketmemelidir. 100 g'da 379 kcal enerji, 74 g karbonhidrat ve 11 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08TY3DCKM) ve ürün ambalajı (EAN-13 8690120072432).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Konya Şeker Sanayi ve Ticaret A.Ş. — Karapınar Bulgur Üretim Tesisi',
    country: COUNTRY_ID,
    size: '2500 g',
    packaging: 'Torba',
    items: [{ ingredients: INGREDIENT_BULGUR_FOR_MEATBALLS_ID }],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1584, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 379, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 74, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 2.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 6.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 11, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Torku' },
      { key: 'Seri', value: 'Çatalhöyük' },
      { key: 'Ürün Tipi', value: 'Köftelik (çiğ köftelik - kısırlık) bulgur' },
      { key: 'Hammadde', value: 'Durum buğdayı' },
      { key: 'Öğütme', value: "İnce (köftelik); taş değirmende sadece su ve buğday kullanılarak üretilir" },
      { key: 'Net Miktar', value: '2500 g (88,3 oz)' },
      { key: 'Porsiyon', value: '60 g (ambalaj üzerindeki besin tablosuna göre)' },
      { key: 'Ambalaj', value: 'Torba' },
      { key: 'Üretim Yeri', value: 'Türkiye — Karapınar, Konya' },
      {
        key: 'Üretici',
        value: 'Konya Şeker Sanayi ve Ticaret A.Ş. Karapınar Bulgur Üretim Tesisi Şubesi',
      },
      {
        key: 'Üretici Adresi',
        value: 'İpekçi Mah. 130913 Sk. No:7A Daire:1 Merkez Karapınar / Konya, Türkiye',
      },
      { key: 'İşletme Kayıt No', value: 'TR-42-K-020100' },
      { key: 'Mamül / Malzeme Kodu', value: '407814 / 207802' },
      { key: 'Web', value: 'www.torku.com.tr' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri', value: '25,4 × 20,1 × 9,14 cm (Amazon ölçümleri)' },
      {
        key: 'Ambalaj Sembolleri',
        value: 'TÜRK MALI, 2149 PP geri dönüşüm, cam/çatal, HELAL, TSE, TS 2284 Tip 5',
      },
      { key: 'Lif Beyanı', value: 'Yüksek lif oranı (%6,3)' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 5 Kasım 2026 itibarıyla "Şu anda mevcut değil"; fiyat yazılmadı',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Gluten içerir (durum buğdayı). Çölyak hastalığı veya gluten duyarlılığı olan kişiler tüketmemelidir.',
      },
      { severity: 'low' as const, text: 'Ambalajı delinmiş veya açılmış ürünü satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'Tavsiye edilen tüketim tarihinden önce tüketilmesi önerilir; ÜRT, TETT ve lot numarası ambalaj üzerindedir.',
      },
    ],
    storage:
      'Serin, rutubetsiz ve kokusuz yerde muhafaza edin. Doğrudan güneş ışığı alan ortamlardan uzak tutun.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
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
