import { getPayload } from 'payload'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { JsonLd } from '@/components/JsonLd'
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  jsonLdGraph,
  organizationNode,
  pageMetadata,
  websiteNode,
} from '@/lib/seo'
import { BarcodeLookupForm } from '@/components/BarcodeLookupForm'
import { HeroVideo } from '@/components/HeroVideo'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CaseCard } from '@/components/CaseCard'
import { ProductGrid } from '@/components/ProductGrid'
import { StatsStrip } from '@/components/StatsStrip'
import { StoryRail } from '@/components/StoryRail'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PRODUCT_CARD_SELECT, productCardFromDoc } from '@/lib/productCardData'
import { totalProductScans } from '@/lib/productScans'
import { ruleStats } from '@/lib/ruleStats'

const STEPS = [
  { no: '01', title: 'Sorgula', desc: 'Barkod numarasını yaz; ürün dosyası anında açılır.' },
  { no: '02', title: 'Kurallar eşleşir', desc: 'Uzman kuralları ürünle otomatik karşılaştırılır.' },
  { no: '03', title: 'Kararı gör', desc: 'Boykot, sağlık ve helal hükmü tek bakışta oku.' },
]

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: '/',
})

export default async function HomePage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [topics, stats, latestProducts, publishedProducts, brandCount, totalScans] =
    await Promise.all([
      // Ana sayfa konu şeridi yalnız bu alanları çizer; konu belgesinin tamamı gerekmiyor.
      payload.find({
        collection: 'topics',
        limit: 100,
        sort: 'order',
        depth: 0,
        select: { name: true, slug: true, description: true, icon: true, color: true, order: true },
      }),
      // Kural sayıları tek GROUP BY sorgusundan gelir; 3.900 kural satırı çekilmez.
      ruleStats(payload),
      payload.find({
        collection: 'products',
        where: { status: { equals: 'published' } },
        sort: '-createdAt',
        limit: 6,
        depth: 1,
        select: PRODUCT_CARD_SELECT,
      }),
      // İstatistik şeridi yalnız sayı gösterir; belge çekilmez.
      payload.count({ collection: 'products', where: { status: { equals: 'published' } } }),
      payload.count({ collection: 'brands' }),
      totalProductScans(payload),
    ])

  const siteStats = [
    { label: 'Taranabilir ürün', value: publishedProducts.totalDocs },
    { label: 'Toplam görüntülenme', value: totalScans },
    { label: 'Aktif uzman kuralı', value: stats.total },
    { label: 'Marka', value: brandCount.totalDocs },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <JsonLd data={jsonLdGraph([organizationNode(), websiteNode()])} />
      <section
        aria-labelledby="hero-heading"
        className="grid gap-10 pt-6 pb-12 sm:py-16 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center"
      >
        <div className="flex flex-col items-start gap-5">
          <EvidenceTag variant="evidence">VAKA DOSYASI · TÜKETİCİ</EvidenceTag>
          <h1
            id="hero-heading"
            className="font-display text-3xl leading-tight text-balance sm:text-4xl"
          >
            Barkodu tara, ürün hakkındaki uzman yorumunu gör.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Barkod Dedektifi, uzmanların yazdığı boykot, sağlık ve helal kurallarını ürüne uygular.
            Geriye tek bakışta okunacak net bir hüküm kalır.
          </p>
          <BarcodeLookupForm />
        </div>

        {/* Tanıtım videosu: mobilde formun altında tam genişlik, masaüstünde hero'nun geniş kolonu. */}
        <div className="relative flex items-center justify-center">
          <div className="group relative w-full rotate-1 rounded-md border border-border bg-card p-2 shadow-md transition-transform duration-300 group-hover:rotate-0">
            <span className="absolute -top-2 left-1/2 z-10 h-4 w-24 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs" />
            <HeroVideo />
          </div>
        </div>
      </section>

      <StatsStrip stats={siteStats} />

      {/* Takip edilen uzmanların yazıları: oturum + takip yoksa kendini gizler. */}
      <StoryRail />

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
          <div className="mt-6">
            <ProductGrid
              className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4"
              products={latestProducts.docs.map(productCardFromDoc)}
            />
          </div>
        </section>
      )}

      <section aria-labelledby="topics-heading" className="py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="topics-heading" className="font-display text-xl sm:text-2xl">
            Son konular
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
          <p className="mt-6 text-sm text-muted-foreground">Henüz konu eklenmemiş.</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.docs.map((t: any) => {
              const ruleCount = stats.byTopic.get(String(t.id))?.rules ?? 0
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
