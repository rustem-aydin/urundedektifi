import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronRight, PackageSearch } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { InfiniteProductGrid } from '@/components/InfiniteProductGrid'
import { Button } from '@/components/ui/button'
import { PRODUCT_PAGE_SIZE, listProductCards } from '@/lib/productCardData'
import { categoryAncestors, categoryDescendantIds, loadCategoryTree } from '@/lib/categoryTree'

const numberFormat = new Intl.NumberFormat('tr-TR')

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const tree = await loadCategoryTree(payload)
  const category = tree.bySlug.get(slug)
  if (!category) return { title: 'Kategori' }
  return {
    title: category.name,
    description:
      category.description ??
      `${category.name} kategorisindeki ürün dosyaları ve alt kategoriler.`,
  }
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const tree = await loadCategoryTree(payload)
  const category = tree.bySlug.get(slug)
  if (!category) notFound()

  const ancestors = categoryAncestors(tree, category)
  const categoryIds = categoryDescendantIds(category)
  const products = await listProductCards(payload, {
    categories: categoryIds,
    page: 1,
    limit: PRODUCT_PAGE_SIZE,
  })

  const feedQuery = new URLSearchParams()
  for (const id of categoryIds) feedQuery.append('kategori', id)
  const feedParams = feedQuery.toString()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <nav aria-label="Kategori yolu" className="flex flex-wrap items-center gap-1 text-sm">
        <Link
          href="/kategoriler"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Kategoriler
        </Link>
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-faded" aria-hidden="true" />
            <Link
              href={`/kategoriler/${ancestor.slug}`}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {ancestor.name}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-faded" aria-hidden="true" />
          <span aria-current="page" className="text-foreground">
            {category.name}
          </span>
        </span>
      </nav>

      <CaseCard className="mt-6 border-l-4">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          {category.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- CMS ikonu, küçük türev
            <img
              src={category.iconUrl}
              alt={category.iconAlt || ''}
              className="size-16 shrink-0 rounded-sm border border-border bg-card object-contain p-1"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-sm border border-border bg-muted/60 font-display text-2xl text-muted-foreground"
            >
              {category.name.slice(0, 1)}
            </span>
          )}

          <div className="flex min-w-0 flex-col items-start gap-2">
            <EvidenceTag>ÜRÜN TİPİ</EvidenceTag>
            <h1 className="font-display text-2xl sm:text-3xl">{category.name}</h1>
            {category.description && (
              <p className="max-w-2xl text-sm text-muted-foreground">{category.description}</p>
            )}
            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
              {numberFormat.format(category.productCount)} yayında ürün
              {category.children.length > 0
                ? ` · ${category.children.length} alt kategori dahil`
                : ''}
            </p>
          </div>
        </div>
      </CaseCard>

      {category.children.length > 0 && (
        <section aria-labelledby="alt-kategoriler" className="mt-8">
          <h2
            id="alt-kategoriler"
            className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase"
          >
            Alt kategoriler
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/kategoriler/${child.slug}`}
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span
                  className={
                    child.productCount > 0
                      ? 'size-1.5 rounded-full bg-evidence-green'
                      : 'size-1.5 rounded-full bg-border'
                  }
                  aria-hidden="true"
                />
                {child.name}
                <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                  {numberFormat.format(child.productCount)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="kategori-urunleri" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="kategori-urunleri" className="font-display text-xl">
            Ürünler
          </h2>
          {products.totalDocs > 0 && (
            <p
              className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase"
              aria-live="polite"
            >
              {numberFormat.format(products.totalDocs)} ürün listeleniyor · en çok görüntülenen
              önce
            </p>
          )}
        </div>

        {products.totalDocs === 0 ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-md border border-dashed border-border bg-card p-8">
            <PackageSearch className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Bu kategoride henüz yayında ürün yok.
              {category.children.length > 0
                ? ' Alt kategorilerden birine göz atabilirsin.'
                : ' Tüm ürünlere göz atabilirsin.'}
            </p>
            <Button asChild variant="outline">
              <Link href="/urunler">Tüm ürünler</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <InfiniteProductGrid
              key={feedParams}
              initialProducts={products.docs}
              totalDocs={products.totalDocs}
              query={feedParams}
            />
          </div>
        )}
      </section>
    </div>
  )
}
