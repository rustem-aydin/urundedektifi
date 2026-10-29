import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'

import { findAllDocs } from './findAllDocs'
import { CONTRIBUTION_KINDS, CONTRIBUTION_LABELS, type ContributionKind } from './contributionLabels'

/**
 * Ürün katkısı ("Katkıda Bulunanlar").
 *
 * Bir ürünün altında üç iş sayılır: ürünü oluşturan, düzenleyen (kaydedilen revizyon)
 * ve veri doğrulaması yapan (bölüm oyu). Aynı kişi üçünü de yaptıysa tek satırda
 * görünür; işler `roles` rozetleriyle listelenir. Kayıtlar yalnız sunucu tarafından
 * yazılır (koleksiyonun yazma kapısı kapalı), okuma herkese açıktır.
 */

export { CONTRIBUTION_KINDS, CONTRIBUTION_LABELS }
export type { ContributionKind }

/** Rozet sırası: oluşturan → düzenleyen → doğrulayan. */
const KIND_ORDER: ContributionKind[] = ['create', 'update', 'verify']

/**
 * Profilde listelenen ürün sayısı üst sınırı (en çok görüntülenenler önce).
 * Bir kullanıcı 9.000+ ürüne katkı verebiliyor: hepsini basmak sayfayı 22 MB'a çıkarıyordu.
 */
export const PROFILE_PRODUCT_LIMIT = 30

export type Contributor = {
  id: string
  name: string
  bio: string | null
  avatarUrl: string | null
  avatarAlt: string | null
  roles: ContributionKind[]
  /** İlk katkının zamanı — avatar grubunun sırası bu. */
  firstAt: string
}

type MediaRef = { url?: string | null; alt?: string | null } | number | string | null | undefined

type ContributorUser = {
  id: string | number
  name?: string | null
  bio?: string | null
  avatar?: MediaRef
}

type ContributionDoc = {
  id: string | number
  product: string | number | { id: string | number }
  user: string | number | ContributorUser | null
  kind: ContributionKind
  createdAt?: string | null
}

type ProductDoc = {
  id: string | number
  name?: string | null
  barcode?: string | null
  status?: string | null
  goruntulenme?: number | string | null
  frontImage?: MediaRef
}

type ExpertDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  title?: string | null
  isPublic?: boolean | null
  avatar?: MediaRef
}

type UserDoc = {
  id: string | number
  name?: string | null
  bio?: string | null
  role?: string | null
  createdAt?: string | null
  avatar?: MediaRef
  following?: (string | number | { id: string | number })[] | null
}

export type ProfileProduct = {
  id: string
  name: string
  barcode: string | null
  frontImageUrl: string | null
  frontImageAlt: string | null
  goruntulenme: number
  roles: ContributionKind[]
}

export type ProfileFollowing = {
  id: string
  name: string
  slug: string
  title: string | null
  avatarUrl: string | null
  avatarAlt: string | null
}

export type PublicProfile = {
  id: string
  name: string
  bio: string | null
  role: string
  avatarUrl: string | null
  avatarAlt: string | null
  createdAt: string | null
  stats: {
    /** Katkı sağladığı yayındaki ürün sayısı. */
    productCount: number
    /** Bu ürünlerin toplam görüntülenmesi (ürün başına bir kez). */
    viewTotal: number
    /** Katkı işi sayısı (oluşturdu + düzenledi + doğruladı). */
    contributionCount: number
  }
  products: ProfileProduct[]
  following: ProfileFollowing[]
}

function mediaOf(ref: MediaRef): { url: string | null; alt: string | null } {
  if (ref && typeof ref === 'object') {
    return { url: ref.url ?? null, alt: ref.alt ?? null }
  }
  return { url: null, alt: null }
}

function relationId(ref: string | number | { id: string | number } | null | undefined): string {
  if (ref === null || ref === undefined) return ''
  if (typeof ref === 'object') return String(ref.id ?? '')
  return String(ref)
}

/**
 * Tek bir katkı işini kaydeder; aynı (ürün, kullanıcı, iş) varsa hiçbir şey yapmaz.
 * Kullanıcı yoksa (misafir yazımı) sessizce döner.
 */
