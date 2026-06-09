import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'

export default async function ExpertDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
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

  const [rules, ratings] = await Promise.all([
    payload.find({
      collection: 'expert-rules',
      where: {
        and: [{ expert: { equals: expert.id } }, { isActive: { equals: true } }],
      },
      sort: '-createdAt',
      depth: 1,
    }),
    payload.find({
      collection: 'rating-scales',
      where: { expert: { equals: expert.id } },
      sort: 'order',
      depth: 0,
    }),
  ])

  return (
    <div className="container">
      <header className="expert-detail-header">
        {typeof expert.avatar === 'object' && expert.avatar?.url && (
          <img
            src={expert.avatar.url}
            alt={expert.avatar.alt || expert.name}
            className="expert-avatar large"
          />
        )}
        <div>
          <h1>
            {expert.name} {expert.verified && <span className="verified">✓ Doğrulanmış</span>}
          </h1>
          {expert.title && <p className="expert-title">{expert.title}</p>}
          {expert.bio && <p className="expert-bio">{expert.bio}</p>}

          {ratings.docs.length > 0 && (
            <div className="expert-ratings-row">
              <span className="muted small">Bu uzmanın derecelendirme ölçeği:</span>{' '}
              {ratings.docs.map((r: any) => (
                <span
                  key={r.id}
                  className="rating-scale-chip"
                  style={{
                    background: r.color || '#6b7280',
                    color: '#fff',
                  }}
                  title={r.description || r.name}
                >
                  {r.name}
                </span>
              ))}
            </div>
          )}

          {expert.credentials && expert.credentials.length > 0 && (
            <details className="credentials">
              <summary>Sertifikalar ({expert.credentials.length})</summary>
              <ul>
                {expert.credentials.map((c: any, i: number) => (
                  <li key={i}>
                    <strong>{c.title}</strong>
                    {c.year && ` (${c.year})`}
                    {c.issuer && ` — ${c.issuer}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {expert.socialLinks?.website && (
            <p>
              <a href={expert.socialLinks.website} target="_blank" rel="noreferrer">
                🌐 Website
              </a>
            </p>
          )}
        </div>
      </header>

      <section className="expert-rules">
        <h2>📋 Aktif Kurallar ({rules.totalDocs})</h2>
        <p className="muted">Bu kurallar, ürün verilerine göre otomatik olarak değerlendirilir.</p>
        {rules.docs.length === 0 ? (
          <p>Henüz aktif kural yok.</p>
        ) : (
          <ul className="rule-list">
            {rules.docs.map((r: any) => (
              <li key={r.id} className="rule-item">
                <div className="rule-head">
                  <strong>{r.name}</strong>
                  {r.rating && (
                    <span
                      className="verdict-badge"
                      style={{
                        background: r.rating.color || '#6b7280',
                        color: '#fff',
                      }}
                      title={r.rating.description || r.rating.name}
                    >
                      {r.rating.name}
                    </span>
                  )}
                </div>
                <p className="muted small">
                  {ruleTypeLabel(r.ruleType)}
                  {r.topic && typeof r.topic === 'object' && (
                    <>
                      {' · '}
                      <span
                        className="topic-chip small"
                        style={{ background: r.topic.color || '#374151' }}
                      >
                        {r.topic.icon} {r.topic.name}
                      </span>
                    </>
                  )}
                </p>
                <p>{r.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ruleTypeLabel(rt: string): string {
  const labels: Record<string, string> = {
    ingredient_text: 'İçindekilerde ara',
    ingredient_excludes: 'İçindekilerde olmamalı',
    additive_code: 'Katkı kodu',
    allergen: 'Alerjen',
    country: 'Ülke',
    brand: 'Marka',
    brand_boycotted: 'Marka boykotlu',
    category: 'Kategori',
    nutrition_max: 'Besin değeri üstünde',
    nutrition_min: 'Besin değeri altında',
    label_has: 'Etiket mevcut',
    label_missing: 'Etiket eksik',
  }
  return labels[rt] || rt
}
