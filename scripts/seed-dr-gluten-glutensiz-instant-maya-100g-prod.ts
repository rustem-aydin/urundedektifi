import path from 'node:path'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * Dr. Gluten Glutensiz İnstant Kuru Hamur Mayası 100 g ürününü UZAK Payload REST
 * API'sine yazar: master içindekiler, fotoğraflar ve ürün dokümanı.
 *
 * Kaynak: Amazon.com.tr ASIN B0GK2PYLVJ + ürün ambalajı (EAN-13 8683092521244,
 * ambalaj görselindeki barkoddan okundu ve kontrol hanesi doğrulandı).
 *
 * Ambalajda besin değerleri tablosu YOKTUR; onun yerine “Kimyasal Parametreler”
 * (nem, tuz, protein, kül, emülgatör) tablosu basılıdır ve tek galeri görselinin
 * çözünürlüğü bu değerleri okumaya yetmez → nutrition boş bırakıldı, uydurulmadı.
 *
 * İçindekiler: Doğal Maya (Saccharomyces cerevisiae), bitki kökenli emülgatör
 * (sorbitan monostearat = E491).
 *
 * Kullanım:
 *   SEED_TOKEN=$(cat scripts/.off-cache/token.txt | tr -d '\r\n') node --import tsx/esm scripts/seed-dr-gluten-glutensiz-instant-maya-100g-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const BARCODE = '8683092521244'
const ASIN = 'B0GK2PYLVJ'
const IMAGE_DIR = path.join(process.cwd(), '.seed-images', 'dr-gluten-instant-maya-100g')

const IMAGES = [
  {
    key: 'front',
    file: 'front.jpg',
    alt: 'Dr. Gluten Glutensiz İnstant Kuru Hamur Mayası 100 g ön yüz; glutensiz, yerli üretim',
  },
  {
    key: 'ingredients',
    file: 'ingredients.jpg',
    alt: 'Dr. Gluten Glutensiz İnstant Hamur Mayası içindekiler: doğal maya (Saccharomyces cerevisiae), bitki kökenli emülgatör (sorbitan monostearat)',
  },
  {
    key: 'recycling',
    file: 'recycling.jpg',
    alt: 'Dr. Gluten Glutensiz İnstant Hamur Mayası ambalaj sembolleri: ISO 9001, ISO 22000, ISO 10002, helal, Türk Malı, geri dönüşüm, gıda ile temasa uygun, temiz tutunuz',
  },
  {
    key: 'usage',
    file: 'usage.jpg',
    alt: 'Dr. Gluten Glutensiz İnstant Hamur Mayası saklama koşulları ve menşei: serin, kuru, güneş ışığından uzak ve kokusuz yerde; menşei Türkiye',
  },
  {
    key: 'barcode',
    file: 'barcode.jpg',
    alt: 'Dr. Gluten Glutensiz İnstant Hamur Mayası barkod numarası 8683092521244',
  },
] as const

