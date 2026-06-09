import { getPayload } from 'payload'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'

export default async function TopicsListPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [topics, allRules] = await Promise.all([
    payload.find({
      collection: 'topics',
      limit: 100,
      sort: 'order',
      depth: 0,
    }),
    payload.find({
      collection: 'expert-rules',
      where: { isActive: { equals: true } },
      limit: 0,
      depth: 0,
    }),
  ])

  // Her konu için uzman ve kural sayısı (kurallar üzerinden)
  const topicStats = new Map<string, Set<string>>()
  for (const r of allRules.docs as any[]) {
    const topicId = typeof r.topic === 'object' ? r.topic.id : r.topic
    const expertId = typeof r.expert === 'object' ? r.expert.id : r.expert
    if (!topicId || !expertId) continue
    if (!topicStats.has(topicId)) topicStats.set(topicId, new Set())
    topicStats.get(topicId)!.add(expertId)
  }

  const ruleCountByTopic = new Map<string, number>()
  for (const r of allRules.docs as any[]) {
    const topicId = typeof r.topic === 'object' ? r.topic.id : r.topic
    if (!topicId) continue
    ruleCountByTopic.set(topicId, (ruleCountByTopic.get(topicId) || 0) + 1)
  }

  return (
    <div className="container">
      <h1>Konular</h1>
      <p className="muted">
        Uzmanların çalıştığı tüm alanlar. Bir konuya tıklayarak o alanda kural yazan uzmanları ve
        aktif kuralları görebilirsiniz.
      </p>

      {topics.docs.length === 0 ? (
        <p>Henüz konu tanımlanmamış.</p>
      ) : (
        <div className="topics-grid-large">
          {topics.docs.map((t: any) => {
            const expertCount = topicStats.get(t.id)?.size || 0
            const ruleCount = ruleCountByTopic.get(t.id) || 0
            return (
              <Link
                key={t.id}
                href={`/konu/${t.slug}`}
                className="topic-card-large"
                style={{ borderTopColor: t.color || '#374151' }}
              >
                <div className="topic-chip large" style={{ background: t.color || '#374151' }}>
                  {t.icon || '🏷️'}
                </div>
                <h2>{t.name}</h2>
                {t.description && <p className="muted">{t.description}</p>}
                <p className="muted small">
                  {expertCount} uzman · {ruleCount} aktif kural
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
