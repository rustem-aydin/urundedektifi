import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, AlertTriangle, Info, OctagonAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { getProductCase } from '@/lib/productCase'
import { Barcode } from '@/components/Barcode'
import { EvidenceTag } from '@/components/EvidenceTag'
import { VerdictStamp } from '@/components/VerdictStamp'
import { CaseCard } from '@/components/CaseCard'
import { CaseSection } from '@/components/CaseSection'
import { ProductGallery } from '@/components/ProductGallery'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ barcode: string }>
}): Promise<Metadata> {
  const { barcode } = await params
  return { title: `Ürün Dosyası ${barcode}` }
}

const NUTRISCORE_COLORS: Record<string, string> = {
  a: 'bg-evidence-green text-background',
  b: 'bg-evidence-green/70 text-background',
  c: 'bg-tape-yellow text-foreground',
  d: 'bg-tape-yellow text-foreground',
  e: 'bg-stamp text-background',
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d))
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ barcode: string }>
}) {
  const { barcode } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const product = await getProductCase(payload, barcode)
  if (!product) notFound()

  const { verdict } = product
  const priceSummary = product.priceSummary

  const generalInfo: [string, string | null | undefined][] = [
    ['Marka', product.brand?.name],
    ['Kategori', product.category?.name],
    ['Üretim yeri', product.country?.name],
    ['Üretici firma', product.manufacturer],
    ['Boyut / ağırlık', product.size],
    ['Ambalaj tipi', product.packaging],
    ['Model / ürün kodu', product.model],
    ['SKU / stok kodu', product.sku],
    ['Garanti', product.warranty],
    ['Saklama koşulları', product.storage],
  ]
  const filledInfo = generalInfo.filter(([, v]) => v) as [string, string][]
  const hasIngredients =
    product.ingredients.length > 0 || product.additives.length > 0 || product.allergens.length > 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <Link
        href="/urunler"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Tüm ürünler
      </Link>

      {/* DOSYA BAŞLIĞI */}
      <header className="mt-4 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
        <ProductGallery images={product.gallery} />

        <CaseCard className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceTag variant="evidence">ÜRÜN DOSYASI</EvidenceTag>
            {product.brand?.isBoycotted && <VerdictStamp variant="danger">Boykotlu marka</VerdictStamp>}
            {verdict.totalMatched > 0 && (
              <VerdictStamp variant="warn">{verdict.totalMatched} delil eşleşti</VerdictStamp>
            )}
          </div>

          <div>
            <h1 className="font-display text-2xl leading-tight text-balance sm:text-3xl">
              {product.name}
            </h1>
            {product.brand?.name && (
              <p className="mt-1 text-muted-foreground">{product.brand.name}</p>
            )}
          </div>

          {(product.labels.length > 0 || product.nutriscore) && (
            <div className="flex flex-wrap items-center gap-2">
              {product.nutriscore && (
                <span
                  className={`inline-flex size-7 items-center justify-center rounded-sm font-mono text-sm font-bold uppercase ${NUTRISCORE_COLORS[product.nutriscore] || 'bg-muted text-foreground'}`}
                  title="Nutri-Score"
                >
                  {product.nutriscore}
                </span>
              )}
              {product.labels.map((l) => (
                <EvidenceTag key={l.value}>{l.name}</EvidenceTag>
              ))}
            </div>
          )}

          {priceSummary && (
            <p className="text-sm">
              <span className="font-mono text-xl font-bold text-evidence-green">
                {formatPrice(priceSummary.min)}–{formatPrice(priceSummary.max)}
              </span>
              <span className="ml-2 text-muted-foreground">
                (ort. {formatPrice(priceSummary.average)})
              </span>
            </p>
          )}

          {product.barcode && (
            <div className="mt-auto border-t border-dashed border-border pt-4">
              <Barcode
                value={product.barcode}
                height={56}
                className="w-full max-w-[240px] text-foreground"
              />
              <p className="mt-2 font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
                KANIT NO: {product.barcode}
              </p>
            </div>
          )}
        </CaseCard>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        {/* HÜKÜMLER */}
        <CaseSection
          id="hukumler"
          eyebrow="Dosya 01"
          title={<>Uzman hükümleri <span className="font-mono text-base text-faded">({verdict.totalMatched})</span></>}
          hasData={verdict.totalMatched > 0}
          emptyMessage="Bu ürünle eşleşen aktif kural bulunamadı. Uzmanlar yeni kurallar ekledikçe bu dosya otomatik güncellenir."
        >
          <div className="mt-4 flex flex-col gap-6">
            {verdict.byTopic.map((tv) => (
              <div key={tv.topic.id}>
                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                  <span aria-hidden="true">{tv.topic.icon}</span>
                  <Link href={`/konu/${tv.topic.slug}`} className="hover:underline underline-offset-4">
                    {tv.topic.name}
                  </Link>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                    {tv.matchedRules.length} eşleşme
                  </span>
                </h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {tv.matchedRules.map((r) => (
                    <li key={r.id}>
                      <CaseCard tape>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <EvidenceTag variant="evidence">DELİL</EvidenceTag>
                            {r.rating?.name && (
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
                          <CardTitle className="mt-2">{r.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                          {r.matchedValue && (
                            <p className="text-sm">
                              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                                Eşleşme:{' '}
                              </span>
                              {r.matchedValue}
                            </p>
                          )}
                          {r.description && (
                            <p className="text-sm text-muted-foreground">{r.description}</p>
                          )}
                          {r.expertName && (
                            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                              <Link
                                href={`/uzmanlar/${r.expertSlug}`}
                                className="hover:text-foreground hover:underline underline-offset-4"
                              >
                                — {r.expertName}
                              </Link>
                            </p>
                          )}
                        </CardContent>
                      </CaseCard>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CaseSection>

        {/* UYARILAR */}
        <CaseSection
          id="uyarilar"
          eyebrow="Dosya 02"
          title="Uyarılar"
          hasData={product.warnings.length > 0}
          emptyMessage="Bu ürün için kayıtlı uyarı yok."
        >
          <ul className="mt-4 flex flex-col gap-2">
            {product.warnings.map((w, i) => {
              const Icon =
                w.severity === 'high' ? OctagonAlert : w.severity === 'medium' ? AlertTriangle : Info
              const tone =
                w.severity === 'high'
                  ? 'border-stamp/60 bg-stamp/10 text-stamp'
                  : w.severity === 'medium'
                    ? 'border-tape-yellow/60 bg-tape-yellow/15 text-foreground'
                    : 'border-border bg-card text-muted-foreground'
              return (
                <li
                  key={i}
                  className={`flex items-start gap-3 rounded-md border px-4 py-3 ${tone}`}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="text-sm">{w.text}</p>
                </li>
              )
            })}
          </ul>
        </CaseSection>

        {/* İÇİNDEKİLER */}
        <CaseSection
          id="icindekiler"
          eyebrow="Dosya 03"
          title="İçindekiler"
          hasData={hasIngredients}
          emptyMessage="İçindekiler bilgisi henüz girilmemiş. Paketin arka yüzündeki listeyi ekleyerek dosyayı tamamlayın."
        >
          <CaseCard className="mt-4">
            <CardContent className="flex flex-col gap-4">
              {product.ingredients.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {product.ingredients.map((it, i) => (
                    <li key={i}>
                      <EvidenceTag>
                        {it.name}
                        {it.pct !== null && <span className="text-faded">%{it.pct}</span>}
                      </EvidenceTag>
                    </li>
                  ))}
                </ul>
              )}
              {product.additives.length > 0 && (
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                    Katkı maddeleri
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {product.additives.map((a, i) => (
                      <li key={i}>
                        <EvidenceTag variant="tape">
                          {a.code ? `${a.code} · ` : ''}
                          {a.name}
                        </EvidenceTag>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {product.allergens.length > 0 && (
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase">
                    Alerjenler
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {product.allergens.map((a, i) => (
                      <li key={i}>
                        <EvidenceTag variant="stamp">{a}</EvidenceTag>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </CaseCard>
        </CaseSection>

        {/* BESİN DEĞERLERİ */}
        <CaseSection
          id="besin-degerleri"
          eyebrow="Dosya 04"
          title="Besin değerleri"
          aside={
            product.nutrition && (
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                {product.nutrition.perLabel}
              </span>
            )
          }
          hasData={Boolean(product.nutrition)}
          emptyMessage="Besin değerleri henüz kaydedilmemiş."
        >
          <CaseCard className="mt-4">
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {product.nutrition?.items.map((it, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{it.name}</td>
                      <td className="py-2 text-right font-mono font-medium">
                        {it.amount} {it.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </CaseCard>
        </CaseSection>

        {/* GENEL BİLGİLER */}
        <CaseSection
          id="genel-bilgiler"
          eyebrow="Dosya 05"
          title="Genel bilgiler"
          hasData={filledInfo.length > 0}
          emptyMessage="Genel bilgi alanları henüz doldurulmamış."
        >
          <CaseCard className="mt-4">
            <CardContent>
              <dl className="flex flex-col divide-y divide-border">
                {filledInfo.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <dt className="shrink-0 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                      {k}
                    </dt>
                    <dd className="text-sm font-medium sm:text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </CaseCard>
        </CaseSection>

        {/* TEKNİK ÖZELLİKLER */}
        <CaseSection
          id="teknik-ozellikler"
          eyebrow="Dosya 06"
          title="Teknik özellikler"
          hasData={product.specifications.length > 0}
          emptyMessage="Teknik özellik kaydı yok."
        >
          <CaseCard className="mt-4">
            <CardContent>
              <dl className="flex flex-col divide-y divide-border">
                {product.specifications.map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <dt className="shrink-0 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                      {s.key}
                    </dt>
                    <dd className="text-sm font-medium sm:text-right">
                      {s.value}
                      {s.unit ? ` ${s.unit}` : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </CaseCard>
        </CaseSection>

        {/* AÇIKLAMA */}
        <CaseSection
          id="aciklama"
          eyebrow="Dosya 07"
          title="Açıklama"
          hasData={Boolean(product.description || product.usage)}
          emptyMessage="Açıklama eklenmemiş."
        >
          <CaseCard className="mt-4">
            <CardContent className="flex flex-col gap-4">
              {product.description && (
                <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">
                  {product.description}
                </p>
              )}
              {product.usage && (
                <div>
                  <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                    Kullanım talimatı
                  </p>
                  <p className="mt-1 text-sm leading-7 whitespace-pre-line text-muted-foreground">
                    {product.usage}
                  </p>
                </div>
              )}
            </CardContent>
          </CaseCard>
        </CaseSection>

        {/* FİYAT */}
        <CaseSection
          id="fiyat"
          eyebrow="Dosya 08"
          title="Fiyat kayıtları"
          hasData={product.prices.length > 0}
          emptyMessage="Henüz fiyat kaydı girilmemiş."
        >
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {product.prices.map((p, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 rounded-sm border border-border bg-card px-3 py-2 shadow-xs"
              >
                <span className="font-mono text-sm font-bold">{formatPrice(p.amount)}</span>
                {p.date && (
                  <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded">
                    {formatDate(p.date)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CaseSection>
      </div>
    </div>
  )
}
