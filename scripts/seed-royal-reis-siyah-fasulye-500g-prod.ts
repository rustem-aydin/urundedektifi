/**
 * Reis Royal Siyah Fasulye 500 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08QKPZY72 + ürün ambalajı (EAN-13 8690849242147).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-royal-reis-siyah-fasulye-500g-prod.ts
 */

import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN?.trim() ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN veya SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690849242147'
const ASIN = 'B08QKPZY72'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'royal-reis-siyah-fasulye-500g')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g ön yüz',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g besin değerleri tablosu (pişmemiş 100 g)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g ambalaj ve geri dönüşüm sembolleri (ÇEVKO, doğa dostu ambalaj)',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g arka yüz: besin değerleri, kullanım, tarif, üretici bilgileri ve barkod',
  },
  {
    key: 'recipe',
    file: 'out-recipe.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g arka yüz tarif paneli: Siyah Fasulye Salatası',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Reis Royal Siyah Fasulye 500 g barkod numarası 8690849242147',
  },
] as const

/** Etiket tek içindekili: siyah fasulye (ambalajda ayrı içindekiler listesi basılı değil). */
const INGREDIENT_NAME = 'Siyah fasulye'
const INGREDIENT_SLUG = 'siyah-fasulye'
const INGREDIENT_ALIASES = ['Black beans', 'Black turtle beans'] as const

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 803 // Reis
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

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

/** EAN-13 sağlama hanesi (tek haneler + 3 × çift haneler; kontrol hanesi toplama katılmaz). */
function assertEan13(barcode: string): void {
  if (!/^\d{13}$/.test(barcode)) throw new Error(`EAN-13 13 hane olmalı: ${barcode}`)
  let sum = 0
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(barcode[index])
    sum += index % 2 === 0 ? digit : digit * 3
  }
  const check = (10 - (sum % 10)) % 10
  if (check !== Number(barcode[12])) {
    throw new Error(`EAN-13 sağlama hanesi hatalı: ${barcode} (beklenen ${check})`)
  }
}

