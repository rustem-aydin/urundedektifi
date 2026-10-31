import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionSlug, Payload, Where } from 'payload'
import type { ExpertRule } from '@/payload-types'

/**
 * "Boykot Dedektifi" uzmanının kendi veri seti: boykotdedektifi.com'da yayımlanan
 * 3.950 marka ve her markanın güncel durumu. Site kendi kurallarını ve markalarını
 * girer gibi, bu uzman da kendi derecelendirme ölçeği + marka başına bir kural yazar.
 *
 * Kaynak: https://boykotdedektifi.com/site-haritasi (marka sayfaları, 2026-10-27).
 * Dereceler sitedeki durum rozetleriyle birebir aynıdır:
 *   Boykot · İkincil Boykot · Ahlaken Boykot · Şüpheli · Araştırılıyor · Uygun
 */

export type SeedSource = { title: string; url: string }

const SITE = 'https://boykotdedektifi.com'

type SiteStatus =
  | 'Boykot'
  | 'İkincil Boykot'
  | 'Ahlaken Boykot'
  | 'Şüpheli'
  | 'Araştırılıyor'
  | 'Uygun'

type SiteBrandRecord = {
  name: string
  siteSlug: string
  status: SiteStatus
  owner: string | null
  country: string | null
  categories: string[]
  about: string | null
  verdict: string | null
  views: number | null
}

const DATA_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'boykot-dedektifi-brands.json',
)

/** Site veri seti (3.950 marka) diskten okunur — tsc'yi milyonlarca literal tipiyle yormamak için. */
const SITE_BRANDS: SiteBrandRecord[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))

export const SITE_SOURCE: SeedSource = {
  title: 'Boykot Dedektifi — Marka veritabanı (site haritası)',
  url: `${SITE}/site-haritas`,
}

/** Derece tanımları: sitedeki rozet rengi ve sırası korunur. */
const RATING_DEFS: Record<SiteStatus, { color: string; order: number; description: string }> = {
  Boykot: {
    color: '#ba191c',
    order: 0,
    description:
      'Doğrudan boykot: marka işgal, apartheid veya Gazze saldırılarıyla belgelenmiş biçimde ilişkilendirilmiştir. Boykot Dedektifi bu markayı kesin boykot listesinde tutar.',
  },
  'İkincil Boykot': {
    color: '#fc8405',
    order: 1,
    description:
      'İkincil boykot: marka doğrudan hedef değildir; boykotlu bir ana şirkete, gruba veya tedarik zincirine bağlı olduğu için listelenir.',
  },
  'Ahlaken Boykot': {
    color: '#00008c',
    order: 2,
    description:
      'Ahlaken boykot: belgelenmiş doğrudan suç ortaklığı yerine ahlaki gerekçelerle (siyasi destek, söylem, lobi faaliyeti) boykot önerilir.',
  },
  'Şüpheli': {
    color: '#fcd30c',
    order: 3,
    description:
      "Şüpheli: markanın boykotlu yapılarla bağlantısına dair ciddi emare vardır ancak bağlantı kesinleşmemiştir; 'Boykot' ile eşitlenmez.",
  },
  'Araştırılıyor': {
    color: '#465468',
    order: 4,
    description:
      'Araştırılıyor: marka hakkında ihbar/iddia bulunur, inceleme sürer. Henüz bir hüküm verilmemiştir.',
  },
  'Uygun': {
    color: '#267f78',
    order: 5,
    description:
      'Uygun: yapılan incelemede boykot gerekçesi oluşturacak bir bağlantı bulunmamıştır.',
  },
}

export const RATINGS = (Object.keys(RATING_DEFS) as SiteStatus[]).map((name) => ({
  name,
  ...RATING_DEFS[name],
}))

