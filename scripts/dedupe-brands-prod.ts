import { brandTitle, planBrandMerges, type BrandRow } from './lib/brand-dedupe'
import { createPayloadClient } from './lib/payload-rest'

/**
 * Marka adlarını tek yazım standardına çeker ve aynı markanın yazım varyantlarını tek kayda indirir
 * (uzak Payload REST API).
 *
 * - Kopya tespiti: Türkçe küçük harf + ı→i + aksan/noktalama silme anahtarı (`scripts/lib/brand-dedupe.ts`).
 * - Kanonik kayıt: en çok ürün taşıyan, sonra en düzgün yazılmış kayıt. Ürünler ve uzman kuralları
 *   kanonik markaya taşınır, kopya marka kayıtları silinir.
 * - Ad düzeni: her kelimenin ilk harfi büyük, kalanı küçük ("NESTLE" → "Nestle").
 *
 * Idempotent: ikinci çalıştırma 0 birleştirme ve 0 yeniden adlandırma üretir.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/dedupe-brands-prod.ts           # kuru
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/dedupe-brands-prod.ts --apply   # yazar
 */

const API = (process.env.SEED_API_URL ?? 'https://barkoddedektifi.com/api').replace(
  /\/$/,
  '',
)
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const APPLY = process.argv.includes('--apply')
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 8)

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function pool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      await worker(items[index]!)
    }
  })
  await Promise.all(runners)
}

type ProductRow = { id: number; brand?: number | { id?: number } | null }
type RuleRow = { id: number; brand?: number | { id?: number } | null }

const relationId = (value: ProductRow['brand']): number | undefined =>
  typeof value === 'number' ? value : typeof value === 'object' && value ? value.id : undefined

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()

  console.log(`Markalar okunuyor: ${API}`)
  const brands = (await client.findAll('brands', {
    limit: 500,
    depth: 0,
    select: { name: true },
  })) as unknown as BrandRow[]
  console.log(`Okunan marka: ${brands.length}`)

  const products = (await client.findAll('products', {
    limit: 500,
    depth: 0,
    select: { brand: true },
  })) as unknown as ProductRow[]
  console.log(`Okunan ürün: ${products.length}`)

  const productCounts = new Map<number, number>()
  for (const product of products) {
    const brandId = relationId(product.brand)
    if (brandId == null) continue
    productCounts.set(brandId, (productCounts.get(brandId) ?? 0) + 1)
  }

  const plan = planBrandMerges(brands, productCounts)
  const deleteIds = plan.merges.flatMap((merge) => merge.deleteIds)
  const deleteSet = new Set(deleteIds)
  const productMoves = products
    .map((product) => ({ product, brandId: relationId(product.brand) }))
    .filter(
      (entry): entry is { product: ProductRow; brandId: number } =>
        entry.brandId != null && deleteSet.has(entry.brandId),
    )
    .map((entry) => {
      const target = plan.reassign.find((move) => move.from === entry.brandId)!.to
      return { id: entry.product.id, from: entry.brandId, to: target }
    })

  console.log(`Birleştirilecek grup: ${plan.merges.length}`)
  console.log(`Silinecek kopya marka: ${deleteIds.length}`)
  console.log(`Taşınacak ürün: ${productMoves.length}`)
  console.log(`Yeniden adlandırılacak marka: ${plan.renames.length}`)
  if (plan.skipped.length) {
    console.log('Birleştirilmeyen gruplar:')
    for (const group of plan.skipped) {
      console.log(`  [${group.key}] ${group.reason}: ${group.names.join(' | ')}`)
    }
  }
  for (const merge of plan.merges.slice(0, 30)) {
    const names = brands.filter((brand) => merge.deleteIds.includes(brand.id)).map((b) => b.name)
    console.log(
      `  ${merge.canonicalName} ← ${names.join(' | ')} (${merge.productCount} ürün)`,
    )
  }
  for (const rename of plan.renames.slice(0, 20)) {
    console.log(`  ad: "${rename.from}" → "${rename.to}"`)
  }

  if (!APPLY) {
    console.log('Kuru çalışma. Yazmak için --apply ekleyin.')
    return
  }

  const startedAt = new Date().toISOString()
  const failures: string[] = []
  let done = 0

  const run = async (label: string, action: () => Promise<unknown>) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await action()
        break
      } catch (error) {
        if (attempt === 3) failures.push(`${label}: ${String(error).slice(0, 300)}`)
        else await sleep(500 * attempt)
      }
    }
    done++
    if (done % 250 === 0) console.log(`  ${done} yazma (hata: ${failures.length})`)
  }

  console.log('1/4 Kopya markalara bağlı ürünler kanonik markaya taşınıyor…')
  await pool(productMoves, CONCURRENCY, (move) =>
    run(`product ${move.id}`, () => client.update('products', move.id, { brand: move.to })),
  )
  if (failures.length) {
    console.log(`Ürün taşıma hatası var (${failures.length}); silme yapılmadı.`)
    return
  }

  console.log('2/4 Kopya markalara bağlı uzman kuralları taşınıyor…')
  if (deleteIds.length) {
    const rules = (await client.findAll('expert-rules', {
      limit: 500,
      depth: 0,
      select: { brand: true },
      where: { brand: { in: deleteIds } },
    })) as unknown as RuleRow[]
    console.log(`  Kural: ${rules.length}`)
    await pool(rules, CONCURRENCY, (rule) => {
      const brandId = relationId(rule.brand)
      const target = plan.reassign.find((move) => move.from === brandId)?.to
      if (target == null) return Promise.resolve()
      return run(`rule ${rule.id}`, () => client.update('expert-rules', rule.id, { brand: target }))
    })
  }
  if (failures.length) {
    console.log(`Kural taşıma hatası var (${failures.length}); silme yapılmadı.`)
    return
  }

  console.log('3/4 Kopya marka kayıtları siliniyor…')
  await pool(deleteIds, CONCURRENCY, (id) =>
    run(`brand ${id}`, () => client.remove('brands', id)),
  )

  console.log('4/4 Marka adları standarda çekiliyor…')
  await pool(plan.renames, CONCURRENCY, (rename) =>
    run(`brand ${rename.id}`, () => client.update('brands', rename.id, { name: rename.to })),
  )

  console.log(`Bitti. Hata: ${failures.length}`)
  for (const failure of failures.slice(0, 20)) console.log(`  ${failure}`)

  // Ürün kancası her yazımı "düzenledi" katkısı olarak işler; toplu marka taşıma bir kullanıcı
  // katkısı değildir, bu çalıştırmada doğan satırlar geri silinir.
  const me = (await (
    await fetch(`${API}/users/me`, {
      headers: { Authorization: `JWT ${client.getToken()}` },
    })
  ).json()) as { user?: { id?: number } }
  const userId = me.user?.id
  if (!userId) {
    console.log('Kullanıcı kimliği okunamadı; katkı temizliği atlandı.')
    return
  }
  const created = await client.findAll('product-contributions', {
    limit: 200,
    depth: 0,
    where: {
      and: [
        { user: { equals: userId } },
        { kind: { equals: 'update' } },
        { createdAt: { greater_than_equal: startedAt } },
      ],
    },
  })
  console.log(`Temizlenecek katkı satırı: ${created.length}`)
  for (const doc of created) await client.remove('product-contributions', doc.id)
  console.log('Katkı temizliği tamam.')
}

await main()
process.exit(0)
