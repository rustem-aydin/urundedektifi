import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { VerdictStamp } from '@/components/VerdictStamp'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Uzmanlar',
  description: 'Doğrulanmış uzmanlar ve ürünlere uygulanan kuralları.',
}

export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<{ konu?: string }>
}) {
  const params = await searchParams
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const topics = await payload.find({
    collection: 'topics',
    limit: 100,
    sort: 'order',
    depth: 0,
  })

  let selectedTopic: any = null
  if (params.konu) {
    const t = await payload.find({
      collection: 'topics',
      where: { slug: { equals: params.konu } },
      limit: 1,
    })
    selectedTopic = t.docs[0]
  }

  const experts = await payload.find({
    collection: 'experts',
    where: {
      and: [{ isPublic: { equals: true } }, { verified: { equals: true } }],
    },
    sort: 'name',
    depth: 1,
  })

  // Eğer konu seçilmişse, sadece o konuda kural yazan uzmanları filtrele
  let filteredExperts = experts.docs
  if (selectedTopic) {
    const rulesInTopic = await payload.find({
      collection: 'expert-rules',
      where: {
        and: [{ topic: { equals: selectedTopic.id } }, { isActive: { equals: true } }],
      },
      limit: 1000,
      depth: 0,
    })
    const expertIds = new Set(
      rulesInTopic.docs.map((r: any) => (typeof r.expert === 'object' ? r.expert.id : r.expert)),
    )
    filteredExperts = experts.docs.filter((e: any) => expertIds.has(e.id))
  }

  // Her uzman için kural + derecelendirme sayısı — N+1 yerine 2 toplu sorgu
  const expertIds = filteredExperts.map((e: any) => e.id)
  const [allExpertRules, allRatings] =
    expertIds.length > 0
      ? await Promise.all([
          payload.find({
            collection: 'expert-rules',
            where: {
              and: [{ expert: { in: expertIds } }, { isActive: { equals: true } }],
            },
            limit: 2000,
            depth: 0,
          }),
          payload.find({
            collection: 'rating-scales',
            where: { expert: { in: expertIds } },
            limit: 1000,
            depth: 0,
          }),
        ])
      : [{ docs: [] }, { docs: [] }]

  const ruleCountByExpert = new Map<string, number>()
  for (const r of (allExpertRules as any).docs) {
    const id = typeof r.expert === 'object' ? r.expert.id : r.expert
    ruleCountByExpert.set(id, (ruleCountByExpert.get(id) || 0) + 1)
  }
  const ratingCountByExpert = new Map<string, number>()
  for (const r of (allRatings as any).docs) {
    const id = typeof r.expert === 'object' ? r.expert.id : r.expert
    ratingCountByExpert.set(id, (ratingCountByExpert.get(id) || 0) + 1)
  }

  const expertsWithStats = filteredExperts.map((e: any) => ({
    ...e,
    ruleCount: ruleCountByExpert.get(e.id) || 0,
    ratingCount: ratingCountByExpert.get(e.id) || 0,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>İMZALAR</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Uzmanlar</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Alanlarında uzman kişiler. Bir uzmana tıklayarak kurallarını inceleyebilirsiniz.
        </p>
      </div>

      {topics.docs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Konuya göre filtrele">
          <Link
            href="/uzmanlar"
            aria-current={!selectedTopic ? 'page' : undefined}
            className={cn(
              'inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors',
              !selectedTopic
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            Tümü
          </Link>
          {topics.docs.map((t: any) => (
            <Link
              key={t.id}
              href={`/uzmanlar?konu=${t.slug}`}
              aria-current={selectedTopic?.id === t.id ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors',
                selectedTopic?.id === t.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {selectedTopic && (
        <p className="mt-4 text-sm text-muted-foreground">
          &ldquo;{selectedTopic.name}&rdquo; konusunda kural yazan uzmanlar
        </p>
      )}

      {expertsWithStats.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Bu konuda henüz uzman yok.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {expertsWithStats.map((e: any) => (
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
                        alt={e.avatar.alt || e.name}
                        className="size-11 rounded-full border border-border object-cover"
                      />
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{e.name}</CardTitle>
                      {e.verified && <VerdictStamp variant="safe">Doğrulandı</VerdictStamp>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {e.title && <p className="text-sm text-muted-foreground">{e.title}</p>}
                  {e.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{e.bio}</p>}
                  <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                    {e.ruleCount} aktif kural · {e.ratingCount} derece
                  </p>
                </CardContent>
              </CaseCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