export const EXPERT = {
  name: 'Boykot Dedektifi',
  slug: 'boykot-dedektifi',
  title: 'Bağımsız Boykot Araştırma Platformu',
  bio: [
    'Boykot Dedektifi, tüketicilerin bilinçli ve etik seçimler yapabilmesi için kapsamlı bir marka veritabanı sunan bağımsız bir boykot değerlendirme platformudur. Markalar boykot gerekçeleriyle birlikte kayıtlıdır; mobil uygulamada barkod taramasıyla rafın önünde sorgulanabilir.',
    "Bu uzmanın veri seti boykotdedektifi.com'daki güncel marka veritabanıdır: 3.950 marka, altı dereceli tek ölçek. Her marka kendi durum rozetiyle (Boykot, İkincil Boykot, Ahlaken Boykot, Şüpheli, Araştırılıyor, Uygun) ve kendi gerekçe metniyle kayıtlıdır.",
    'Dereceler birbirinin yerine geçmez: "Şüpheli" ve "Araştırılıyor" kayıtları kesin boykot değildir; "Uygun" kayıtları ise incelemede bağlantı bulunmadığını gösterir. Markanın durumu değiştiğinde marka kaydı ve kuralı birlikte güncellenir.',
    'Her marka kuralının altında markanın Boykot Dedektifi sayfası kaynak olarak bağlanır.',
  ].join('\n\n'),
  socialLinks: {
    website: SITE,
    twitter: 'https://x.com/B0YKOTDedektifi',
    instagram: 'https://www.instagram.com/boykotdedektifi',
    youtube: 'https://www.youtube.com/@boykotdedektifi',
  },
  credentials: [
    {
      title: 'Dünyanın en büyük boykot platformu — marka ve ürün veritabanı',
      year: 2026,
      issuer: 'Boykot Dedektifi',
    },
    {
      title: 'Google Play uygulaması — 1 Mn+ indirme, 95,1 B değerlendirme',
      year: 2026,
      issuer: 'Google Play',
    },
    {
      title: 'App Store uygulaması — 4,9/5 puan, 33 B değerlendirme',
      year: 2026,
      issuer: 'Apple App Store',
    },
  ],
}

export const TOPIC = {
  name: 'Boykot',
  slug: 'boykot',
  description:
    "Bir markanın İsrail'in işgali, apartheid rejimi ya da Filistin'e yönelik saldırılarla belgelenmiş bağlantısı. Boykot Dedektifi'nin marka veritabanı, altı dereceli tek ölçekle değerlendirilir.",
  icon: '🛑',
  color: '#dc2626',
  order: 1,
}

const IL_COUNTRY = {
  name: 'İsrail',
  slug: 'israil',
  code: '729',
  iso: 'IL',
}

export type BrandSeedData = {
  name: string
  slug: string
  country?: string
  description: string
}

export type SeedBrand = { name: string; data: BrandSeedData }

export type SeedRule = {
  name: string
  ruleType: ExpertRule['ruleType']
  ratingName: SiteStatus
  brandName: string
  description: string
  sources: SeedSource[]
}

export type SeedPlan = {
  country: typeof IL_COUNTRY
  topic: typeof TOPIC
  expert: typeof EXPERT
  ratings: typeof RATINGS
  brands: SeedBrand[]
  rules: SeedRule[]
}

