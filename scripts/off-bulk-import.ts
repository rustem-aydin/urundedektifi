import fs from 'fs'
import path from 'path'
import readline from 'node:readline'
import { fileURLToPath } from 'url'
import { setTimeout as sleep } from 'node:timers/promises'
import { z } from 'zod'
import { createPayloadClient } from './lib/payload-rest'
import {
  OffProductSchema,
  createOffImporter,
  fromDumpRecord,
  loginOff,
  searchOffPage,
  type ImagePolicy,
  type OffImporter,
  type OffProduct,
} from './lib/off-import'

/**
 * Open Food Facts Türkiye listesinin tamamını (varsayılan: sayfa 2 → 231,
 * sayfa başına 50 ürün) prod Payload'a aktarır.
 *
 * Tasarım:
 *  - Sayfa yanıtları `.off-cache/pages/page-N.json` altında önbelleklenir;
 *    yeniden başlatmada OFF'a tekrar gidilmez.
 *  - İlerleme `.off-cache/state.json` içinde tutulur: biten sayfalar atlanır,
 *    hatalı barkodlar sonraki turda tekrar denenir.
 *  - Var olan barkodlar ATLANIR (elle zenginleştirilmiş kayıt ezilmez).
 *  - `--until-done`: OFF hız sınırı ya da kesinti olduğunda bekleyip devam
 *    eder; tüm sayfalar ve görseller tamamlanana kadar çıkmaz.
 *  - `--backfill-images`: yalnız eksik ön yüz görsellerini tamamlar.
 *
 * Kullanım:
 *   SEED_EMAIL=... SEED_PASSWORD=... node --import tsx/esm scripts/off-bulk-import.ts \
 *     [--from=2] [--to=231] [--images=all|front|none] [--sleep=8000] [--concurrency=4] \
 *     [--until-done] [--retry-failed] [--backfill-images]
 */

const API = process.env.SEED_API_URL ?? 'https://urundedektifi.elharezmi.com/api'
const EMAIL = process.env.SEED_EMAIL ?? ''
const PASSWORD = process.env.SEED_PASSWORD ?? ''
/** OFF arama ucu anonim kullanıcıya kapalı; hesap bilgileri verilirse oturum açılır. */
const OFF_USER = process.env.SEED_OFF_USER ?? ''
const OFF_PASSWORD = process.env.SEED_OFF_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error('SEED_EMAIL ve SEED_PASSWORD gerekli.')
  process.exit(1)
}

