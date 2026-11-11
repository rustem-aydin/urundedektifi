/**
 * Genel API okuma koruması.
 *
 * Neden: `/api/products?limit=0` tek istekte 9.498 kaydı (122 KB) döndürüyordu
 * ve hız sınırı yoktu; 25 art arda istek hiç 429 almadan 200 döndü (ölçüldü,
 * 2026-11-11). Katalog bu yüzden birkaç saniyede kopyalanabiliyordu.
 *
 * Koruma yalnız `GET`/`HEAD` okumalarına uygulanır; yazma uçları (katkı, geri
 * bildirim, giriş) kendi erişim kurallarıyla çalışmaya devam eder:
 * - `limit=0` (Payload'da "hepsi") ve `limit > 100` → 400
 * - aynı IP'den dakikada 300'den fazla okuma → 429
 * - `limit > 25` veya `page > 5` (toplu sayfalama) dakikada 30 → 429
 * - ürün kaydı döndüren uçlar (`/api/products/case/...` vb.) dakikada 60 → 429
 *
 * Limitler bilinçli olarak cömerttir: web ve mobil istemciler en fazla
 * `limit=100` kullanır (mobilde sayfa boyutu 24), tek sayfa açılışı birkaç okuma
 * yapar. Görsel trafiği (`/api/media/file/...`) ve yönetim/oturum uçları
 * sayılmaz; böylece sayfa açılış hızı ve panel kullanımı etkilenmez.
 */

export const API_MAX_PAGE_SIZE = 100
export const API_HARD_LIMIT_PER_MINUTE = 300
export const API_BULK_LIMIT_PER_MINUTE = 30
export const API_CASE_LIMIT_PER_MINUTE = 60

const WINDOW_MS = 60_000
const STORE_MAX_KEYS = 20_000
const BULK_PAGE = 5
const BULK_LIMIT = 25

/**
 * Görsel dosyaları ve oturum gerektiren uçlar sayılmaz: sayfa başına onlarca
 * medya isteği normaldir, panel de aynı IP'den çok sayıda okuma yapar.
 */
const EXEMPT_PREFIXES = ['/api/media/', '/api/mcp', '/api/users', '/api/graphql'] as const

/** Tek ürün kaydı döndüren, barkodla gezilebilen uçlar. */
const CASE_PREFIXES = [
  '/api/products/case/',
  '/api/products/verdict/',
  '/api/products/feedback/',
] as const

type Bucket = { count: number; resetAt: number }
export type RateStore = Map<string, Bucket>

export type ApiGuardDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 429; message: string; retryAfterSeconds?: number }

export type ApiGuardInput = {
  method: string
  pathname: string
  search: string
  ip: string
  now?: number
}

const buckets: RateStore = new Map()

function windowOverflow(store: RateStore, now: number): void {
  if (store.size <= STORE_MAX_KEYS) return
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key)
  }
  // Hâlâ büyükse yeni anahtarlarla şişmek yerine sayacı sıfırla (fail-open).
  if (store.size > STORE_MAX_KEYS) store.clear()
}

/** `null` → istek hakkı var; sayı → 429 için beklenecek saniye. */
function consume(
  store: RateStore,
  key: string,
  limit: number,
  now: number,
): number | null {
  const bucket = store.get(key)
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }
  if (bucket.count >= limit) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  }
  bucket.count += 1
  return null
}

function tooMany(retryAfterSeconds: number): ApiGuardDecision {
  return {
    allowed: false,
    status: 429,
    message: 'Çok fazla istek. Lütfen bir dakika sonra tekrar deneyin.',
    retryAfterSeconds,
  }
}

export function decideApiRead(
  input: ApiGuardInput,
  store: RateStore = buckets,
): ApiGuardDecision {
  const method = input.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return { allowed: true }

  if (EXEMPT_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) {
    return { allowed: true }
  }

  const now = input.now ?? Date.now()
  const params = new URLSearchParams(input.search)

  const limitParam = params.get('limit')
  if (limitParam !== null && limitParam !== '') {
    const limit = Number(limitParam)
    if (Number.isFinite(limit) && limit === 0) {
      return {
        allowed: false,
        status: 400,
        message:
          'limit=0 kapatıldı: tüm kayıtları tek istekte döndürmez. Sayfalamak için limit (en fazla 100) ve page kullanın.',
      }
    }
    if (Number.isFinite(limit) && limit > API_MAX_PAGE_SIZE) {
      return {
        allowed: false,
        status: 400,
        message: `limit en fazla ${API_MAX_PAGE_SIZE} olabilir. Daha fazlası için page parametresiyle sayfalayın.`,
      }
    }
  }

  windowOverflow(store, now)

  const hard = consume(store, `hard:${input.ip}`, API_HARD_LIMIT_PER_MINUTE, now)
  if (hard !== null) return tooMany(hard)

  if (CASE_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) {
    const single = consume(store, `case:${input.ip}`, API_CASE_LIMIT_PER_MINUTE, now)
    if (single !== null) return tooMany(single)
  }

  const page = Number(params.get('page') ?? '1')
  const limit = Number(params.get('limit') ?? '0')
  const isBulk =
    (Number.isFinite(limit) && limit > BULK_LIMIT) || (Number.isFinite(page) && page > BULK_PAGE)
  if (isBulk) {
    const bulk = consume(store, `bulk:${input.ip}`, API_BULK_LIMIT_PER_MINUTE, now)
    if (bulk !== null) return tooMany(bulk)
  }

  return { allowed: true }
}
