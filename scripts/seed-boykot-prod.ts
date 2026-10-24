import fs from 'fs'
import { z } from 'zod'
import { buildSeedPlan, SEED_AVATAR } from '../src/lib/seed/boykotDedektifi'
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

/**
 * Marka upsert'i ada göre arar; prod'da adı farklı yazılmış (ör. "carrefour")
 * aynı slug'lı kayıt varsa onu günceller — slug unique olduğu için create 400 verirdi.
 */
async function upsertBrand(brand: SeedBrand): Promise<IdDoc> {
  const byName = await client.findOne('brands', { name: { equals: brand.name } })
  if (byName) return client.update('brands', byName.id, brand.data)

  const bySlug = await client.findOne('brands', { slug: { equals: brand.data.slug } })
  if (bySlug) return client.update('brands', bySlug.id, brand.data)

  return client.create('brands', brand.data)
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

  // 4) Markalar
  const brandIdByName: Record<string, number> = {}
  for (const [index, brand] of plan.brands.entries()) {
    const doc = await upsertBrand(brand)
    brandIdByName[brand.name] = doc.id
    if ((index + 1) % 25 === 0) console.log(`  Markalar: ${index + 1}/${plan.brands.length}`)
  }
  console.log(`  Markalar hazır: ${plan.brands.length} kayıt`)

  // 5) Kurallar
  let written = 0
  for (const rule of plan.rules) {
    await client.upsert(
      'expert-rules',
      {
        and: [
          { expert: { equals: expert.id } },
          { topic: { equals: topic.id } },
          { name: { equals: rule.name } },
        ],
      },
      {
        name: rule.name,
        expert: expert.id,
        topic: topic.id,
        rating: ratingIdByName[rule.ratingName],
        ruleType: rule.ruleType,
        description: rule.description,
        ...(rule.brandName ? { brand: brandIdByName[rule.brandName] } : {}),
        ...(rule.countrySlug ? { country: country.id } : {}),
        isActive: true,
        evidence: rule.sources.map((source) => ({
          type: 'link',
          url: source.url,
          caption: source.title,
        })),
        sources: rule.sources.map((source) => ({ title: source.title, url: source.url })),
      },
    )
    written++
    if (written % 25 === 0) console.log(`  Kurallar: ${written}/${plan.rules.length}`)
  }
  console.log(`  Kurallar hazır: ${written} adet`)

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
