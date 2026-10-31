import { getPayload } from 'payload'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronRight, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { loadCategoryTree, type CategoryNode } from '@/lib/categoryTree'

export const metadata: Metadata = {
  title: 'Kategoriler',
  description:
    'Ürün tipleri üst ve alt kategori olarak: içecek, süt ürünleri, et & şarküteri, atıştırmalık ve daha fazlası.',
}

const numberFormat = new Intl.NumberFormat('tr-TR')

function CategoryIcon({ category, size }: { category: CategoryNode; size: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'size-10' : 'size-8'
  if (category.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CMS ikonu, sabit boyutlu küçük görsel
      <img
        src={category.iconUrl}
        alt={category.iconAlt || ''}
        className={`${box} shrink-0 rounded-sm border border-border bg-card object-contain p-1`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-sm border border-border bg-muted/60 font-medium text-muted-foreground ${
        size === 'lg' ? 'text-sm' : 'text-xs'
      }`}
    >
      {category.name.slice(0, 1)}
    </span>
  )
}

/** Alt kategori satırı: kendi alt kategorileri varsa bir düzey daha içeride listelenir. */
function ChildLink({ child }: { child: CategoryNode }) {
  return (
    <li>
      <Link
        href={`/kategoriler/${child.slug}`}
        className="group flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <CategoryIcon category={child} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm">{child.name}</span>
        <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.14em] text-faded">
          {numberFormat.format(child.directProductCount)}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      {child.children.length > 0 && (
        <ul className="mt-0.5 ml-6 flex flex-col gap-0.5 border-l border-border pl-2">
          {child.children.map((grandchild) => (
            <ChildLink key={grandchild.id} child={grandchild} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Üst kategori: başlık + açıklama + alt kategori listesi. */
function RootSection({ root }: { root: CategoryNode }) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CategoryIcon category={root} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-lg">
              <Link
                href={`/kategoriler/${root.slug}`}
                className="inline-flex items-center gap-1 rounded-md outline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {root.name}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </h2>
            {root.description && (
              <p className="max-w-xl text-sm text-muted-foreground">{root.description}</p>
            )}
          </div>
        </div>
        <p className="shrink-0 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase sm:pt-2">
          {numberFormat.format(root.productCount)} ürün · {root.children.length} alt kategori
        </p>
      </div>

      {root.children.length > 0 ? (
        <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {root.children.map((child) => (
            <ChildLink key={child.id} child={child} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Bu üst kategorinin alt kategorisi henüz tanımlı değil;{' '}
          <Link
            href={`/kategoriler/${root.slug}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            ürünlerine
          </Link>{' '}
          göz atabilirsin.
        </p>
      )}
    </section>
  )
}

export default async function CategoriesPage() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const tree = await loadCategoryTree(payload)

  const totalProducts = tree.roots.reduce((sum, root) => sum + root.productCount, 0)
  const totalChildren = tree.all.length - tree.roots.length

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag>ÜRÜN TİPLERİ</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Kategoriler</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Ürünleri türlerine göre gez. Her üst kategori, alt kategorileri ve o türdeki yayındaki
          ürün dosyalarını içerir.
        </p>
        {tree.roots.length > 0 && (
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            {tree.roots.length} üst kategori · {totalChildren} alt kategori ·{' '}
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
        <CaseCard className="mt-8 gap-6 p-4 sm:p-6">
          <div className="flex flex-col gap-6">
            {tree.roots.map((root) => (
              <RootSection key={root.id} root={root} />
            ))}
          </div>
        </CaseCard>
      )}
    </div>
  )
}
