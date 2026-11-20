import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createPayloadClient, type PayloadClient } from './lib/payload-rest'

/**
 * GİMDES uzmanını (helal sertifikasyon kuruluşu), "Helal" konusunu, kendi
 * derecelendirme ölçeğini ve marka kurallarını UZAK Payload REST API'sine yazar.
 *
 * Kaynaklar (2026-11-20):
 *   - https://www.gimdes.org/akreditasyonlarimiz-ve-taninmalarimiz.html
 *   - https://www.gimdes.org/logo-marka-ve-belge-kullanim-talimati-2
 *   - https://www.gimdes.com/SertifikaAra?query=erpilic (resmî sertifika sorgusu)
 *
 * Idempotent: uzman slug, konu slug, derece (uzman+ad) ve kural (uzman+ad)
 * anahtarlarıyla upsert eder; planda olmayan kural/dereceleri siler.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-gimdes-prod.ts
 *   SEED_TOKEN=... node --import tsx/esm scripts/seed-gimdes-prod.ts
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const TOKEN = process.env.SEED_TOKEN ?? ''

if (!TOKEN && (!EMAIL || !PASSWORD)) {
  console.error('SEED_TOKEN ya da SEED_EMAIL + SEED_PASSWORD gerekli.')
  process.exit(1)
}

const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD, token: TOKEN })

const ASSET_DIR = path.join(process.cwd(), '.seed-images', 'gimdes')
// Resmî helal sertifikasyon markası (kare site simgesi, 512×512, saydam zemin).
const LOGO_URL = 'https://www.gimdes.org/wp-content/uploads/cropped-site-icon-2.png'
const LOGO_ALT = 'GİMDES logosu'

const EXPERT = {
  name: 'GİMDES',
  slug: 'gimdes',
  title: 'Helal ve Tayyib Sertifikasyon Kuruluşu',
  bio: [
    'GİMDES (Gıda ve İhtiyaç Maddeleri Denetleme ve Sertifikalama Araştırmaları Derneği), 2005 yılında İstanbul’da kurulan ve Türkiye’nin ilk helal sertifikalama kuruluşu olan sivil toplum kuruluşudur. Gıda, kozmetik ve temizlik ürünlerinde helal ve tayyib denetimi yaparak sertifika verir.',
    'Sertifikasyon, GİMDES Helal Standardı’na göre ürün grubu bazında yürütülür: GİMDES 114 (helal ürün), 150 (tabiî ürünler), 200 (helal kesim), 210 (yem ve rasyon) ve 220 (et ve et ürünleri). Belge markaya değil, başvuruda beyan edilen ürün gruplarına verilir; bu yüzden aynı markanın sertifika kapsamı dışındaki ürünleri helal sertifikalı sayılmaz.',
    'GİMDES; Malezya’da JAKIM, Endonezya’da BPJPH, Fas’ta IMANOR ve Türkiye’de Helal Akreditasyon Kurumu (HAK) tarafından akredite edilmiştir. HAK akreditasyonu 2024-059 numarasıyla 16.07.2024 – 16.07.2029 arasında geçerlidir ve OIC/SMIIC 1:2019 (helal gıda) ile OIC/SMIIC 4:2018 (helal kozmetik) standartlarını kapsar. Sertifikaları Katar Halk Sağlığı Bakanlığı (MOPH) ve Tayland Merkez İslam Konseyi (CICOT) tarafından tanınır; GİMDES 2008’den beri World Halal Council üyesidir ve konseyin başkan yardımcılığını yürütür.',
    'Bu uzmandaki marka kuralı, markanın GİMDES’in resmî sertifika sorgu kaydında geçerli bir belgesi olduğunu gösterir. Belge ürün grubu bazında verildiği için ürünün kapsamda olup olmadığı ambalajdaki GİMDES logosu ve sertifika numarasıyla doğrulanmalıdır. GİMDES kaydının bulunmaması ürünün haram olduğu anlamına gelmez; başka kuruluşların sertifikaları bu kaydın dışındadır.',
    'Her kuralın kaynağı GİMDES’in resmî sertifika sorgu sonucudur (gimdes.com/SertifikaAra); kayıt tarihi ve belge geçerliliği kural metninde belirtilir. Bu profil GİMDES’in kamuya açık kayıtlarını okuyan bağımsız bir doğrulama katmanıdır; GİMDES ile ortaklık veya onay ilişkisi iddiası taşımaz.',
  ].join('\n\n'),
  verified: true,
  isPublic: true,
  socialLinks: {
    website: 'https://www.gimdes.org',
    twitter: 'https://x.com/GIMDES',
    instagram: 'https://www.instagram.com/gimdes/',
    youtube: 'https://www.youtube.com/@gimdes',
  },
  credentials: [
    {
      title: 'HAK Helal Akreditasyon Belgesi (No: 2024-059)',
      year: 2024,
      issuer: 'T.C. Helal Akreditasyon Kurumu (HAK)',
    },
    { title: 'JAKIM Helal Sertifikalama Akreditasyonu', issuer: 'JAKIM — Malezya' },
    { title: 'BPJPH Helal Sertifikalama Akreditasyonu', issuer: 'BPJPH — Endonezya' },
    { title: 'IMANOR Helal Sertifikalama Akreditasyonu', issuer: 'IMANOR — Fas' },
    {
      title: 'MOPH Helal Sertifika Tanınması',
      issuer: 'Katar Halk Sağlığı Bakanlığı (MOPH)',
    },
    {
      title: 'CICOT Helal Sertifika Tanınması',
      issuer: 'Tayland Merkez İslam Konseyi (CICOT)',
    },
    {
      title: 'World Halal Council üyeliği ve Başkan Yardımcılığı',
      year: 2008,
      issuer: 'World Halal Council (WHC)',
    },
    {
      title: 'Türk Patent ve Marka Kurumu tescilli GİMDES logosu',
      issuer: 'Türk Patent ve Marka Kurumu',
    },
  ],
} as const

const TOPIC = {
  name: 'Helal',
  slug: 'helal',
  description:
    'İslami usullere uygun üretim ve helal sertifikasyonu: kesim, içerik, katkı ve üretim süreçlerinin helal ve tayyib ölçütlerine uygunluğu. GİMDES uzmanı, markanın geçerli helal sertifikasını ve belgenin kapsadığı ürün gruplarını değerlendirir.',
  icon: '☪️',
  color: '#16a34a',
  order: 2,
} as const

/** Dereceler: "Sertifikalı" yalnız ürün grubu kapsamı doğrulandığında kullanılır. */
const RATINGS = [
  {
    name: 'GİMDES Sertifikalı',
    color: '#16a34a',
    order: 0,
    description:
      'Ürün, geçerli bir GİMDES helal sertifikasının kapsadığı ürün grubunda yer alır ve ambalajında GİMDES logosu ile sertifika numarası bulunur.',
  },
  {
    name: 'Kısmi Sertifika',
    color: '#f59e0b',
    order: 1,
    description:
      'Markanın geçerli bir GİMDES sertifikası vardır ancak belge markanın tamamını değil, belirli ürün gruplarını kapsar. Ürünün kapsamda olduğu yalnız ambalajdaki GİMDES logosu ve sertifika numarasıyla doğrulanabilir.',
  },
  {
    name: 'Sertifikasız',
    color: '#6b7280',
    order: 2,
    description:
      'GİMDES’in resmî sertifika sorgusunda marka için geçerli bir belge bulunamadı. Bu, ürünün haram olduğu anlamına gelmez; başka kuruluşların sertifikaları bu kaydın dışındadır.',
  },
  {
    name: 'Askıda / İptal',
    color: '#dc2626',
    order: 3,
    description:
      'Markanın GİMDES belgesi askıya alınmış, geri çekilmiş veya süresi dolmuş durumda. Belge yenilenene kadar ürün helal sertifikalı sayılmaz.',
  },
] as const

