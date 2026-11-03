import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Karabuğday Patlağı Silindir 87 g ürününü UZAK Payload REST API'sine yazar:
 * master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0H5D3117B + ürün ambalajı (EAN-13 8693374282909).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-karabugday-patlagi-87g-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-yayla-karabugday-patlagi-87g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374282909'
const ASIN = 'B0H5D3117B'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-karabugday-patlagi-87g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Karabuğday Patlağı Silindir 87 g ön yüz',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Karabuğday Patlağı 87 g içindekiler (%100 karabuğday) ve susam alerjen uyarısı',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Karabuğday Patlağı 87 g besin değerleri tablosu (100 g ve 30 g porsiyon)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Karabuğday Patlağı 87 g ambalaj sembolleri (PP 5 geri dönüşüm, gıda ile temasa uygun, helal)',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Karabuğday Patlağı 87 g arka yüz: içindekiler, besin değerleri, üretici ve barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Karabuğday Patlağı 87 g barkod numarası 8693374282909',
  },
] as const

/** Etiketten okunan içindekiler: tek madde — %100 karabuğday. */
const INGREDIENTS = [{ id: 610, name: 'karabuğday', percent: 100 }] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 14 // Atıştırmalık & Tatlı › Cips & Atıştırmalık
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  transFat: 52,
  carbohydrate: 7,
  sugars: 8,
  fiber: 18,
  protein: 19,
  salt: 20,
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
    name: 'Yayla Karabuğday Patlağı 87 g',
    description:
      "Yayla Karabuğday Patlağı, %100 karabuğdaydan fırınlanarak üretilen patlak (patlamış tahıl) atıştırmalıktır. 87 g'lık silindir ambalajda sunulur; ambalajın ön yüzünde bir adet patlağın yaklaşık 27 kcal olduğu belirtilir.\n\nEtikette ürünün glütensiz, vegan, katkı maddesi ve koruyucu içermediği, trans yağ içermediği, ilave şeker ve tuz içermediği ve lif kaynağı olduğu beyan edilir. Sade hâliyle tüketilebildiği gibi labne, bal, fıstık ezmesi, taze meyve veya sebze ile birlikte de yenebilir. Eser miktarda susam içerebilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0H5D3117B) ve ürün ambalajı.",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '87 g',
    packaging: 'Silindir plastik kap (PP 5)',
    items: INGREDIENTS.map((entry) => ({
      ingredients: entry.id,
      percent_estimate: entry.percent,
    })),
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1569, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 375, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 72, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 4.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 13, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: ['gluten-free', 'vegan', 'no-additives', 'halal-certified'] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Karabuğday patlağı (fırınlanmış tahıl atıştırmalığı)' },
      { key: 'Çeşni', value: 'Sade' },
      { key: 'Boy', value: 'Silindir' },
      { key: 'Net Miktar', value: '87 g' },
      {
        key: 'Porsiyon',
        value: '1 porsiyon 30 g (besin tablosu); 1 adet patlak yaklaşık 7 g ≈ 27 kcal',
      },
      { key: 'Ambalaj', value: 'Silindir plastik kap (PP 5)' },
      {
        key: 'Menşei',
        value:
          'Yerli ve ithal hammadde kullanılarak Türkiye’de üretilmiştir (ambalaj beyanı)',
      },
      { key: 'Üretici', value: 'Yayla Agro Gıda San. ve Tic. A.Ş.' },
      { key: 'Üretici Adresi', value: 'Niğde OSB 12. Cad. No.:1 Merkez / Niğde' },
      { key: 'İşletme Kayıt No', value: 'TR-51-K-006543' },
      { key: 'Tüketici Hattı', value: '444 4 330' },
      { key: 'Web', value: 'yaylaagro.com' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Kategorisi', value: 'Gıda Ürünleri › Baklagiller ve Makarnalar › Kuru Bakliyatlar' },
      {
        key: 'Amazon Ölçümler',
        value: 'Paket ağırlığı 0,08 kg; paket biçimi silindir; boyut 87 g (Amazon.com.tr ürün detayı)',
      },
      {
        key: 'Besin Beyanları',
        value:
          'Glütensiz, vegan, katkı maddesi içermez, koruyucu içermez, trans yağ içermez, ilave şeker ve tuz içermez, lif kaynağı',
      },
      { key: 'Alerjen Beyanı', value: 'Eser miktarda susam içerebilir' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5 geri dönüşüm, gıda ile temasa uygun (çatal-bardak), güneşten ve nemden koruyun, çöpe atınız, helal',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — listeleme 3 Kasım 2026 itibarıyla “Şu anda mevcut değil”, fiyat yok',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Eser miktarda susam içerebilir. Susam alerjisi olan kişiler tüketmeden önce etiketi kontrol etmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.',
      },
      {
        severity: 'low' as const,
        text: 'Ürün, TETT (tavsiye edilen tüketim tarihi) geçmeden tüketilmelidir.',
      },
    ],
    storage:
      'Doğrudan güneş ışığına maruz bırakmayınız. Serin ve rutubetsiz yerde muhafaza ediniz.',
    usage:
      'Sade haliyle hafif; labne, bal, fıstık ezmesi, taze meyveler veya sebzeler ile lezzetlendirilebilirsin.',
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
