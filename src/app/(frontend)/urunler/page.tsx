import { getPayload } from 'payload'
import Link from 'next/link'
import { PackageSearch, Plus } from 'lucide-react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { PRODUCT_PAGE_SIZE, listProductCards } from '@/lib/productCardData'
import { EvidenceTag } from '@/components/EvidenceTag'
import { InfiniteProductGrid } from '@/components/InfiniteProductGrid'
import { ProductsFilterBar } from '@/components/ProductsFilterBar'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Ürünler',
  description: 'Yayındaki tüm ürün dosyaları — isim, kategori, marka ve etikete göre filtreleyin.',
}

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

  const [categories, products] = await Promise.all([
    // Süzgeç çipleri tüm kategorileri gösterir; katalog 33–50 aralığında, tavan güvenlik payı.
    payload.find({ collection: 'categories', limit: 200, sort: 'name', depth: 0 }),
    // Marka listesi sunucuda çekilmez: 3.950 marka tek istekte 10 sn'ye yaklaşıyordu.
    // Süzgeç, yazdıkça `/api/brands` üzerinden ilk 20 eşleşmeyi arar (bkz. BrandCombobox).
    listProductCards(payload, { q, category, brand, labels, limit: PRODUCT_PAGE_SIZE }),
  ])

  // Seçili markanın adı: tek kayıt, süzgeç düğmesinde görünür.
  const selectedBrand =
    brand && (await payload.findByID({ collection: 'brands', id: brand, depth: 0 }).catch(() => null))

  const docs = products.docs

  const hasFilters = Boolean(q || category || brand || labels.length > 0)

  // Sonsuz kaydırma ucu ile sayfa aynı filtre sözleşmesini paylaşır (`sayfa`yı istemci ekler).
  const feedQuery = new URLSearchParams()
  if (q) feedQuery.set('q', q)
  if (category) feedQuery.set('kategori', category)
  if (brand) feedQuery.set('marka', brand)
  for (const label of labels) feedQuery.append('etiket', label)
  const feedParams = feedQuery.toString()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>DOSYALAR</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürünler</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Yayındaki ürün dosyaları. Barkodu okut ya da listeden seç.
        </p>
      </div>

      <div className="mt-6">
        <ProductsFilterBar
          q={q}
          category={category}
          brand={brand}
          labels={labels}
          categories={categories.docs.map((c: any) => ({ id: String(c.id), name: c.name }))}
          brandName={(selectedBrand as { name?: string } | null)?.name ?? null}
        />
      </div>

      {products.totalDocs === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-md border border-dashed border-border bg-card p-8">
          <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
          {hasFilters ? (
            <>
              <p className="text-sm text-muted-foreground">
                Bu filtrelerle eşleşen ürün yok. Filtreleri kaldırıp tekrar dene.
              </p>
              <Button asChild variant="outline">
                <Link href="/urunler">Filtreleri temizle</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Henüz yayında ürün yok. Barkodu okutup ilk dosyayı sen aç.
              </p>
              <Button asChild>
                <Link href="/tara">
                  <Plus aria-hidden="true" />
                  Barkod okut
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase" aria-live="polite">
            {products.totalDocs} ürün listeleniyor · en çok görüntülenen önce
          </p>
          <div className="mt-4">
            <InfiniteProductGrid
              key={feedParams || 'tumu'}
              initialProducts={docs}
              totalDocs={products.totalDocs}
              query={feedParams}
            />
          </div>
        </>
      )}
    </div>
  )
}
