import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Haşlanmış Suyu Süzülmüş Börülce 150 g ürününü UZAK Payload REST API'sine
 * yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0DY1MRLDQ + ürün ambalajı (EAN-13 8693374265506,
 * arka yüzdeki barkod görselinden okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu uyarısı: ambalajdaki tabloda değer sütunu etiket sütununa göre bir
 * satır kaymış basılmıştır ("Doymuş Yağ" hizasında 0,8 g görünür). Kayda, enerji
 * (478 kJ / 114 kcal) ve %RA sütunuyla doğrulanan eşleme yazılır: yağ 0,8 g (%1),
 * doymuş yağ 0,5 g (%3), karbonhidrat 15,5 g (%6), şeker 0 g, lif 10,2 g (%41),
 * protein 6,0 g (%12), tuz 0 g. Enerji kontrolü: 15,5×4 + 6,0×4 + 0,8×9 + 10,2×2
 * = 113,6 ≈ 114 kcal.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-haslanmis-borulce-150g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374265506'
const ASIN = 'B0DY1MRLDQ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-haslanmis-borulce-150g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Haşlanmış Suyu Süzülmüş Börülce 150 g ön yüz; kullanıma hazır, 1 porsiyon, vegan',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Haşlanmış Börülce 150 g içindekiler: haşlanmış börülce (su, börülce) (%97), bitkisel yağ (ayçiçek yağı)',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Haşlanmış Börülce 150 g besin değerleri tablosu (100 g: 478 kJ / 114 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Haşlanmış Börülce 150 g ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, yeşil nokta, helal',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Haşlanmış Börülce 150 g arka yüz: hazırlanışı, saklama koşulları, üretici bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Haşlanmış Börülce 150 g barkod numarası 8693374265506',
  },
] as const

const BRAND_ID = 28 // Yayla
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