/** İçindekiler master kaydını adına göre bulur; yoksa oluşturur (idempotent). */
async function ensureIngredient(client: PayloadClient): Promise<number> {
  const found = (await client.find('ingredients', {
    where: { name: { equals: INGREDIENT_NAME } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number }> }
  if (found.docs[0]) return found.docs[0].id

  const created = await client.create('ingredients', {
    name: INGREDIENT_NAME,
    slug: INGREDIENT_SLUG,
    aliases: INGREDIENT_ALIASES.map((alias) => ({ alias })),
  })
  console.log(`  + içindekiler: ${INGREDIENT_NAME} (${created.id})`)
  return created.id
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
    ...(TOKEN ? { token: TOKEN } : {}),
  })
  await client.login()
  console.log(`API: ${API}`)

  const ingredientId = await ensureIngredient(client)
  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Reis Royal Siyah Fasulye 500 g',
    description:
      "Reis Royal Siyah Fasulye, Türkiye'de yetiştirilen siyah fasulyenin (black turtle bean) ayıklanmış, tekli 500 g'lık paketidir. Tek bileşenden oluşur; tuz, katkı maddesi ve koruyucu içermez.\n\nPişirme yöntemi kuru fasulye ile aynıdır; genelde salatalarda kullanılır, yemeklerin yanında tamamlayıcı olarak da servis edilir. Ambalajda glutensiz, yüksek protein, yüksek lif, güçlü antioksidan ve düşük glisemik indeks beyanları ile Siyah Fasulye Salatası tarifi yer alır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08QKPZY72) ve ürün ambalajı (EAN-13 8690849242147).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'REİS TARIMSAL ÜRÜNLER SANAYİ VE TİCARET A.Ş.',
    size: '500 g',
    packaging: 'Plastik laminat poşet, şeffaf taneli pencere',
    items: [{ ingredients: ingredientId }],
    additives: [] as number[],
    /* Etiket: "ENERJİ VE BESİN ÖĞELERİ (100 g'da) / AVERAGE NUTRITION VALUES (UNCOOKED PER 3,5 OZ)". */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1137, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 272, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 24.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 35.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 21.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
      ],
    },
    labels: ['gluten-free'],
    specifications: [
      { key: 'Marka', value: 'Reis (Royal serisi)' },
      { key: 'Ürün Tipi', value: 'Kuru siyah fasulye (kuru baklagil)' },
      { key: 'Çeşit', value: 'Siyah fasulye / black turtle bean' },
      { key: 'Net Miktar', value: '500 g (17,6 oz)' },
      { key: 'Ambalaj', value: 'Plastik laminat poşet, şeffaf taneli pencere' },
      { key: 'Menşe Ülke', value: 'Türkiye' },
      { key: 'Üretici', value: 'REİS TARIMSAL ÜRÜNLER SANAYİ VE TİCARET A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Çakmaklı Mevkii, Akçaburgaz Mahallesi 3051. Sokak No: 7, 34522 Esenyurt / İstanbul',
      },
      { key: 'Telefon', value: '(0212) 671 97 00 (PBX)' },
      { key: 'Faks', value: '(0212) 671 97 01' },
      { key: 'Tüketici Danışma Hattı', value: '0212 671 97 10' },
      { key: 'E-posta', value: 'reis@reisgida.com.tr' },
      { key: 'Web', value: 'www.reisgida.com.tr — tarifler: www.reisroyallezzetler.com' },
      { key: 'İşletme Kayıt No', value: 'TR-34-K-048577' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Ölçüleri (Amazon)', value: '23,4 × 14,3 × 4,7 cm' },
      { key: 'Ürün Ağırlığı (Amazon)', value: '510 g' },
      { key: 'Porsiyon', value: '1 porsiyon 50 g (etiket besin paneli); tarifte 1 porsiyon 60 g' },
      { key: 'Besin Değerleri Bazı', value: '100 g pişmemiş (çiğ) ürün' },
      {
        key: 'Besin Tablosu Notu',
        value:
          "Ambalajdaki tablo kendi içinde tutarsız: diyet lif 35,1 g, toplam karbonhidrat 24,6 g olarak basılmış (lif karbonhidratın alt bileşenidir, toplamdan büyük olamaz) ve enerji kontrolü tutmuyor (24,6×4 + 21,8×4 + 1,8×9 ≈ 202 kcal; basılı değer 272 kcal). Değerler düzeltilmeden, basıldığı gibi kaydedildi; tuz «<0,1 g» olarak beyan edilmiştir.",
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Ambalajda ayrı içindekiler listesi basılı değil (tek bileşenli ürün); ürün siyah fasulyedir',
      },
      {
        key: 'Sertifika ve Uygunluk',
        value:
          'REIS IS CERTIFIED ISO 9001; «Belirli yörelerden seçilen ürünler Reis güvencesiyle, kalite yönetim sistemlerine uygun olarak paketlenmektedir» beyanı',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'ÇEVKO (Yeşil Nokta), doğa dostu ambalaj (Möbius), çevremizi koruyalım (Tidyman), kuru tut (şemsiye), güneş ışığından koru, gıda ile temasa uygun (çatal-bardak), tüketici danışma hattı, QR (tarif)',
      },
      {
        key: 'Pişirme Önerisi',
        value:
          'Siyah fasulye pişirme yöntemi kuru fasulye ile aynıdır; genelde salatalara eklenir, yemeklerin yanında tamamlayıcı olarak kullanılır',
      },
      {
        key: 'Etiket Beyanları',
        value: 'Glutensiz; yüksek protein; yüksek lif; güçlü antioksidan; düşük glisemik indeks',
      },
      { key: 'Amazon Satış Biçimi', value: "Tekli 0,5 kg (500 g)" },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 116,09 TL / 0,5 kg (4 Kasım 2026). Amazon’un gösterdiği kg fiyatı (23,22 TL) 0,5 kg paketle uyuşmuyor; hesaplanan birim fiyat 232,18 TL/kg.',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Çiğ tüketilmez; kuru fasulye gibi haşlanarak tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj hasarlıysa ürünü satın almayınız; TETT (tavsiye edilen tüketim tarihi) geçmeden tüketiniz.',
      },
      {
        severity: 'medium' as const,
        text: 'Ambalajdaki besin tablosu kendi içinde çelişkili: diyet lif (35,1 g) toplam karbonhidrattan (24,6 g) yüksek basılmış, enerji değeri makro besinlerle uyuşmuyor. Tablo değerlerine temkinli yaklaşın.',
      },
    ],
    storage:
      'Serin ve rutubetsiz yerde, güneş ışığından koruyarak saklayınız. Kullanmadan önce gözden geçiriniz.',
    usage:
      'Pişirme: siyah fasulyenin pişirme yöntemi kuru fasulye ile aynıdır. Etiketteki Siyah Fasulye Salatası tarifi — Malzemeler: 2 su bardağı siyah fasulye, 1 adet küçük boy kırmızı soğan, 2 adet kırmızı közlenmiş biber, yeşil soğan, taze maydanoz; sos için 1 adet limon suyu, 1 yemek kaşığı nar ekşisi, zeytinyağı. Yapılışı: Siyah fasulyelere üzerini geçecek kadar su ekleyin, yumuşayıncaya kadar haşlayıp süzünüz. Kırmızı soğanı, kırmızı közlenmiş biberleri, maydanoz ve taze soğanı da doğrayınız. Tüm salata malzemelerini bir kapta birleştiriniz, üzerine tuz, limon suyu, nar ekşisi ve zeytinyağı ekleyiniz, harmanlayarak servis ediniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 116.09, date: '2026-11-04' }],
    frontImage: media.front,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption:
          'Arka yüz: besin değerleri, «Neden siyah fasulye?» beyanları, tarif, üretici bilgileri ve barkod',
      },
      {
        image: media.recipe,
        caption: 'Tarif paneli: Siyah Fasulye Salatası (1 porsiyon 60 g)',
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
