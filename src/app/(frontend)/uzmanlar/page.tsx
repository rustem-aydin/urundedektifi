import { getPayload } from 'payload'
import React from 'react'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'

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

  // Her uzman için kural + derecelendirme sayısı
  const expertsWithStats = await Promise.all(
    filteredExperts.map(async (e: any) => {
      const [rules, ratings] = await Promise.all([
        payload.find({
          collection: 'expert-rules',
          where: {
            and: [{ expert: { equals: e.id } }, { isActive: { equals: true } }],
          },
          limit: 0,
        }),
        payload.find({
          collection: 'rating-scales',
          where: { expert: { equals: e.id } },
          limit: 0,
        }),
      ])
      return { ...e, ruleCount: rules.totalDocs, ratingCount: ratings.totalDocs }
    }),
  )

  return (
    <div className="container">
      <h1>Uzmanlar</h1>
      <p className="muted">
        Alanlarında uzman kişiler. Bir uzmana tıklayarak kurallarını inceleyebilirsiniz.
      </p>

      {topics.docs.length > 0 && (
        <div className="topic-filter">
          <span className="filter-label">Konuya göre filtrele:</span>
          <Link href="/uzmanlar" className={`topic-filter-btn ${!selectedTopic ? 'active' : ''}`}>
            Tümü
          </Link>
          {topics.docs.map((t: any) => (
            <Link
              key={t.id}
              href={`/uzmanlar?konu=${t.slug}`}
              className={`topic-filter-btn ${selectedTopic?.id === t.id ? 'active' : ''}`}
            >
              {t.icon} {t.name}
            </Link>
          ))}
        </div>
      )}

      {selectedTopic && (
        <p className="muted">"{selectedTopic.name}" konusunda kural yazan uzmanlar</p>
      )}

      {expertsWithStats.length === 0 ? (
        <p>Bu konuda henüz uzman yok.</p>
      ) : (
        <div className="experts-grid">
          {expertsWithStats.map((e: any) => (
            <Link key={e.id} href={`/uzmanlar/${e.slug}`} className="expert-card-link">
              <article className="expert-card-large">
                {e.avatar?.url && (
                  <img src={e.avatar.url} alt={e.avatar.alt || e.name} className="expert-avatar" />
                )}
                <h2>
                  {e.name} {e.verified && <span className="verified">✓</span>}
                </h2>
                {e.title && <p className="muted">{e.title}</p>}
                {e.bio && <p className="bio">{e.bio}</p>}
                <p className="rule-count">
                  📋 {e.ruleCount} aktif kural · 🎨 {e.ratingCount} derece
                </p>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