export async function recordContribution(args: {
  payload: Payload
  productId: string | number | null | undefined
  userId: string | number | null | undefined
  kind: ContributionKind
  /**
   * Yazının doğduğu istek. Payload kancaları yazıyı bir işlem (transaction) içinde
   * çalıştırır; aynı işlem içinde ikinci bir belge yazmak için `req` geçmek gerekir,
   * aksi hâlde iç içe işlem açılmaya çalışılır ve insert düşer.
   */
  req?: PayloadRequest
}): Promise<void> {
  const { payload, productId, userId, kind, req } = args
  if (!productId || !userId) return

  try {
    const existing = await payload.find({
      collection: 'product-contributions',
      where: {
        and: [
          { product: { equals: productId } },
          { user: { equals: userId } },
          { kind: { equals: kind } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    })
    if (existing.docs.length > 0) return

    await payload.create({
      collection: 'product-contributions',
      data: { product: Number(productId), user: Number(userId), kind },
      overrideAccess: true,
      ...(req ? { req } : {}),
    })
  } catch (error) {
    // Katkı kaydı ikincil bilgidir: ürün yazımını asla geri düşürmemeli.
    payload.logger.error({ err: error, msg: `Katkı kaydı yazılamadı (${kind}/${productId})` })
  }
}

/** Ürünün katkıcıları: kişi başına tek satır, işler rozet olarak. */
export async function listContributors(
  payload: Payload,
  productId: string | number,
): Promise<{ total: number; contributors: Contributor[] }> {
  const docs = await findAllDocs<ContributionDoc>(payload, 'product-contributions', {
    where: { product: { equals: productId } },
    depth: 2,
    sort: 'createdAt',
  })

  const byUser = new Map<string, Contributor>()
  for (const doc of docs) {
    if (!doc.user || typeof doc.user !== 'object') continue
    const user = doc.user as ContributorUser
    const userId = String(user.id ?? '')
    if (!userId) continue

    const existing = byUser.get(userId)
    if (existing) {
      if (!existing.roles.includes(doc.kind)) existing.roles.push(doc.kind)
      if (doc.createdAt && (!existing.firstAt || doc.createdAt < existing.firstAt)) {
        existing.firstAt = doc.createdAt
      }
      continue
    }

    const avatar = mediaOf(user.avatar)
    byUser.set(userId, {
      id: userId,
      name: user.name ?? 'Katılımcı',
      bio: user.bio ?? null,
      avatarUrl: avatar.url,
      avatarAlt: avatar.alt,
      roles: [doc.kind],
      firstAt: doc.createdAt ?? '',
    })
  }

  const contributors = [...byUser.values()]
    .map((contributor) => ({
      ...contributor,
      roles: KIND_ORDER.filter((kind) => contributor.roles.includes(kind)),
    }))
    .sort((a, b) => (a.firstAt === b.firstAt ? a.name.localeCompare(b.name, 'tr') : a.firstAt < b.firstAt ? -1 : 1))

  return { total: contributors.length, contributors }
}

/**
 * Herkese açık profil: kimlik + katkı özeti + katkı verdiği ürünler + takip ettikleri.
 * E-posta, yetki jetonları ve iç alanlar asla dışarı çıkmaz; yalnız aşağıdaki alanlar döner.
 *
 * Sayılar tek bir toplama sorgusundan gelir: bir kullanıcının 9.000+ katkısı olabiliyor,
 * satırları tek tek çekmek profili saniyelerce süründürüyordu. Liste de en çok görüntülenen
 * `PROFILE_PRODUCT_LIMIT` ürünle sınırlıdır; toplam sayı `stats.productCount` ile verilir.
 */
export async function buildPublicProfile(
  payload: Payload,
  userId: string | number,
): Promise<PublicProfile | null> {
  const user = (await payload
    .findByID({ collection: 'users', id: userId, depth: 2, overrideAccess: true })
    .catch(() => null)) as UserDoc | null
  if (!user) return null

  const numericId = Number(userId)
  const statsRows = (await payload.db.drizzle.execute(sql`
    select
      (select count(*)::int from "product_contributions" where "user_id" = ${numericId}) as contribution_count,
      coalesce(agg.product_count, 0)::int as product_count,
      coalesce(agg.view_total, 0)::int as view_total
    from (
      select count(*)::int as product_count, coalesce(sum(t."goruntulenme"), 0) as view_total
      from (
        select distinct p."id", p."goruntulenme"
        from "products" p
        join "product_contributions" c on c."product_id" = p."id"
        where c."user_id" = ${numericId} and p."status" = 'published'
      ) t
    ) agg
  `)) as { rows?: { contribution_count?: number; product_count?: number; view_total?: number }[] }

  const statsRow = statsRows.rows?.[0]
  const topRows = (await payload.db.drizzle.execute(sql`
    select p."id"
    from "products" p
    join "product_contributions" c on c."product_id" = p."id"
    where c."user_id" = ${numericId} and p."status" = 'published'
    group by p."id", p."goruntulenme", p."created_at"
    order by p."goruntulenme" desc nulls last, p."created_at" desc
    limit ${PROFILE_PRODUCT_LIMIT}
  `)) as { rows?: { id?: number }[] }

  const topIds = (topRows.rows ?? []).map((row) => Number(row.id)).filter((id) => Number.isFinite(id))
  const published =
    topIds.length > 0
      ? await findAllDocs<ProductDoc>(payload, 'products', {
          where: { id: { in: topIds } },
          depth: 1,
        })
      : []

  const rolesRows =
    topIds.length > 0
      ? ((await payload.db.drizzle.execute(sql`
          select "product_id", array_agg(distinct "kind"::text) as roles
          from "product_contributions"
          where "user_id" = ${numericId} and "product_id" in (${sql.join(
            topIds.map((id) => sql`${id}`),
            sql`, `,
          )})
          group by "product_id"
        `)) as { rows?: { product_id?: number; roles?: string[] }[] }).rows ?? []
      : []

  const rolesByProduct = new Map<string, ContributionKind[]>()
  for (const row of rolesRows) {
    const productId = String(row.product_id ?? '')
    if (!productId) continue
    rolesByProduct.set(productId, (row.roles ?? []).filter((kind): kind is ContributionKind => KIND_ORDER.includes(kind as ContributionKind)))
  }

  const byId = new Map(published.map((product) => [String(product.id), product]))
  const products: ProfileProduct[] = topIds
    .map((id) => byId.get(String(id)))
    .filter((product): product is ProductDoc => Boolean(product))
    .map((product) => {
      const image = mediaOf(product.frontImage)
      const roles = rolesByProduct.get(String(product.id)) ?? []
      return {
        id: String(product.id),
        name: product.name ?? 'İsimsiz ürün',
        barcode: product.barcode ?? null,
        frontImageUrl: image.url,
        frontImageAlt: image.alt,
        goruntulenme: Math.max(0, Math.trunc(Number(product.goruntulenme ?? 0)) || 0),
        roles: KIND_ORDER.filter((kind) => roles.includes(kind)),
      }
    })

  const followingIds = (user.following ?? []).map((ref) => relationId(ref)).filter(Boolean)
  const experts =
    followingIds.length > 0
      ? await findAllDocs<ExpertDoc>(payload, 'experts', {
          where: { id: { in: followingIds } },
          depth: 1,
        })
      : []

  const following: ProfileFollowing[] = experts
    .filter((expert) => expert.isPublic !== false)
    .map((expert) => {
      const avatar = mediaOf(expert.avatar)
      return {
        id: String(expert.id),
        name: expert.name ?? 'Uzman',
        slug: expert.slug ?? '',
        title: expert.title ?? null,
        avatarUrl: avatar.url,
        avatarAlt: avatar.alt,
      }
    })
    .filter((expert) => expert.slug)

  const avatar = mediaOf(user.avatar)

  return {
    id: String(user.id),
    name: user.name ?? 'Kullanıcı',
    bio: user.bio ?? null,
    role: user.role ?? 'user',
    avatarUrl: avatar.url,
    avatarAlt: avatar.alt,
    createdAt: user.createdAt ?? null,
    stats: {
      productCount: Math.max(0, Math.trunc(Number(statsRow?.product_count ?? 0)) || 0),
      viewTotal: Math.max(0, Math.trunc(Number(statsRow?.view_total ?? 0)) || 0),
      contributionCount: Math.max(0, Math.trunc(Number(statsRow?.contribution_count ?? 0)) || 0),
    },
    products,
    following,
  }
}

/** Ürünün katkıcılarını barkodla getirir (mobil ve REST istemcileri için). */
export async function contributorsForBarcode(
  payload: Payload,
  barcode: string,
): Promise<{ total: number; contributors: Contributor[] } | null> {
  const found = await payload.find({
    collection: 'products',
    where: { barcode: { equals: barcode } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const product = found.docs[0]
  if (!product) return null
  return listContributors(payload, product.id)
}
