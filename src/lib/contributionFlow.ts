import type { Payload } from 'payload'

import type { User } from '@/payload-types'

/**
 * Katkı akışı (ADR 0024): taramada bulunamayan barkod için son kullanıcı fotoğraf gönderir,
 * ürün `draft` olarak açılır ve editör inceleme kuyruğunda görür. Ürün yayına alınınca
 * profilde "Katkılarım" listesinde durumu değişir; kabul edilmezse kayıt silinir.
 */

/** Katkı sahibinin aynı anda açık tutabileceği taslak sayısı. */
export const PENDING_LIMIT = 50
/** Bir katkıda gönderilebilecek fotoğraf sayısı (ilk fotoğraf ön yüz). */
export const CONTRIBUTION_PHOTOS = { min: 1, max: 6 } as const

export type ContributionState = 'published' | 'pending' | 'none'

/** Barkodu yalnız rakamlara indirir; 8–14 hane dışındaysa null. */
export function normalizeContributionBarcode(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 14 ? digits : null
}

/** Barkodun durumu: yayında mı, incelemede mi, hiç yok mu. */
export async function contributionState(
  payload: Payload,
  barcode: string,
): Promise<ContributionState> {
  const found = await payload.find({
    collection: 'products',
    where: { barcode: { equals: barcode } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { status: true },
  })
  const product = found.docs[0]
  if (!product) return 'none'
  return product.status === 'published' ? 'published' : 'pending'
}

/** Kullanıcının incelemede bekleyen (taslak) katkı sayısı. */
export async function pendingContributionCount(
  payload: Payload,
  userId: string | number,
): Promise<number> {
  const result = await payload.count({
    collection: 'products',
    where: {
      and: [{ submittedBy: { equals: userId } }, { status: { equals: 'draft' } }],
    },
    overrideAccess: true,
  })
  return result.totalDocs
}

export class ContributionError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ContributionError'
  }
}

export type ContributionInput = {
  payload: Payload
  user: User | null
  barcode: string | null
  mediaIds: unknown
  req?: Parameters<Payload['create']>[0]['req']
}

export type ContributionResult = { id: string; barcode: string; state: ContributionState }

/**
 * Katkı kaydı: giriş zorunlu, barkod 8–14 hane, 1–6 görsel, aynı barkodda kayıt olmamalı,
 * kullanıcının 50'den az açık taslağı olmalı. Ürün `draft` olarak açılır; `submittedBy`
 * alanı sahibi işaretler ve `afterChange` kancası `product-contributions` satırını yazar.
 */
export async function submitContribution({
  payload,
  user,
  barcode,
  mediaIds,
  req,
}: ContributionInput): Promise<ContributionResult> {
  if (!user) throw new ContributionError(401, 'Katkı için giriş yapmanız gerekiyor.')

  const code = normalizeContributionBarcode(barcode)
  if (!code) throw new ContributionError(400, 'Barkod 8–14 haneli olmalı.')

  const ids = Array.isArray(mediaIds)
    ? mediaIds
        .map((id) => String(id ?? '').trim())
        .filter((id) => /^\d+$/.test(id))
    : []
  if (ids.length < CONTRIBUTION_PHOTOS.min) {
    throw new ContributionError(400, 'En az bir fotoğraf gönderin.')
  }
  if (ids.length > CONTRIBUTION_PHOTOS.max) {
    throw new ContributionError(400, `En fazla ${CONTRIBUTION_PHOTOS.max} fotoğraf gönderilebilir.`)
  }
  if (new Set(ids).size !== ids.length) {
    throw new ContributionError(400, 'Aynı fotoğraf birden fazla eklenemez.')
  }

  const existing = await contributionState(payload, code)
  if (existing === 'published') {
    throw new ContributionError(409, 'Bu barkod zaten kayıtlı; ürün dosyasını açabilirsiniz.')
  }
  if (existing === 'pending') {
    throw new ContributionError(409, 'Bu barkod için açılmış bir kayıt var; yeni katkı açılamaz.')
  }

  const pending = await pendingContributionCount(payload, user.id)
  if (pending >= PENDING_LIMIT) {
    throw new ContributionError(
      429,
      `Bekleyen ${PENDING_LIMIT} katkınız var. İncelenmesini bekleyin.`,
    )
  }

  const files = await payload.find({
    collection: 'media',
    where: { id: { in: ids.map((id) => Number(id)) } },
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
    select: { mimeType: true },
  })
  if (files.docs.length !== ids.length) {
    throw new ContributionError(400, 'Fotoğraflardan biri yüklenemedi; tekrar deneyin.')
  }
  if (files.docs.some((doc) => !String(doc.mimeType ?? '').startsWith('image/'))) {
    throw new ContributionError(400, 'Yalnız fotoğraf gönderilebilir.')
  }

  const created = await payload.create({
    collection: 'products',
    data: {
      barcode: code,
      status: 'draft',
      submittedBy: user.id,
      frontImage: Number(ids[0]),
      additionalImages: ids.slice(1).map((id) => ({ image: Number(id) })),
      // `nutrition.per` şemada zorunlu; katkı kaydı analiz öncesi boş besin tablosuyla açılır.
      nutrition: { per: '100g' },
    },
    overrideAccess: true,
    ...(req ? { req } : {}),
  })

  return { id: String(created.id), barcode: code, state: 'pending' }
}

