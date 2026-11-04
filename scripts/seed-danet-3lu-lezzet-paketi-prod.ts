import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Amazon.com.tr ASIN B0F18SN68L "Dana Sucuk-Pastırma-Kavurma 3'lü Lezzet Paketi"
 * bir DEMETTİR: üç ayrı Danet paketi (sucuk + pastırma 70 g + kavurma), demetin
 * kendi EAN'i yoktur. Bu yüzden demet kaydı AÇILMAZ; üç bileşen ürünü tek tek
 * yazılır (barkodlar ambalajdan okundu ve EAN-13 kontrol hanesi doğrulandı):
 *
 *   8697403890028  Danet Dana Sucuk (Fermente)      — yeni kayıt
 *   8697403890325  Danet Çemeni Sıyrılmış Dana Pastırma 70 g — yeni kayıt
 *   8697403890547  Danet Dana Kavurma               — mevcut OFF kaydı (id 13964) zenginleştirilir
 *
 * Görseller 1500 px'lik Amazon galerisinden kırpıldı; sucuk halka etiketindeki
 * besin değerleri düşük çözünürlüklü, bu yüzden sucukta kcal hane için not düşüldü.
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-danet-3lu-lezzet-paketi-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const ASIN = 'B0F18SN68L'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'danet-3lu-lezzet-paketi')

const BRAND_ID = 1539 // Danet
const CATEGORY_ID = 29 // Et & Şarküteri
const COUNTRY_ID = 1 // Türkiye
const ALLERGEN_GLUTEN_ID = 1

const INGREDIENTS = {
  beef: 1461, // Dana eti
  beefFat: 1542, // Dana yağı
  salt: 137, // tuz
  wheatFlour: 181, // Buğday unu
  redPepper: 4429, // Kırmızıbiber
  garlic: 466, // Sarımsak
  ascorbicAcid: 1158, // askorbik asit
  sodiumPolyphosphate: 4751, // Sodyum Polifosfat
  dextrose: 549, // Dekstroz
} as const

const ADDITIVES = {
  e250: 116, // Sodyum Nitrit
  e300: 48, // Askorbik Asit
} as const

const NUTRIENT_IDS = {
  energyKj: 1,
  energyKcal: 2,
  fat: 4,
  saturatedFat: 5,
  carbohydrate: 7,
  sugars: 8,
  protein: 19,
  salt: 20,
} as const

const MANUFACTURER = 'Vahdet Et ve Gıda San. Tic. A.Ş.'
const PRODUCER_SPECS = [
  { key: 'Üretici', value: MANUFACTURER },
  {
    key: 'Üretici Adresi',
    value: 'Hacı Musa Mah. Mezbaha Cad. No: 70-1, Suhut / Afyonkarahisar',
  },
  { key: 'Üretici Telefonu', value: '0 272 718 45 43' },
  { key: 'İstanbul Merkez', value: '444 1 339' },
  { key: 'İşletme Kayıt Numarası', value: 'TR-03-0115' },
  { key: 'Web', value: 'www.danet.com.tr — danet@danet.com.tr' },
]

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

async function ensureIngredient(client: PayloadClient, name: string, slug: string): Promise<number> {
  const existing = await client.findOne('ingredients', { slug: { equals: slug } })
  if (existing) return existing.id
  const created = await client.create('ingredients', {
    name,
    slug,
    aliases: [{ alias: 'Baharat karışımı' }, { alias: 'Spice mix' }],
  })
  console.log(`  + içindekiler: ${name} (${created.id})`)
  return created.id
}

