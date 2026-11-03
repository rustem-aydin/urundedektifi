import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Yayla Barbunya 1 kg ürününü UZAK Payload REST API'sine yazar: master
 * içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B01MUSUOFK + ürün ambalajı (EAN-13 8693374011165,
 * arka yüzdeki basılı barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Besin tablosu: etiket değerleri 50 g KURU porsiyon içindir (paket ~20 porsiyon).
 * Kayda 100 g karşılıkları yazılır (×2): 300 kcal, yağ 1,4 g, doymuş 0,6 g,
 * karbonhidrat 38,8 g, şeker 4,4 g, lif 23,2 g, protein 21,2 g, tuz 0 g,
 * potasyum 1511 mg, fosfor 420 mg. Enerji kontrolü: 38,8×4 + 21,2×4 + 1,4×9 +
 * 23,2×2 = 299,6 ≈ 300 kcal. Etikette kJ satırı yok, uydurulmadı.
 *
 * Fiyat: Amazon.com.tr'de 1 kg varyantı stokta olmadığı için fiyat yazılmadı.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-yayla-barbunya-1kg-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8693374011165'
const ASIN = 'B01MUSUOFK'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'yayla-barbunya-1kg')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Yayla Barbunya 1 kg ön yüz; protein kaynağı, B grubu vitaminleri, yüksek lif',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Yayla Barbunya 1 kg ürün beyanı: ürün barbunya, 1. sınıf, menşei Türkiye, TS 141',
  },
  {
    key: 'nutrition',
    file: 'nutrition.jpg',
    alt: 'Yayla Barbunya 1 kg besin değerleri tablosu (50 g kuru porsiyon: 150 kcal)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Yayla Barbunya 1 kg ambalaj sembolleri: güneş almayan, rutubetsiz, temiz tutunuz, gıda ile temasa uygun, geri dönüşüm',
  },
  {
    key: 'back',
    file: 'back.jpg',
    alt: 'Yayla Barbunya 1 kg arka yüz: net ağırlık, üretici bilgileri, saklama koşulları, besin bilgileri',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Yayla Barbunya 1 kg barkod numarası 8693374011165',
  },
] as const

const BRAND_ID = 28 // Yayla
const CATEGORY_ID = 51 // Baklagil & Tahıl › Baklagil
const COUNTRY_ID = 1 // Türkiye