const RULES = [
  {
    name: 'Erpiliç — GİMDES Helal Sertifikası (200-046 / 220-046)',
    ruleType: 'brand' as const,
    brandId: 274,
    brandName: 'Erpilic',
    ratingName: 'Kısmi Sertifika',
    description: [
      'Erpiliç Entegre Tavukçuluk (Bolu), GİMDES’in resmî sertifika sorgusunda 27.11.2026 tarihine kadar geçerli iki belgeyle kayıtlıdır:',
      '• 200-046 — Beyaz et (tavuk ve hindi): bütün/parça piliç taze ve donmuş et, sakatat ve MDM. İlk belge tarihi 27.10.2009.',
      '• 220-046 — İşlenmiş et ürünleri: kaplamalı ürünler (schnitzel, nugget, kroket, cordon bleu, çıtır ürünler), köfte grubu, döner ve soslu ürünler ile şarküteri grubunda piliç jambon. İlk belge tarihi 27.11.2014.',
      'Aynı sertifika numaraları İmren ve Göynük Piliç markaları için de geçerlidir.',
      'Belge markaya değil ürün grubuna verilir: 220-046 kapsam listesinde piliç salam, sosis veya sucuk yer almamaktadır. Bu nedenle ürünün kapsamda olduğu ambalajdaki GİMDES logosu ve sertifika numarasıyla doğrulanmalıdır; GİMDES talimatına göre sertifikalı her ambalajda kuruluşa özgü sertifika numarası bulunmak zorundadır.',
      'GİMDES kaydının bulunmaması ürünün haram olduğu anlamına gelmez; başka kuruluşların sertifikaları bu değerlendirmenin dışındadır.',
    ].join('\n\n'),
    sources: [
      {
        title: 'GİMDES Helal Sertifika Sorgulama — ERPİLİÇ (200-046, 220-046)',
        url: 'https://www.gimdes.com/SertifikaAra?query=erpilic',
      },
      {
        title: 'GİMDES — Akreditasyonlarımız ve Tanınmalarımız',
        url: 'https://www.gimdes.org/akreditasyonlarimiz-ve-taninmalarimiz.html',
      },
      {
        title: 'GİMDES — Logo, Marka ve Belge Kullanım Talimatı',
        url: 'https://www.gimdes.org/logo-marka-ve-belge-kullanim-talimati-2',
      },
    ],
  },
] as const

