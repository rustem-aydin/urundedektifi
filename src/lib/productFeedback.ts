import { LRUCache } from 'lru-cache'
import { APIError, type Payload } from 'payload'

import type { User } from '@/payload-types'

/**
 * Ürün verisi doğrulaması ve yorumları.
 *
 * Tek veri kaynağı `product-feedback` koleksiyonudur. Bir doğrulama oyu kendi
 * yorum metnini taşır (`kind: 'vote'`): kullanıcının "doğrula" demesi de yorum
 * listesinde görünür, ayrı bir yorum dokümanı doğmaz. Böylece oy + yorum aynı
 * kayıtta yaşar, tekrar oylamada aynı satır güncellenir.
 *
 * Doğrulama birimi ürün dosyası bölümleridir (sabit `FEEDBACK_TARGETS`).
 * Dosya 01 (uzman hükümleri) ve Dosya 08 (fiyat kayıtları) kapsam dışıdır:
 * ilki uzman içeriğidir, ikincisi tarih damgalı fiyat kayıtlarıdır.
 */

export const FEEDBACK_TARGETS = [
  { key: 'uyarilar', label: 'Uyarılar' },
  { key: 'icindekiler', label: 'İçindekiler' },
  { key: 'besin-degerleri', label: 'Besin değerleri' },
  { key: 'genel-bilgiler', label: 'Genel bilgiler' },
  { key: 'teknik-ozellikler', label: 'Teknik özellikler' },
  { key: 'aciklama', label: 'Açıklama' },
] as const

export type FeedbackTargetKey = (typeof FEEDBACK_TARGETS)[number]['key']
export type FeedbackVerdict = 'confirm' | 'refute'
export type FeedbackKind = 'vote' | 'comment'

export const FEEDBACK_TARGET_KEYS: FeedbackTargetKey[] = FEEDBACK_TARGETS.map((t) => t.key)

export const FEEDBACK_TARGET_LABELS: Record<FeedbackTargetKey, string> = Object.fromEntries(
  FEEDBACK_TARGETS.map((t) => [t.key, t.label]),
) as Record<FeedbackTargetKey, string>

export const DEFAULT_CONFIRM_TEXT = 'Verilerin doğruluğunu teyit ediyorum.'

/** "Doğru değil" oyunun metni bu ifadeyle başlar; kullanıcı yalnız nedeni yazar. */
export const REFUTE_PREFIX = 'Doğru olmadığını bildiriyorum çünkü '

export const MAX_FEEDBACK_TEXT = 500
export const FEEDBACK_PAGE_SIZE = 20
export const FEEDBACK_PAGE_MAX = 100
/** Bir ürün başına önbelleğe alınan en yeni kayıt sayısı. */
const FEEDBACK_LOAD_LIMIT = 500

export type FeedbackTargetSummary = {
  confirm: number
  refute: number
  total: number
  /** 0 oy varsa null. */
  percent: number | null
}

export type FeedbackEntry = {
  id: string
  target: FeedbackTargetKey | null
  targetLabel: string | null
  kind: FeedbackKind
  verdict: FeedbackVerdict | null
  text: string
  authorName: string
  createdAt: string
  mine: boolean
  canDelete: boolean
}

export type ProductFeedbackSummary = {
  barcode: string
  productName: string
  targets: Record<FeedbackTargetKey, FeedbackTargetSummary>
  comments: FeedbackEntry[]
  totalComments: number
  hasMore: boolean
  myVotes: Partial<Record<FeedbackTargetKey, FeedbackVerdict>>
  signedIn: boolean
}

export type FeedbackProduct = { id: number; name: string; barcode: string | null }

type RawFeedback = {
  id: string | number
  target: FeedbackTargetKey | null
  kind: FeedbackKind
  verdict: FeedbackVerdict | null
  text: string
  authorId: string
  authorName: string
  createdAt: string
}

const feedbackCache = new LRUCache<string, RawFeedback[]>({
  max: 200,
  ttl: 1000 * 30, // 30 sn: yazma yolları zaten anında düşürür, TTL yalnız dış süreçler için.
})

/** Serbest yorum spam kilidi: hesap başına 30 sn'de bir yeni yorum (oylar sınırlı değil). */
const commentRate = new LRUCache<string, number>({ max: 5000, ttl: 1000 * 60 * 10 })
const COMMENT_COOLDOWN_MS = 30_000

/** Panelden yapılan silme/düzenleme ve endpoint yazmaları buradan önbelleği düşürür. */
export function invalidateProductFeedbackCache(productId?: string | number | null) {
  if (productId != null) feedbackCache.delete(String(productId))
  else feedbackCache.clear()
}

export function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return id == null ? null : String(id)
  }
  return null
}