function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`
  const found = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const flag = (name: string): boolean => process.argv.slice(2).includes(`--${name}`)

const FROM = Number(arg('from', '2'))
const TO = Number(arg('to', '231'))
const SLEEP_MS = Number(arg('sleep', '8000'))
const IMAGES = (arg('images', 'all') ?? 'all') as ImagePolicy
const CONCURRENCY = Math.max(1, Math.min(8, Number(arg('concurrency', '4'))))
/** Görsel indirme/yükleme eşzamanlılığı (OFF CDN'i zorlamamak için ölçülü). */
const IMAGE_CONCURRENCY = Math.max(1, Math.min(8, Number(arg('image-concurrency', '3'))))
const RETRY_FAILED = flag('retry-failed')
const BACKFILL_IMAGES = flag('backfill-images')
/** `dump`: resmî jsonl dökümünden aktar (arama ucu kapalıyken tek yol). */
const SOURCE = arg('source', 'search') ?? 'search'
const DUMP_FILE = arg('dump', '')
const UNTIL_DONE = flag('until-done')
/** Sayfa alınamadığında (OFF hız sınırı) beklenecek süre. */
const OUTAGE_WAIT_MS = Number(arg('outage-wait', '600000'))
/**
 * Sayfa başına deneme sayısı. OFF hız sınırı istek sayısıyla tetiklendiği için
 * varsayılan 1: başarısız sayfa, dış döngüde uzun beklemeyle yeniden denenir.
 */
const PAGE_ATTEMPTS = Math.max(1, Number(arg('attempts', '1')))

if (!['all', 'front', 'none'].includes(IMAGES)) {
  console.error(`--images all|front|none olmalı, verilen: ${IMAGES}`)
  process.exit(1)
}

const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.off-cache')
const PAGES_DIR = path.join(CACHE_DIR, 'pages')
const STATE_FILE = path.join(CACHE_DIR, 'state.json')

const PageState = z.object({
  done: z.boolean().default(false),
  created: z.number().default(0),
  skipped: z.number().default(0),
  failed: z.number().default(0),
  total: z.number().default(0),
})

const State = z.object({
  pages: z.record(z.string(), PageState).default({}),
  failed: z
    .record(z.string(), z.object({ reason: z.string(), attempts: z.number().default(1) }))
    .default({}),
  /** Döküm görsel onarımında kalınan satır (yeniden başlatmada baştan okumamak için). */
  dumpBackfill: z.object({ lines: z.number().default(0) }).default({ lines: 0 }),
})

type State = z.infer<typeof State>

function loadState(): State {
  if (!fs.existsSync(STATE_FILE)) return State.parse({})
  return State.parse(JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')))
}

function saveState(state: State): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

/**
 * Sayfa yanıtını diskten okur; yoksa OFF'a gidip önbelleğe yazar.
 * OFF hız sınırı geçici 401/503 döndürdüğü için sayfa başına geri çekilme.
 */
async function loadPage(page: number, maxAttempts = PAGE_ATTEMPTS): Promise<OffProduct[]> {
  fs.mkdirSync(PAGES_DIR, { recursive: true })
  const cacheFile = path.join(PAGES_DIR, `page-${page}.json`)
  if (fs.existsSync(cacheFile)) {
    return z.array(OffProductSchema).parse(JSON.parse(fs.readFileSync(cacheFile, 'utf-8')))
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const { products } = await searchOffPage(page, 50)
      fs.writeFileSync(cacheFile, JSON.stringify(products))
      return products
    } catch (error) {
      if (attempt >= maxAttempts) throw error
      const wait = Math.min(300_000, 30_000 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 5_000)
      console.log(
        `  … sayfa ${page} alınamadı (${attempt}/${maxAttempts}), ${Math.round(wait / 1000)} sn sonra tekrar`,
      )
      await sleep(wait)
    }
  }
}

/** Basit iş havuzu: aynı anda en fazla `limit` ürün işlenir. */
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const current = index++
      if (current >= items.length) return
      await worker(items[current])
    }
  })
  await Promise.all(runners)
}

function duration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours} sa ${minutes} dk` : `${minutes} dk`
}

/** Tek geçiş: aralıktaki bitmemiş sayfaları aktarır. Alınamayan sayfa sayısını döndürür. */
async function importPass(
  importer: OffImporter,
  state: State,
  from: number,
  to: number,
): Promise<{ failedPages: number[]; created: number; skipped: number; failed: number }> {
  const failedPages: number[] = []
  let created = 0
  let skipped = 0
  let failed = 0
  let failStreak = 0

  for (let page = from; page <= to; page++) {
    const pageKey = String(page)
    if (state.pages[pageKey]?.done) continue

    let products: OffProduct[]
    try {
      products = await loadPage(page, PAGE_ATTEMPTS)
    } catch (error) {
      console.log(`! sayfa ${page} alınamadı: ${(error as Error).message}`)
      failedPages.push(page)
      // Üst üste 3 sayfa alınamıyorsa OFF tarafı kapalı: geçişi bitir, dışarıda bekle.
      if (++failStreak >= 2) {
        console.log('Üst üste 2 sayfa alınamadı; geçiş durduruldu.')
        return { failedPages, created, skipped, failed }
      }
      continue
    }
    failStreak = 0

    const pageStats = { created: 0, skipped: 0, failed: 0, total: products.length }
    console.log(`\n[sayfa ${page}] ${products.length} ürün`)

    try {
      await importer.prefetchIngredients(products)
    } catch (error) {
      console.log(`  ! içindekiler sözlüğü alınamadı: ${(error as Error).message}`)
    }

    await pool(products, CONCURRENCY, async (product) => {
      try {
        const result = await importer.importProduct(product)
        if (result.status !== 'skipped') {
          pageStats.created++
          created++
          console.log(
            `  + ${result.barcode} ${result.name} (${result.items} içindeki, ${result.nutrition} besin)`,
          )
        } else {
          pageStats.skipped++
          skipped++
          if (!['zaten kayıtlı', 'adsız ürün'].includes(result.reason)) {
            console.log(`  · ${result.barcode} atlandı: ${result.reason}`)
          }
        }
      } catch (error) {
        pageStats.failed++
        failed++
        const reason = (error as Error).message.slice(0, 300)
        const prior = state.failed[product.code]
        state.failed[product.code] = { reason, attempts: (prior?.attempts ?? 0) + 1 }
        console.log(`  ! ${product.code} hata: ${reason}`)
      }
    })

    state.pages[pageKey] = { done: true, ...pageStats }
    saveState(state)

    console.log(
      `[sayfa ${page}] +${pageStats.created} yeni · ${pageStats.skipped} atlandı · ${pageStats.failed} hata`,
    )

    if (page < to) await sleep(SLEEP_MS)
  }

  return { failedPages, created, skipped, failed }
}

