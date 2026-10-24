import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { COMPANIES, seedBoykotDedektifi } from '../src/lib/seed/boykotDedektifi'

/**
 * Boykot Dedektifi içeriğini (uzman, konu, derecelendirmeler, markalar, kurallar)
 * yerel veritabanına kurar. Idempotent: ikinci çalıştırmada kayıt çoğaltmaz.
 *
 * Kullanım: pnpm seed:boykot
 */
async function main() {
  const payload = await getPayload({ config })

  const summary = await seedBoykotDedektifi(payload, (msg) => console.log(`  ${msg}`))

  console.log('\nÖzet:')
  console.log(`  Yeni ülke      : ${summary.countries}`)
  console.log(`  Yeni marka     : ${summary.brands}`)
  console.log(`  Yeni kural     : ${summary.rules}`)
  console.log(`  Boykotlu marka : ${COMPANIES.filter((c) => c.tier === 'boykot').reduce((n, c) => n + c.brands.length, 0)}`)
  console.log(`  Şüpheli kural  : ${COMPANIES.filter((c) => c.tier === 'supheli').reduce((n, c) => n + c.brands.length, 0)}`)

  await payload.destroy()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
