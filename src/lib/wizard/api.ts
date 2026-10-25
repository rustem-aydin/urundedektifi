import type {
  AuthResponse,
  ExpertStats,
  FeedbackTargetKey,
  FeedbackVerdict,
  ProductFeedback,
  MasterCollection,
  MasterOption,
  MediaRef,
  PayloadList,
  PostDoc,
  PostListItem,
  ProductDoc,
  ProductWriteData,
  RawProduct,
  User,
} from './types'
import type { ExpertVerdict } from '@/lib/verdictEngine'
import { normalizeText } from './match'

/**
 * Ekle/Düzenle yazma yolu (ADR 0008/0009). Web, Payload ile aynı kaynakta çalışır; bu yüzden
 * taban yol görelidir (`/api`) ve CORS gerekmez. Tüm yazma çağrıları JWT ister.
 */

export const API_BASE = (process.env.NEXT_PUBLIC_PAYLOAD_API_URL ?? '/api').replace(/\/+$/, '')

export type ApiErrorKind = 'notFound' | 'unauthorized' | 'offline' | 'server'

export class ApiError extends Error {
  kind: ApiErrorKind
  status: number

  constructor(kind: ApiErrorKind, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const REQUEST_TIMEOUT_MS = 15000

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  // FormData gövdesinde Content-Type'ı fetch kendisi (boundary ile) üretir.
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `JWT ${token}` } : {}),
        ...init.headers,
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    throw new ApiError(
      'offline',
      0,
      detail ? `Sunucuya ulaşılamadı: ${detail}` : 'Sunucuya ulaşılamadı.',
    )
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError('unauthorized', response.status, 'Bu işlem için yetkiniz yok.')
  }
  if (response.status === 404) {
    throw new ApiError('notFound', 404, 'Kayıt bulunamadı.')
  }
  if (!response.ok) {
    // Payload hata gövdesi: { errors: [{ message }] }; özel uçlar { error: 'cümle' } döner.
    const detail = await response
      .json()
      .then((body: unknown) => {
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          return body.error
        }
        if (body && typeof body === 'object' && 'errors' in body && Array.isArray(body.errors)) {
          const first = body.errors[0]
          if (first && typeof first === 'object' && 'message' in first && typeof first.message === 'string') {
            return first.message
          }
        }
        return null
      })
      .catch(() => null)
    throw new ApiError(
      'server',
      response.status,
      detail ? `Sunucu hatası (${response.status}): ${detail}` : `Sunucu hatası (${response.status}).`,
    )
  }

  return (await response.json()) as T
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function fetchMe(token: string): Promise<User> {
  const result = await request<User | { user: User }>('/users/me', {}, token)
  return 'user' in result ? result.user : result
}

/** Master listeleri tek tek sayfalar hâlinde toplar (marka 700+, içindekiler yüzlerce olabilir). */
export async function fetchMasterOptions(collection: MasterCollection): Promise<MasterOption[]> {
  const pageSize = 200
  const collected: MasterOption[] = []
  let page = 1
  let totalPages = 1
  do {
    const result = await request<PayloadList<Record<string, unknown>>>(
      // `sort=createdAt`: aynı ad birden çok kez açılmışsa öneri EN ESKİ (kanonik) kaydı göstersin,
      // yeni kopya eklendikçe öneri kaymasın. Kayıt anındaki arama (`findMasterByName`) de böyle.
      `/${collection}?limit=${pageSize}&depth=0&sort=createdAt&page=${page}`,
    )
    for (const doc of result.docs) collected.push(toMasterOption(doc))
    totalPages = result.totalPages
    page += 1
  } while (page <= totalPages)
  return collected
}

function toMasterOption(doc: Record<string, unknown>): MasterOption {
  const name = typeof doc.name === 'string' ? doc.name : typeof doc.code === 'string' ? doc.code : ''
  const aliases = Array.isArray(doc.aliases)
    ? doc.aliases
        .map((row) => {
          if (!row || typeof row !== 'object') return null
          const value = 'alias' in row ? row.alias : null
          return typeof value === 'string' ? value : null
        })
        .filter((value): value is string => Boolean(value))
    : []
  return {
    id: String(doc.id ?? ''),
    name,
    code: typeof doc.code === 'string' ? doc.code : null,
    aliases,
  }
}

/** Barkodla ham doküman (durumdan bağımsız; taslak ürünler de bulunur). */
export async function findProductByBarcode(barcode: string): Promise<RawProduct | null> {
  const page = await request<PayloadList<RawProduct>>(
    `/products?limit=1&depth=0&where[barcode][equals]=${encodeURIComponent(barcode)}`,
  )
  return page.docs[0] ?? null
}

