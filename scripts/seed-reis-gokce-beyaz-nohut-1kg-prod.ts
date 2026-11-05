import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Reis Gökçe Beyaz Nohut 1 kg ürününü UZAK Payload REST API'sine yazar.
 *
 * Kaynak: Amazon.com.tr ASIN B08G1SVY5S + ürün ambalajı (EAN-13 8690849820512,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Ülke alanı ambalajın "Menşe / Ülke: Meksika" beyanına göre Meksika'dır; aynı
 * ambalajda "Product of Turkey / TÜRK MALI" ve TSE işareti de vardır (Türkiye'de
 * paketlenmiştir). Amazon "Menşei Türkiyedir" der — çelişki specifications'ta.
 *
 * Besin tablosu ABD etiketi düzenindedir ("Per serving" = 1 cup / 100 g, 10
 * porsiyon/paket) ve kJ satırı yoktur; kJ uydurulmadı.
 *
 * Amazon listesi 5 Kasım 2026 itibarıyla stokta değildir; prices boş bırakılır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-reis-gokce-beyaz-nohut-1kg-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-reis-gokce-beyaz-nohut-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8690849820512'
const ASIN = 'B08G1SVY5S'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'reis-gokce-beyaz-nohut-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Reis Gökçe Beyaz Nohut 1 kg ön yüz; beyaz nohut, 1981’den günümüze Reis',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Reis Gökçe Beyaz Nohut besin değerleri tablosu (100 g: 330 kcal, 23 g lif, 21 g protein)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Reis Gökçe Beyaz Nohut ambalaj sembolleri: ÇEVKO, TSE, doğa dostu ambalaj, çevreyi koruyalım, rutubetsiz, güneş almayan, gıda ile temasa uygun',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Reis Gökçe Beyaz Nohut 1 kg arka yüz: saklama talimatı, üretici bilgileri, besin tablosu ve barkod',
  },
  {
    key: 'label',
    file: 'label.jpg',
    alt: 'Reis Gökçe Beyaz Nohut etiket bilgileri: tip koçbaşı, boy A (çok iri), sınıf 1, menşe Meksika, TS 142, parti no 0604',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Reis Gökçe Beyaz Nohut barkod numarası 8690849820512',
  },
] as const

const BRAND_ID = 803 // Reis
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 121 // Meksika (ambalaj: Menşe / Ülke: Meksika)
const INGREDIENT_CHICKPEA_ID = 1170 // Nohut