type Doc = { id: number; name?: string; slug?: string; alt?: string }

async function findOne(
  collection: string,
  where: Record<string, unknown>,
): Promise<Doc | undefined> {
  return (await client.findOne(collection, where)) as Doc | undefined
}

/** Resmî GİMDES helal markasını indirir; avatar için en az 400×400 kare olmalı. */
async function prepareLogo(): Promise<string> {
  fs.mkdirSync(ASSET_DIR, { recursive: true })
  const iconPath = path.join(ASSET_DIR, 'gimdes-icon.png')

  if (!fs.existsSync(iconPath)) {
    const res = await fetch(LOGO_URL)
    if (!res.ok) throw new Error(`Logo indirilemedi: ${res.status} ${LOGO_URL}`)
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 1000) throw new Error('Logo yanıtı beklenenden küçük')
    fs.writeFileSync(iconPath, bytes)
    console.log(`  ↓ logo indirildi (${bytes.length} bayt)`)
  }

  const meta = await sharp(iconPath).metadata()
  if (!meta.width || !meta.height || meta.width !== meta.height || meta.width < 400) {
    throw new Error(`Logo kare ve en az 400×400 olmalı: ${meta.width}×${meta.height}`)
  }
  return iconPath
}

async function ensureLogoMedia(): Promise<number> {
  const existing = await findOne('media', { alt: { equals: LOGO_ALT } })
  if (existing) {
    console.log(`  = logo medyası mevcut (#${existing.id})`)
    return existing.id
  }
  const iconPath = await prepareLogo()
  const media = await client.upload('media', iconPath, { alt: LOGO_ALT })
  console.log(`  + logo medyası yüklendi (#${media.id})`)
  return media.id
}

