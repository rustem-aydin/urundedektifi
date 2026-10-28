import 'dotenv/config'
import { z } from 'zod'
import { detectCountryFromBarcode } from '../src/lib/barcodePrefixes'

/**
 * Ürünlerin "Üretim Yeri Ülke" alanını barkodun GS1 prefix'ine göre doldurur.
 *
 * Yeni ürünlerde Products beforeValidate hook'u aynı eşlemeyi yapar; bu betik
 * hook'tan önce (veya ülkesiz) içeri girmiş mevcut ürünler içindir. Eşleme
 * `PREFIX_RULES` tablosundan gelir ve yalnız "Ülkeler" koleksiyonunda karşılığı
 * olan adlar yazılır (GS1 Küresel/ISBN/Tayvan gibi bölgeler atlanır).
 *
 * Varsayılan kuru çalışmadır; yazmak için --apply. Dolu ama farklı ülke
 * işaretlenmiş kayıtlar yalnız --overwrite ile düzeltilir.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/fill-product-countries.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/fill-product-countries.ts --apply --overwrite
 */
const API = (process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api').replace(/\/$/, '')
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const APPLY = process.argv.includes('--apply')
const OVERWRITE = process.argv.includes('--overwrite')
const CONCURRENCY = Number(process.env.SEED_CONCURRENCY ?? 5)

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

const LoginResponse = z.object({ token: z.string() })
const CountryDoc = z.object({ id: z.number(), name: z.string(), iso: z.string().nullish() })
const CountryList = z.object({ docs: z.array(CountryDoc) })
const ProductDoc = z.object({
  id: z.number(),
  barcode: z.string().nullish(),
  name: z.string().nullish(),
  country: z
    .union([z.number(), z.object({ id: z.number() })])
    .nullish(),
})
const ProductList = z.object({ docs: z.array(ProductDoc) })

type Country = z.infer<typeof CountryDoc>
type ProductRow = z.infer<typeof ProductDoc>
type PlannedUpdate = { id: number; barcode: string | null; name: string | null; from: string | null; to: Country }

function countryId(value: ProductRow['country']): number | null {
  if (value == null) return null
  return typeof value === 'object' ? value.id : value
}

async function main() {
  const login = await fetch(`${API}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`login ${login.status}: ${await login.text()}`)
  const token = LoginResponse.parse(await login.json()).token
  const headers = { Authorization: `JWT ${token}` }

  const countryRes = await fetch(`${API}/countries?limit=1000&depth=0`, { headers })
  if (!countryRes.ok) throw new Error(`countries ${countryRes.status}`)
  const countries = CountryList.parse(await countryRes.json()).docs
  const byName = new Map(countries.map((country) => [country.name, country]))
  const byId = new Map(countries.map((country) => [country.id, country]))

  const products: ProductRow[] = []
  for (let page = 1; ; page++) {
    const res = await fetch(
      `${API}/products?limit=1000&depth=0&page=${page}&select[barcode]=true&select[name]=true&select[country]=true`,
      { headers },
    )
    if (!res.ok) throw new Error(`products page ${page}: ${res.status} ${await res.text()}`)
    const payload = ProductList.parse(await res.json())
    products.push(...payload.docs)
    if (payload.docs.length < 1000) break
  }

  const updates: PlannedUpdate[] = []
  const skipped: ProductRow[] = []
  const conflicts: PlannedUpdate[] = []
  let alreadyCorrect = 0

  for (const product of products) {
    const detected = detectCountryFromBarcode(product.barcode ?? '')
    const target = detected ? byName.get(detected.country) : undefined
    if (!target) {
      skipped.push(product)
      continue
    }
    const currentId = countryId(product.country)
    if (currentId === target.id) {
      alreadyCorrect++
      continue
    }
    const current = currentId != null ? byId.get(currentId) : undefined
    const planned = {
      id: product.id,
      barcode: product.barcode ?? null,
      name: product.name ?? null,
      from: current?.name ?? null,
      to: target,
    }
    if (current && !OVERWRITE) conflicts.push(planned)
    else updates.push(planned)
  }

  console.log(`Hedef: ${API} · mod: ${APPLY ? 'YAZ' : 'kuru çalışma'}${OVERWRITE ? ' + üzerine yaz' : ''}`)
  console.log(`Taranan ürün: ${products.length}`)
  console.log(`  zaten doğru : ${alreadyCorrect}`)
  console.log(`  doldurulacak: ${updates.length}`)
  console.log(`  düzeltilecek: ${conflicts.length}${OVERWRITE ? ' (üzerine yazılacak)' : ' (--overwrite verilmedi, atlandı)'}`)
  console.log(`  ülke tespit edilemedi: ${skipped.length}`)

  const perCountry = new Map<string, number>()
  for (const update of updates) {
    perCountry.set(update.to.name, (perCountry.get(update.to.name) ?? 0) + 1)
  }
  console.log('  dağılım:', [...perCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15))

  if (conflicts.length) console.log('  mevcut ülkesi farklı ilk 10:', conflicts.slice(0, 10))
  if (skipped.length) {
    console.log(
      '  tespit edilemeyen ilk 15:',
      skipped.slice(0, 15).map((product) => `${product.id} ${product.barcode} ${product.name ?? ''}`),
    )
  }

  if (!APPLY || updates.length === 0) return

  let done = 0
  const failures: Array<{ id: number; error: string }> = []
  let cursor = 0
  const worker = async () => {
    while (cursor < updates.length) {
      const update = updates[cursor++]
      try {
        const res = await fetch(`${API}/products/${update.id}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: update.to.id }),
        })
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      } catch (error) {
        failures.push({ id: update.id, error: error instanceof Error ? error.message : String(error) })
      }
      done++
      if (done % 200 === 0) console.log(`  yazıldı ${done}/${updates.length}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, updates.length) }, worker))

  console.log(`Yazılan: ${updates.length - failures.length}/${updates.length}`)
  if (failures.length) {
    console.log('Hatalar:', failures.slice(0, 10))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
