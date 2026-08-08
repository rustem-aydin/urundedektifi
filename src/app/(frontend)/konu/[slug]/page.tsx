import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { VerdictStamp } from '@/components/VerdictStamp'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Konu',
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const t = await payload.find({
    collection: 'topics',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })

  const topic = t.docs[0]
  if (!topic) notFound()

  const rules = await payload.find({
    collection: 'expert-rules',
    where: {
      and: [{ topic: { equals: topic.id } }, { isActive: { equals: true } }],
    },
    sort: '-createdAt',
    limit: 100,
    depth: 1,
  })

  // Bu konuda kural yazan uzmanların ID'lerini topla
  const expertIds = Array.from(
    new Set(rules.docs.map((r: any) => (typeof r.expert === 'object' ? r.expert.id : r.expert))),
  )

  const experts =
    expertIds.length > 0
      ? await payload.find({
          collection: 'experts',
          where: {
            and: [
              { id: { in: expertIds } },
              { isPublic: { equals: true } },
              { verified: { equals: true } },
            ],
          },
          depth: 1,
        })
      : { docs: [] }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header
        className="rounded-md border border-border border-l-4 bg-card p-5 shadow-sm"
        // CMS renkleri serbest biçimde gelir; token dışı tek renk burada, inline stil ile uygulanır
        style={{ borderLeftColor: (topic as any).color || undefined }}
      >
        <EvidenceTag>KONU DOSYASI</EvidenceTag>
        <h1 className="mt-2 flex items-center gap-2 font-display text-2xl sm:text-3xl">
          <span aria-hidden="true">{(topic as any).icon}</span>
          {topic.name}
        </h1>
        {(topic as any).description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {(topic as any).description}
          </p>
        )}
      </header>

      <section aria-labelledby="topic-experts-heading" className="mt-10">
        <h2 id="topic-experts-heading" className="font-display text-xl">
          Bu konuda kural yazan uzmanlar ({experts.docs.length})
        </h2>
        {experts.docs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Bu konuda henüz uzman yok.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experts.docs.map((e: any) => (
              <Link
                key={e.id}
                href={`/uzmanlar/${e.slug}`}
                className="group rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <CaseCard className="h-full transition-shadow group-hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      {e.avatar?.url && (
                        <img
                          src={e.avatar.url}
                          alt={e.name}
                          className="size-10 rounded-full border border-border object-cover"
                        />
                      )}
                      <CardTitle>{e.name}</CardTitle>
                    </div>
                    {e.verified && (
                      <VerdictStamp variant="safe" className="mt-2">
                        Doğrulandı
                      </VerdictStamp>
                    )}
                  </CardHeader>
                  {e.title && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{e.title}</p>
                    </CardContent>
                  )}
                </CaseCard>
              </Link>
            ))}
          </div>
        )}
      </section>

      {rules.docs.length > 0 && (
        <section aria-labelledby="topic-rules-heading" className="mt-10">
          <h2 id="topic-rules-heading" className="font-display text-xl">
            Bu konudaki aktif kurallar ({rules.totalDocs})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bu kurallar eşleşen tüm ürünlere otomatik olarak uygulanır.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {rules.docs.map((rule: any) => {
              const expert = rule.expert
              return (
                <CaseCard key={rule.id} tape>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <EvidenceTag variant="evidence">DELİL</EvidenceTag>
                      {rule.rating && (
                        <span
                          className="inline-flex w-fit shrink-0 items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] motion-safe:-rotate-2"
                          // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                          style={{ color: rule.rating.color || undefined }}
                          title={rule.rating.description || rule.rating.name}
                        >
                          {rule.rating.name}
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-2">{rule.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {rule.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {rule.description}
                      </p>
                    )}
                    {expert?.name && (
                      <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                        <Link
                          href={`/uzmanlar/${expert.slug}`}
                          className="hover:text-foreground hover:underline underline-offset-4"
                        >
                          — {expert.name}
                        </Link>
                      </p>
                    )}
                  </CardContent>
                </CaseCard>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
