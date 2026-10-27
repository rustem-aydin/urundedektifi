import { getPayload } from 'payload'
import Link from 'next/link'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ruleStats } from '@/lib/ruleStats'

export const metadata: Metadata = {
  title: 'Konular',
  description: 'Uzmanların kural yazdığı tüm alanlar: boykot, sağlık, helal ve daha fazlası.',
}

export default async function TopicsListPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [topics, stats] = await Promise.all([
    payload.find({
      collection: 'topics',
      limit: 100,
      sort: 'order',
      depth: 0,
    }),
    // Konu başına kural/uzman sayısı SQL'de gruplanır (bkz. ruleStats).
    ruleStats(payload),
  ])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>DOSYA DOLAPLARI</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Konular</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Uzmanların çalıştığı alanlar. Bir konuya girip o alanda kural yazan uzmanları ve aktif
          kuralları görebilirsin.
        </p>
      </div>

      {topics.docs.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Henüz konu eklenmemiş.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.docs.map((t: any) => {
            const entry = stats.byTopic.get(String(t.id))
            const expertCount = entry?.experts ?? 0
            const ruleCount = entry?.rules ?? 0
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
