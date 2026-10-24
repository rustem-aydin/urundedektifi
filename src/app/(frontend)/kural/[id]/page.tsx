import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { listProductsMatchingRule } from '@/lib/productCase'
import { ruleTypeLabel } from '@/lib/ruleLabels'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ProductCard } from '@/components/ProductCard'

export const metadata: Metadata = {
  title: 'Kural',
}

export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const rule = await payload
    .findByID({ collection: 'expert-rules', id, depth: 2 })
    .catch(() => null)
  if (!rule || !rule.isActive) notFound()

  const products = await listProductsMatchingRule(payload, rule)

  const rating = rule.rating && typeof rule.rating === 'object' ? rule.rating : null
  const topic = rule.topic && typeof rule.topic === 'object' ? rule.topic : null
  const expert = rule.expert && typeof rule.expert === 'object' ? rule.expert : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {expert?.slug ? (
        <Link
          href={`/uzmanlar/${expert.slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← {expert.name}
        </Link>
      ) : null}

      <CaseCard tape className="mt-4 flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EvidenceTag variant="evidence">KURAL DOSYASI</EvidenceTag>
          {rating ? (
            <span
              className="inline-flex w-fit shrink-0 items-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] motion-safe:-rotate-2"
              // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
              style={{ color: rating.color || undefined }}
              title={rating.description || rating.name}
            >
              {rating.name}
            </span>
          ) : null}
        </div>

        <h1 className="font-display text-2xl sm:text-3xl">{rule.name}</h1>

        <p className="flex flex-wrap items-center gap-2 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
          <span>{ruleTypeLabel(rule.ruleType)}</span>
          {topic ? (
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-background"
              // Konu rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
              style={{ background: topic.color || undefined }}
            >
              {topic.icon} {topic.name}
            </span>
          ) : null}
        </p>

        {rule.description ? (
          <p className="whitespace-pre-line text-sm text-muted-foreground">{rule.description}</p>
        ) : null}

        {(rule.sources?.length || rule.evidence?.length) && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
              Kaynaklar
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {(rule.sources || []).map((source, index) => (
                <li key={`source-${index}`}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
              {(rule.evidence || []).map((item, index) =>
                item.type === 'link' && item.url ? (
                  <li key={`evidence-${index}`}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {item.caption || item.url}
                    </a>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        )}
      </CaseCard>

      <section className="mt-10">
        <h2 className="font-display text-xl">Eşleşen ürünler ({products.length})</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bu kural yayındaki ürünlere otomatik uygulanır; aşağıdakiler kurala takılan dosyalar.
        </p>

        {products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Şu an bu kurala takılan yayında ürün yok.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const frontImage = product.gallery[0] ?? null
              return (
                <ProductCard
                  key={product.id}
                  href={product.barcode ? `/urun/${product.barcode}` : null}
                  name={product.name || 'İsimsiz ürün'}
                  brandName={product.brand?.name ?? null}
                  categoryName={product.category?.name ?? null}
                  barcode={product.barcode}
                  imageUrl={frontImage?.url || null}
                  imageAlt={frontImage?.alt || product.name}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
