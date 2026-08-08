import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { VerdictStamp } from '@/components/VerdictStamp'

export const metadata: Metadata = {
  title: 'Uzman',
}

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
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="flex flex-col gap-5 rounded-md border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start">
        {typeof expert.avatar === 'object' && expert.avatar?.url && (
          <img
            src={expert.avatar.url}
            alt={expert.avatar.alt || expert.name}
            className="size-20 rounded-full border border-border object-cover"
          />
        )}
        <div className="flex min-w-0 flex-col items-start gap-2">
          <EvidenceTag>UZMAN DOSYASI</EvidenceTag>
          <h1 className="font-display text-2xl sm:text-3xl">{expert.name}</h1>
          {expert.verified && <VerdictStamp variant="safe">Doğrulandı</VerdictStamp>}
          {expert.title && <p className="text-sm font-medium">{expert.title}</p>}
          {expert.bio && <p className="max-w-2xl text-sm text-muted-foreground">{expert.bio}</p>}

          {ratings.docs.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                Derecelendirme ölçeği:
              </span>
              {ratings.docs.map((r: any) => (
                <span
                  key={r.id}
                  className="inline-flex w-fit items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em]"
                  // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                  style={{ color: r.color || undefined }}
                  title={r.description || r.name}
                >
                  {r.name}
                </span>
              ))}
            </div>
          )}

          {expert.credentials && expert.credentials.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline">
                Sertifikalar ({expert.credentials.length})
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {expert.credentials.map((c: any, i: number) => (
                  <li key={i}>
                    <strong className="text-foreground">{c.title}</strong>
                    {c.year && ` (${c.year})`}
                    {c.issuer && ` — ${c.issuer}`}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {expert.socialLinks?.website && (
            <a
              href={expert.socialLinks.website}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase underline-offset-4 hover:text-foreground hover:underline"
            >
              Website ↗
            </a>
          )}
        </div>
      </header>

      <section aria-labelledby="expert-rules-heading" className="mt-10">
        <h2 id="expert-rules-heading" className="font-display text-xl">
          Aktif kurallar ({rules.totalDocs})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu kurallar, ürün verilerine göre otomatik olarak değerlendirilir.
        </p>
        {rules.docs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Henüz aktif kural yok.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {rules.docs.map((r: any, i: number) => (
              <li key={r.id}>
                <CaseCard tape={i === 0} className="gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
                    <EvidenceTag variant="evidence">
                      DELİL {String(i + 1).padStart(2, '0')}
                    </EvidenceTag>
                    {r.rating && (
                      <span
                        className="inline-flex w-fit shrink-0 items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] motion-safe:-rotate-2"
                        // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                        style={{ color: r.rating.color || undefined }}
                        title={r.rating.description || r.rating.name}
                      >
                        {r.rating.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 px-4 pb-4">
                    <p className="font-medium">{r.name}</p>
                    <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                      {ruleTypeLabel(r.ruleType)}
                      {r.topic && typeof r.topic === 'object' && (
                        <>
                          {' · '}
                          <span
                            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-background"
                            // Konu rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                            style={{ background: r.topic.color || undefined }}
                          >
                            {r.topic.icon} {r.topic.name}
                          </span>
                        </>
                      )}
                    </p>
                    {r.description && (
                      <p className="text-sm text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                </CaseCard>
              </li>
            ))}
          </ol>
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
