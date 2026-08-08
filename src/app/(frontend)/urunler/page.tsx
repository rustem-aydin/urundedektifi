import { getPayload } from 'payload'
import Link from 'next/link'
import { PackageSearch, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { listProductCases } from '@/lib/productCase'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ProductCard } from '@/components/ProductCard'
import { ProductsFilterBar } from '@/components/ProductsFilterBar'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Ürünler',
  description: 'Yayındaki tüm ürün dosyaları — isim, kategori, marka ve etikete göre filtreleyin.',
}

const LABEL_OPTIONS = [
  { label: 'Vegan', value: 'vegan' },
  { label: 'Vejetaryen', value: 'vegetarian' },
  { label: 'Glütensiz', value: 'gluten-free' },
  { label: 'Laktozsuz', value: 'lactose-free' },
  { label: 'Organik / Bio', value: 'organic' },
  { label: 'Helal Sertifikalı', value: 'halal-certified' },
  { label: 'Koşer', value: 'kosher' },
  { label: 'GDO içermez (Non-GMO)', value: 'non-gmo' },
  { label: 'Doğal', value: 'natural' },
  { label: 'Katkısız', value: 'no-additives' },
  { label: 'Şekersiz', value: 'sugar-free' },
  { label: 'Hayvan Deneysiz (Cruelty Free)', value: 'cruelty-free' },
  { label: 'BPA İçermez', value: 'bpa-free' },
  { label: 'Paraben İçermez', value: 'paraben-free' },
  { label: 'Sülfatsız', value: 'sulfate-free' },
  { label: 'Geri Dönüştürülebilir Ambalaj', value: 'recyclable' },
  { label: 'Fair Trade / Adil Ticaret', value: 'fair-trade' },
]

type SearchParams = { q?: string; kategori?: string; marka?: string; etiket?: string | string[] }

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const q = (params.q || '').trim()
  const category = params.kategori || ''
  const brand = params.marka || ''
  const labels = Array.isArray(params.etiket) ? params.etiket : params.etiket ? [params.etiket] : []

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [categories, brands, products] = await Promise.all([
    payload.find({ collection: 'categories', limit: 100, sort: 'name', depth: 0 }),
    payload.find({ collection: 'brands', limit: 100, sort: 'name', depth: 0 }),
    listProductCases(payload, { q, category, brand, labels, limit: 48 }),
  ])

  const docs = products.docs

  const hasFilters = Boolean(q || category || brand || labels.length > 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>DOSYALAR</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürünler</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Yayındaki ürün kayıtları. Bir ürünü taratmak için barkodunu okutun ya da listeden seçin.
        </p>
      </div>

      <div className="mt-6">
        <ProductsFilterBar
          q={q}
          category={category}
          brand={brand}
          labels={labels}
          categories={categories.docs.map((c: any) => ({ id: c.id, name: c.name }))}
          brands={brands.docs.map((b: any) => ({ id: b.id, name: b.name }))}
        />
      </div>

      {LABEL_OPTIONS.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Etikete göre filtrele">
          {LABEL_OPTIONS.map((o) => {
            const active = labels.includes(o.value)
            const rest = active ? labels.filter((l) => l !== o.value) : [...labels, o.value]
            const sp = new URLSearchParams()
            if (q) sp.set('q', q)
            if (category) sp.set('kategori', category)
            if (brand) sp.set('marka', brand)
            for (const l of rest) sp.append('etiket', l)
            const qs = sp.toString()
            return (
              <Link
                key={o.value}
                href={qs ? `/urunler?${qs}` : '/urunler'}
                aria-pressed={active}
                className={
                  active
                    ? 'inline-flex items-center rounded-sm border border-foreground bg-foreground px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-background transition-colors'
                    : 'inline-flex items-center rounded-sm border border-border bg-card px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground'
                }
              >
                {o.label}
              </Link>
            )
          })}
        </div>
      )}

      {products.totalDocs === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-md border border-dashed border-border bg-card p-8">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
          {hasFilters ? (
            <>
              <p className="text-sm text-muted-foreground">
                Bu filtrelerle eşleşen ürün bulunamadı — filtreleri kaldırıp tekrar deneyin.
              </p>
              <Button asChild variant="outline">
                <Link href="/urunler">Filtreleri Temizle</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Henüz yayında ürün yok. Barkod taratarak ilk ürünü siz ekleyin.
              </p>
              <Button asChild>
                <Link href="/tara">
                  <Plus aria-hidden="true" />
                  İlk Ürünü Siz Ekleyin
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase" aria-live="polite">
            {products.totalDocs} ürün bulundu
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((p) => {
              const frontImage = p.gallery[0] ?? null
              const href = p.barcode ? `/urun/${p.barcode}` : null
              return (
                <ProductCard
                  key={p.id}
                  href={href}
                  name={p.name || 'İsimsiz ürün'}
                  brandName={p.brand?.name ?? null}
                  categoryName={p.category?.name ?? null}
                  barcode={p.barcode}
                  imageUrl={frontImage?.url || null}
                  imageAlt={frontImage?.alt || p.name}
                  verdictCount={p.verdict.totalMatched}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