/** Yerel (Local API) ve uzak (REST) yazıcıların paylaştığı tek veri planı. */
export function buildSeedPlan(): SeedPlan {
  const brands: SeedBrand[] = []
  const rules: SeedRule[] = []

  for (const record of SITE_BRANDS) {
    const source: SeedSource = { title: `Boykot Dedektifi — ${record.name}`, url: `${SITE}/b/${record.siteSlug}` }
    const rating = RATING_DEFS[record.status]
    if (!rating) continue

    const data: BrandSeedData = {
      name: record.name,
      slug: record.siteSlug,
      description: buildBrandDescription(record),
    }
    if (record.country) data.country = record.country
    brands.push({ name: record.name, data })

    rules.push({
      name: `${record.name} — ${record.status}`,
      ruleType: 'brand',
      ratingName: record.status,
      brandName: record.name,
      description: buildRuleDescription(record),
      sources: [source],
    })
  }

  rules.push({
    name: 'İsrail Menşeli Ürün (GS1 729)',
    ruleType: 'country',
    ratingName: 'Boykot',
    brandName: '',
    description: [
      "Ürünün menşe ülkesi İsrail olarak belirlendi. GS1 standartlarında 729 barkod prefix'i İsrail'e aittir ve bu prefix ile başlayan barkodlar İsrail kaynaklı ürünleri gösterir.",
      "BDS hareketi, iki koşulu karşılamadığı sürece tüm İsrail şirketlerinin boykot edilmesi çağrısı yapmaktadır: (a) İsrail'in askeri işgali, apartheid veya yerleşimci sömürgeciliğine bulaşmamış olmak, (b) Filistinlilerin uluslararası hukuk kapsamındaki haklarını, öncelikle UN 194 uyarınca mültecilerin geri dönüş hakkını kamuya açık şekilde tanımak.",
      "Uyarı: Yasadışı yerleşimlerde üretilen ürünler 'Product of Israel' etiketiyle satılabilir; etiket ile üretim yeri farklı olabilir. Bu nedenle menşe kaydı barkod prefix'i ile birlikte değerlendirilmelidir.",
    ].join('\n\n'),
    sources: [
      {
        title: 'BDS Hareketi — Boykot & Baskı Şirket Hedefleme Rehberi',
        url: 'https://www.bdsmovement.net/',
      },
      {
        title: 'GS1 — Ülke/prefiks listesi (729 = İsrail)',
        url: 'https://www.gs1.org/standards/barcodes/application-identifiers',
      },
    ],
  })

  return { country: IL_COUNTRY, topic: TOPIC, expert: EXPERT, ratings: RATINGS, brands, rules }
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function buildBrandDescription(record: SiteBrandRecord): string {
  const parts: string[] = []
  const about = clean(record.about)
  const categories = record.categories.map(clean).filter(Boolean)

  parts.push(about || `${record.name} markası${categories.length ? ` (${categories.join(', ')})` : ''}.`)
  if (record.owner) parts.push(`Ana şirket: ${record.owner}.`)
  if (record.country) parts.push(`Menşei: ${record.country}.`)
  if (categories.length) parts.push(`Kategori: ${categories.join(', ')}.`)
  parts.push(`Kaynak: ${SITE}/b/${record.siteSlug}`)

  return parts.join(' ')
}

function buildRuleDescription(record: SiteBrandRecord): string {
  const rating = RATING_DEFS[record.status]
  return [
    `"${record.name}" markası Boykot Dedektifi veritabanında "${record.status}" durumunda kayıtlıdır.`,
    rating.description,
    clean(record.verdict) || clean(record.about),
    `Kaynak: ${SITE}/b/${record.siteSlug}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

type SeedSummary = {
  countries: number
  brands: number
  updatedBrands: number
  rules: number
  updatedRules: number
  removedRules: number
  removedRatings: number
}

type RuleContext = {
  expertId: number
  topicId: number
  countryId: number
  ratingIdByName: Record<string, number>
  brandIdByName: Record<string, number>
}

export async function seedBoykotDedektifi(
  payload: Payload,
  log: (msg: string) => void = () => {},
): Promise<SeedSummary> {
  const plan = buildSeedPlan()
  const summary: SeedSummary = {
    countries: 0,
    brands: 0,
    updatedBrands: 0,
    rules: 0,
    updatedRules: 0,
    removedRules: 0,
    removedRatings: 0,
  }

  // 1) Ülke: İsrail (GS1 prefix 729)
  const countryId = await findId(payload, 'countries', { slug: { equals: plan.country.slug } })
  const country = countryId
    ? await payload.update({ collection: 'countries', id: countryId, data: plan.country })
    : await payload.create({ collection: 'countries', data: plan.country })
  if (!countryId) summary.countries++
  log(`Ülke hazır: ${plan.country.name} (prefix ${plan.country.code})`)

  // 2) Konu
  const topicId = await findId(payload, 'topics', { slug: { equals: plan.topic.slug } })
  const topic = topicId
    ? await payload.update({ collection: 'topics', id: topicId, data: plan.topic })
    : await payload.create({ collection: 'topics', data: plan.topic })
  log(`Konu hazır: ${plan.topic.name}`)

  // 3) Uzman
  const avatarId = await ensureAvatar(payload, log)
  const expertId = await findId(payload, 'experts', { slug: { equals: plan.expert.slug } })
  const expertData = {
    ...plan.expert,
    ...(avatarId ? { avatar: avatarId } : {}),
    verified: true,
    isPublic: true,
  }
  const expert = expertId
    ? await payload.update({ collection: 'experts', id: expertId, data: expertData })
    : await payload.create({ collection: 'experts', data: expertData })
  log(`Uzman hazır: ${plan.expert.name} (/uzmanlar/${plan.expert.slug})`)

  // 4) Derecelendirme ölçeği — sitedeki altı durum + kullanılmayan derecelerin temizliği
  const ratingIdByName: Record<string, number> = {}
  for (const rating of plan.ratings) {
    const existingId = await findId(payload, 'rating-scales', {
      and: [{ expert: { equals: expert.id } }, { name: { equals: rating.name } }],
    })
    const data = {
      name: rating.name,
      color: rating.color,
      order: rating.order,
      description: rating.description,
      expert: expert.id,
    }
    const doc = existingId
      ? await payload.update({ collection: 'rating-scales', id: existingId, data })
      : await payload.create({ collection: 'rating-scales', data })
    ratingIdByName[rating.name] = doc.id
  }
  log(`Derecelendirmeler hazır: ${plan.ratings.map((r) => r.name).join(', ')}`)

  const keptRatingIds = new Set(Object.values(ratingIdByName))
  const staleRatingIds = (await findAll(payload, 'rating-scales', {
    expert: { equals: expert.id },
  }))
    .map((doc) => doc.id as number)
    .filter((id) => !keptRatingIds.has(id))

  // 5) Markalar — sitedeki slug korunur, isim anahtarıyla idempotent upsert.
  // Önce aynı markanın eski yazımları birleştirilir (ör. "Intel" + "İntel", "McDonald's"
  // + "Mc Donald's"): kural tek markaya bağlanmalı, marka listesi kopya göstermemeli.
  await pruneLegacyBrands(payload, plan, log)
  await mergeDuplicateBrands(payload, plan, log)

  const brandIdByName: Record<string, number> = {}
  const brandIdBySlug: Record<string, number> = {}
  const brandIdByKey: Record<string, number> = {}
  const existingBrands = await findAll(payload, 'brands', {})
  for (const doc of existingBrands as { id: number; name?: string; slug?: string }[]) {
    if (doc.name) brandIdByName[doc.name] = doc.id
    if (doc.slug) brandIdBySlug[doc.slug] = doc.id
    if (doc.name) {
      const key = nameKey(doc.name)
      const seen = brandIdByKey[key]
      // Aynı normalize anahtara düşen birden çok kayıt varsa eşleştirme belirsizdir: kullanma.
      brandIdByKey[key] = seen === undefined ? doc.id : -1
    }
  }

  // Planda aynı normalize ada düşen ayrı markalar varsa (ör. "KIWI" + "Kiwi") normalize
  // eşleştirme kullanılmaz; yalnız tam ad veya slug eşleşmesi kabul edilir.
  const planKeyCount = new Map<string, number>()
  for (const brand of plan.brands) {
    const key = nameKey(brand.name)
    planKeyCount.set(key, (planKeyCount.get(key) ?? 0) + 1)
  }

  for (const [index, brand] of plan.brands.entries()) {
    const keyedId = brandIdByKey[nameKey(brand.name)]
    const ambiguous = (planKeyCount.get(nameKey(brand.name)) ?? 0) > 1
    const existingId =
      brandIdByName[brand.name] ??
      (!ambiguous && keyedId > 0 ? keyedId : undefined) ??
      brandIdBySlug[brand.data.slug]
    const doc = existingId
      ? await payload.update({ collection: 'brands', id: existingId, data: brand.data })
      : await payload.create({ collection: 'brands', data: brand.data })
    brandIdByName[brand.name] = doc.id as number
    if (existingId) summary.updatedBrands++
    else summary.brands++
    if ((index + 1) % 250 === 0) log(`Markalar: ${index + 1}/${plan.brands.length}`)
  }
  log(`Markalar hazır: ${plan.brands.length} kayıt (${summary.brands} yeni, ${summary.updatedBrands} güncel)`)

  // 6) Kurallar
  const context: RuleContext = {
    expertId: expert.id,
    topicId: topic.id,
    countryId: country.id,
    ratingIdByName,
    brandIdByName,
  }
  const keptRuleIds = new Set<number>()
  const currentRules = await findAll(payload, 'expert-rules', {
    and: [{ expert: { equals: expert.id } }, { topic: { equals: topic.id } }],
  })
  const ruleIdByName: Record<string, number> = {}
  for (const doc of currentRules as { id: number; name?: string }[]) {
    if (doc.name) ruleIdByName[doc.name] = doc.id
  }

  for (const [index, rule] of plan.rules.entries()) {
    const id = await upsertRule(payload, summary, context, rule, ruleIdByName)
    keptRuleIds.add(id)
    if ((index + 1) % 250 === 0) log(`Kurallar: ${index + 1}/${plan.rules.length}`)
  }
  log(`Kurallar hazır: ${plan.rules.length} adet (${summary.rules} yeni, ${summary.updatedRules} güncel)`)

  // 7) Bu uzmanın artık plana girmeyen kurallarını sil (eski iki katmanlı set)
  for (const stale of currentRules) {
    if (keptRuleIds.has(stale.id as number)) continue
    await payload.delete({ collection: 'expert-rules', id: stale.id as number })
    summary.removedRules++
  }
  if (summary.removedRules) log(`Eski kurallar silindi: ${summary.removedRules}`)

  // 8) Derece temizliği kural silindikten SONRA yapılır: expert_rules.rating_id zorunlu,
  //    dereceyi önce silmek FK'yi NULL'a düşürüp hata verir.
  for (const id of staleRatingIds) {
    await payload.delete({ collection: 'rating-scales', id })
    summary.removedRatings++
  }
  if (summary.removedRatings) log(`Eski dereceler silindi: ${summary.removedRatings}`)

  return summary
}

const ASSET_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets')
const AVATAR_FILENAME = 'boykot-dedektifi-icon.webp'
const AVATAR_ALT = 'Boykot Dedektifi logosu'

/** Uzman avatarı: gerçek marka ikonu (192x192 webp) ve medya alt metni. */
export const SEED_AVATAR = {
  filePath: path.join(ASSET_DIR, AVATAR_FILENAME),
  alt: AVATAR_ALT,
}

async function ensureAvatar(
  payload: Payload,
  log: (msg: string) => void,
): Promise<number | undefined> {
  const existingId = await findId(payload, 'media', { alt: { equals: AVATAR_ALT } })
  if (existingId) return existingId

  const filePath = path.join(ASSET_DIR, AVATAR_FILENAME)
  if (!fs.existsSync(filePath)) {
    log(`Avatar dosyası bulunamadı, alan boş bırakıldı: ${filePath}`)
    return undefined
  }

  const media = await payload.create({
    collection: 'media',
    data: { alt: AVATAR_ALT },
    filePath,
  })
  log(`Avatar yüklendi: ${AVATAR_ALT}`)
  return media.id as number
}

/**
 * Eski elle derlenmiş veri setinden (ADR öncesi 104 markalık liste) kalan ve yeni planda
 * YER ALMAYAN markalar. Ürünü, kuralı ya da bağlı markası yoksa silinir: aksi halde
 * kimsenin değerlendirmediği hayalet marka kayıtları kalırdı.
 */
export const LEGACY_BRANDS = new Set<string>([
  'Chevron',
  'Caltex',
  'Texaco',
  'Intel',
  'Hewlett Packard Enterprise',
  'Carrefour',
  'AXA',
  'RE/MAX',
  "McDonald's",
  'Coca-Cola',
  'FANUC',
  'Elbit Systems',
  'Maersk',
  'CAF',
  'Ring',
  'Teva',
  "Lay's",
  'Nescafé',
  'KitKat',
  "Carte d'Or",
  'Calvé',
  "M&M's",
  'Tic Tac',
  'ABC',
])

/** Sadece bu uzmanın planıyla çakışan eski kayıtlar; kullanıcı markalarına dokunulmaz. */
async function pruneLegacyBrands(
  payload: Payload,
  plan: SeedPlan,
  log: (msg: string) => void,
): Promise<number> {
  const planNames = new Set(plan.brands.map((b) => b.name))
  let removed = 0
  for (const doc of (await findAll(payload, 'brands', {})) as {
    id: number
    name?: string
  }[]) {
    if (!doc.name || !LEGACY_BRANDS.has(doc.name) || planNames.has(doc.name)) continue
    const [products, rules] = await Promise.all([
      payload.count({ collection: 'products', where: { brand: { equals: doc.id } } }),
      payload.count({ collection: 'expert-rules', where: { brand: { equals: doc.id } } }),
    ])
    if (products.totalDocs > 0 || rules.totalDocs > 0) {
      log(`Eski marka korundu (referans var): ${doc.name}`)
      continue
    }
    await payload.delete({ collection: 'brands', id: doc.id })
    removed++
  }
  if (removed) log(`Eski marka kayıtları silindi: ${removed}`)
  return removed
}

/**
 * Aynı normalize ada düşen marka kayıtlarını tek kayda indirir: plan markasının adı/slug'ı
 * hedef seçilir, ürün referansları hedefe taşınır, diğer kayıt silinir. Ürünü taşınamayan
 * (silinemeyen) kopya loglanır ve bırakılır — veri kaybı yerine kopya tercih edilir.
 */
async function mergeDuplicateBrands(
  payload: Payload,
  plan: SeedPlan,
  log: (msg: string) => void,
): Promise<number> {
  const planByName = new Map(plan.brands.map((b) => [b.name, b]))
  const planByKey = new Map(plan.brands.map((b) => [nameKey(b.name), b]))
  // Site bazı markaları ayrı kayıt olarak tutuyor (ör. "KIWI"/"Kiwi", "Disney"/"Disney+").
  // Aynı anahtara düşen birden çok plan markası varsa bunlar BİRLEŞTİRİLMEZ.
  const planKeyCount = new Map<string, number>()
  for (const b of plan.brands) {
    const key = nameKey(b.name)
    planKeyCount.set(key, (planKeyCount.get(key) ?? 0) + 1)
  }

  const groups = new Map<string, { id: number; name: string; slug?: string }[]>()
  for (const doc of (await findAll(payload, 'brands', {})) as { id: number; name?: string; slug?: string }[]) {
    if (!doc.name) continue
    const key = nameKey(doc.name)
    const list = groups.get(key) ?? []
    list.push({ id: doc.id, name: doc.name, slug: doc.slug })
    groups.set(key, list)
  }

  let merged = 0
  for (const [key, members] of groups) {
    if (members.length < 2) continue
    if ((planKeyCount.get(key) ?? 0) > 1) continue
    const planned = planByKey.get(key)
    // Bu uzmanın planıyla ilgisi olmayan gruplara dokunma.
    if (!planned || !members.some((m) => planByName.has(m.name))) continue

    const target =
      members.find((m) => m.name === planned.name) ??
      members.find((m) => m.slug === planned.data.slug) ??
      members[0]
    const extras = members.filter((m) => m.id !== target.id)

    for (const extra of extras) {
      try {
        for (let page = 1; ; page++) {
          const products = await payload.find({
            collection: 'products',
            where: { brand: { equals: extra.id } },
            limit: 100,
            page,
            depth: 0,
          })
          for (const product of products.docs) {
            await payload.update({
              collection: 'products',
              id: product.id,
              data: { brand: target.id },
            })
          }
          if (!products.hasNextPage || products.docs.length === 0) break
        }
        await payload.delete({ collection: 'brands', id: extra.id })
        merged++
      } catch (error) {
        log(`Marka birleştirilemedi (${extra.name} → ${target.name}): ${(error as Error).message}`)
      }
    }
  }
  if (merged) log(`Kopya marka birleştirildi: ${merged}`)
  return merged
}

/**
 * Marka adı eşleştirme anahtarı: Türkçe küçük harf + aksan/boşluk/noktalama at.
 * Site "Mc Donald's", repo "McDonald's" gibi yazım farklarında ikinci marka açılmasını önler.
 */
function nameKey(name: string): string {
  return name
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

async function findId<TSlug extends CollectionSlug>(
  payload: Payload,
  collection: TSlug,
  where: Where,
): Promise<number | undefined> {
  const result = await payload.find({ collection, where, limit: 1, depth: 0 })
  return result.docs[0]?.id as number | undefined
}

async function findAll<TSlug extends CollectionSlug>(
  payload: Payload,
  collection: TSlug,
  where: Where,
): Promise<{ id: number | string }[]> {
  const docs: { id: number | string }[] = []
  for (let page = 1; ; page++) {
    const result = await payload.find({ collection, where, limit: 200, page, depth: 0 })
    docs.push(...(result.docs as { id: number | string }[]))
    if (!result.hasNextPage || result.docs.length === 0) return docs
  }
}

/** Kuralı yazar; eşleşen kaydın id'sini döner (temizlik adımı için). */
async function upsertRule(
  payload: Payload,
  summary: SeedSummary,
  context: RuleContext,
  rule: SeedRule,
  ruleIdByName: Record<string, number>,
): Promise<number> {
  const existingId = ruleIdByName[rule.name]
  const ruleData = {
    name: rule.name,
    expert: context.expertId,
    topic: context.topicId,
    rating: context.ratingIdByName[rule.ratingName],
    ruleType: rule.ruleType,
    description: rule.description,
    brand: rule.brandName ? context.brandIdByName[rule.brandName] : undefined,
    country: rule.ruleType === 'country' ? context.countryId : undefined,
    isActive: true,
    evidence: rule.sources.map((source) => ({
      type: 'link' as const,
      url: source.url,
      caption: source.title,
    })),
    sources: rule.sources.map((source) => ({ title: source.title, url: source.url })),
  }
  if (existingId) {
    await payload.update({ collection: 'expert-rules', id: existingId, data: ruleData })
    summary.updatedRules++
    return existingId
  }
  const created = await payload.create({ collection: 'expert-rules', data: ruleData })
  summary.rules++
  ruleIdByName[rule.name] = created.id as number
  return created.id as number
}

export { SITE_BRANDS }