async function ensureMedia(
  client: PayloadClient,
  images: readonly { key: string; file: string; alt: string }[],
): Promise<Record<string, number>> {
  const ids: Record<string, number> = {}
  for (const image of images) {
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

type ProductSeed = {
  barcode: string
  name: string
  description: string
  size: string | null
  items: { ingredients: number; percent_estimate?: number }[]
  allergens: number | null
  additives: number[]
  nutrition: { nutrient: number; amount: number; unit: string }[]
  labels: string[]
  specs: { key: string; value: string }[]
  warnings: { severity: 'low' | 'medium'; text: string }[]
  storage: string
  usage: string
  skuSuffix: string
  images: readonly { key: string; file: string; alt: string }[]
  gallery: (media: Record<string, number>) => {
    frontImage: number
    ingredientsImage?: number
    nutritionImage?: number
    additionalImages: { image: number; caption: string }[]
  }
}

async function main(): Promise<void> {
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

  const spiceMixId = await ensureIngredient(client, 'Baharat karışımı', 'baharat-karismi')

  const seeds: ProductSeed[] = [
    {
      barcode: '8697403890028',
      name: 'Danet Dana Sucuk (Fermente)',
      description:
        "Danet Dana Sucuk, fermente edilerek üretilmiş dana sucuğudur; vakumlu ambalajda satılır. Etiket dana eti, dana yağı, baharat karışımı, sodyum polifosfat, askorbik asit, sodyum nitrit, dekstroz, stabilizatör, sofra tuzu ve sarımsak içerdiğini bildirir. Ürünlerin İslami usullere göre, veteriner hekim kontrolünde kesilmiş etlerden üretildiği ve domuz eti/yağı içermediği beyan edilir; ambalajda HALAL FOOD CERTIFIED logosu bulunur.\n\nNet miktar ambalaj üzerinde yazılıdır (Amazon demetinde 3 parça toplam 0,4 kg). Bu kayıt, Amazon.com.tr'deki Dana Sucuk-Pastırma-Kavurma 3'lü Lezzet Paketi (ASIN B0F18SN68L) görsellerinden ve ambalaj etiketinden derlendi.",
      size: null,
      items: [
        { ingredients: INGREDIENTS.beef },
        { ingredients: INGREDIENTS.beefFat },
        { ingredients: spiceMixId },
        { ingredients: INGREDIENTS.sodiumPolyphosphate },
        { ingredients: INGREDIENTS.ascorbicAcid },
        { ingredients: INGREDIENTS.dextrose },
        { ingredients: INGREDIENTS.salt },
        { ingredients: INGREDIENTS.garlic },
      ],
      allergens: null,
      additives: [ADDITIVES.e250, ADDITIVES.e300],
      nutrition: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1507, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 360, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 40, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 16, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 18, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2, unit: 'g' },
      ],
      labels: ['halal-certified', 'recyclable'],
      specs: [
        { key: 'Marka', value: 'Danet' },
        { key: 'Ürün Tipi', value: 'Fermente dana sucuk' },
        { key: 'Menşe', value: 'Türkiye' },
        ...PRODUCER_SPECS,
        {
          key: 'Net Miktar',
          value: 'Ambalaj üzerinde yazılıdır (Amazon 3’lü sette toplam 0,4 kg / 3 parça)',
        },
        { key: 'Ambalaj', value: 'Vakumlu şeffaf ambalaj (LDPE)' },
        { key: 'EAN-13', value: '8697403890028' },
        { key: 'Amazon ASIN', value: ASIN },
        { key: 'Amazon Satış Biçimi', value: 'Dana Sucuk-Pastırma-Kavurma 3’lü Lezzet Paketi (demet)' },
        { key: 'Helal', value: 'Ambalajda HALAL FOOD CERTIFIED logosu bulunur' },
        { key: 'Katkı Beyanı', value: 'Sodyum polifosfat, askorbik asit, sodyum nitrit, dekstroz, stabilizatör' },
        {
          key: 'Besin Tablosu Notu',
          value:
            'Değerler halka etiket üzerinde 100 g için basılıdır; enerji kJ değeri 1507 okunmuştur, kcal hane düşük çözünürlükte 360/460 olarak ayırt edilemediği için kJ ile tutarlı 360 kcal yazıldı. Makrolar (yağ 40 g + protein 18 g) yaklaşık 436 kcal verir; etiket kendi içinde çelişkilidir.',
        },
        {
          key: 'Saklama',
          value: '0/+4 °C’de muhafaza ediniz. Son tüketim tarihi ve parti no ambalaj üzerindedir.',
        },
        { key: 'Fiyat Bilgisi', value: 'Amazon.com.tr’de 4 Kasım 2026 itibarıyla “Şu anda mevcut değil”' },
      ],
      warnings: [
        {
          severity: 'medium',
          text: 'Sodyum nitrit (E250) ve sodyum polifosfat içerir; etiket domuz eti/yağı içermediğini belirtir.',
        },
        { severity: 'low', text: '0/+4 °C’de saklanmalı, son tüketim tarihi geçmiş ürün tüketilmemelidir.' },
      ],
      storage: '0/+4 °C’de muhafaza ediniz.',
      usage: 'Dilimlenerek doğrudan veya pişirilerek tüketilir.',
      skuSuffix: 'SUCUK',
      images: [
        { key: 'front', file: 'sucuk-front.jpg', alt: 'Danet Dana Sucuk (Fermente) ön yüz; halka sucuk, HALAL FOOD CERTIFIED logosu' },
        { key: 'label', file: 'sucuk-label.jpg', alt: 'Danet Dana Sucuk (Fermente) etiketi: içindekiler, üretici ve besin değerleri' },
        { key: 'barcode', file: 'sucuk-barcode.jpg', alt: 'Danet Dana Sucuk (Fermente) barkod numarası 8697403890028' },
      ],
      gallery: (media) => ({
        frontImage: media.front,
        ingredientsImage: media.label,
        additionalImages: [{ image: media.barcode, caption: 'Barkod 8697403890028' }],
      }),
    },
    {
      barcode: '8697403890325',
      name: 'Danet Çemeni Sıyrılmış Dana Pastırma 70 g',
      description:
        "Danet Çemeni Sıyrılmış Dana Pastırma, geleneksel pastırma çemeniyle üretildikten sonra çemeni sıyrılarak dilimlenmiş 70 g'lık dana pastırmasıdır. İçindekiler dana eti ile pastırma çemenidir (buğday unu, kırmızıbiber, sarımsak, tuz, askorbik asit, sodyum nitrit). Etiket gluten içerdiğini belirtir.\n\nÜrünün İslami usullere göre, veteriner hekim kontrolünde kesilmiş etlerden üretildiği ve domuz eti/yağı içermediği beyan edilir; ambalajda HALAL FOOD CERTIFIED logosu bulunur. Doğrudan veya pişirilerek tüketilir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0F18SN68L — 3’lü lezzet paketi) ve ürün ambalajı (EAN-13 8697403890325).",
      size: '70 g',
      items: [
        { ingredients: INGREDIENTS.beef },
        { ingredients: INGREDIENTS.wheatFlour },
        { ingredients: INGREDIENTS.redPepper },
        { ingredients: INGREDIENTS.garlic },
        { ingredients: INGREDIENTS.salt },
        { ingredients: INGREDIENTS.ascorbicAcid },
      ],
      allergens: ALLERGEN_GLUTEN_ID,
      additives: [ADDITIVES.e300, ADDITIVES.e250],
      nutrition: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 848, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 201, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 5, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 2, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 1, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0.3, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 35, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 5, unit: 'g' },
      ],
      labels: ['halal-certified', 'recyclable'],
      specs: [
        { key: 'Marka', value: 'Danet' },
        { key: 'Ürün Tipi', value: 'Çemeni sıyrılmış dana pastırma (dilimlenmiş)' },
        { key: 'Menşe', value: 'Türkiye' },
        ...PRODUCER_SPECS,
        { key: 'Net Miktar', value: '70 g' },
        { key: 'Ambalaj', value: 'Vakumlu şeffaf ambalaj (PVC/LDPE/PET)' },
        { key: 'EAN-13', value: '8697403890325' },
        { key: 'Amazon ASIN', value: ASIN },
        { key: 'Amazon Satış Biçimi', value: 'Dana Sucuk-Pastırma-Kavurma 3’lü Lezzet Paketi (demet)' },
        { key: 'Helal', value: 'Ambalajda HALAL FOOD CERTIFIED logosu bulunur' },
        { key: 'Alerjen Beyanı', value: 'Gluten içerir (pastırma çemenindeki buğday unu)' },
        {
          key: 'Besin Tablosu Notu',
          value: 'Değerler 100 g için basılıdır: 848 kJ / 201 kcal, yağ 5 g, doymuş 2 g, karbonhidrat 1 g, şeker 0,3 g, protein 35 g, tuz 5 g.',
        },
        { key: 'Fiyat Bilgisi', value: 'Amazon.com.tr’de 4 Kasım 2026 itibarıyla “Şu anda mevcut değil”' },
      ],
      warnings: [
        { severity: 'medium', text: 'Gluten içerir; çölyak hastaları ve gluten duyarlılığı olanlar tüketmemelidir.' },
        { severity: 'low', text: '0/+4 °C’de saklanmalı, son tüketim tarihi geçmiş ürün tüketilmemelidir.' },
      ],
      storage: '0/+4 °C’de buzdolabında muhafaza ediniz.',
      usage: 'Doğrudan veya pişirilerek tüketilir.',
      skuSuffix: 'PASTIRMA',
      images: [
        { key: 'front', file: 'pastirma-front.jpg', alt: 'Danet Çemeni Sıyrılmış Dana Pastırma 70 g ön yüz; dilimlenmiş pastırma, HALAL FOOD CERTIFIED logosu' },
        { key: 'label', file: 'pastirma-label.jpg', alt: 'Danet Dana Pastırma 70 g etiketi: içindekiler, alerjen uyarısı ve besin değerleri tablosu' },
        { key: 'nutrition', file: 'pastirma-nutrition.jpg', alt: 'Danet Dana Pastırma 70 g besin değerleri tablosu (100 g: 848 kJ / 201 kcal)' },
        { key: 'barcode', file: 'pastirma-barcode.jpg', alt: 'Danet Dana Pastırma 70 g barkod numarası 8697403890325' },
      ],
      gallery: (media) => ({
        frontImage: media.front,
        ingredientsImage: media.label,
        nutritionImage: media.nutrition,
        additionalImages: [{ image: media.barcode, caption: 'Barkod 8697403890325' }],
      }),
    },
    {
      barcode: '8697403890547',
      name: 'Danet Dana Kavurma',
      description:
        "Danet Dana Kavurma, dana eti, dana yağı ve sofra tuzundan üretilmiş, vakumlu ambalajda satılan kavurmadır. Etiket, etlerin İslami usullere göre veteriner hekim kontrolünde kesildiğini ve üründe domuz eti, yağı veya katkısı bulunmadığını belirtir; ambalajda HALAL FOOD CERTIFIED logosu vardır. Doğrudan veya pişirilerek tüketilir; 0/+4 °C'de saklanır.\n\nNet miktar ambalaj üzerinde yazılıdır. Veri kaynağı: Amazon.com.tr (ASIN B0F18SN68L — 3’lü lezzet paketi) ve ürün ambalajı (EAN-13 8697403890547).",
      size: null,
      items: [
        { ingredients: INGREDIENTS.beef },
        { ingredients: INGREDIENTS.beefFat },
        { ingredients: INGREDIENTS.salt },
      ],
      allergens: null,
      additives: [],
      nutrition: [
        { nutrient: NUTRIENT_IDS.energyKj, amount: 1486, unit: 'kJ' },
        { nutrient: NUTRIENT_IDS.energyKcal, amount: 355, unit: 'kcal' },
        { nutrient: NUTRIENT_IDS.fat, amount: 30, unit: 'g' },
        { nutrient: NUTRIENT_IDS.saturatedFat, amount: 16, unit: 'g' },
        { nutrient: NUTRIENT_IDS.carbohydrate, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.sugars, amount: 0, unit: 'g' },
        { nutrient: NUTRIENT_IDS.protein, amount: 25, unit: 'g' },
        { nutrient: NUTRIENT_IDS.salt, amount: 2, unit: 'g' },
      ],
      labels: ['halal-certified', 'recyclable'],
      specs: [
        { key: 'Marka', value: 'Danet' },
        { key: 'Ürün Tipi', value: 'Dana kavurma' },
        { key: 'Menşe', value: 'Türkiye' },
        ...PRODUCER_SPECS,
        { key: 'Net Miktar', value: 'Ambalaj üzerinde yazılıdır' },
        { key: 'Ambalaj', value: 'Vakumlu şeffaf ambalaj' },
        { key: 'EAN-13', value: '8697403890547' },
        { key: 'Amazon ASIN', value: ASIN },
        { key: 'Amazon Satış Biçimi', value: 'Dana Sucuk-Pastırma-Kavurma 3’lü Lezzet Paketi (demet)' },
        { key: 'Helal', value: 'Ambalajda HALAL FOOD CERTIFIED logosu bulunur' },
        { key: 'Katkı Maddesi', value: 'İçermez (dana eti, dana yağı, sofra tuzu)' },
        {
          key: 'Besin Tablosu Notu',
          value: 'Değerler 100 g için basılıdır: 355 kcal / 1486 kJ, yağ 30 g, doymuş 16 g, karbonhidrat 0 g, şeker 0 g, protein 25 g, tuz 2 g.',
        },
        { key: 'Fiyat Bilgisi', value: 'Amazon.com.tr’de 4 Kasım 2026 itibarıyla “Şu anda mevcut değil”' },
      ],
      warnings: [
        { severity: 'low', text: '0/+4 °C’de saklanmalı; son tüketim tarihi geçmiş ürün tüketilmemelidir.' },
      ],
      storage: '0/+4 °C’de muhafaza ediniz.',
      usage: 'Direkt veya pişirilerek tüketilir.',
      skuSuffix: 'KAVURMA',
      images: [
        { key: 'front', file: 'kavurma-front.jpg', alt: 'Danet Dana Kavurma ön yüz; vakumlu paket, HALAL FOOD CERTIFIED logosu' },
        { key: 'label', file: 'kavurma-label.jpg', alt: 'Danet Dana Kavurma etiketi: içindekiler, saklama koşulları ve üretici bilgileri' },
        { key: 'nutrition', file: 'kavurma-nutrition.jpg', alt: 'Danet Dana Kavurma besin değerleri tablosu (100 g: 355 kcal / 1486 kJ)' },
        { key: 'barcode', file: 'kavurma-barcode.jpg', alt: 'Danet Dana Kavurma barkod numarası 8697403890547' },
      ],
      gallery: (media) => ({
        frontImage: media.front,
        ingredientsImage: media.label,
        nutritionImage: media.nutrition,
        additionalImages: [{ image: media.barcode, caption: 'Barkod 8697403890547' }],
      }),
    },
  ]

  for (const seed of seeds) {
    assertEan13(seed.barcode)
    console.log(`\n${seed.name} (${seed.barcode})`)
    const media = await ensureMedia(client, seed.images)
    const gallery = seed.gallery(media)

    const data = {
      barcode: seed.barcode,
      name: seed.name,
      description: seed.description,
      brand: BRAND_ID,
      category: CATEGORY_ID,
      manufacturer: MANUFACTURER,
      country: COUNTRY_ID,
      size: seed.size,
      packaging: seed.skuSuffix === 'SUCUK'
        ? 'Vakumlu şeffaf ambalaj (LDPE)'
        : seed.skuSuffix === 'PASTIRMA'
          ? 'Vakumlu şeffaf ambalaj (PVC/LDPE/PET)'
          : 'Vakumlu şeffaf ambalaj',
      items: seed.items,
      allergens: seed.allergens,
      additives: seed.additives,
      nutrition: { per: '100g' as const, items: seed.nutrition },
      labels: seed.labels,
      specifications: seed.specs,
      warnings: seed.warnings,
      storage: seed.storage,
      usage: seed.usage,
      model: ASIN,
      sku: `AMZ-${ASIN}-${seed.skuSuffix}`,
      prices: [] as { amount: number; date: string }[],
      frontImage: gallery.frontImage,
      ingredientsImage: gallery.ingredientsImage ?? null,
      nutritionImage: gallery.nutritionImage ?? null,
      additionalImages: gallery.additionalImages,
      status: 'published' as const,
    }

    const existing = await client.findOne('products', { barcode: { equals: seed.barcode } })
    const product = existing
      ? await client.update('products', existing.id, data)
      : await client.create('products', data)

    console.log(`  ${existing ? 'güncellendi' : 'oluşturuldu'}: ${product.id}`)
    console.log(`  https://barkoddedektifi.com/urun/${seed.barcode}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
