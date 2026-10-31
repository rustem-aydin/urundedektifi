import { buildCorpus, normalizeProductName } from './lib/product-name'
import { createPayloadClient } from './lib/payload-rest'

/**
 * Ürün adlarını tek yazım standardına çeker (uzak Payload REST API).
 *
 * Kural: her kelime büyük harfle başlar, kalanı küçüktür ("SODOBO GURME TON" → "Sodobo Gurme Ton").
 * Ayrıntılar ve kenar durumlar `scripts/lib/product-name.ts` içinde.
 *
 * Idempotent: standarda uyan adlara yazma yapılmaz, ikinci çalıştırma 0 değişiklik üretir.
 * Ürün kancası her yazımı katkı satırına işlediği için bu çalıştırmada doğan katkılar sonunda silinir.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/normalize-product-names-prod.ts           # kuru
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/normalize-product-names-prod.ts --apply   # yazar
 */

const API = (process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api').replace(
  /\/$/,
  '',
)
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
const APPLY = process.argv.includes('--apply')
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6)

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

/** Geri çekilme beklemesi (tsconfig `lib` hedefi Promise.withResolvers'ı tanımıyor). */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function pool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index]!)
    }
  })
  await Promise.all(runners)
  return results
}

type ProductRow = { id: number; name?: string | null }

async function main() {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  await client.login()

  console.log(`Ürünler okunuyor: ${API}`)
  const rows = (await client.findAll('products', {
    limit: 500,
    depth: 0,
    select: { name: true },
  })) as ProductRow[]
  console.log(`Okunan ürün: ${rows.length}`)

  const corpus = buildCorpus(
    rows.map((row) => (typeof row.name === 'string' ? row.name : '')).filter((name) => name !== ''),
  )

  const changes: { id: number; from: string; to: string }[] = []
  let empty = 0
  for (const row of rows) {
    const name = typeof row.name === 'string' ? row.name : ''
    if (!name.trim()) {
      empty++
      continue
    }
    const normalized = normalizeProductName(name, corpus)
    if (normalized !== name) changes.push({ id: row.id, from: name, to: normalized })
  }

  console.log(`Adı boş: ${empty}`)
  console.log(`Değişecek: ${changes.length} / ${rows.length - empty}`)
  for (const change of changes.slice(0, 40)) {
    console.log(`  [${change.id}] "${change.from}" → "${change.to}"`)
  }

  if (!APPLY) {
    console.log('Kuru çalışma. Yazmak için --apply ekleyin.')
    return
  }

  const startedAt = new Date().toISOString()
  const failures: { id: number; error: string }[] = []
  let done = 0
  await pool(changes, CONCURRENCY, async (change) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await client.update('products', change.id, { name: change.to })
        break
      } catch (error) {
        if (attempt === 3) failures.push({ id: change.id, error: String(error).slice(0, 300) })
        else await sleep(500 * attempt)
      }
    }
    done++
    if (done % 250 === 0 || done === changes.length) {
      console.log(`  ${done}/${changes.length} (hata: ${failures.length})`)
    }
  })

  console.log(`Bitti. Güncellenen: ${changes.length - failures.length}, hata: ${failures.length}`)
  if (failures.length) {
    console.log('Hatalı kayıtlar:')
    for (const failure of failures.slice(0, 20)) console.log(`  [${failure.id}] ${failure.error}`)
  }

  // Ürün kancası her yazımı "düzenledi" katkısı olarak işler; toplu ad düzeltmesi bir
  // kullanıcı katkısı değildir, bu çalıştırmada doğan satırlar geri silinir.
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