const BRAND_ID = 846 // Dr. Gluten
const CATEGORY_ID = 15 // Diğer (diğer instant/kuru maya ürünleriyle aynı kategori)
const COUNTRY_ID = 1 // Türkiye
const INGREDIENT_YEAST_ID = 4444 // Doğal maya
const ADDITIVE_E491_ID = 472 // Sorbitan Monostearat (E491)

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
    name: 'Dr. Gluten Glutensiz İnstant Kuru Hamur Mayası 100 g',
    description:
      'Dr. Gluten Glutensiz İnstant Kuru Hamur Mayası, doğrudan una veya yoğurma sırasında hamura eklenebilen, glutensiz üretim için hazırlanmış instant (kuru) hamur mayasıdır. 100 g’lık tekli sachettir.\n\nAmbalaj bilgisi: içindekiler doğal maya (Saccharomyces cerevisiae) ve bitki kökenli emülgatör (sorbitan monostearat, E491). Ürün glutensizdir; menşei Türkiye’dir. Üretici, tesisin TS EN ISO 9001, ISO 22000 ve ISO 10002 sertifikalarına ve helal sertifikasına sahip olduğunu belirtir.\n\nVeri kaynağı: Amazon.com.tr (ASIN B0GK2PYLVJ) ve ürün ambalajı (EAN-13 8683092521244).',
    brand: BRAND_ID,
    category: CATEGORY_ID,
    manufacturer: 'OPTİ NATUREL İLAÇ GIDA SAN. TİC. LTD. ŞTİ.',
    country: COUNTRY_ID,
    size: '100 g',
    packaging: 'Tekli sachet (doypack); paket ağırlığı 110 g',
    items: [{ ingredients: INGREDIENT_YEAST_ID }],
    allergens: null,
    additives: [ADDITIVE_E491_ID],
    labels: ['gluten-free', 'halal-certified'],
    specifications: [
      { key: 'Marka', value: 'Dr. Gluten' },
      { key: 'Ürün Tipi', value: 'İnstant kuru hamur mayası (glutensiz)' },
      { key: 'Net Miktar', value: '100 g (3,52 oz)' },
      { key: 'Ambalaj', value: 'Tekli sachet (doypack)' },
      { key: 'Menşe', value: 'Türkiye' },
      { key: 'Üretici', value: 'OPTİ NATUREL İLAÇ GIDA SAN. TİC. LTD. ŞTİ.' },
      {
        key: 'Üretici Adresi',
        value:
          'Macun Mah. ATB (Ankara Ticaret Borsası) İş Merkezi I Blok No: 226, Yenimahalle / ANKARA',
      },
      { key: 'Üretici Telefonu', value: '+90 850 303 04 66 (faks +90 312 316 17 64)' },
      { key: 'Web', value: 'www.optinaturel.com.tr — tüketici@optinaturel.com.tr' },
      { key: 'Paketleme İşletme Kayıt No.', value: 'TR-06-K-051004' },
      { key: 'Üretici İşletme Kayıt No.', value: 'TR-41-K-000265' },
      {
        key: 'Kullanım',
        value:
          'Kuru mayayı doğrudan una ekleyebilir ya da yoğurmaya başladıktan 1 dakika sonra hamura ilave edebilirsiniz',
      },
      {
        key: 'Sertifikalar',
        value:
          'TS EN ISO 9001:2015, ISO 22000, ISO 10002, helal sertifikası; Türk Malı / yerli üretim',
      },
      {
        key: 'İçindekiler Beyanı',
        value:
          'Doğal maya (Saccharomyces cerevisiae), bitki kökenli emülgatör (sorbitan monostearat / E491)',
      },
      { key: 'Alerjen Beyanı', value: 'Ambalajda alerjen uyarısı yok' },
      {
        key: 'Besin Tablosu Notu',
        value:
          'Ambalajda besin değerleri tablosu yoktur; bunun yerine “Kimyasal Parametreler” (fermentasyon gücü, nem, tuz, protein, kül, emülgatör) tablosu basılıdır. Tek galeri görselinin çözünürlüğü bu değerleri güvenilir okumaya yetmediği için besin değerleri boş bırakıldı.',
      },
      { key: 'GTİN-14', value: '08683092521244' },
      { key: 'EAN-13', value: BARCODE },
      { key: 'Amazon ASIN', value: ASIN },
      { key: 'Amazon Satış Biçimi', value: 'Tekli 100 g paket' },
      { key: 'Ürün Ölçüleri', value: '21,9 × 12,6 × 2,1 cm (paket, Amazon ölçümü); 110 g' },
      {
        key: 'Fiyat Kaynağı',
        value:
          'Amazon.com.tr — 153,76 TL (100 g; önceki fiyat 195,49 TL, %21 indirim, 4 Kasım 2026)',
      },
    ],
    warnings: [
      {
        severity: 'low' as const,
        text: 'Serin, kuru, güneş ışığından uzak ve kokusuz yerde saklayın.',
      },
      {
        severity: 'low' as const,
        text: 'Ambalaj üzerindeki son tüketim tarihi ve parti bilgisini tüketim öncesi kontrol edin.',
      },
    ],
    storage:
      'Serin, kuru, güneş ışığından uzak ve kokusuz yerde saklayınız.',
    usage:
      'Kuru mayayı doğrudan una ekleyebilir ya da yoğurmaya başladıktan 1 dakika sonra hamura ilave edebilirsiniz.',
    model: ASIN,
    sku: `AMZ-${ASIN}`,
    prices: [{ amount: 153.76, date: '2026-11-04T00:00:00.000Z' }],
    frontImage: media.front,
    ingredientsImage: media.ingredients,
    recyclingImage: media.recycling,
    additionalImages: [
      { image: media.usage, caption: 'Saklama koşulları ve menşei' },
      { image: media.barcode, caption: 'Barkod 8683092521244' },
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
