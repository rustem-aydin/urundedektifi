/**
 * Genel API koruması: okuma, yazma, GraphQL ve `/urunler/akis`.
 *
 * Neden: `/api/products?limit=0` tek istekte 9.498 kaydı (122 KB) döndürüyordu
 * ve hız sınırı yoktu; 25 art arda istek hiç 429 almadan 200 döndü (ölçüldü,
 * 2026-11-11). Ayrıca `limit=abc` gibi sayısal olmayan değerler `NaN`'a dönüşüp
 * karşılaştırmaları sessizce atlatıyordu (2026-11-23, tek istekte 9.658 kayıt).
 *
 * Kurallar:
 * - GET/HEAD `limit`/`page` yalnız rakamdan oluşan tam sayı olabilir; `limit`
 *   1..100, `page` 1..400. `NaN`, `Infinity`, ondalık, negatif, boşluklu veya
 *   boş değer → 400. Aynı parametre birden çok kez gönderilirse her değer
 *   denetlenir (parametre kirliliğiyle doğrulama atlatılamaz).
 * - `limit > 25` veya `page > 5` toplu sayfalama bütçesi: dakikada 30.
 * - Aynı IP dakikada 300 okuma; tek ürün uçları ayrıca dakikada 60.
 * - `/api/graphql` muaf değildir: ayrı IP bütçesi dakikada 30; sorgu, `variables`
 *   ve gövdedeki `limit` değerleri de 1..100 dışındaysa 400.
 * - `/urunler/akis` muaf değildir: IP başına dakikada 60. Sayfa tavanı (100)
 *   burada değil rotada uygulanır: tavan aşılırsa 429 değil, normal liste sonu
 *   (`products: []`, `hasNextPage: false`, HTTP 200) döner; istemci hata kutusu
 *   göstermez. Yanıt sözleşmesi (`products`, `page`, `pageSize`, `totalDocs`)
 *   korunur.
 * - Yazma uçları: kayıt, katkı ve geri bildirim dakikada 10; giriş/Google
 *   girişi dakikada 10 (pencere dolunca kendiliğinden açılır, kalıcı kilit yok);
 *   şifre sıfırlama e-posta başına saatte 3.
 * - Görsel trafiği (`/api/media/...`), MCP (`/api/mcp*`) ve oturum/panel
 *   okumaları (`/api/users*` GET) sayılmaz: sayfa başına onlarca medya isteği
 *   ve panel kullanımı normaldir.
 */

export const API_MAX_PAGE_SIZE = 100
export const API_MAX_PAGE = 400
export const API_HARD_LIMIT_PER_MINUTE = 300
export const API_BULK_LIMIT_PER_MINUTE = 30
export const API_CASE_LIMIT_PER_MINUTE = 60
export const API_GRAPHQL_LIMIT_PER_MINUTE = 30
export const API_WRITE_LIMIT_PER_MINUTE = 10
export const API_LOGIN_LIMIT_PER_MINUTE = 10
export const API_FORGOT_PASSWORD_LIMIT_PER_HOUR = 3
export const AKIS_LIMIT_PER_MINUTE = 60
/** Derin sayfalama tavanı: 100 × 24 = 2400 ürün. Tavan aşımı rota tarafında boş liste sonu döner. */
export const AKIS_MAX_PAGE = 100

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const STORE_MAX_KEYS = 20_000
const BULK_PAGE = 5
const BULK_LIMIT = 25

/**
 * Görsel dosyaları ve oturum gerektiren okumalar sayılmaz. Yazma uçları bu
 * listeden bağımsız olarak kendi bütçelerine tabidir.
 */
const READ_EXEMPT_PREFIXES = ['/api/media/', '/api/mcp', '/api/users'] as const

/** Tek ürün kaydı döndüren, barkodla gezilebilen uçlar. */
const CASE_PREFIXES = [
  '/api/products/case/',
  '/api/products/verdict/',
  '/api/products/feedback/',
] as const

