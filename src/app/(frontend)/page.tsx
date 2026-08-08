import { getPayload } from 'payload'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { Barcode } from '@/components/Barcode'
import { BarcodeLookupForm } from '@/components/BarcodeLookupForm'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CaseCard } from '@/components/CaseCard'
import { ProductCard } from '@/components/ProductCard'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const STEPS = [
  { no: '01', title: 'Tara', desc: 'Barkodu kameraya gösterin ya da numarayı yazın.' },
  { no: '02', title: 'Kurallar eşleşir', desc: 'Uzman kuralları ürünle otomatik karşılaştırılır.' },
  { no: '03', title: 'Kararı gör', desc: 'Boykot, sağlık ve helal hükmü tek bakışta okunur.' },
]

export default async function HomePage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [topics, allRules, latestProducts] = await Promise.all([
    payload.find({ collection: 'topics', limit: 100, sort: 'order', depth: 0 }),
    payload.find({
      collection: 'expert-rules',
      where: { isActive: { equals: true } },
      limit: 0,
      depth: 0,
    }),
    payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      sort: '-createdAt',
      limit: 6,
      depth: 2,
    }),
  ])

  const ruleCountByTopic = new Map<string, number>()
  for (const r of allRules.docs as any[]) {
    const topicId = typeof r.topic === 'object' ? r.topic.id : r.topic
    if (!topicId) continue
    ruleCountByTopic.set(topicId, (ruleCountByTopic.get(topicId) || 0) + 1)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <section aria-labelledby="hero-heading" className="grid gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col items-start gap-5">
          <EvidenceTag variant="evidence">VAKA DOSYASI · TÜKETİCİ</EvidenceTag>
          <h1
            id="hero-heading"
            className="font-display text-3xl leading-tight text-balance sm:text-4xl"
          >
            Barkodu göster, delilleri topla, kararı gör.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Ürün Dedektifi; boykot, sağlık ve helal kurallarını uzmanların kaleminden ürüne
            uygular. Sonuç: tek bakışta okunan bir hüküm.
          </p>
          <BarcodeLookupForm />
        </div>

        <div className="group relative flex items-center justify-center" aria-hidden="true">
          <div className="relative w-full max-w-sm rotate-1 rounded-md border border-border bg-card p-6 shadow-md transition-transform duration-300 group-hover:rotate-0">
            <span className="absolute -top-2 left-1/2 h-4 w-24 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs" />
            <Barcode value="8690123456789" height={120} className="w-full text-foreground" />
            <span
              className="animate-scanline pointer-events-none absolute top-6 right-6 left-6 h-0.5 bg-gradient-to-r from-transparent via-stamp to-transparent [--scan-height:120px]"
            />
            <div className="mt-4 flex items-center justify-between border-t border-dashed border-border pt-3">
              <span className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
                KANIT NO: 8690123456789
              </span>
              <span className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
                UD-2026
              </span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-y border-border py-10">
        <h2 id="how-heading" className="font-display text-xl sm:text-2xl">
          Nasıl çalışır
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.no} className="flex gap-3">
              <span className="font-mono text-sm font-bold text-stamp">{step.no}</span>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {latestProducts.docs.length > 0 && (
        <section aria-labelledby="products-heading" className="pb-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="products-heading" className="font-display text-xl sm:text-2xl">
              Son dosyalar
            </h2>
            <Link
              href="/urunler"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
            >
              Tüm ürünler
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(latestProducts.docs as any[]).map((p: any) => {
              const frontImage = typeof p.frontImage === 'object' ? p.frontImage : null
              return (
                <ProductCard
                  key={p.id}
                  href={p.barcode ? `/urun/${p.barcode}` : null}
                  name={p.name || 'İsimsiz ürün'}
                  brandName={typeof p.brand === 'object' ? p.brand?.name : null}
                  categoryName={typeof p.category === 'object' ? p.category?.name : null}
                  barcode={p.barcode}
                  imageUrl={frontImage?.url || null}
                  imageAlt={frontImage?.alt || p.name}
                />
              )
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="topics-heading" className="py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="topics-heading" className="font-display text-xl sm:text-2xl">
            Son vakalar
          </h2>
          <Link
            href="/konular"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
          >
            Tüm konular
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {topics.docs.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Henüz konu tanımlanmamış.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.docs.map((t: any) => {
              const ruleCount = ruleCountByTopic.get(t.id) || 0
              return (
                <Link key={t.id} href={`/konu/${t.slug}`} className="group rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
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
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                      <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                        {ruleCount} aktif kural
                      </p>
                    </CardContent>
                  </CaseCard>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
