import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Gurme Fit Kinoalı Bulgur 360 g ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08G1VSD8C + ürün ambalajı (EAN-13 8693374242422,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Amazon listesi 3 Kasım 2026 itibarıyla stokta değildir ("Şu anda mevcut değil"),
 * bu yüzden prices boş bırakılır ve durum specifications'a yazılır.
 *
 * Besin tablosu pişmemiş (uncooked) 100 g içindir; tuz etikette "<0,1 g" olarak
 * basılmıştır ve "en fazla" birimiyle korunur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-yayla-gurme-fit-kinoali-bulgur-360g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-gurme-fit-kinoali-bulgur-360g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374242422'
const ASIN = 'B08G1VSD8C'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-gurme-fit-kinoali-bulgur-360g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur 360 g ön yüz; 6 porsiyon, 15 dakikada hazır, vegan, protein ve lif kaynağı',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur içindekiler: tane bulgur (durum buğdayı), kurutulmuş domates, kırmızı kinoa (%6); gluten içerir',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur besin değerleri tablosu (pişmemiş 100 g: 1396 kJ / 391 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur ambalaj sembolleri: PP 5, 2502, gıda ile temasa uygun, çevreye atmayın, güneş almayan, rutubetsiz',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur 360 g arka yüz: hazırlanışı, besin tablosu, içindekiler, saklama ve üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Gurme Fit Kinoalı Bulgur 360 g barkod numarası 8693374242422',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 28 // Baklagil & Tahıl
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_BULGUR_ID = 1504 // Bulgur
const INGREDIENT_DRIED_TOMATO_ID = 4530 // Kurutulmuş domates
const INGREDIENT_QUINOA_ID = 847 // kinoa
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
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  await assertIngredient(client, INGREDIENT_BULGUR_ID, 'Bulgur')
  await assertIngredient(client, INGREDIENT_DRIED_TOMATO_ID, 'Kurutulmuş domates')
  await assertIngredient(client, INGREDIENT_QUINOA_ID, 'kinoa')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Gurme Fit Kinoalı Bulgur 360 g',
    description:
      "Yayla Gurme Fit Kinoalı Bulgur, tane bulgur (durum buğdayı), kurutulmuş domates ve kırmızı kinoa (%6) karışımından oluşan 360 g'lık pilavlık bulgur paketidir. Ambalajda 6 porsiyon ve 15 dakikada hazır bilgisi yer alır; ürün vegan, protein ve lif kaynağı, düşük doymuş yağlı olarak tanımlanır.\n\nÜrün gluten içerir; koruyucu atmosferde paketlenmiştir. 100 g pişmemiş üründe 391 kcal, 8,4 g lif ve 12,1 g protein bulunur.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08G1VSD8C) ve ürün ambalajı (EAN-13 8693374242422).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '360 g',
    packaging: 'Doypack poşet (koruyucu atmosferde paketlenmiş)',
    items: [
      { ingredients: INGREDIENT_BULGUR_ID },
      { ingredients: INGREDIENT_DRIED_TOMATO_ID },
      { ingredients: INGREDIENT_QUINOA_ID, percent_estimate: 6 },
    ],
    allergens: ALLERGEN_GLUTEN_ID,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1396, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 391, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.28, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 62, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 1.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 8.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 12.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0.1, unit: 'g (en fazla)' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'halal-certified', 'no-additives'],
    specifications: [
      { key: 'Marka', value: 'Yayla (Gurme Fit)' },
      { key: 'Ürün Tipi', value: 'Kinoalı bulgur (pilavlık bulgur karışımı)' },
      { key: 'Net Miktar', value: '360 g' },
      { key: 'Porsiyon', value: '6 porsiyon (1 porsiyon yaklaşık 60 g)' },
      { key: 'Pişirme Süresi', value: '15 dakika' },
      {
        key: 'Ambalaj',
        value: 'Doypack poşet, koruyucu atmosferde paketlenmiştir',
      },
      {
        key: 'Üretim Yeri',
        value:
          'Türkiye — üretici tesisi Mersin (GS1 öneki 869); ambalajda ayrı menşe beyanı fotoğrafta görünmüyor',
      },
      { key: 'Üretici', value: 'YAYLA Agro Gıda San. ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mahallesi 1099. Sokak No: 1, Toroslar / MERSİN',
      },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'E-posta', value: 'yayla@yaylabakliyat.com.tr' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      {
        key: 'TETT ve Parti No.',
        value:
          'Ambalajın üzerindedir; etikette TETT, parti no (PN), ürün yılı ve menşe ülke bilgisinin ambalajda yer aldığı belirtilir',
      },
      { key: 'Standart', value: 'Gıda Kodeksi’ne uygundur' },
      {
        key: 'Beyan',
        value:
          'Vegan, protein kaynağı, lif kaynağı, düşük doymuş yağ; koruyucu ve renklendirici içermez; helal',
      },
      {
        key: 'Hazırlanışı',
        value:
          '3 yemek kaşığı (32 g) sıvı yağ ve 1 yemek kaşığı (20 g) tereyağı eritin; paketin tamamını ekleyip 2 dakika kavurun ve 1,5 tatlı kaşığı (12 g) tuz ekleyin; 4 su bardağı (800 ml) sıcak su ekleyip suyu çekene kadar 10 dakika pişirin, 10 dakika dinlendirin (toplam 15 dakika)',
      },
      {
        key: 'Alerjen Beyanı',
        value: 'Gluten içerir (durum buğdayı); ambalajda “Gluten içerir / Contain wheat gluten” yazar',
      },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'PP 5, 2502, gıda ile temasa uygun, çevreye atmayın, güneş almayan, rutubetsiz; QR kod ve helal logosu',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Değerler ambalajdaki “Uncooked per 100 g” (pişmemiş 100 g) sütunundan yazıldı; tuz etikette “<0,1 g” olarak basılmıştır ve “en fazla” birimiyle korundu. Etiket ayrıca “**Değerler ortalama bir yetişkinin Referans Alım Düzeyini belirtir (8400 kJ/2000 kcal)” notunu taşır.',
      },
      {
        key: 'İçindekiler Çelişkisi',
        value:
          'Amazon açıklaması içindekileri “tane bulgur, kırmızı kinoa-kuru domates (%10)” olarak verir; ambalajda kırmızı kinoa %6’dır ve domatese yüzde verilmez. Kayda ambalaj yazıldı.',
      },
      {
        key: 'Üretici Adresi Çelişkisi',
        value:
          'Amazon ürün açıklaması adresi “İstanbul Yolu 30. Km, Saray Mh. FSM Blv. No: 327, Kahramankazan / Ankara” olarak verir; ambalajdaki üretici adresi Toroslar / Mersin’dir ve kayda ambalaj yazıldı.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value:
          '21,4 × 12,7 × 4,3 cm (paket, Amazon ölçümü); Amazon paket ağırlığı 340 g der, ambalaj net miktarı 360 g’dır',
      },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr listesi 3 Kasım 2026 itibarıyla stokta değil (“Şu anda mevcut değil”), satış fiyatı yok; kayda fiyat yazılmadı',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ürün gluten içerir (durum buğdayı); çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalajı açtıktan sonra rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Lütfen rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
    usage:
      '3 yemek kaşığı (32 g) sıvı yağ ve 1 yemek kaşığı (20 g) tereyağı eritin; paketin tamamını ekleyip 2 dakika kavurun ve 1,5 tatlı kaşığı (12 g) tuz ekleyin. 4 su bardağı (800 ml) sıcak su ekleyip suyu çekene kadar 10 dakika pişirin, servis öncesi 10 dakika dinlendirin; isteğe göre baharat ekleyebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: hazırlanışı, besin tablosu, içindekiler ve üretici bilgileri',
      },
      { image: media.barcode, caption: 'Barkod 8693374242422' },
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