const NUTRIENT_IDS = {
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

  // Kanonik master kaydı: Barbunya (3073).
  const barbunyaId = await ensureIngredient(client, 'Barbunya', 'barbunya', [
    'Barbunya',
    'Barbunya fasulyesi',
    'Cranberry bean',
    'Borlotti bean',
  ])
  console.log(`İçindekiler: barbunya ${barbunyaId}`)

  const media = await ensureMedia(client)

  const data = {
    barcode: BARCODE,
    name: 'Yayla Barbunya 1 kg',
    description:
      'Yayla Barbunya, 1. sınıf A (büyük) boy kuru barbunya fasulyesinin 1 kg’lık paketidir. Tek bileşenlidir; pişirmeden önce ıslatılır.\n\nAmbalaj bilgisi: TS 141, 1. sınıf, A (büyük) boy, menşei Türkiye; %100 yerli. Etiket, ürünü protein kaynağı, B grubu vitaminleri ve yüksek lif kaynağı olarak tanımlar. Etiketli besin tablosu 50 g kuru porsiyon içindir (paket yaklaşık 20 porsiyon); sitede 100 g karşılıkları gösterilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B01MUSUOFK) ve ürün ambalajı (EAN-13 8693374011165).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.',
    country: COUNTRY_ID,
    size: '1 kg',
    packaging: 'Plastik ambalaj (doypack)',
    items: [{ ingredients: barbunyaId }],
    allergens: null,
    additives: [] as number[],
    nutrition: {
      per: '100g' as const,
      items: [
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 300, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 1.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 0.6, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 38.8, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 4.4, unit: 'g' },
        { nutrient: NUTRIENT_IDS.fiber, amount: 23.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 21.2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.potassium, amount: 1511, unit: 'mg' },
        { nutrient: NUTRIENT_IDS.phosphorus, amount: 420, unit: 'mg' },
      ],
    },
    specifications: [
      { key: 'Marka', value: 'Yayla' },
      { key: 'Ürün Tipi', value: 'Kuru barbunya fasulyesi (1. sınıf, A / büyük boy)' },
      { key: 'Net Miktar', value: '1 kg' },
      { key: 'Standart', value: 'TS 141; 1. sınıf, A (büyük) boy' },
      { key: 'Menşe', value: 'Türkiye (%100 yerli)' },
      { key: 'Üretici', value: 'YAYLA Agro Gıda Sanayi ve Nakliyat A.Ş.' },
      {
        key: 'Üretici Adresi',
        value:
          'Saray Mahallesi Fatih Sultan Mehmet Bulvarı No: 327, Kazan / ANKARA / TÜRKİYE',
      },
      { key: 'Üretici Telefonu', value: '+90 312 815 49 50 (pbx), faks +90 312 815 47 90' },
      { key: 'Web', value: 'www.yaylabakliyat.com.tr' },
      { key: 'İşletme Kayıt Numarası', value: 'TR-06-K-000171' },
      {
        key: 'Uygunluk Beyanı',
        value: 'Türk Gıda Kodeksi’ne uygundur',
      },
      {
        key: 'TETT ve Parti No.',
        value: 'TETT, parti no (PN) ve ürün yılı ambalajın üzerindedir',
      },
      {
        key: 'Saklama Koşulları',
        value:
          'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız',
      },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Etiket değerleri 50 g KURU porsiyon içindir (paket yaklaşık 20 porsiyon). 100 g değerleri 2 ile çarpılarak yazıldı: 300 kcal, yağ 1,4 g, doymuş yağ 0,6 g, karbonhidrat 38,8 g, şeker 4,4 g, lif 23,2 g, protein 21,2 g, tuz 0 g, potasyum 1511 mg, fosfor 420 mg. Enerji makro toplamıyla doğrulandı (299,6 ≈ 300 kcal); etikette kJ satırı yok.',
      },
      {
        key: 'Beyan',
        value:
          'Front panel: protein kaynağı, B grubu vitaminleri içerir, yüksek lif; ambalajda helal/vegan logosu yok',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yok (Amazon alanı: “GDO içermez”)' },
      { key: 'EAN-13', value: BARCODE },
      {
        key: 'Etiket Barkodu',
        value:
          'Bazı paketlerde üzerine yapıştırılan etikette farklı bir barkod (8693374204697, TETT/parti/ürün yılı bilgili) bulunur; poşetin baskılı barkodu 8693374011165’tir',
      },
      { key: 'Amazon ASIN', value: ASIN },
      {
        key: 'Amazon Satış Biçimi',
        value:
          'Tekli 1 kg; aynı listede 500 g, 2 kg, 1 kg × 2, 1 kg × 4 ve 2 kg × 2 varyantları da satılıyor',
      },
      { key: 'Ürün Ölçüleri', value: '21,8 × 17 × 6,6 cm (paket, Amazon ölçümü); 1 kg' },
      {
        key: 'Fiyat Bilgisi',
        value:
          'Amazon.com.tr’de 1 kg varyantı 3 Kasım 2026 itibarıyla stokta değil; fiyat kaydedilmedi',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'TETT (tavsiye edilen tüketim tarihi), parti no ve ürün yılı ambalajın üzerindedir; tüketim öncesi kontrol edilmelidir.',
      },
      {
        severity: 'low' as const,
        text: 'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'Kuru baklagil çiğ tüketilmez; pişirilmeden önce ıslatılıp haşlanmalıdır.',
      },
    ],
    storage:
      'Rutubetsiz, güneş almayan serin bir yerde, mümkünse bez torbada saklayınız.',
    usage:
      'Pişirme önerisi: barbunyayı tuz eklemeden, 3 katı suyla sekiz saat–bir gün aralığında ıslatın; yazın buzdolabında ıslatın. Islatma suyunu daima süzün, haşlama için kullanmayın. Barbunya Yapılışı: 200 g barbunya bir gün önceden soğuk suda ıslatılıp haşlanır, haşlama suyu dökülüp süzgeçte soğutulur; bir büyük soğan, 2 havuç, 1 patates ve 3 diş sarımsak sotelenir, 500 ml sebze suyu eklenir, süzülen barbunyalar karışıma eklenip 15 dk kısık ateşte pişirilir.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    nutritionImage: media.nutrition,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.back, caption: 'Arka yüz: net ağırlık, üretici bilgileri ve saklama koşulları' },
      { image: media.barcode, caption: 'Barkod 8693374011165' },
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
