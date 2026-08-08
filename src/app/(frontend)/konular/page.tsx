import { getPayload } from 'payload'
import Link from 'next/link'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Konular',
  description: 'Uzmanların kural yazdığı tüm alanlar: boykot, sağlık, helal ve daha fazlası.',
}

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>DOSYA DOLAPLARI</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Konular</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Uzmanların çalıştığı tüm alanlar. Bir konuya tıklayarak o alanda kural yazan uzmanları ve
          aktif kuralları görebilirsiniz.
        </p>
      </div>

      {topics.docs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Henüz konu tanımlanmamış.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.docs.map((t: any) => {
            const expertCount = topicStats.get(t.id)?.size || 0
            const ruleCount = ruleCountByTopic.get(t.id) || 0
            return (
              <Link
                key={t.id}
                href={`/konu/${t.slug}`}
                className="group rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <CaseCard
                  className="h-full border-l-4 transition-shadow group-hover:shadow-md"
                  // CMS renkleri serbest biçimde gelir; token dışı tek renk burada, inline stil ile uygulanır
                  style={{ borderLeftColor: t.color || undefined }}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span aria-hidden="true">{t.icon || '🏷️'}</span>
                      {t.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {t.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                    )}
                    <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                      {expertCount} uzman · {ruleCount} aktif kural
                    </p>
                  </CardContent>
                </CaseCard>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