export type MyContribution = {
  id: string
  barcode: string | null
  name: string | null
  status: 'draft' | 'published' | 'archived' | null
  createdAt: string | null
  frontImageUrl: string | null
  frontImageAlt: string | null
  photoCount: number
}

function mediaOf(ref: unknown): { url: string | null; alt: string | null } {
  if (!ref || typeof ref !== 'object') return { url: null, alt: null }
  const media = ref as { url?: string | null; alt?: string | null }
  return { url: media.url ?? null, alt: media.alt ?? null }
}

type ProductRow = {
  id: string | number
  barcode?: string | null
  name?: string | null
  status?: string | null
  createdAt?: string | null
  frontImage?: unknown
  additionalImages?: { image?: unknown }[] | null
}

function toMyContribution(doc: ProductRow): MyContribution {
  const image = mediaOf(doc.frontImage)
  return {
    id: String(doc.id),
    barcode: doc.barcode ?? null,
    name: doc.name ?? null,
    status: (doc.status as MyContribution['status']) ?? null,
    createdAt: doc.createdAt ?? null,
    frontImageUrl: image.url,
    frontImageAlt: image.alt,
    photoCount: (doc.additionalImages ?? []).length + (doc.frontImage ? 1 : 0),
  }
}

/** Oturum sahibinin katkıları (incelemede + yayında), en yeni önce. */
export async function myContributions(
  payload: Payload,
  userId: string | number,
): Promise<MyContribution[]> {
  const found = await payload.find({
    collection: 'products',
    where: { submittedBy: { equals: userId } },
    sort: '-createdAt',
    limit: 100,
    depth: 1,
    overrideAccess: true,
    select: {
      barcode: true,
      name: true,
      status: true,
      createdAt: true,
      frontImage: true,
      additionalImages: true,
    },
  })
  return found.docs.map((doc) => toMyContribution(doc as unknown as ProductRow))
}

export type ReviewItem = MyContribution & {
  submitterName: string | null
  submitterId: string | null
  submitterAvatarUrl: string | null
  seen: boolean
}

/** İnceleme kuyruğu: yalnız taslaklar, görülmemişler önce ve eski önce. */
export async function reviewQueue(payload: Payload): Promise<ReviewItem[]> {
  const found = await payload.find({
    collection: 'products',
    where: { status: { equals: 'draft' } },
    sort: 'createdAt',
    limit: 200,
    depth: 2,
    overrideAccess: true,
    select: {
      barcode: true,
      name: true,
      status: true,
      createdAt: true,
      frontImage: true,
      additionalImages: true,
      submittedBy: true,
      is_submit: true,
    },
  })

  const items = found.docs.map((doc) => {
    const row = doc as unknown as ProductRow & {
      submittedBy?: { id?: string | number; name?: string | null; avatar?: unknown } | null
      is_submit?: boolean | null
    }
    const submitter = row.submittedBy && typeof row.submittedBy === 'object' ? row.submittedBy : null
    const avatar = mediaOf(submitter?.avatar)
    return {
      ...toMyContribution(row),
      submitterName: submitter?.name ?? null,
      submitterId: submitter ? String(submitter.id ?? '') || null : null,
      submitterAvatarUrl: avatar.url,
      seen: row.is_submit === true,
    }
  })

  return items.sort((a, b) => {
    if (a.seen !== b.seen) return a.seen ? 1 : -1
    return (a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1
  })
}
