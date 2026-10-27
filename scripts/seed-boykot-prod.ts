import fs from 'fs'
import { z } from 'zod'
import { buildSeedPlan, LEGACY_BRANDS, SEED_AVATAR } from '../src/lib/seed/boykotDedektifi'
import type { SeedBrand } from '../src/lib/seed/boykotDedektifi'
import { createPayloadClient, type IdDoc } from './lib/payload-rest'

/**
 * Boykot Dedektifi içeriğini UZAK Payload REST API'sine (prod) yazar.
 * Yerel seeder ile aynı planı (`buildSeedPlan`) kullanır; tek veri kaynağı vardır.
 *
 * Idempotent: slug/ad anahtarlarıyla upsert eder, ikinci çalıştırmada çoğaltmaz.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-boykot-prod.ts
 *   (SEED_API_URL verilmezse üretim adresi kullanılır.)
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
const avatarPath = SEED_AVATAR.filePath

const ExpertDetail = z
  .object({
    name: z.string(),
    title: z.string().nullish(),
    credentials: z.array(z.unknown()).nullish(),
    socialLinks: z.record(z.string(), z.string().nullish()).nullish(),
    avatar: z.object({ url: z.string().nullish() }).nullish(),
  })
  .loose()

/** Marka adı eşleştirme anahtarı (seed modülündeki `nameKey` ile aynı kural). */
function nameKey(name: string): string {
  return name
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

type BrandRef = { id: number; name?: string; slug?: string }
type BrandIndex = {
  byName: Map<string, number>
  bySlug: Map<string, number>
  byKey: Map<string, number>
  keyCount: Map<string, number>
}

async function loadAllBrands(): Promise<BrandRef[]> {
  return (await client.findAll('brands', { limit: 200 })) as BrandRef[]
}

/**
 * Aynı normalize ada düşen marka kayıtlarını tek kayda indirir (yerel seeder ile aynı kural):
 * plan markasının adı/slug'ı hedef, ürün referansları hedefe taşınır, kopya silinir.
 */
async function mergeDuplicateBrands(
  brands: BrandRef[],
  planRules: { brandNames: Set<string>; byKey: Map<string, string>; keyCount: Map<string, number> },
) {
  const groups = new Map<string, BrandRef[]>()
  for (const doc of brands) {
    if (!doc.name) continue
    const key = nameKey(doc.name)
    groups.set(key, [...(groups.get(key) ?? []), doc])
  }

  let merged = 0
  for (const [key, members] of groups) {
    if (members.length < 2) continue
    // Planda aynı anahtara düşen birden çok marka varsa site onları ayrı tutuyor: birleştirme yok.
    if ((planRules.keyCount.get(key) ?? 0) > 1) continue
    const plannedName = planRules.byKey.get(key)
    if (!plannedName || !members.some((m) => m.name && planRules.brandNames.has(m.name))) continue

    const target = members.find((m) => m.name === plannedName) ?? members[0]
    for (const extra of members.filter((m) => m.id !== target.id)) {
      try {
        const products = (await client.findAll('products', {
          where: { brand: { equals: extra.id } },
          limit: 100,
        })) as { id: number }[]
        for (const product of products) {
          await client.update('products', product.id, { brand: target.id })
        }
        await client.remove('brands', extra.id)
        merged++
      } catch (error) {
        console.log(`  Marka birleştirilemedi (${extra.name} → ${target.name}): ${(error as Error).message}`)
      }
    }
  }
  if (merged) console.log(`  Kopya marka birleştirildi: ${merged}`)
}

/**
 * Eski elle derlenmiş listeden kalan ve yeni planda olmayan markalar: ürünü/kuralı yoksa
 * silinir (yerel seeder ile aynı kural). Referansı olan kayıt korunur ve loglanır.
 */
async function pruneLegacyBrands(brands: BrandRef[], planNames: Set<string>) {
  let removed = 0
  for (const doc of brands) {
    if (!doc.name || !LEGACY_BRANDS.has(doc.name) || planNames.has(doc.name)) continue
    const [products, rules] = await Promise.all([
      client.find('products', { where: { brand: { equals: doc.id } }, limit: 1 }),
      client.find('expert-rules', { where: { brand: { equals: doc.id } }, limit: 1 }),
    ])
    if (products.totalDocs > 0 || rules.totalDocs > 0) {
      console.log(`  Eski marka korundu (referans var): ${doc.name}`)
      continue
    }
    await client.remove('brands', doc.id)
    removed++
  }
  if (removed) console.log(`  Eski marka kayıtları silindi: ${removed}`)
}

/** Marka kayıtları tek turda yüklenir: 3.950 marka için marka başına arama yapılmaz. */
async function loadBrandIndex(): Promise<BrandIndex> {
  const docs = await loadAllBrands()
  const byName = new Map<string, number>()
  const bySlug = new Map<string, number>()
  const byKey = new Map<string, number>()
  for (const doc of docs) {
    if (doc.name) byName.set(doc.name, doc.id)
    if (doc.slug) bySlug.set(doc.slug, doc.id)
    if (doc.name) {
      const key = nameKey(doc.name)
      // Aynı normalize anahtara düşen birden çok kayıt varsa eşleştirme belirsizdir.
      byKey.set(key, byKey.has(key) ? -1 : doc.id)
    }
  }
  return { byName, bySlug, byKey, keyCount: new Map() }
}

/**
 * Marka upsert'i önce ada, sonra slug'a bakar; prod'da adı farklı yazılmış
 * aynı slug'lı kayıt varsa onu günceller — slug unique olduğu için create 400 verirdi.
 */
async function upsertBrand(brand: SeedBrand, index: BrandIndex): Promise<IdDoc> {
  const key = nameKey(brand.name)
  const keyed = index.byKey.get(key)
  const ambiguous = (index.keyCount.get(key) ?? 0) > 1
  const id =
    index.byName.get(brand.name) ?? (!ambiguous && keyed && keyed > 0 ? keyed : undefined) ?? index.bySlug.get(brand.data.slug)
  if (id) return client.update('brands', id, brand.data)
  const created = await client.create('brands', brand.data)
  index.byName.set(brand.name, created.id)
  index.bySlug.set(brand.data.slug, created.id)
  index.byKey.set(nameKey(brand.name), created.id)
  return created
}

async function uploadAvatar(): Promise<number | undefined> {
  const existing = await client.findOne('media', { alt: { equals: SEED_AVATAR.alt } })
  if (existing) return existing.id
  if (!fs.existsSync(avatarPath)) {
    console.log(`  Avatar dosyası yok, atlandı: ${avatarPath}`)
    return undefined
  }
  const media = await client.upload('media', avatarPath, { alt: SEED_AVATAR.alt })
  console.log(`  Avatar yüklendi: ${SEED_AVATAR.alt} (#${media.id})`)
  return media.id
}

async function main() {
  const plan = buildSeedPlan()
  console.log(`Hedef: ${client.api}`)

  await client.login()
  console.log(`  Giriş yapıldı: ${EMAIL}`)

  // 1) Ülke + konu
  const country = await client.upsert(
    'countries',
    { slug: { equals: plan.country.slug } },
    plan.country,
  )
  console.log(`  Ülke hazır: ${plan.country.name} (#${country.id})`)

  const topic = await client.upsert('topics', { slug: { equals: plan.topic.slug } }, plan.topic)
  console.log(`  Konu hazır: ${plan.topic.name} (#${topic.id})`)

  // 2) Uzman (avatar dahil)
  const avatarId = await uploadAvatar()
  const expert = await client.upsert(
    'experts',
    { slug: { equals: plan.expert.slug } },
    {
      ...plan.expert,
      ...(avatarId ? { avatar: avatarId } : {}),
      verified: true,
      isPublic: true,
    },
  )
  console.log(`  Uzman hazır: ${plan.expert.name} (#${expert.id})`)

  // 3) Derecelendirme ölçeği
  const ratingIdByName: Record<string, number> = {}
  for (const rating of plan.ratings) {
    const doc = await client.upsert(
      'rating-scales',
      { and: [{ expert: { equals: expert.id } }, { name: { equals: rating.name } }] },
      { ...rating, expert: expert.id },
    )
    ratingIdByName[rating.name] = doc.id
  }
  console.log(`  Derecelendirmeler hazır: ${plan.ratings.map((r) => r.name).join(', ')}`)

  // 4) Markalar — önce eski hayalet kayıtlar silinir, kopya yazımlar birleştirilir, sonra upsert
  const planNames = new Set(plan.brands.map((b) => b.name))
  await pruneLegacyBrands(await loadAllBrands(), planNames)
  await mergeDuplicateBrands(await loadAllBrands(), {
    brandNames: planNames,
    byKey: new Map(plan.brands.map((b) => [nameKey(b.name), b.name])),
    keyCount: plan.brands.reduce((acc, b) => acc.set(nameKey(b.name), (acc.get(nameKey(b.name)) ?? 0) + 1), new Map<string, number>()),
  })
  const brandIndex = await loadBrandIndex()
  for (const brand of plan.brands) {
    const key = nameKey(brand.name)
    brandIndex.keyCount.set(key, (brandIndex.keyCount.get(key) ?? 0) + 1)
  }
  const brandIdByName: Record<string, number> = {}
  for (const [index, brand] of plan.brands.entries()) {
    const doc = await upsertBrand(brand, brandIndex)
    brandIdByName[brand.name] = doc.id
    if ((index + 1) % 100 === 0) console.log(`  Markalar: ${index + 1}/${plan.brands.length}`)
  }
  console.log(`  Markalar hazır: ${plan.brands.length} kayıt`)

  // 5) Kurallar — mevcut kural kimlikleri tek turda yüklenir, kural başına arama yapılmaz
  const currentRules = (await client.findAll('expert-rules', {
    where: { and: [{ expert: { equals: expert.id } }, { topic: { equals: topic.id } }] },
  })) as { id: number; name?: string }[]
  const ruleIdByName = new Map<string, number>()
  for (const doc of currentRules) if (doc.name) ruleIdByName.set(doc.name, doc.id)

  let written = 0
  for (const rule of plan.rules) {
    const data = {
      name: rule.name,
      expert: expert.id,
      topic: topic.id,
      rating: ratingIdByName[rule.ratingName],
      ruleType: rule.ruleType,
      description: rule.description,
      ...(rule.ruleType === 'brand' ? { brand: brandIdByName[rule.brandName] } : {}),
      ...(rule.ruleType === 'country' ? { country: country.id } : {}),
      isActive: true,
      evidence: rule.sources.map((source) => ({
        type: 'link',
        url: source.url,
        caption: source.title,
      })),
      sources: rule.sources.map((source) => ({ title: source.title, url: source.url })),
    }
    const existingId = ruleIdByName.get(rule.name)
    const saved = existingId
      ? await client.update('expert-rules', existingId, data)
      : await client.create('expert-rules', data)
    ruleIdByName.set(rule.name, saved.id)
    written++
    if (written % 100 === 0) console.log(`  Kurallar: ${written}/${plan.rules.length}`)
  }
  console.log(`  Kurallar hazır: ${written} adet`)

  // 5b) Plandan çıkan kayıtları sil (eski iki katmanlı set).
  // Sıra kritik: expert_rules.rating_id zorunlu olduğu için ÖNCE kural, SONRA derece silinir.
  const plannedRules = new Set<string>(plan.rules.map((r) => r.name))
  let removedRules = 0
  for (const rule of (await client.findAll('expert-rules', {
    where: {
      and: [{ expert: { equals: expert.id } }, { topic: { equals: topic.id } }],
    },
  })) as { id: number; name?: string }[]) {
    if (rule.name && plannedRules.has(rule.name)) continue
    await client.remove('expert-rules', rule.id)
    removedRules++
  }

  const plannedRatings = new Set<string>(plan.ratings.map((r) => r.name))
  let removedRatings = 0
  for (const scale of (await client.findAll('rating-scales', {
    where: { expert: { equals: expert.id } },
  })) as { id: number; name?: string }[]) {
    if (scale.name && plannedRatings.has(scale.name)) continue
    await client.remove('rating-scales', scale.id)
    removedRatings++
  }
  console.log(`  Silinen: ${removedRules} kural, ${removedRatings} derece`)

  // 6) Doğrulama — yazılan kaydı geri oku
  const saved = ExpertDetail.parse(
    (
      await client.find('experts', {
        where: { slug: { equals: plan.expert.slug } },
        depth: 1,
        limit: 1,
      })
    ).docs[0],
  )

  const rules = await client.find('expert-rules', {
    where: { expert: { equals: expert.id } },
    limit: 0,
  })
  const scales = await client.find('rating-scales', {
    where: { expert: { equals: expert.id } },
    limit: 0,
  })

  console.log('\nDoğrulama:')
  console.log(
    `  Uzman   : ${saved.name} · ${saved.title ?? '-'} · ${saved.credentials?.length ?? 0} belge · ${Object.values(saved.socialLinks ?? {}).filter(Boolean).length} sosyal link`,
  )
  console.log(`  Avatar  : ${saved.avatar?.url ?? 'yok'}`)
  console.log(`  Kural   : ${rules.totalDocs}`)
  console.log(`  Derece  : ${scales.totalDocs}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