function isTargetKey(value: unknown): value is FeedbackTargetKey {
  return typeof value === 'string' && FEEDBACK_TARGET_KEYS.includes(value as FeedbackTargetKey)
}

function normalizeText(value: string): string {
  const text = value.replace(/\r\n/g, '\n').trim()
  if (!text) throw new APIError('Yorum metni boş olamaz.', 400)
  if (text.length > MAX_FEEDBACK_TEXT) {
    throw new APIError(`Yorum en fazla ${MAX_FEEDBACK_TEXT} karakter olabilir.`, 400)
  }
  return text
}

function voteText(verdict: FeedbackVerdict, note: string | null | undefined): string {
  const trimmed = (note ?? '').replace(/\r\n/g, '\n').trim()
  if (verdict === 'confirm') return normalizeText(trimmed || DEFAULT_CONFIRM_TEXT)
  if (!trimmed) {
    throw new APIError('Doğru olmadığını bildirirken nedeni yazmalısın.', 400)
  }
  const reason = trimmed.startsWith(REFUTE_PREFIX) ? trimmed.slice(REFUTE_PREFIX.length) : trimmed
  return normalizeText(`${REFUTE_PREFIX}${reason}`)
}

async function authorNames(
  payload: Payload,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const result = await payload.find({
    collection: 'users',
    where: { id: { in: unique } },
    limit: unique.length,
    depth: 0,
    overrideAccess: true,
    select: { name: true },
  })
  const map = new Map<string, string>()
  for (const doc of result.docs as { id: string | number; name?: string | null }[]) {
    map.set(String(doc.id), (doc.name || '').trim() || 'Üye')
  }
  return map
}

async function loadFeedback(payload: Payload, productId: string | number): Promise<RawFeedback[]> {
  const key = String(productId)
  const cached = feedbackCache.get(key)
  if (cached) return cached

  const result = await payload.find({
    collection: 'product-feedback',
    where: { product: { equals: productId } },
    sort: '-createdAt',
    limit: FEEDBACK_LOAD_LIMIT,
    depth: 0,
    overrideAccess: true,
  })

  const docs = result.docs as {
    id: string | number
    product: unknown
    target?: string | null
    kind?: string | null
    verdict?: string | null
    text?: string | null
    author: unknown
    createdAt: string
  }[]

  const names = await authorNames(
    payload,
    docs.map((doc) => relationId(doc.author)).filter((id): id is string => Boolean(id)),
  )

  const rows: RawFeedback[] = docs
    .map((doc) => {
      const authorId = relationId(doc.author)
      if (!authorId) return null
      const kind: FeedbackKind = doc.kind === 'vote' ? 'vote' : 'comment'
      return {
        id: doc.id,
        target: isTargetKey(doc.target) ? doc.target : null,
        kind,
        verdict:
          kind === 'vote' && (doc.verdict === 'confirm' || doc.verdict === 'refute')
            ? (doc.verdict as FeedbackVerdict)
            : null,
        text: (doc.text || '').trim(),
        authorId,
        authorName: names.get(authorId) || 'Üye',
        createdAt: doc.createdAt,
      }
    })
    .filter((row): row is RawFeedback => row !== null)

  feedbackCache.set(key, rows)
  return rows
}

