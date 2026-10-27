import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { ExpertCards } from '@/components/ExpertCards'
import { EvidenceTag } from '@/components/EvidenceTag'
import { cn } from '@/lib/utils'
import { findAllDocs } from '@/lib/findAllDocs'
import { ruleStats } from '@/lib/ruleStats'

export const metadata: Metadata = {
  title: 'Uzmanlar',
  description: 'Ürünlere kural yazan, doğrulanmış uzmanlar.',
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

  // Kural sayıları ve konuya göre uzman süzgeci tek GROUP BY sonucundan gelir
  // (bkz. ruleStats): 3.900 kural satırı sayfa render'ında çekilmez.
  const stats = await ruleStats(payload)

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
      select: { expert: true },
    })
    const expertIds = new Set(
      rulesInTopic.docs.map((r: any) => (typeof r.expert === 'object' ? r.expert.id : r.expert)),
    )
    filteredExperts = experts.docs.filter((e: any) => expertIds.has(e.id))
  }

  // Derecelendirme sayısı uzman başına küçük bir kümedir; tek sorguda okunur.
  const expertIds = filteredExperts.map((e: any) => e.id)
  const allRatings =
    expertIds.length > 0
      ? await findAllDocs<{ expert?: unknown }>(payload, 'rating-scales', {
          where: { expert: { in: expertIds } },
          select: { expert: true },
        })
      : []

  const ratingCountByExpert = new Map<string, number>()
  for (const r of allRatings as any[]) {
    const id = typeof r.expert === 'object' ? r.expert.id : r.expert
    ratingCountByExpert.set(String(id), (ratingCountByExpert.get(String(id)) || 0) + 1)
  }

  const expertsWithStats = filteredExperts.map((e: any) => ({
    ...e,
    ruleCount: stats.byExpert.get(String(e.id))?.rules ?? 0,
    ratingCount: ratingCountByExpert.get(String(e.id)) || 0,
  }))

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>İMZALAR</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Uzmanlar</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Alanlarında uzman kişiler. Bir uzmana girip kurallarını inceleyebilirsin.
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
        <ExpertCards
          experts={expertsWithStats.map((e: any) => ({
            id: String(e.id),
            slug: e.slug,
            name: e.name,
            title: e.title ?? null,
            bio: e.bio ?? null,
            avatarUrl: typeof e.avatar === 'object' ? (e.avatar?.url ?? null) : null,
            avatarAlt: typeof e.avatar === 'object' ? (e.avatar?.alt ?? null) : null,
            verified: Boolean(e.verified),
            ruleCount: e.ruleCount,
            ratingCount: e.ratingCount,
          }))}
        />
      )}
    </div>
  )
}