/** Master kaydı ad + slug ile bulur; yoksa oluşturur (idempotent). */
async function ensureIngredient(
  client: PayloadClient,
  name: string,
  slug: string,
  aliases: string[],
): Promise<number> {
  const existing = await client.findOne('ingredients', {
    and: [{ name: { equals: name } }, { slug: { equals: slug } }],
  })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name,
    slug,
    aliases: aliases.map((alias) => ({ alias })),
  })
  console.log(`  + içindekiler: ${name} (${created.id})`)
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
    token: TOKEN || undefined,
  })
  await client.login()
  const token = client.getToken()
  const who = await fetch(`${client.api}/users/me`, {
    headers: { Authorization: `JWT ${token}` },
  }).then((res) => res.json() as Promise<{ user?: { role?: string } }>)
  console.log(`API: ${client.api} (rol: ${who.user?.role})`)

  // Kanonik master kayıtları: Börülce 4744, Su 278, Ayçiçek yağı 298.
  const borulceId = await ensureIngredient(client, 'Börülce', 'borulce', [
    'Börülce',
    'Black eyed beans',
    'Black eye peas',
    'Cowpea',
  ])
  const waterId = await ensureIngredient(client, 'Su', 'su', ['Su', 'Water'])
  const sunflowerOilId = await ensureIngredient(client, 'Ayçiçek yağı', 'aycicek-yagi', [
    'Ayçiçek yağı',
    'Sunflower oil',
  ])
  console.log(`İçindekiler: börülce ${borulceId}, su ${waterId}, ayçiçek yağı ${sunflowerOilId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Haşlanmış Suyu Süzülmüş Börülce 150 g',
    description:
      'Yayla Haşlanmış Suyu Süzülmüş Börülce, haşlanıp suyu süzülen börülcenin (siyah gözlü bakla) 150 g’lık tekli, kullanıma hazır paketidir. Tek porsiyonluktur; ıslatma veya haşlama gerekmez, ambalaj açılıp doğrudan çorba, yemek ve salatalara eklenir.\n\nİçindekiler haşlanmış börülce (su, börülce) (%97) ve bitkisel yağ (ayçiçek yağı); tuz eklenmemiştir, ürün renklendirici ve koruyucu içermez, vegan uygundur. Etiket ürünü “susuz haşlanmış börülce / boiled black eyed beans (drained)” olarak tanımlar.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0DY1MRLDQ) ve ürün ambalajı (EAN-13 8693374265506).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.',
    country: COUNTRY_ID,
    size: '150 g',
    packaging: 'Tekli poşet (4 katlı BPA’sız koruyucu ambalaj)',
    items: [
      { ingredients: borulceId, percent_estimate: 97 },
      { ingredients: waterId },
      { ingredients: sunflowerOilId },
    ],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 478, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 114, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 0.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 15.5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 10.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
      ],
    },
    labels: ['vegan', 'vegetarian', 'no-additives', 'bpa-free', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Haşlanmış suyu süzülmüş börülce (kullanıma hazır)' },
      { key: 'Net Miktar', value: '150 g' },
      { key: 'Porsiyon', value: 'Paket tek porsiyondur (1 porsiyon / 1 portion, 150 g)' },
      { key: 'Ambalaj', value: 'Tekli poşet, 4 katlı BPA’sız koruyucu ambalaj' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Ticaret A.Ş.' },
      {
        key: 'Üretici Adresi',
        value: 'Yalınayak Mah. 102099. Sk. No: 1, Toroslar / MERSİN',
      },
      { key: 'Üretici Telefonu', value: '0 324 221 62 76 (faks 0 324 221 62 78)' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-33-K-001608' },
      { key: 'Web', value: 'www.yaylaagro.com (ambalajda “yaylabakliyat” sosyal medya hesapları)' },
      { key: 'TETT ve Parti No.', value: 'Ambalajın üzerindedir' },
      { key: 'Standart', value: 'Gıda Kodeksi’ne uygundur' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etikette değer sütunu bir satır kaymış basılmıştır. Enerji (478 kJ / 114 kcal) ve %RA sütunuyla doğrulanan eşleme yazıldı: yağ 0,8 g (%1), doymuş yağ 0,5 g (%3), karbonhidrat 15,5 g (%6), şeker 0 g (%0), lif 10,2 g (%41), protein 6,0 g (%12), tuz 0 g (%0).',
      },
      {
        key: 'Beyan',
        value: 'Düşük yağ, protein ve lif içerir; renklendirici ve koruyucu içermez; vegan',
      },
      {
        key: 'Amazon Beyanı',
        value:
          'Amazon madde işaretlerinde “yüksek magnezyum içerir” yazar; ambalajın besin tablosunda magnezyum satırı yoktur, bu nedenle magnezyum değeri kayda işlenmedi',
      },
      { key: 'Helal', value: 'Ambalajda helal logosu bulunur' },
      {
        key: 'Ambalaj Sembolleri',
        value:
          'Güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, PP 5, yeşil nokta, helal, QR kod',
      },
      {
        key: 'Alerjen Beyanı',
        value:
          'Ambalajda alerjen uyarısı yok; Amazon ürün detayında “Gluten içerebilir” yazar',
      },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value: 'Tekli paket (150 g); aynı listede 3’lü paket ve 150 g × 12 varyantları da satılıyor',
      },
      { key: 'Ürün Ölçüleri', value: '14,7 × 11,3 × 3,8 cm (paket, Amazon ölçümü); paket ağırlığı 0,21 kg' },
      { key: 'Katkı Maddesi', value: 'İçermez' },
      {
        key: 'Fiyat Kaynağı',
        value: 'Amazon.com.tr — 62,00 TL (150 g, 100 g başına 41,33 TL, 3 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'medium' as const,
        text: 'Ambalajda alerjen uyarısı ve içindekiler listesinde gluten kaynağı yoktur; Amazon ürün detayında “Gluten içerebilir” beyanı yer alır. Çölyak hastaları ve gluten duyarlılığı olanlar üreticiye danışmalıdır.',
      },
      {
        severity: 'low' as const,
        text: 'Şişmiş ve sızıntılı ürünleri tüketmeyiniz.',
      },
      {
        severity: 'low' as const,
        text: 'Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi) geçmiş ürün tüketilmemelidir.',
      },
    ],
    storage:
      'Oda sıcaklığında, güneş ışığından uzak ortamda saklayınız. Açıldıktan sonra buzdolabında (+4 °C) muhafaza edilmeli ve 2 gün içinde tüketilmelidir.',
    usage:
      'Ambalajı açıp çorbalara, yemeklere ve salatalara ekleyin; yemeğe ekstra zenginlik katar. Isıtılarak da tüketilebilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 62, date: '2026-11-03T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: hazırlanışı, saklama koşulları ve üretici bilgileri' },
      { image: media.barcode, caption: 'Barkod 8693374265506' },
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
