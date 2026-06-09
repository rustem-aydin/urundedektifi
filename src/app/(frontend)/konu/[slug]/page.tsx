import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'
import Link from 'next/link'

import config from '@/payload.config'

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
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
      and: [
        { topic: { equals: topic.id } },
        { isActive: { equals: true } },
      ],
    },
    sort: '-createdAt',
    limit: 100,
    depth: 1,
  })

  // Bu konuda kural yazan uzmanların ID'lerini topla
  const expertIds = Array.from(
    new Set(
      rules.docs.map((r: any) =>
        typeof r.expert === 'object' ? r.expert.id : r.expert,
      ),
    ),
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
    <div className="container">
      <header
        className="topic-header"
        style={{ borderTopColor: topic.color || '#374151' }}
      >
        <h1>
          <span
            className="topic-chip large"
            style={{ background: topic.color || '#374151' }}
          >
            {topic.icon} {topic.name}
          </span>
        </h1>
        {topic.description && <p className="topic-desc">{topic.description}</p>}
      </header>

      <section>
        <h2>Bu Konuda Kural Yazan Uzmanlar ({experts.docs.length})</h2>
        {experts.docs.length === 0 ? (
          <p>Bu konuda henüz uzman yok.</p>
        ) : (
          <div className="experts-grid">
            {experts.docs.map((e: any) => (
              <Link
                key={e.id}
                href={`/uzmanlar/${e.slug}`}
                className="expert-card-link"
              >
                <article className="expert-card-large">
                  {e.avatar?.url && (
                    <img src={e.avatar.url} alt={e.name} className="expert-avatar" />
                  )}
                  <h2>
                    {e.name} {e.verified && <span className="verified">✓</span>}
                  </h2>
                  {e.title && <p className="muted">{e.title}</p>}
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      {rules.docs.length > 0 && (
        <section>
          <h2>Bu Konudaki Aktif Kurallar ({rules.totalDocs})</h2>
          <p className="muted">
            Bu kurallar eşleşen tüm ürünlere otomatik olarak uygulanır.
          </p>
          <div className="grid">
            {rules.docs.map((rule: any) => {
              const expert = rule.expert
              return (
                <article key={rule.id} className="rule-card">
                  {rule.rating && (
                    <span
                      className="verdict-badge"
                      style={{
                        background: rule.rating.color || '#6b7280',
                        color: '#fff',
                      }}
                      title={rule.rating.description || rule.rating.name}
                    >
                      {rule.rating.name}
                    </span>
                  )}
                  <h3>{rule.name}</h3>
                  <p
                    className="muted"
                    style={{
                      fontSize: '0.875rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {rule.description}
                  </p>
                  {expert?.name && (
                    <p className="author">
                      <Link href={`/uzmanlar/${expert.slug}`}>— {expert.name}</Link>
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