async function upsertExpert(avatar: number): Promise<Doc> {
  const existing = await findOne('experts', { slug: { equals: EXPERT.slug } })
  const data = { ...EXPERT, avatar }
  if (existing) {
    const doc = await client.update('experts', existing.id, data)
    console.log(`  = uzman güncellendi (#${doc.id})`)
    return doc as Doc
  }
  const doc = await client.create('experts', data)
  console.log(`  + uzman oluşturuldu (#${doc.id})`)
  return doc as Doc
}

async function upsertTopic(): Promise<Doc> {
  const existing = await findOne('topics', { slug: { equals: TOPIC.slug } })
  if (existing) {
    const doc = await client.update('topics', existing.id, TOPIC)
    console.log(`  = konu güncellendi (#${doc.id})`)
    return doc as Doc
  }
  const doc = await client.create('topics', TOPIC)
  console.log(`  + konu oluşturuldu (#${doc.id})`)
  return doc as Doc
}

async function upsertRatings(expertId: number): Promise<Map<string, number>> {
  const ids = new Map<string, number>()
  for (const rating of RATINGS) {
    const existing = await findOne('rating-scales', {
      and: [{ expert: { equals: expertId } }, { name: { equals: rating.name } }],
    })
    const data = { ...rating, expert: expertId }
    const doc = existing
      ? await client.update('rating-scales', existing.id, data)
      : await client.create('rating-scales', data)
    ids.set(rating.name, doc.id)
    console.log(`  ${existing ? '=' : '+'} derece "${rating.name}" (#${doc.id})`)
  }
  return ids
}

async function upsertRules(
  expertId: number,
  topicId: number,
  ratingIds: Map<string, number>,
): Promise<void> {
  const wanted = new Set<string>(RULES.map((rule) => rule.name))

  for (const rule of RULES) {
    const ratingId = ratingIds.get(rule.ratingName)
    if (!ratingId) throw new Error(`Derece bulunamadı: ${rule.ratingName}`)

    const data = {
      name: rule.name,
      expert: expertId,
      topic: topicId,
      rating: ratingId,
      ruleType: rule.ruleType,
      brand: rule.brandId,
      description: rule.description,
      sources: rule.sources,
      isActive: true,
    }
    const existing = await findOne('expert-rules', {
      and: [{ expert: { equals: expertId } }, { name: { equals: rule.name } }],
    })
    const doc = existing
      ? await client.update('expert-rules', existing.id, data)
      : await client.create('expert-rules', data)
    console.log(`  ${existing ? '=' : '+'} kural "${rule.name}" (#${doc.id}) → ${rule.brandName}`)
  }

  // Planda olmayan GİMDES kuralları kalırsa aynı ürün için ikinci hüküm üretir.
  const current = (await client.findAll('expert-rules', {
    where: { expert: { equals: expertId } },
    limit: 100,
    depth: 0,
  })) as unknown as Doc[]
  for (const doc of current) {
    if (doc.name && wanted.has(doc.name)) continue
    await client.remove('expert-rules', doc.id)
    console.log(`  − eski kural silindi (#${doc.id} ${doc.name})`)
  }
}

async function main() {
  console.log(`Hedef: ${client.api}`)
  await client.login()

  const avatar = await ensureLogoMedia()
  const expert = await upsertExpert(avatar)
  const topic = await upsertTopic()
  const ratingIds = await upsertRatings(expert.id)
  await upsertRules(expert.id, topic.id, ratingIds)

  const verify = await findOne('expert-rules', {
    and: [{ expert: { equals: expert.id } }, { name: { equals: RULES[0].name } }],
  })
  console.log(`\nUzman #${expert.id} · konu #${topic.id} · kural #${verify?.id ?? '?'}`)
  console.log(`https://barkoddedektifi.com/uzmanlar/${EXPERT.slug}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