/** Düzenle ekranının formu: ilişkileri açılmış ham doküman (`depth=2`). */
export async function fetchProductDoc(id: string): Promise<ProductDoc | null> {
  try {
    // Payload tekil doküman ucunda `{ doc }` sarmalı yok: gövde doğrudan ürün.
    return await request<ProductDoc>(`/products/${encodeURIComponent(id)}?depth=2`)
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'notFound') return null
    throw error
  }
}

/** Ürünü siler (sunucu `delete` yetkisini admin/editör ile sınırlıyor). */
export async function deleteProduct(id: string, token: string): Promise<void> {
  await request<unknown>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }, token)
}

/** Medya yüklemesi: multipart, `file` alanı + isteğe bağlı `alt`. */
export async function uploadMedia(blob: Blob, fileName: string, token: string, alt?: string): Promise<MediaRef> {
  const form = new FormData()
  form.append('file', new File([blob], fileName, { type: blob.type || 'image/jpeg' }))
  if (alt) form.append('alt', alt)
  const result = await request<{ doc: MediaRef }>('/media', { method: 'POST', body: form }, token)
  return result.doc
}

export async function createProduct(data: ProductWriteData, token: string): Promise<RawProduct> {
  const result = await request<{ doc: RawProduct }>(
    '/products',
    { method: 'POST', body: JSON.stringify(data) },
    token,
  )
  return result.doc
}