/**
 * Döküm dosyasından aktarım. Yeniden çalıştırma güvenlidir: var olan barkodlar
 * atlanır, dosya baştan okunur (11,5 bin satır saniyeler sürer).
 */
async function dumpPass(
  importer: OffImporter,
  state: State,
  file: string,
): Promise<{ created: number; skipped: number; failed: number }> {
  const lines = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  })

  let created = 0
  let skipped = 0
  let failed = 0
  let index = 0
  let batch: OffProduct[] = []
  const startedAt = Date.now()

  const flush = async (): Promise<void> => {
    if (!batch.length) return
    // İçindekiler sözlüğü tek istekte toplanır; ürünler eşzamanlı yazılır.
    await importer.prefetchIngredients(batch).catch((error: unknown) => {
      console.log(`  ! içindekiler sözlüğü: ${(error as Error).message}`)
    })
    const pending = batch
    batch = []
    await pool(pending, CONCURRENCY, async (product) => {
      try {
        const result = await importer.importProduct(product)
        if (result.status === 'skipped') {
          skipped++
        } else {
          created++
          console.log(`  + ${result.barcode} ${result.name} (${result.items} içindeki, ${result.nutrition} besin)`)
        }
      } catch (error) {
        failed++
        state.failed[product.code] = {
          reason: (error as Error).message.slice(0, 300),
          attempts: (state.failed[product.code]?.attempts ?? 0) + 1,
        }
        console.log(`  ! ${product.code} hata: ${(error as Error).message.slice(0, 200)}`)
      }
    })
    saveState(state)
    const perProduct = (Date.now() - startedAt) / index
    const remaining = Math.max(0, 11528 - index)
    console.log(
      `[döküm ${index}] +${created} · ${skipped} atlandı · ${failed} hata · ` +
        `${(perProduct / 1000).toFixed(1)} sn/ürün · kalan ~${duration(perProduct * remaining)}`,
    )
  }

  for await (const line of lines) {
    index++
    if (!line.trim()) continue
    try {
      batch.push(fromDumpRecord(JSON.parse(line) as Record<string, unknown>))
    } catch (error) {
      failed++
      console.log(`  ! satır ${index} ayrıştırılamadı: ${(error as Error).message.slice(0, 160)}`)
      continue
    }
    if (batch.length >= 200) await flush()
  }
  await flush()

  return { created, skipped, failed }
}

