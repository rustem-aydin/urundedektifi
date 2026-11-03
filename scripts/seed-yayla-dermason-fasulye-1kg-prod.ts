/**
 * Yayla Dermason Fasulye 1 kg ürününü UZAK Payload REST API'sine yazar:
 * mevcut OFF kaydını (barkod 8693374111988) etiket verisi ve fotoğraflarla günceller.
 *
 * Kaynak: Amazon.com.tr ASIN B07STNP1R4 + ürün ambalajı (EAN-13 8693374111988).
 * Idempotent: barkoda göre upsert eder, görselleri alt metinlerinden bulur.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') \
 *     node --import tsx/esm scripts/seed-yayla-dermason-fasulye-1kg-prod.ts
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

const BARCODE = '8693374111988'
const GTIN = '8693374111988'
const ASIN = 'B07STNP1R4'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-dermason-fasulye-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'out-front.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg ön yüz',
  },
  {
    key: 'ingredients',
    file: 'out-ingredients.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg ürün içeriği, üretici ve işletme kayıt bilgileri',
  },
  {
    key: 'nutrition',
    file: 'out-nutrition.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg besin değerleri tablosu (50 g kuru porsiyon)',
  },
  {
    key: 'recycling',
    file: 'out-recycling.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg geri dönüşüm ve ambalaj sembolleri (PP 5, 2502)',
  },
  {
    key: 'back',
    file: 'out-back.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg arka yüz: besin değerleri, içerik, tarif, saklama ve barkod',
  },
  {
    key: 'barcode',
    file: 'out-barcode.jpg',
    alt: 'Yayla Dermason Fasulye 1 kg barkod numarası 8693374111988',
  },
] as const

/** Etiketten okunan içerik: tek yaprak madde (Dermason çeşidi kuru fasulye). */
const INGREDIENT_NAME = 'Kuru fasulye'

/** Master kimlikleri (prod'da doğrulandı). */
const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_ID = 2519 // Kuru fasulye

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
  potassium: 35,
  phosphorus: 38,
} as const

/** EAN-13 sağlama hanesi (tek haneler + 3 × çift haneler). */
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

async function assertIngredient(client: PayloadClient, id: number, expected: string): Promise<void> {
  const doc = (await client.find('ingredients', {
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
  })) as unknown as { docs: Array<{ id: number; name: string }> }
  const name = doc.docs[0]?.name
  if (name !== expected) {
    throw new Error(`İçindekiler ${id} beklenen "${expected}" değil: ${String(name)}`)
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
    ...(TOKEN ? { token: TOKEN } : {}),
  })
  await client.login()
  console.log(`API: ${API}`)

  await assertIngredient(client, INGREDIENT_ID, INGREDIENT_NAME)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Dermason Fasulye 1 kg',
    description:
      'Yayla Dermason Fasulye, Türk mutfağının klasik kuru fasulye yemeği ve piyazında kullanılan 1 kg\'lık dermason çeşidi kuru fasulye paketidir. Fasulyeler 1. sınıf B (küçük) boy olarak elenip ambalajlanır; pişirmeden önce 10-12 saat soğuk suda ıslatılması önerilir.\n\nAmbalajda ürünün potasyum ve protein içeriğinin yüksek, lif içeriğinin çok yüksek olduğu ve düşük şekerli olduğu belirtilir; ürün %100 yerli üretimdir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B07STNP1R4) ve ürün ambalajı (EAN-13 8693374111988).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    country: COUNTRY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    size: '1 kg',
    packaging: 'Plastik paket (PP 5)',
    items: [{ ingredients: INGREDIENT_ID }],
    allergens: null,
    additives: [] as number[],
    /*
     * Etiket 50 g kuru porsiyon için verir (paket ≈ 20 porsiyon); 100 g değerleri
     * iki katıdır. kJ etikette yazmaz, kcal'den 4,184 ile çevrilmiştir.
     */
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1180, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 282, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 29.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 32.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 21.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 927, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 367, unit: 'mg' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Kuru fasulye (kuru baklagil)' },
      { key: 'Çeşit', value: 'Dermason, 1. sınıf B (küçük) boy' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Porsiyon', value: '50 g kuru (paket başına yaklaşık 20 porsiyon)' },
      { key: 'Ambalaj', value: 'Plastik paket (PP 5)' },
      { key: 'Üretim Yeri', value: 'Türkiye (%100 yerli)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, 06980 Kazan / Ankara',
      },
      { key: 'Tüketici Danışma Hattı', value: '444 43 30' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-06-K-000171' },
      { key: 'Uygunluk Beyanı', value: "Türk Gıda Kodeksi'ne uygundur" },
      { key: 'EAN-13', value: GTIN },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Üretici Referansı', value: '20000001022301' },
      { key: 'Paket Ölçüleri', value: '22,04 × 18,05 × 5,08 cm' },
      { key: 'Brüt Ağırlık', value: '1,08 kg' },
      {
        key: 'Etiket Beyanları',
        value:
          'Potasyum içeriği yüksektir; zengin protein içerir; lif içeriği çok yüksektir; düşük şeker içerir',
      },
      {
        key: 'Etiket Sembolleri',
        value:
          'PP 5 (polipropilen), 2502, gıda ile temasa uygunluk (çatal-bardak), çöp adam, güneşten koruyunuz, kuru tutunuz',
      },
      {
        key: 'Besin Tablosu',
        value:
          "Etiket değerleri 50 g kuru porsiyon içindir (141 kcal, 16,1 g lif); 100 g değerleri iki katı olarak hesaplanmıştır. kJ etikette belirtilmemiştir, kcal'den çevrilmiştir.",
      },
      { key: 'Alerjen Beyanı', value: 'Etikette alerjen uyarısı bulunmuyor' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 3 Kasım 2026 itibarıyla satışta değil (öne çıkan teklif yok)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Kuru baklagiller çiğ tüketilmez; pişirmeden önce 10-12 saat ıslatılıp iyice pişirilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Etikette alerjen uyarısı yer almıyor; alerjisi olan kişiler ambalaj etiketini kontrol etmelidir.',
      },
      { severity: 'low' as const, text: 'Ürün paketi açılmış veya delinmiş ise satın almayınız.' },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürünü tüketmeyiniz.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      "Etli Kuru Fasulye Yapımı: 250-300 g et (kemikli tavsiye edilir) daha önceden haşlanır. Tencerede sıvı yağ ile ince ince doğranmış 1 orta boy soğan pembeleşinceye kadar kavrulur. 1,5 yemek kaşığı salça eklenip kavrulduktan sonra 1 yeşil biber ve 2 domates doğranır, haşlanmış et eklenir ve 5 dakika kadar kavrulur. Üzerine 1 kase haşlanmış Yayla Dermason Fasulye dökülür, fasulyelerin üstünü 2 parmak geçecek kadar et suyu ilave edilir. Tuz eklenir ve fasulye iyice yumuşayıncaya kadar pişirilir; yemeğin suyu eksilirse sıcak su takviyesi yapılır (soğuk su eklenirse fasulyeler sertleşir).\n\nPişirme Önerisi: Soğuk suda 10-12 saat ıslatın. Düdüklü tencerede 15 dakika veya normal tencerede 30-40 dakika haşlayın.",
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as Array<{ amount: number; date: string }>,
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: besin değerleri, içerik, tarif ve saklama bilgileri',
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