/** Yayındaki ürünü barkoddan çözer; yoksa null (uç 404 döner). */
export async function feedbackProduct(
  payload: Payload,
  barcode: string,
): Promise<FeedbackProduct | null> {
  const found = await payload.find({
    collection: 'products',
    where: { and: [{ barcode: { equals: barcode } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { name: true, barcode: true },
  })
  const product = found.docs[0]
  if (!product) return null
  return {
    id: product.id,
    name: product.name || 'Ürün',
    barcode: product.barcode ?? null,
  }
}

function canModerate(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'editor'
}

export async function buildFeedbackSummary({
  payload,
  product,
  user,
  page = 0,
  limit = FEEDBACK_PAGE_SIZE,
}: {
  payload: Payload
  product: FeedbackProduct
  user: User | null
  page?: number
  limit?: number
}): Promise<ProductFeedbackSummary> {
  const rows = await loadFeedback(payload, product.id)
  const userId = user?.id != null ? String(user.id) : null
  const moderator = canModerate(user)

  const targets = Object.fromEntries(
    FEEDBACK_TARGET_KEYS.map((key) => [key, { confirm: 0, refute: 0, total: 0, percent: null }]),
  ) as Record<FeedbackTargetKey, FeedbackTargetSummary>

  const myVotes: Partial<Record<FeedbackTargetKey, FeedbackVerdict>> = {}

  for (const row of rows) {
    if (row.kind !== 'vote' || !row.target || !row.verdict) continue
    const bucket = targets[row.target]
    bucket[row.verdict] += 1
    bucket.total += 1
    if (userId && row.authorId === userId) myVotes[row.target] = row.verdict
  }
  for (const key of FEEDBACK_TARGET_KEYS) {
    const bucket = targets[key]
    bucket.percent = bucket.total > 0 ? Math.round((bucket.confirm * 100) / bucket.total) : null
  }

  const safeLimit = Math.min(Math.max(limit, 1), FEEDBACK_PAGE_MAX)
  const safePage = Math.max(page, 0)
  const start = safePage * safeLimit
  const comments = rows.slice(start, start + safeLimit).map<FeedbackEntry>((row) => {
    const mine = Boolean(userId && row.authorId === userId)
    return {
      id: String(row.id),
      target: row.target,
      targetLabel: row.target ? FEEDBACK_TARGET_LABELS[row.target] : null,
      kind: row.kind,
      verdict: row.verdict,
      text: row.text,
      authorName: row.authorName,
      createdAt: row.createdAt,
      mine,
      canDelete: mine || moderator,
    }
  })

  return {
    barcode: String(product.barcode ?? ''),
    productName: product.name,
    targets,
    comments,
    totalComments: rows.length,
    hasMore: start + comments.length < rows.length,
    myVotes,
    signedIn: Boolean(user),
  }
}

function requireUser(user: User | null): User {
  if (!user) throw new APIError('Bunun için giriş yapman gerekiyor.', 401)
  return user
}

export function assertTarget(value: unknown): FeedbackTargetKey {
  if (!isTargetKey(value)) throw new APIError('Geçersiz doğrulama başlığı.', 400)
  return value
}

export function assertVerdict(value: unknown): FeedbackVerdict {
  if (value !== 'confirm' && value !== 'refute') {
    throw new APIError('Doğrulama kararı "confirm" ya da "refute" olmalı.', 400)
  }
  return value
}

/**
 * Doğrulama oyu: kullanıcı + ürün + bölüm başına tek kayıt. Tekrar oy verilirse
 * aynı doküman güncellenir (yorum metni dahil), ikinci satır açılmaz.
 */
export async function castFeedbackVote({
  payload,
  product,
  user,
  target,
  verdict,
  note,
}: {
  payload: Payload
  product: FeedbackProduct
  user: User | null
  target: FeedbackTargetKey
  verdict: FeedbackVerdict
  note?: string | null
}): Promise<void> {
  const author = requireUser(user)
  const text = voteText(verdict, note)

  const existing = await payload.find({
    collection: 'product-feedback',
    where: {
      and: [
        { product: { equals: product.id } },
        { target: { equals: target } },
        { kind: { equals: 'vote' } },
        { author: { equals: author.id } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = existing.docs[0]
  if (doc) {
    await payload.update({
      collection: 'product-feedback',
      id: doc.id,
      data: { verdict, text },
      overrideAccess: true,
      depth: 0,
    })
  } else {
    await payload.create({
      collection: 'product-feedback',
      data: {
        product: product.id,
        target,
        kind: 'vote',
        verdict,
        text,
        author: author.id,
      },
      overrideAccess: true,
      depth: 0,
    })
  }
  invalidateProductFeedbackCache(product.id)
}

export async function addFeedbackComment({
  payload,
  product,
  user,
  text,
}: {
  payload: Payload
  product: FeedbackProduct
  user: User | null
  text: string
}): Promise<void> {
  const author = requireUser(user)
  const last = commentRate.get(String(author.id))
  if (last && Date.now() - last < COMMENT_COOLDOWN_MS) {
    throw new APIError('Çok hızlı yazıyorsun. 30 saniye sonra tekrar dene.', 429)
  }
  await payload.create({
    collection: 'product-feedback',
    data: {
      product: product.id,
      kind: 'comment',
      text: normalizeText(text),
      author: author.id,
    },
    overrideAccess: true,
    depth: 0,
  })
  commentRate.set(String(author.id), Date.now())
  invalidateProductFeedbackCache(product.id)
}

export async function removeFeedbackComment({
  payload,
  product,
  user,
  id,
}: {
  payload: Payload
  product: FeedbackProduct
  user: User | null
  id: string
}): Promise<void> {
  const author = requireUser(user)
  const doc = await payload.findByID({
    collection: 'product-feedback',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const ownerId = relationId(doc.author)
  const owns = ownerId != null && String(author.id) === ownerId
  if (!owns && !canModerate(author)) {
    throw new APIError('Bu yorumu silme yetkin yok.', 403)
  }
  if (relationId(doc.product) !== String(product.id)) {
    throw new APIError('Yorum bu ürüne ait değil.', 400)
  }
  await payload.delete({
    collection: 'product-feedback',
    id,
    overrideAccess: true,
  })
  invalidateProductFeedbackCache(product.id)
}
