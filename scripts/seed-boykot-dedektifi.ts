import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { buildSeedPlan, seedBoykotDedektifi } from '../src/lib/seed/boykotDedektifi'

/**
 * Boykot Dedektifi içeriğini (uzman, konu, derecelendirmeler, 3.950 marka, marka
 * başına kural) yerel veritabanına kurar. Idempotent: ikinci çalıştırmada kayıt
 * çoğaltmaz; plandan çıkan eski dereceleri/kuralları siler.
 *
 * Kullanım: pnpm seed:boykot
 */
async function main() {
  const payload = await getPayload({ config })
  const plan = buildSeedPlan()

  const summary = await seedBoykotDedektifi(payload, (msg) => console.log(`  ${msg}`))

  console.log('\nÖzet:')
  console.log(`  Marka kaydı     : ${plan.brands.length} (${summary.brands} yeni, ${summary.updatedBrands} güncel)`)
  console.log(`  Kural           : ${plan.rules.length} (${summary.rules} yeni, ${summary.updatedRules} güncel)`)
  console.log(`  Silinen kural   : ${summary.removedRules}`)
  console.log(`  Silinen derece  : ${summary.removedRatings}`)
  console.log(`  Dereceler       : ${plan.ratings.map((r) => r.name).join(' · ')}`)

  await payload.destroy()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
