import { getPayload } from 'payload'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadCategoryTree, type CategoryNode } from '@/lib/categoryTree'

export const metadata: Metadata = {
  title: 'Kategoriler',
  description: 'Ürün tipleri: içecek, atıştırmalık, süt ürünleri ve alt kategorileri.',
}

const numberFormat = new Intl.NumberFormat('tr-TR')

function CategoryCard({ category }: { category: CategoryNode }) {
  return (
    <CaseCard className="flex h-full flex-col border-l-4">
      <CardHeader>
        <CardTitle>
          <Link
            href={`/kategoriler/${category.slug}`}
            className="group flex items-center gap-3 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {category.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- CMS ikonu, sabit boyutlu küçük türev
              <img
                src={category.iconUrl}
                alt={category.iconAlt || ''}
                className="size-10 shrink-0 rounded-sm border border-border bg-card object-contain p-1"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-muted/60 text-sm font-medium text-muted-foreground"
              >
                {category.name.slice(0, 1)}
              </span>
            )}
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate">{category.name}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {category.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
        )}
        <p className="mt-auto font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
          {numberFormat.format(category.productCount)} ürün · {category.children.length} alt kategori
        </p>
        {category.children.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {category.children.map((child) => (
              <Link
                key={child.id}
                href={`/kategoriler/${child.slug}`}
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {child.name}
                <span className="text-faded">{child.productCount}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </CaseCard>
  )
}

export default async function CategoriesPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const tree = await loadCategoryTree(payload)

  const totalProducts = tree.roots.reduce((sum, root) => sum + root.productCount, 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>ÜRÜN TİPLERİ</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Kategoriler</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Ürünleri türlerine göre gez. Bir kategoriye girdiğinde alt kategorileri ve o türdeki
          yayındaki ürün dosyalarını görürsün.
        </p>
        {tree.roots.length > 0 && (
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            {tree.roots.length} ana kategori · {tree.all.length} kategori ·{' '}
            {numberFormat.format(totalProducts)} yayında ürün
          </p>
        )}
      </div>

      {tree.roots.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-md border border-dashed border-border bg-card p-8">
          <Package className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Henüz ürün kategorisi eklenmemiş. Panelden kategori oluşturup ürünlere bağlayın.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tree.roots.map((root) => (
            <CategoryCard key={root.id} category={root} />
          ))}
        </div>
      )}
    </div>
  )
}
