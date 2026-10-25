import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { RichText } from '@payloadcms/richtext-lexical/react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { FollowButton } from '@/components/FollowButton'
import { VerdictStamp } from '@/components/VerdictStamp'

/**
 * Uzman yazısı sayfası.
 *
 * Hikâye rayından ve uzman profilinden buraya gelinir. Gövde Lexical JSON'dan doğrudan
 * JSX'e çevrilir (markdown yalnız API tüketicileri için `bodyMarkdown` alanında durur).
 */

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const result = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 1,
  })
  const post = result.docs[0]
  if (!post) return { title: 'Yazı bulunamadı' }
  return {
    title: post.title,
    description: post.excerpt || undefined,
    openGraph: { title: post.title, description: post.excerpt || undefined, type: 'article' },
  }
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const result = await payload.find({
    collection: 'posts',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
  })
  const post = result.docs[0]
  if (!post) notFound()

  const expert = typeof post.expert === 'object' ? post.expert : null
  if (!expert || expert.isPublic === false) notFound()

  const more = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { expert: { equals: expert.id } },
        { status: { equals: 'published' } },
        { id: { not_equals: post.id } },
      ],
    },
    sort: '-publishedAt',
    limit: 3,
    depth: 1,
  })

  const cover = typeof post.cover === 'object' ? post.cover : null
  const topics = Array.isArray(post.topics) ? post.topics.filter((t) => typeof t === 'object') : []
  const published = formatDate(post.publishedAt ?? post.createdAt)

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10">
      <nav aria-label="Geri" className="mb-6">
        <Link
          href={expert.slug ? `/uzmanlar/${expert.slug}` : '/uzmanlar'}
          className="font-mono text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
        >
          ‹ {expert.name}
        </Link>
      </nav>

      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {expert.avatar && typeof expert.avatar === 'object' && expert.avatar.url ? (
              <img
                src={expert.avatar.url}
                alt={expert.avatar.alt || expert.name}
                className="size-11 rounded-full border border-border object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-full border border-border bg-muted font-mono text-[0.65rem] uppercase text-faded"
              >
                {expert.name.slice(0, 2)}
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              <Link href={`/uzmanlar/${expert.slug}`} className="truncate font-medium hover:underline">
                {expert.name}
              </Link>
              <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                {expert.title || 'Uzman'}
              </span>
            </div>
          </div>
          <FollowButton expertId={String(expert.id)} expertName={expert.name} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EvidenceTag variant="stamp">UZMAN KALEMİNDEN</EvidenceTag>
          {expert.verified ? <VerdictStamp variant="safe">Doğrulandı</VerdictStamp> : null}
          {published ? (
            <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
              {published}
            </span>
          ) : null}
        </div>

        <h1 className="font-display text-3xl leading-tight text-balance sm:text-4xl">{post.title}</h1>
        {post.excerpt ? (
          <p className="text-base text-muted-foreground">{post.excerpt}</p>
        ) : null}

        {topics.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li key={topic.id}>
                <Link href={`/konu/${topic.slug}`} className="hover:underline">
                  <EvidenceTag>
                    {topic.icon ? `${topic.icon} ` : ''}
                    {topic.name}
                  </EvidenceTag>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {cover?.url ? (
        <img
          src={cover.url}
          alt={cover.alt || post.title}
          className="mt-8 w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="mt-8 flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-tape-yellow/15"
        >
          <span className="font-mono text-[0.65rem] tracking-[0.3em] text-faded uppercase">
            VAKA NOTU · {expert.name}
          </span>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-4 text-[0.95rem] leading-relaxed [&_a]:text-stamp [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-stamp/60 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:font-mono [&_code]:text-sm [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-lg [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
        <RichText data={post.body as never} />
      </div>

      <footer className="mt-10 flex flex-col gap-4 border-t border-dashed border-border pt-6">
        <Link
          href={`/uzmanlar/${expert.slug}`}
          className="inline-flex w-fit items-center rounded-sm border border-foreground/25 bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-foreground/60 hover:bg-muted"
        >
          {expert.name} profilini gör
        </Link>

        {more.docs.length > 0 ? (
          <section aria-labelledby="more-heading" className="mt-4 flex flex-col gap-3">
            <h2 id="more-heading" className="font-mono text-[0.65rem] tracking-[0.2em] text-stamp uppercase">
              AYNI UZMANDAN
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {more.docs.map((item) => (
                <Link key={item.id} href={`/yazilar/${item.slug}`} className="group">
                  <CaseCard className="h-full p-4 transition-shadow group-hover:shadow-md">
                    <p className="font-display text-base leading-snug">{item.title}</p>
                    {item.excerpt ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>
                    ) : null}
                  </CaseCard>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </footer>
    </article>
  )
}
