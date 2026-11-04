import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Hasata Kırşehir Koçbaşı Nohut 1000 g ürününü UZAK Payload REST API'sine yazar:
 * mevcut OFF kaydını (id 17954) zenginleştirir, fotoğrafları yükler.
 *
 * Kaynak: Amazon.com.tr ASIN B0C1X7ZHL5 + ürün ambalajı. Barkod arka yüzden
 * okundu (8697423962033) ve EAN-13 kontrol hanesi doğrulandı. Ürün Amazon'da
 * şu anda stokta değil ("Şu anda mevcut değil"), bu yüzden prices boş bırakıldı.
 *
 * Besin tablosu 100 g içindir; %RA sütunu TÜBER 2022 referanslarıyla
 * (protein 50 g, lif 25 g, potasyum 2000 mg, fosfor 700 mg, magnezyum 375 mg)
 * uyumludur.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-hasata-kirsehir-kocbasi-nohut-1000g-prod.ts
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-hasata-kirsehir-kocbasi-nohut-1000g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8697423962033'
const ASIN = 'B0C1X7ZHL5'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'hasata-kirsehir-kocbasi-nohut-1000g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Hasata Kırşehir Koçbaşı Nohut 1000 g ön yüz; kilitli ambalaj, True to Seed',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Hasata Kırşehir Koçbaşı Nohut 1000 g besin değerleri tablosu (100 g: 1300 kJ / 310 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Hasata Kırşehir Koçbaşı Nohut 1000 g ambalaj sembolleri: gıda ile temasa uygun, temiz tutunuz, güneş almayan, kuru yerde saklayın, geri dönüştürülebilir',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Hasata Kırşehir Koçbaşı Nohut 1000 g arka yüz: besin tablosu, pişirme önerisi, saklama koşulları, üretici bilgileri, barkod',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Hasata Kırşehir Koçbaşı Nohut 1000 g barkod numarası 8697423962033',
  },
] as const

const BRAND_ID = 1098 // Hasata
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_CHICKPEA_ID = 1170 // Nohut

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
  magnesium: 40,
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

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Hasata Kırşehir Koçbaşı Nohut 1000 g',
    description:
      "Hasata Kırşehir Koçbaşı Nohut, Kırşehir bölgesinde yetiştirilen koçbaşı nohudun 1 kg'lık kilitli (ziplock) ambalajıdır. Her paket tek hasat mahsulünden doldurulur; böylece taneler eşit sürede pişer. Kelebeklenmeyi önlemek için paketleme öncesi tamamen doğal kontrollü atmosfer işlemi uygulanır.\n\nİçindekiler tek bileşendir: koçbaşı nohut. Etiket ürünü yüksek protein ve lif kaynağı, potasyum, fosfor ve magnezyum kaynağı olarak tanımlar; kilitli ambalaj sayesinde açıldıktan sonra kavanoza aktarmadan saklanabilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0C1X7ZHL5) ve ürün ambalajı (EAN-13 8697423962033).",
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'Danem Gıda San. ve Tic. A.Ş.',
    country: COUNTRY_ID,
    size: '1000 g',
    packaging: 'Kilitli (ziplock) 3 katlı esnek ambalaj',
    items: [{ ingredients: INGREDIENT_CHICKPEA_ID }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1300, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 310, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 3.72, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 1.05, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 42.1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 23, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 18.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 892.8, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 306.1, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.magnesium, amount: 116.4, unit: 'mg' },
      ],
    },
    labels: ['halal-certified', 'recyclable'],
    specifications: [
      { key: 'Marka', value: 'Hasata' },
      { key: 'Ürün Tipi', value: 'Koçbaşı nohut (kuru baklagil)' },
      { key: 'Çeşitlilik', value: 'Koç Nohut (koçbaşı)' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Ambalaj', value: 'Kilitli (ziplock) 3 katlı esnek ambalaj' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Yetiştiği Bölge', value: 'Kırşehir' },
      { key: 'Üretici', value: 'Danem Gıda San. ve Tic. A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Mersin Tarsus Organize Sanayi Bölgesi - Gelişme Alanı, Burhan OSB Mah. Kadri Şaman Bulvarı No: 5, Akdeniz / Mersin',
      },
      { key: 'Üretici Telefonu', value: '+90 324 241 53 00 (faks +90 324 241 53 29)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-034701' },
      { key: 'Müşteri Hattı', value: '0800 2 111 11 02 — www.hasata.com.tr' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Ürün Standardı', value: '1. Tip, türü: Koçbaşı, TS 142' },
      { key: 'Diyet Türü', value: 'Vejetaryen (Amazon ürün detayı)' },
      {
        key: 'Beyan',
        value:
          'Yüksek protein kaynağı, zengin lif kaynağı; potasyum, fosfor ve magnezyum kaynağı. Kelebeklenmeyi önlemek için kontrollü atmosfer işlemi uygulanır.',
      },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Gıda ile temasa uygun, temiz tutunuz, güneş almayan, kuru serin yerde saklayınız, geri dönüştürülebilir; TÜRK MALI',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda alerjen uyarısı yok; Amazon ürün detayında “Kabuklu Su Ürünleri İçermez” yazar.',
      },
      {
        key: 'İçindekiler Notu',
        value:
          'Ambalajda ayrı “İçindekiler” paneli basılı değildir; ürün tek bileşenlidir (koçbaşı nohut). Amazon ürün detayı da içindekileri “Koçbaşı Nohut” olarak verir.',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Tablo 100 g içindir; %RA sütunu TÜBER 2022 referanslarıyla uyumludur (protein 50 g, lif 25 g, potasyum 2000 mg, fosfor 700 mg, magnezyum 375 mg). Enerji 1300 kJ / 310 kcal olarak basılıdır.',
      },
      {
        key: 'Ağırlık',
        value: 'Paket ağırlığı ~1,02 kg; paket ölçüleri 22,2 × 14,9 × 6,8 cm (Amazon)',
      },
      {
        key: 'Fiyat Bilgisi',
        value:
          'Amazon.com.tr’de 4 Kasım 2026 itibarıyla “Şu anda mevcut değil” — fiyat gösterilmiyor, öne çıkan teklif yok.',
      },
      { key: 'TETT ve Parti No.', value: 'Üretim tarihi (ÜT), TETT ve parti no. (P) ambalajın üzerindedir' },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Serin ve kuru ortamda, güneş görmeyen yerde muhafaza edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Serin ve kuru ortamda, güneş görmeyen yerde muhafaza edilmelidir. Kilitli ambalaj sayesinde açıldıktan sonra kendi ambalajında saklanabilir.',
    usage:
      'Nohutu bir gece önceden (en az 8 saat) bolca soğuk suda bekletin. Tencereye koyduğunuz nohutların üzerine 2-3 parmak geçecek kadar sıcak su ekleyip kısık ateşte haşlayın.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [] as { amount: number; date: string }[],
    frontImage: media.front,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      {
        image: media.back,
        caption: 'Arka yüz: besin tablosu, pişirme önerisi, saklama koşulları ve üretici bilgileri',
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