/** Dökümdeki ürünlerin eksik görsellerini tamamlar (arama ucu kapalıyken kullanılır). */
async function dumpBackfillPass(
  importer: OffImporter,
  state: State,
  file: string,
): Promise<{ filled: number; missing: number }> {
  const lines = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  })

  let filled = 0
  let missing = 0
  let index = 0
  const startedAt = Date.now()
  const resumeFrom = state.dumpBackfill.lines

  for await (const line of lines) {
    index++
    if (index <= resumeFrom) continue
    if (!line.trim()) continue
    let product: OffProduct
    try {
      product = fromDumpRecord(JSON.parse(line) as Record<string, unknown>)
    } catch {
      continue
    }
    const result = await importer.fixImages(product).catch(() => 'failed' as const)
    if (result === 'filled') filled++
    else if (result === 'failed') missing++

    if (index % 100 === 0) {
      state.dumpBackfill = { lines: index }
      saveState(state)
      const processed = index - resumeFrom
      const perProduct = (Date.now() - startedAt) / processed
      console.log(
        `[görsel ${index}] ${filled} eklendi · ${missing} başarısız · ` +
          `${(perProduct / 1000).toFixed(2)} sn/ürün · kalan ~${duration(perProduct * Math.max(0, 11528 - index))}`,
      )
    }
  }

  state.dumpBackfill = { lines: index }
  saveState(state)
  return { filled, missing }
}

/** Tek geçiş: önbellekteki ürünlerin eksik ön yüz görsellerini tamamlar. */
async function backfillPass(
  importer: OffImporter,
  from: number,
  to: number,
): Promise<{ filled: number; missing: number; unreadable: number }> {
  let filled = 0
  let missing = 0
  let unreadable = 0
  const startedAt = Date.now()

  for (let page = from; page <= to; page++) {
    const products = await loadPage(page).catch(() => [] as OffProduct[])
    if (!products.length) {
      unreadable++
      continue
    }
    let pageMissing = 0
    await pool(products, Math.max(2, CONCURRENCY), async (product) => {
      const result = await importer.fixImages(product).catch(() => 'failed' as const)
      if (result === 'filled') filled++
      else if (result === 'failed') {
        pageMissing++
        missing++
      }
    })
    console.log(
      `[görsel ${page}] ${pageMissing ? `${pageMissing} eksik kaldı` : 'tamam'} · toplam ${filled} eklendi ·` +
        ` ${duration(Date.now() - startedAt)}`,
    )
  }

  return { filled, missing, unreadable }
}

/** Kayıtlı hatalı barkodları bir kez daha dener. */
async function retryFailedPass(
  importer: OffImporter,
  state: State,
  from: number,
  to: number,
): Promise<number> {
  const codes = Object.entries(state.failed)
    .filter(([, entry]) => entry.attempts < 4)
    .map(([code]) => code)
  if (!codes.length) return 0

  console.log(`\nTekrar deneme: ${codes.length} barkod`)
  const byBarcode = new Map<string, OffProduct>()
  for (let page = from; page <= to; page++) {
    for (const product of await loadPage(page).catch(() => [] as OffProduct[])) {
      byBarcode.set(product.code, product)
    }
  }

  let created = 0
  for (const code of codes) {
    const product = byBarcode.get(code)
    if (!product) continue
    try {
      await importer.prefetchIngredients([product])
      const result = await importer.importProduct(product)
      if (result.status !== 'skipped') {
        created++
        console.log(`  + ${code} ${result.name}`)
      }
      delete state.failed[code]
      saveState(state)
    } catch (error) {
      const prior = state.failed[code]
      state.failed[code] = {
        reason: (error as Error).message.slice(0, 300),
        attempts: (prior?.attempts ?? 1) + 1,
      }
      saveState(state)
    }
  }
  return created
}

