import { getPayload } from 'payload'
import Link from 'next/link'
import { Suspense } from 'react'
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
import { HeroVideo } from '@/components/HeroVideo'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CaseCard } from '@/components/CaseCard'
import { StatsStrip } from '@/components/StatsStrip'
import { StoryRail } from '@/components/StoryRail'
import { ProductSlider, ProductSliderError, ProductSliderSkeleton } from '@/components/ProductSlider'
import { UnifiedSearchForm } from '@/components/UnifiedSearchForm'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listSliderCards, type ProductSliderKind } from '@/lib/productCardData'
import { totalProductScans } from '@/lib/productScans'
import { ruleStats } from '@/lib/ruleStats'
import { cached } from '@/lib/serverCache'

const STEPS = [
  { no: '01', title: 'Sorgula', desc: 'Barkod numarasını yaz; ürün dosyası anında açılır.' },
  { no: '02', title: 'Kurallar eşleşir', desc: 'Uzman kuralları ürünle otomatik karşılaştırılır.' },
  { no: '03', title: 'Görüşü gör', desc: 'Boykot, sağlık ve helal görüşünü tek bakışta oku.' },
]

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: '/',
})

/**
 * Ana sayfanın verisi 5 dakika süreç içi önbellekte tutulur: bot trafiği ve
 * ziyaretçiler aynı sorguları tekrar tekrar çalıştırmaz. İçerik yazımında
 * `clearServerCache()` ile düşürülür (bkz. koleksiyon hook'ları).
 */
const loadHomeData = () =>
  cached('home', async () => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })

    const [topics, stats, publishedProducts, brandCount, totalScans] = await Promise.all([
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

    return { topics, stats, siteStats }
  })

/**
 * Slider verisi ayrı önbellek anahtarında tutulur: biri yavaşlar ya da hata verirse
 * diğeri ve sayfanın kalanı etkilenmez (her bölüm kendi Suspense sınırında).
 */
const SLIDER_LIMIT = 8

const loadSlider = (kind: ProductSliderKind) =>
  cached(`home-slider-${kind}`, async () => {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    return listSliderCards(payload, kind, SLIDER_LIMIT)
  })

const SLIDERS: Record<ProductSliderKind, { id: string; title: string; viewAllHref: string }> = {
  // Görüntülenme varsayılan sıralamadır: "tümü" bağlantısı düz listeye gider.
  views: { id: 'most-viewed-heading', title: 'En çok görüntülenen', viewAllHref: '/urunler' },
  newest: {
    id: 'newest-heading',
    title: 'Yeni eklenen',
    viewAllHref: '/urunler?sirala=newest',
  },
}

/**
 * Tek slider bölümü: veri sunucuda çekilir, hata boş sonuçtan ayrı bir kutuya düşer.
 * Boş sonuçta `ProductSlider` hiçbir şey çizmez (bölüm gizlenir).
 */
async function ProductSliderSection({ kind }: { kind: ProductSliderKind }) {
  const { id, title, viewAllHref } = SLIDERS[kind]
  const products = await loadSlider(kind).catch((error: unknown) => {
    console.error(`[anasayfa] "${title}" slider'ı yüklenemedi`, error)
    return null
  })
  if (!products) return <ProductSliderError id={id} title={title} />
  return <ProductSlider id={id} title={title} products={products} viewAllHref={viewAllHref} />
}

export default async function HomePage() {
  const { topics, stats, siteStats } = await loadHomeData()

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <JsonLd data={jsonLdGraph([organizationNode(), websiteNode()])} />
      <section
        aria-labelledby="hero-heading"
        className="grid gap-10 pt-6 pb-12 sm:py-16 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-center"
      >
        <div className="flex flex-col items-start gap-5">
          <EvidenceTag variant="evidence">TÜKETİCİ TOPLULUĞU</EvidenceTag>
          <h1
            id="hero-heading"
            className="font-display text-3xl leading-tight text-balance sm:text-4xl"
          >
            Barkodu tara, ürün hakkındaki uzman yorumunu gör.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Barkod Dedektifi, uzmanların yazdığı boykot, sağlık ve helal kurallarını ürüne uygular.
            Geriye tek bakışta okunacak net bir görüş kalır.
          </p>
          <UnifiedSearchForm />
        </div>

        {/* Tanıtım videosu: mobilde formun altında tam genişlik, masaüstünde hero'nun geniş kolonu. */}
        <div className="relative flex items-center justify-center">
          <div className="group relative w-full rotate-1 rounded-md border border-border bg-card p-2 shadow-md transition-transform duration-300 group-hover:rotate-0">
            <span className="absolute -top-2 left-1/2 z-10 h-4 w-24 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs" />
            <HeroVideo />
          </div>
        </div>
      </section>

      {/* Ürün keşfi: iki slider kendi Suspense sınırında; yükleme iskeleti ve hata
          kutusu ayrı, boş sonuçta bölüm hiç çizilmez (ayırıcı çizgi bölümün kendi
          alt kenarında; boş sonuçta geriye boş bir şerit kalmaz). */}
      <div>
        <Suspense fallback={<ProductSliderSkeleton id="most-viewed-heading" title="En çok görüntülenen" />}>
          <ProductSliderSection kind="views" />
        </Suspense>
        <Suspense fallback={<ProductSliderSkeleton id="newest-heading" title="Yeni eklenen" />}>
          <ProductSliderSection kind="newest" />
        </Suspense>
      </div>

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