const NUTRIENT_IDS = {
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  transFat: 52,
  cholesterol: 6,
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

  await assertIngredient(client, INGREDIENT_CHICKPEA_ID, 'Nohut')

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Reis Gökçe Beyaz Nohut 1 kg',
    description:
      "Reis Gökçe Beyaz Nohut, koçbaşı tipi, A boy (çok iri) ve 1. sınıf beyaz nohudun 1 kg'lık paketidir. Ambalajda menşe ülke Meksika olarak belirtilir; ürün Türkiye'de paketlenmiştir (\"Product of Turkey / TÜRK MALI\", TSE). Tek bileşen beyaz nohuttur.\n\nEtiket ABD düzeni bir besin tablosu taşır: 100 g'da 330 kcal, 23 g lif ve 21 g protein. Paket 10 porsiyon (1 porsiyon 1 su bardağı / 100 g) olarak tanımlanır.\n\nVeri kaynağı: Amazon.com.tr (ASIN B08G1SVY5S) ve ürün ambalajı (EAN-13 8690849820512).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik paket (doypack)',
    items: [{ ingredients: INGREDIENT_CHICKPEA_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 330, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.83, unit: 'g' },
        { nutrient: NUTRIENT_IDS.transFat, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.cholesterol, amount: 0, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 39, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 21, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: [] as string[],
    specifications: [
      { key: 'Marka', value: 'Reis' },
      { key: 'Ürün Tipi', value: 'Beyaz nohut (Gökçe)' },
      { key: 'Net Miktar', value: '1000 g (1 kg)' },
      { key: 'Tip', value: 'Koçbaşı' },
      { key: 'Boy', value: 'A (Çok İri)' },
      { key: 'Sınıf', value: '1' },
      { key: 'Standart', value: 'TS 142' },
      {
        key: 'Menşe',
        value: 'Meksika (ambalajda “Menşe / Ülke: Meksika”)',
      },
      {
        key: 'Üretim Yeri',
        value:
          'Türkiye’de paketlenmiştir; ambalajda “Product of Turkey / TÜRK MALI” ve TSE işareti bulunur',
      },
      { key: 'Hasat Yılı', value: 'Ambalajda alan boş bırakılmış' },
      { key: 'Parti No.', value: '0604' },
      {
        key: 'TETT',
        value:
          'Ambalajda “… tarihinden önce tüketilmesi tavsiye edilir. 12:53” baskısı var (partiye göre değişir)',
      },
      { key: 'İşletme Kayıt Numarası', value: 'TR-34-K-048577' },
      { key: 'Üretici', value: 'Reis Tarımsal Ürünler Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Çakmaklı Mevkii, Akçaburgaz Mahallesi 3051. Sokak No: 7, 34522 Esenyurt / İSTANBUL',
      },
      { key: 'Telefon', value: '0 212 671 97 00 (faks 0 212 671 97 01)' },
      { key: 'TSE Danışma Hattı', value: '0 212 671 97 10' },
      { key: 'E-posta', value: 'reis@reisgida.com.tr' },
      { key: 'Web', value: 'www.reisgida.com.tr' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'ÇEVKO, TSE, doğa dostu ambalaj, çevreyi koruyalım, rutubetsiz, güneş almayan, gıda ile temasa uygun',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Tablo ABD etiketi düzenindedir: “Per serving 1 cup (100 g)”, paket başına 10 porsiyon, %DV 2000 kcal referansına göredir. Etikette kJ satırı yoktur; kJ değeri uydurulmadı. Sodyum 0 mg olduğu için tuz 0 g yazıldı.',
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Ambalajda ayrı içindekiler listesi yoktur; ürün adı “BEYAZ NOHUT / WHITE CHICKPEAS”. Amazon içindekiler alanı “GÖKÇE BEYAZ NOHUT” der',
      },
      {
        key: 'Menşe Çelişkisi',
        value:
          'Amazon ürün açıklaması “Menşei Türkiye’dir” der; ambalajda “Menşe / Ülke: Meksika” yazar ve aynı ambalaj “Product of Turkey” ibaresini taşır (Meksika kaynaklı nohut, Türkiye’de paketlenmiş). Kayda ambalajın menşe beyanı yazıldı.',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Ürün Ölçüleri',
        value: '21 × 16,6 × 6,8 cm; paket ağırlığı 1,06 kg (Amazon ölçümü)',
      },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr listesi 5 Kasım 2026 itibarıyla stokta değil (“Şu anda mevcut değil”), satış fiyatı yok; kayda fiyat yazılmadı',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Çok amaçlı ayıklama yöntemleri kullanılsa da baklagilleri kullanmadan önce bir kez daha gözden geçirmeniz tavsiye edilir.',
      },
      {
        severity: 'low' as const,
        text: 'Serin ve rutubetsiz yerde, güneş ışığından koruyarak saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Serin ve rutubetsiz yerde, güneş ışığından koruyarak saklayınız. Kullanmadan önce gözden geçiriniz.',
    usage: null,
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
        caption: 'Arka yüz: saklama talimatı, üretici bilgileri ve besin tablosu',
      },
      {
        image: media.label,
        caption: 'Etiket bilgileri: tip koçbaşı, boy A (çok iri), sınıf 1, menşe Meksika, parti 0604',
      },
      { image: media.barcode, caption: 'Barkod 8690849820512' },
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