async function main(): Promise<void> {
  const client = createPayloadClient({ api: API, email: EMAIL, password: PASSWORD })
  console.log(`Hedef: ${client.api}`)
  console.log(
    `Aralık: sayfa ${FROM}–${TO} · görseller: ${IMAGES} · eşzamanlılık: ${CONCURRENCY} · ` +
      `OFF bekleme: ${SLEEP_MS} ms${UNTIL_DONE ? ' · mod: until-done' : ''}`,
  )
  await client.login()

  if (OFF_USER && OFF_PASSWORD) {
    await loginOff(OFF_USER, OFF_PASSWORD)
    console.log(`  OFF oturumu açıldı: ${OFF_USER}`)
  } else {
    console.log('  OFF oturumu yok (SEED_OFF_USER/SEED_OFF_PASSWORD boş) — arama ucu 401 verebilir.')
  }

  const importer = await createOffImporter(client, {
    images: IMAGES,
    imageConcurrency: IMAGE_CONCURRENCY,
    ingredientCachePath: path.join(CACHE_DIR, 'ingredients.json'),
  })
  await importer.init()
  console.log('Master listeler yüklendi.')

  if (BACKFILL_IMAGES && SOURCE === 'dump') {
    if (!DUMP_FILE || !fs.existsSync(DUMP_FILE)) {
      throw new Error(`--backfill-images --source=dump için --dump=<dosya.jsonl> gerekli`)
    }
    const result = await dumpBackfillPass(importer, loadState(), DUMP_FILE)
    console.log(`Görsel onarımı (döküm): ${result.filled} eklendi · ${result.missing} başarısız`)
    if (result.missing) process.exitCode = 2
    return
  }

  if (BACKFILL_IMAGES) {
    const result = await backfillPass(importer, FROM, TO)
    console.log(
      `Görsel onarımı: ${result.filled} eklendi · ${result.missing} eksik · ` +
        `${result.unreadable} sayfa okunamadı`,
    )
    if (result.missing || result.unreadable) process.exitCode = 2
    return
  }

  if (SOURCE === 'dump') {
    if (!DUMP_FILE || !fs.existsSync(DUMP_FILE)) {
      throw new Error(`--source=dump için --dump=<dosya.jsonl> gerekli (bulunamadı: ${DUMP_FILE || 'yok'})`)
    }
    const state = loadState()
    const result = await dumpPass(importer, state, DUMP_FILE)
    const totals = await client.find('products', {
      where: { status: { equals: 'published' } },
      limit: 0,
    })
    console.log(
      `\nDöküm aktarımı: +${result.created} yeni · ${result.skipped} atlandı · ` +
        `${result.failed} hata · yayındaki ürün: ${totals.totalDocs}`,
    )
    if (result.failed) process.exitCode = 2
    return
  }

  const state = loadState()
  const startedAt = Date.now()
  let loginAt = Date.now()
  let pass = 0

  for (;;) {
    pass++
    if (Date.now() - loginAt > 45 * 60_000) {
      await client.login()
      loginAt = Date.now()
    }

    const importResult = await importPass(importer, state, FROM, TO)
    const abortedMidPass = importResult.failedPages.length > 0
    if ((RETRY_FAILED || UNTIL_DONE) && !abortedMidPass) {
      await retryFailedPass(importer, state, FROM, TO)
    }

    const pendingPages = []
    for (let page = FROM; page <= TO; page++) {
      if (!state.pages[String(page)]?.done) pendingPages.push(page)
    }
    const remainingFailures = Object.keys(state.failed).length

    const totals = await client.find('products', {
      where: { status: { equals: 'published' } },
      limit: 0,
    })
    console.log(
      `\n[geçiş ${pass}] yeni: ${importResult.created} · atlanan: ${importResult.skipped} · ` +
        `hata: ${importResult.failed} · bekleyen sayfa: ${pendingPages.length} · ` +
        `yayındaki ürün: ${totals.totalDocs} · geçen: ${duration(Date.now() - startedAt)}`,
    )

    let imagesMissing = 0
    if (!pendingPages.length && IMAGES !== 'none') {
      const backfill = await backfillPass(importer, FROM, TO)
      imagesMissing = backfill.missing + backfill.unreadable
    }

    const complete = !pendingPages.length && remainingFailures === 0 && imagesMissing === 0
    if (complete) {
      console.log('\nTamamlandı: tüm sayfalar aktarıldı, bekleyen görsel ya da hata yok.')
      return
    }
    if (!UNTIL_DONE) {
      console.log(
        `\nEksik kaldı (sayfa: ${pendingPages.length}, hata: ${remainingFailures}, görsel: ${imagesMissing}).` +
          ' `--until-done` ile eksikler tamamlanır.',
      )
      process.exitCode = 2
      return
    }

    console.log(
      `OFF/kaynak beklemesi: ${duration(OUTAGE_WAIT_MS)} sonra yeniden denenecek ` +
        `(bekleyen sayfa: ${pendingPages.length || 'yok'}, hata: ${remainingFailures}, görsel: ${imagesMissing}).`,
    )
    await sleep(OUTAGE_WAIT_MS)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