/** GraphQL metninde `limit: N`, `"limit": N` ve `limit = N` biçimlerini yakalar. */
const GRAPHQL_LIMIT_PATTERN = /\blimit\b\s*["']?\s*[:=]\s*["']?\s*(-?\d+(?:\.\d+)?)/gi

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
  /** Proxy'nin yalnız gerekli uçlarda okuduğu istek gövdesi (GraphQL, şifre sıfırlama). */
  body?: string | null
  /** Gövde inceleme sınırını aşan istek: içerik taranamaz, bu yüzden reddedilir. */
  bodyTooLarge?: boolean
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
  windowMs: number = MINUTE_MS,
): number | null {
  const bucket = store.get(key)
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
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

function badRequest(message: string): ApiGuardDecision {
  return { allowed: false, status: 400, message }
}

/** Yalnız `0-9` dizisi kabul edilir: `Number()`'ın `NaN`/`Infinity`/ondalık çevrimleri devre dışı. */
function strictUnsigned(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

type Paging = { limit: number | null; page: number | null; bulk: boolean }

function parsePaging(params: URLSearchParams): Paging | ApiGuardDecision {
  let limit: number | null = null
  for (const raw of params.getAll('limit')) {
    const value = strictUnsigned(raw)
    if (value === null || value < 1 || value > API_MAX_PAGE_SIZE) {
      return badRequest(
        `limit yalnız 1–${API_MAX_PAGE_SIZE} arasında bir tam sayı olmalıdır. limit=0 tüm kayıtları döndürmez; sayfalamak için page kullanın.`,
      )
    }
    limit = value
  }

  let page: number | null = null
  for (const raw of params.getAll('page')) {
    const value = strictUnsigned(raw)
    if (value === null || value < 1 || value > API_MAX_PAGE) {
      return badRequest(`page yalnız 1–${API_MAX_PAGE} arasında bir tam sayı olmalıdır.`)
    }
    page = value
  }

  return {
    limit,
    page,
    bulk: (limit !== null && limit > BULK_LIMIT) || (page !== null && page > BULK_PAGE),
  }
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function isAkisPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return path === '/urunler/akis' || path.startsWith('/urunler/akis/')
}

function isGraphqlPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  return path === '/api/graphql' || path.startsWith('/api/graphql/')
}

function decideRead(
  input: ApiGuardInput,
  params: URLSearchParams,
  now: number,
  store: RateStore,
): ApiGuardDecision {
  const paging = parsePaging(params)
  if ('allowed' in paging) return paging

  const exempt = READ_EXEMPT_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))
  if (exempt) return { allowed: true }

  windowOverflow(store, now)

  const hard = consume(store, `hard:${input.ip}`, API_HARD_LIMIT_PER_MINUTE, now)
  if (hard !== null) return tooMany(hard)

  if (CASE_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))) {
    const single = consume(store, `case:${input.ip}`, API_CASE_LIMIT_PER_MINUTE, now)
    if (single !== null) return tooMany(single)
  }

  if (paging.bulk) {
    const bulk = consume(store, `bulk:${input.ip}`, API_BULK_LIMIT_PER_MINUTE, now)
    if (bulk !== null) return tooMany(bulk)
  }

  return { allowed: true }
}

function evaluateGraphqlLimit(raw: string): ApiGuardDecision | null {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > API_MAX_PAGE_SIZE) {
    return badRequest(
      `GraphQL limit yalnız 1–${API_MAX_PAGE_SIZE} arasında bir tam sayı olabilir. limit=0 tüm kayıtları döndürmez.`,
    )
  }
  return null
}

function decideGraphql(
  input: ApiGuardInput,
  params: URLSearchParams,
  now: number,
  store: RateStore,
): ApiGuardDecision {
  if (input.bodyTooLarge) {
    return badRequest('İstek gövdesi çok büyük; GraphQL sorgusu reddedildi.')
  }

  const retry = consume(store, `graphql:${input.ip}`, API_GRAPHQL_LIMIT_PER_MINUTE, now)
  if (retry !== null) return tooMany(retry)

  const chunks: string[] = []
  const query = params.get('query')
  if (query) chunks.push(query)
  const variables = params.get('variables')
  if (variables) chunks.push(variables)
  if (input.body) chunks.push(input.body)

  for (const chunk of chunks) {
    for (const match of chunk.matchAll(GRAPHQL_LIMIT_PATTERN)) {
      const decision = evaluateGraphqlLimit(match[1])
      if (decision) return decision
    }
  }

  return { allowed: true }
}

