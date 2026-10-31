import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { expertRules, listProductsForRules } from '@/lib/productCase'
import { ruleTypeLabel } from '@/lib/ruleLabels'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ExpertTabs } from '@/components/ExpertTabs'
import { FollowButton } from '@/components/FollowButton'
import { ProductCard } from '@/components/ProductCard'
import { VerdictStamp } from '@/components/VerdictStamp'

export const metadata: Metadata = {
  title: 'Uzman',
}

const SOCIAL_LABELS: Record<string, string> = {
  website: 'Web',
  twitter: 'X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const RULE_PAGE_SIZE = 20
/** Sekmede gösterilen ürün kartı: 5 sütunda iki tam satır. */
const PRODUCT_CARD_LIMIT = 10

export default async function ExpertDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ kuralSayfa?: string; sekme?: string }>
}) {
  const { slug } = await params
  const { kuralSayfa, sekme } = await searchParams
  const rulePage = Math.max(1, Number(kuralSayfa) || 1)
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const result = await payload.find({
    collection: 'experts',
    where: {
      and: [{ slug: { equals: slug } }, { isPublic: { equals: true } }],
    },
    limit: 1,
    depth: 1,
  })

  const expert = result.docs[0]
  if (!expert) notFound()

  const [rules, ratings, posts, followers, matched] = await Promise.all([
    payload.find({
      collection: 'expert-rules',
      where: {
        and: [{ expert: { equals: expert.id } }, { isActive: { equals: true } }],
      },
      sort: '-createdAt',
      limit: RULE_PAGE_SIZE,
      page: rulePage,
      depth: 1,
    }),
    payload.find({
      collection: 'rating-scales',
      where: { expert: { equals: expert.id } },
      sort: 'order',
      depth: 0,
    }),
    payload.find({
      collection: 'posts',
      where: { and: [{ expert: { equals: expert.id } }, { status: { equals: 'published' } }] },
      sort: '-publishedAt',
      limit: 3,
      depth: 1,
    }),
    payload.count({
      collection: 'users',
      where: { following: { in: [expert.id] } },
      overrideAccess: true,
    }),
    // Ürün eşleşmesi TÜM kurallarla hesaplanır; kart için yalnız gösterilecek kadar Dosya kurulur.
    // Kurallar istekler arası önbellekten gelir (3.900+ satır her açılışta okunmaz).
    expertRules(payload, expert.id).then((allRules) =>
      listProductsForRules(payload, allRules, { limit: PRODUCT_CARD_LIMIT }),
    ),
  ])

  const matchedProducts = matched.products
  const matchedTotal = matched.total

  const cover = typeof expert.cover === 'object' ? expert.cover : null
  const socials = Object.entries(expert.socialLinks ?? {}).filter(
    ([, value]) => typeof value === 'string' && value,
  ) as [string, string][]

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12">
      {/* KAPAK + KİMLİK */}
      <header>
        <div className="relative h-36 overflow-hidden rounded-b-md border border-t-0 border-border bg-tape-yellow/15 sm:h-48">
          {cover?.url ? (
            <img
              src={cover.url}
              alt={cover.alt || expert.name}
              className="size-full object-cover"
            />
          ) : (
            <div aria-hidden="true" className="flex size-full items-center justify-center">
              <span className="font-mono text-[0.65rem] tracking-[0.4em] text-faded uppercase">
                UZMAN DOSYASI · {expert.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 px-1 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            {typeof expert.avatar === 'object' && expert.avatar?.url ? (
              <img
                src={expert.avatar.url}
                alt={expert.avatar.alt || expert.name}
                className="-mt-14 size-24 shrink-0 rounded-full border-4 border-background object-cover shadow-sm sm:-mt-16"
              />
            ) : (
              <span
                aria-hidden="true"
                className="-mt-14 flex size-24 shrink-0 items-center justify-center rounded-full border-4 border-background bg-muted font-display text-2xl text-muted-foreground sm:-mt-16"
              >
                {expert.name.slice(0, 2)}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1 pb-1">
              <EvidenceTag>UZMAN DOSYASI</EvidenceTag>
              <h1 className="font-display text-2xl leading-tight sm:text-3xl">{expert.name}</h1>
              {expert.title ? <p className="text-sm font-medium">{expert.title}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {expert.verified ? <VerdictStamp variant="safe">Doğrulandı</VerdictStamp> : null}
                <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                  {followers.totalDocs > 0 ? `${followers.totalDocs} takipçi · ` : ''}
                  {rules.totalDocs} aktif kural
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-1">
            <FollowButton expertId={String(expert.id)} expertName={expert.name} />
          </div>
        </div>
      </header>

      {expert.bio ? (
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{expert.bio}</p>
      ) : null}

      {ratings.docs.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            Derecelendirme ölçeği:
          </span>
          {ratings.docs.map((r: any) => (
            <span
              key={r.id}
              className="inline-flex w-fit items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]"
              // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
              style={{ color: r.color || undefined }}
              title={r.description || r.name}
            >
              {r.name}
            </span>
          ))}
        </div>
      )}

      {(expert.credentials?.length || socials.length > 0) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {expert.credentials && expert.credentials.length > 0 ? (
            <CaseCard className="p-4">
              <p className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase">
                Sertifikalar ({expert.credentials.length})
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {expert.credentials.map((c: any, i: number) => (
                  <li key={i}>
                    <strong className="text-foreground">{c.title}</strong>
                    {c.year && ` (${c.year})`}
                    {c.issuer && ` — ${c.issuer}`}
                  </li>
                ))}
              </ul>
            </CaseCard>
          ) : null}

          {socials.length > 0 ? (
            <CaseCard className="p-4">
              <p className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase">
                Bağlantılar
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {socials.map(([key, url]) => (
                  <li key={key}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-sm border border-border bg-card px-2 py-1 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                      {SOCIAL_LABELS[key] ?? key} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </CaseCard>
          ) : null}
        </div>
      )}

      {/* BÖLÜMLER — tek sekme şeridi */}
      <ExpertTabs
        defaultValue={sekme}
        tabs={[
          ...(posts.docs.length > 0
            ? [
                {
                  value: 'yazilar',
                  label: 'Uzman kaleminden',
                  meta: `${posts.totalDocs} yazı`,
                  content: (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {posts.docs.map((post) => {
                        const postCover = typeof post.cover === 'object' ? post.cover : null
                        const published = formatDate(post.publishedAt ?? post.createdAt)
                        return (
                          <Link key={post.id} href={`/yazilar/${post.slug}`} className="group">
                            <CaseCard className="flex h-full flex-col gap-2 p-4 transition-shadow group-hover:shadow-md">
                              {postCover?.url ? (
                                <img
                                  src={postCover.url}
                                  alt={postCover.alt || post.title}
                                  className="h-28 w-full rounded-sm border border-border object-cover"
                                />
                              ) : (
                                <div
                                  aria-hidden="true"
                                  className="flex h-16 w-full items-center justify-center rounded-sm border border-dashed border-border bg-tape-yellow/15 font-mono text-[0.6rem] tracking-[0.3em] text-faded uppercase"
                                >
                                  VAKA NOTU
                                </div>
                              )}
                              <p className="font-display text-base leading-snug">{post.title}</p>
                              {post.excerpt ? (
                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                  {post.excerpt}
                                </p>
                              ) : null}
                              {published ? (
                                <span className="mt-auto font-mono text-[0.6rem] tracking-[0.14em] text-faded uppercase">
                                  {published}
                                </span>
                              ) : null}
                            </CaseCard>
                          </Link>
                        )
                      })}
                    </div>
                  ),
                },
              ]
            : []),
          ...(matchedTotal > 0
            ? [
                {
                  value: 'urunler',
                  label: 'Hüküm verdiği ürünler',
                  meta: `${matchedTotal} dosya`,
                  content: (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {matchedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          href={product.barcode ? `/urun/${product.barcode}` : null}
                          name={product.name}
                          brandName={product.brand?.name ?? null}
                          categoryName={product.category?.name ?? null}
                          imageUrl={product.gallery[0]?.url ?? null}
                          imageAlt={product.gallery[0]?.alt ?? product.name}
                        />
                      ))}
                    </div>
                  ),
                },
              ]
            : []),
          {
            value: 'kurallar',
            label: 'Aktif kurallar',
            meta: `${rules.totalDocs} kural`,
            content: (
              <>
                {rules.docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz aktif kural yok.</p>
                ) : (
                  <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {rules.docs.map((r: any, i: number) => (
                      <li key={r.id}>
                        <CaseCard tape={i === 0} className="h-full gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
                            <EvidenceTag variant="evidence">
                              DELİL{' '}
                              {String((rulePage - 1) * RULE_PAGE_SIZE + i + 1).padStart(2, '0')}
                            </EvidenceTag>
                            {r.rating && (
                              <span
                                className="inline-flex w-fit shrink-0 items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] motion-safe:-rotate-2"
                                // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                                style={{ color: r.rating.color || undefined }}
                                title={r.rating.description || r.rating.name}
                              >
                                {r.rating.name}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 px-4 pb-4">
                            <Link
                              href={`/kural/${r.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {r.name}
                            </Link>
                            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                              {ruleTypeLabel(r.ruleType)}
                              {r.topic && typeof r.topic === 'object' && (
                                <>
                                  {' · '}
                                  <span
                                    className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-background"
                                    // Konu rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                                    style={{ background: r.topic.color || undefined }}
                                  >
                                    {r.topic.icon} {r.topic.name}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </CaseCard>
                      </li>
                    ))}
                  </ol>
                )}

                {rules.totalPages > 1 && (
                  <nav
                    aria-label="Kural sayfaları"
                    className="mt-6 flex items-center justify-between gap-4 font-mono text-[0.7rem] tracking-[0.14em] uppercase"
                  >
                    {rulePage > 1 ? (
                      <Link
                        href={`/uzmanlar/${expert.slug}?kuralSayfa=${rulePage - 1}&sekme=kurallar`}
                        className="underline-offset-4 hover:underline"
                      >
                        ← Önceki
                      </Link>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className="text-faded">
                      {rulePage} / {rules.totalPages}
                    </span>
                    {rulePage < rules.totalPages ? (
                      <Link
                        href={`/uzmanlar/${expert.slug}?kuralSayfa=${rulePage + 1}&sekme=kurallar`}
                        className="underline-offset-4 hover:underline"
                      >
                        Sonraki →
                      </Link>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </nav>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
