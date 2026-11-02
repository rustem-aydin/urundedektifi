import 'dotenv/config'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { createExpertAccount, relationshipId } from '../src/lib/expertAccounts'

/**
 * Hesabı olmayan uzmanlar için panel hesabı açar (ADR 0030).
 * Idempotent: hesabı zaten bağlı uzmanlar atlanır.
 *
 * Kullanım: pnpm seed:expert-accounts
 *
 * Açılan hesabın e-postası uzmanın adından türetilir; rastgele şifre hiçbir
 * yerde saklanmaz, ilk şifreyi admin panelden belirler.
 */
async function main() {
  const payload = await getPayload({ config })

  const experts = await payload.find({
    collection: 'experts',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })

  let opened = 0
  for (const expert of experts.docs) {
    if (relationshipId(expert.user)) continue

    const accountId = await createExpertAccount(payload, expert.name)
    await payload.update({
      collection: 'experts',
      id: expert.id,
      data: { user: accountId },
      depth: 0,
      overrideAccess: true,
    })
    const account = await payload.findByID({
      collection: 'users',
      id: accountId,
      depth: 0,
      overrideAccess: true,
    })
    console.log(`  + ${expert.name} → ${account.email} (#${accountId}) — şifreyi panelden belirleyin`)
    opened += 1
  }

  console.log(
    `Uzman ${experts.docs.length} · yeni hesap ${opened} · zaten bağlı ${experts.docs.length - opened}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