function decideAkis(input: ApiGuardInput, now: number, store: RateStore): ApiGuardDecision {
  // Sayfa tavanı rotada uygulanır (200 + boş liste sonu); burada yalnız IP bütçesi var.
  const retry = consume(store, `akis:${input.ip}`, AKIS_LIMIT_PER_MINUTE, now)
  if (retry !== null) return tooMany(retry)

  return { allowed: true }
}

function emailFromBody(body: string | null | undefined): string | null {
  if (!body) return null
  try {
    const parsed = JSON.parse(body) as { email?: unknown } | null
    if (typeof parsed?.email === 'string') {
      const email = parsed.email.trim().toLowerCase()
      return email === '' ? null : email
    }
  } catch {
    // Gövde JSON değilse Payload kendi hatasını döndürür; bütçe IP'ye yazılır.
  }
  return null
}

function writeBudget(
  store: RateStore,
  key: string,
  limit: number,
  now: number,
  message: string,
  windowMs: number = MINUTE_MS,
): ApiGuardDecision {
  const retry = consume(store, key, limit, now, windowMs)
  return retry === null
    ? { allowed: true }
    : { allowed: false, status: 429, message, retryAfterSeconds: retry }
}

function decideWrite(
  input: ApiGuardInput,
  now: number,
  store: RateStore,
): ApiGuardDecision {
  const method = input.method.toUpperCase()
  if (method !== 'POST') return { allowed: true }

  const pathname = normalizePath(input.pathname)
  windowOverflow(store, now)

  if (pathname === '/api/users/forgot-password') {
    if (input.bodyTooLarge) {
      return badRequest('İstek gövdesi çok büyük; şifre sıfırlama isteği reddedildi.')
    }
    const email = emailFromBody(input.body)
    const key = email ? `forgot:${email}` : `forgot-ip:${input.ip}`
    return writeBudget(
      store,
      key,
      API_FORGOT_PASSWORD_LIMIT_PER_HOUR,
      now,
      `Şifre sıfırlama isteği aynı e-posta için saatte en fazla ${API_FORGOT_PASSWORD_LIMIT_PER_HOUR} kez gönderilebilir.`,
      HOUR_MS,
    )
  }

  if (pathname === '/api/users/login' || pathname === '/api/users/google') {
    return writeBudget(
      store,
      `login:${input.ip}`,
      API_LOGIN_LIMIT_PER_MINUTE,
      now,
      'Çok fazla giriş denemesi. Bir dakika sonra tekrar deneyin.',
    )
  }

  if (pathname === '/api/users') {
    return writeBudget(
      store,
      `register:${input.ip}`,
      API_WRITE_LIMIT_PER_MINUTE,
      now,
      'Çok fazla kayıt denemesi. Bir dakika sonra tekrar deneyin.',
    )
  }

  if (pathname === '/api/products/contribute') {
    return writeBudget(
      store,
      `contribute:${input.ip}`,
      API_WRITE_LIMIT_PER_MINUTE,
      now,
      'Çok fazla katkı isteği. Bir dakika sonra tekrar deneyin.',
    )
  }

  // Geri bildirim yazıları hem koleksiyon REST'inden hem ürün uçlarından gelir.
  if (
    pathname === '/api/product-feedback' ||
    pathname.startsWith('/api/product-feedback/') ||
    pathname.startsWith('/api/products/feedback/')
  ) {
    return writeBudget(
      store,
      `feedback:${input.ip}`,
      API_WRITE_LIMIT_PER_MINUTE,
      now,
      'Çok fazla geri bildirim isteği. Bir dakika sonra tekrar deneyin.',
    )
  }

  return { allowed: true }
}

export function decideApiRequest(
  input: ApiGuardInput,
  store: RateStore = buckets,
): ApiGuardDecision {
  const method = input.method.toUpperCase()
  const now = input.now ?? Date.now()
  const params = new URLSearchParams(input.search)

  if (isAkisPath(input.pathname)) return decideAkis(input, now, store)
  if (isGraphqlPath(input.pathname)) return decideGraphql(input, params, now, store)
  if (method === 'GET' || method === 'HEAD') {
    return decideRead(input, params, now, store)
  }
  return decideWrite(input, now, store)
}
