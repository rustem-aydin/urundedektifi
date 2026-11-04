import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Patlayan Mısır (Cin Mısır) 1 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B0DY1R6CJD + ürün ambalajı (EAN-13 8693374264981,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * 500 g'lık aynı seri ayrı EAN taşıdığı için (8693374236414, kayıt 15365) bu kayıt
 * ayrı üründür; iki kayıt barkodla ayrışır.
 *
 * Amazon listesi 4 Kasım 2026 itibarıyla stokta değildir ("Şu anda mevcut değil"),
 * bu yüzden prices boş bırakılır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-patlayan-misir-1kg-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-patlayan-misir-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374264981'
const ASIN = 'B0DY1R6CJD'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-patlayan-misir-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg ön yüz; patlamış mısır tenceresi, 1 kg',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg besin değerleri tablosu (pişmemiş 100 g: 1457 kJ / 348 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, helal',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg arka yüz: tarifler, pişirme önerisi, besin tablosu ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg barkod numarası 8693374264981',
  },
  {
    key: 'cooking',
    file: 'cooking.jpg',
    alt: 'Yayla Patlayan Mısır 1 kg pişirme önerisi ve tarif paneli',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_POPCORN_ID = 631 // Cin mısır

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
  magnesium: 40,
  phosphorus: 38,
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
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  await assertIngredient(client, INGREDIENT_POPCORN_ID, 'Cin mısır')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Patlayan Mısır (Cin Mısır) 1 kg',
    description:
      "Yayla Patlayan Mısır, tencerede patlatılan cin mısırının (patlatmalık mısır) 1 kg'lık ekonomik paketidir. Tek bileşen mısırdır; ambalajda ürün \"Mısır, 1. Sınıf\" olarak tanımlanır ve TS 3415 standardına uygunluğu belirtilir. Magnezyum ve fosfor kaynağıdır; 100 g pişmemiş üründe 12 g lif ve 9,9 g protein bulunur.\n\nPişirme: tencerede 2-3 yemek kaşığı sıvı yağ ile 1 çay bardağı mısır, rengi değişene kadar kavrulur; tuz eklenip tencerenin kapağı kapatılır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DY1R6CJD) ve ürün ambalajı (EAN-13 8693374264981).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Yayla Agro Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik paket (PP 5, geri dönüştürülebilir)',
    items: [{ ingredients: INGREDIENT_POPCORN_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1457, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 348, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 4.7, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 60.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 12, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 9.9, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 170, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 348, unit: 'mg' },
      ],
    },
    labels: ['halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Cin mısır (patlatmalık / patlayan mısır)' },
      { key: 'Net Miktar', value: '1 kg (ambalajda “1 kg e”)' },
      { key: 'Sınıf', value: '1. Sınıf' },
      { key: 'Standart', value: 'TS 3415' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Uygunluk', value: 'Türk Gıda Kodeksi’ne uygundur' },
      { key: 'Üretici', value: 'Yayla Agro Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kahramankazan / ANKARA',
      },
      { key: 'Telefon', value: '0 312 815 49 50 (pbx)' },
      { key: 'Faks', value: '0 312 815 47 90' },
      {
        key: 'İşletme Kayıt Numarası',
        value: 'TR-06-K-000171 (Ankara), TR-33-K-001608 (Mersin); üretim yeri kısaltması ambalaj üzerine kodlanmıştır',
      },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web / Sosyal', value: 'www.yaylabakliyat.com.tr, yaylabakliyat (Instagram, X, Facebook, YouTube)' },
      {
        key: 'TETT, Parti No. ve Üretim Yılı',
        value: 'Ambalajın üzerindedir (TETT, PN, ÜY)',
      },
      {
        key: 'Pişirme Önerisi',
        value:
          'Tencerede 2-3 yemek kaşığı sıvı yağ ve 1 çay bardağı Yayla Patlayan Mısır rengi değişene kadar kavrulur, bir miktar tuz eklenip tencerenin kapağı kapatılır; mısırların çıtır çıtır patlaması için yağla birlikte mısırları tencerede atıp biraz kavurmak gerekir',
      },
      {
        key: 'Beyanlar',
        value: 'Magnezyum ve fosfor kaynağı; doğal lif, mineral ve protein kaynağı; GDO içermez (Amazon ürün detayı)',
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Ambalajda içindekiler listesi yoktur; ürün “Mısır, 1. Sınıf” olarak tanımlanır ve tek bileşendir. Amazon’un içindekiler alanı anlamsız metin içerir (“Yayla Bakliyat Yayla Cin Misir 1000 1”)',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen beyanı yoktur' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5 geri dönüşüm, geri dönüşüm oku, ® damla-ok, helal',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Değerler ambalajdaki 100 g pişmemiş (patlatılmamış) mısır içindir; patlatıldıktan sonra değerler değişir. Tuz “<0,1 g” olarak basılmıştır ve “en fazla” birimiyle korundu; %RA değerleri ortalama yetişkin referans alımına (8400 kJ/2000 kcal) göredir.',
      },
      {
        key: 'Saklama Beyanı',
        value:
          'TETT, parti no ve üretim yılı ambalajın üzerindedir; rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklanır',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value: '21,2 × 17 × 4,5 cm; paket ağırlığı 1,05 kg (Amazon ölçümü)',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr listesi 4 Kasım 2026 itibarıyla stokta değil (“Şu anda mevcut değil”), satış fiyatı yok; kayda fiyat yazılmadı',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Tahıl, hububat ve pirinçler tarımsal kökenli ürünlerdir; tüketmeden önce gözle kontrol edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Lütfen rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Tencerede 2-3 yemek kaşığı sıvı yağ ve 1 çay bardağı Yayla Patlayan Mısır atıp rengi değişene kadar kavurun, bir miktar tuz ekleyip tencerenin kapağını kapatın. Mısırların çıtır çıtır patlaması için yağla birlikte mısırları tencerede atıp biraz kavurmayı unutmayın.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
    frontImage: media.front,
    ingredientsImage: null,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: tarifler, pişirme önerisi, besin tablosu ve üretici bilgileri',
      },
      { image: media.barcode, caption: 'Barkod 8693374264981' },
      { image: media.cooking, caption: 'Pişirme önerisi ve tarif paneli' },
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
