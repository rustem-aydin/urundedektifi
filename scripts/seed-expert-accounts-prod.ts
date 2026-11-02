import { createPayloadClient } from './lib/payload-rest'
import {
  EXPERT_EMAIL_DOMAIN,
  expertEmailLocalPart,
  generateExpertPassword,
  relationshipId,
} from '../src/lib/expertAccounts'

/**
 * Hesabı olmayan uzmanlar için panel hesabı açar — UZAK Payload REST API'si (ADR 0032).
 *
 * Akış: uzman kaydı REST'ten okunur → `users` rolü `user` olarak açılır (uzman rolü
 * elle açılamaz) → uzman `user` alanına bağlanır; sunucu hook'u rolü `uzman`a çeker.
 *
 * Idempotent: `user` alanı dolu uzmanlar atlanır.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/seed-expert-accounts-prod.ts
 *   (SEED_API_URL verilmezse üretim adresi kullanılır.)
 */
const API = process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })

type ExpertRow = { id: number; name: string; user?: unknown }

async function availableEmail(name: string): Promise<string> {
  const local = expertEmailLocalPart(name)
  for (let attempt = 1; attempt <= 999; attempt += 1) {
    const candidate =
      attempt === 1
        ? `${local}@${EXPERT_EMAIL_DOMAIN}`
        : `${local}-${attempt}@${EXPERT_EMAIL_DOMAIN}`
    const taken = await client.find('users', {
      where: { email: { equals: candidate } },
      limit: 1,
      depth: 0,
    })
    if (taken.totalDocs === 0) return candidate
  }
  throw new Error(`Bu ad için boş e-posta bulunamadı: ${name}`)
}

async function main() {
  console.log(`Hedef: ${client.api}`)
  await client.login()

  const experts = (await client.findAll('experts', {
    limit: 1000,
    depth: 0,
  })) as unknown as ExpertRow[]

  let opened = 0
  for (const expert of experts) {
    if (relationshipId(expert.user)) continue

    const email = await availableEmail(expert.name)
    const account = await client.create('users', {
      name: expert.name,
      email,
      password: generateExpertPassword(),
      role: 'user',
    })
    await client.update('experts', expert.id, { user: account.id })
    console.log(`  + ${expert.name} → ${email} (#${account.id}) — şifreyi panelden belirleyin`)
    opened += 1
  }

  console.log(`Uzman ${experts.length} · yeni hesap ${opened} · zaten bağlı ${experts.length - opened}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