export async function updateProduct(
  id: string,
  data: ProductWriteData,
  token: string,
): Promise<RawProduct> {
  const result = await request<{ doc: RawProduct }>(
    `/products/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(data) },
    token,
  )
  return result.doc
}

export async function createMasterDoc(
  collection: MasterCollection,
  data: { name?: string; code?: string; slug?: string },
  token: string,
): Promise<{ id: string }> {
  const result = await request<{ doc: { id: string | number } }>(
    `/${collection}`,
    { method: 'POST', body: JSON.stringify(data) },
    token,
  )
  return { id: String(result.doc.id) }
}

/** Master kayıt arama (ör. "yeni oluştur" 400 dönerse mevcut kaydı bulmak için). */
export async function findMasterDoc(
  collection: MasterCollection,
  field: 'name' | 'code',
  value: string,
): Promise<{ id: string; name: string } | null> {
  const page = await request<
    PayloadList<{ id: string | number; name?: string | null; code?: string | null }>
  >(`/${collection}?limit=1&depth=0&where[${field}][equals]=${encodeURIComponent(value)}`)
  const doc = page.docs[0]
  if (!doc) return null
  return { id: String(doc.id), name: doc.name ?? doc.code ?? value }
}

/**
 * Ada göre master arama — eşlemede "Yeni oluştur" denmiş olsa bile aynı adlı kayıt varsa
 * onu bağlamak için. Payload `like` büyük/küçük harf duyarsızdır ama ALT DİZE eşler
 * ("su" → "Susam"), bu yüzden aday listesi `normalizeText` ile tam eşitliğe süzülür.
 * `equals` kullanılmaz: Türkçe harf ve büyük/küçük farkı yüzünden mevcut kaydı kaçırır.
 * Aynı ad birden çok kez açılmışsa **en eski** kayıt seçilir (`sort=createdAt`): kopyalar
 * sonradan açıldığı için kanonik satır odur.
 */
export async function findMasterByName(
  collection: MasterCollection,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const needle = normalizeText(name)
  if (!needle) return null
  const page = await request<
    PayloadList<{ id: string | number; name?: string | null }>
  >(
    `/${collection}?limit=100&depth=0&sort=createdAt&where[name][like]=${encodeURIComponent(name.trim())}`,
  )
  const doc = page.docs.find(
    (row) => typeof row.name === 'string' && normalizeText(row.name) === needle,
  )
  if (!doc) return null
  return { id: String(doc.id), name: doc.name ?? name }
}

/**
 * Tüketici hesabı açma. Sunucu `users.create`'i herkese açtı; rol hook'ta `user`'a sabitlenir.
 * Kayıt jeton döndürmez — hemen ardından `login()` çağrılır.
 */
export async function register(input: {
  name: string
  email: string
  password: string
}): Promise<void> {
  await request<{ doc: unknown }>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Takip listesini tümüyle yazar (hasMany alanı; sunucu yalnız kendi dokümanına izin verir). */
export async function updateFollowing(
  userId: string | number,
  expertIds: string[],
  token: string,
): Promise<void> {
  // Postgres ilişkileri tamsayı kimlik bekler; "2" dizesi doğrulamada reddedilir.
  const values = expertIds.map((id) => (/^\d+$/.test(id) ? Number(id) : id))
  await request<{ doc: unknown }>(
    `/users/${encodeURIComponent(String(userId))}`,
    { method: 'PATCH', body: JSON.stringify({ following: values }) },
    token,
  )
}

export async function fetchExpertStats(expertId: string): Promise<ExpertStats> {
  return request<ExpertStats>(`/experts/${encodeURIComponent(expertId)}/stats`)
}

/**
 * Takip edilen uzmanların yayınlanmış yazıları (ray + profil listesi).
 * `expert.isPublic` koşulu public olmayan uzmanın yazılarını sorgu düzeyinde düşürür.
 */
export async function fetchPostsByExperts(
  expertIds: string[],
  options: { limit?: number; since?: Date } = {},
): Promise<PostListItem[]> {
  if (!expertIds.length) return []
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 24))
  // depth=2: yazının uzmanı ve uzmanın avatarı ray için açılmış gelsin.
  params.set('depth', '2')
  params.set('sort', '-publishedAt')
  params.set('where[and][0][status][equals]', 'published')
  params.set('where[and][1][expert.isPublic][equals]', 'true')
  expertIds.forEach((id, index) => {
    params.set(`where[and][2][expert][in][${index}]`, id)
  })
  if (options.since) {
    params.set('where[and][3][publishedAt][greater_than_equal]', options.since.toISOString())
  }
  const page = await request<PayloadList<PostListItem>>(`/posts?${params.toString()}`)
  return page.docs
}

export async function fetchPostBySlug(slug: string): Promise<PostDoc | null> {
  const page = await request<PayloadList<PostDoc>>(
    `/posts?limit=1&depth=2&where[slug][equals]=${encodeURIComponent(slug)}`,
  )
  return page.docs[0] ?? null
}

/** Oturum sahibinin takip ettiği uzmanlara daraltılmış hüküm (misafir → boş). */
export type ProductVerdict = {
  totalMatched: number
  byExpert: ExpertVerdict[]
  /** Takip edilmeyen uzmanların eşleşmeleri var mı? (boş durumun nedenini ayırt eder) */
  hasOtherMatches?: boolean
}

export async function fetchVerdict(barcode: string, token?: string | null): Promise<ProductVerdict> {
  return request<ProductVerdict>(
    `/products/verdict/${encodeURIComponent(barcode)}`,
    {},
    token ?? undefined,
  )
}

/** Barkod → takip edilen uzmanların eşleşen kural sayısı (liste kartları). */
export async function fetchMatchCounts(
  barcodes: string[],
  token?: string | null,
): Promise<Record<string, number>> {
  if (barcodes.length === 0) return {}
  const result = await request<{ counts: Record<string, number> }>(
    `/products/match-counts?barcodes=${encodeURIComponent(barcodes.join(','))}`,
    {},
    token ?? undefined,
  )
  return result.counts ?? {}
}

// --- Ürün verisi doğrulaması + yorumlar (ADR 0013) ---

export async function fetchProductFeedback(
  barcode: string,
  token?: string | null,
  options: { page?: number; limit?: number } = {},
): Promise<ProductFeedback> {
  const query = new URLSearchParams({
    page: String(options.page ?? 0),
    limit: String(options.limit ?? 20),
  })
  return request<ProductFeedback>(
    `/products/feedback/${encodeURIComponent(barcode)}?${query.toString()}`,
    {},
    token,
  )
}

export async function submitFeedbackVote(
  barcode: string,
  input: { target: FeedbackTargetKey; verdict: FeedbackVerdict; note?: string },
  token: string,
): Promise<ProductFeedback> {
  return request<ProductFeedback>(
    `/products/feedback/${encodeURIComponent(barcode)}/vote`,
    {
      method: 'POST',
      body: JSON.stringify({ target: input.target, verdict: input.verdict, note: input.note ?? '' }),
    },
    token,
  )
}

export async function submitFeedbackComment(
  barcode: string,
  text: string,
  token: string,
): Promise<ProductFeedback> {
  return request<ProductFeedback>(
    `/products/feedback/${encodeURIComponent(barcode)}/comment`,
    { method: 'POST', body: JSON.stringify({ text }) },
    token,
  )
}

export async function deleteFeedbackComment(
  barcode: string,
  id: string,
  token: string,
): Promise<ProductFeedback> {
  return request<ProductFeedback>(
    `/products/feedback/${encodeURIComponent(barcode)}/comment/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    token,
  )
}
