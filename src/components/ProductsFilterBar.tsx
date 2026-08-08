'use client'

import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Option = { id: string; name: string }

type ProductsFilterBarProps = {
  q: string
  category: string
  brand: string
  labels: string[]
  categories: Option[]
  brands: Option[]
}

const ALL = '__all__'

function buildParams({
  q,
  category,
  brand,
  labels,
}: {
  q: string
  category: string
  brand: string
  labels: string[]
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('kategori', category)
  if (brand) params.set('marka', brand)
  for (const l of labels) params.append('etiket', l)
  return params
}

export function ProductsFilterBar({
  q,
  category,
  brand,
  labels,
  categories,
  brands,
}: ProductsFilterBarProps) {
  const router = useRouter()

  const push = (next: { q?: string; category?: string; brand?: string; labels?: string[] }) => {
    const params = buildParams({
      q: next.q ?? q,
      category: next.category ?? category,
      brand: next.brand ?? brand,
      labels: next.labels ?? labels,
    })
    const qs = params.toString()
    router.push(qs ? `/urunler?${qs}` : '/urunler')
  }

  const hasFilters = Boolean(q || category || brand || labels.length > 0)

  return (
    <form
      role="search"
      aria-label="Ürünleri filtrele"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        push({ q: String(fd.get('q') || '').trim() })
      }}
    >
      <div className="relative min-w-0 flex-1 sm:min-w-56">
        <label htmlFor="urun-q" className="sr-only">
          Ürün adı ara
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="urun-q"
          name="q"
          type="search"
          autoComplete="off"
          defaultValue={q}
          placeholder="Ürün adında ara…"
          className="h-10 border-2 border-foreground bg-card pl-8 shadow-xs"
        />
      </div>

      <label className="sr-only">Kategoriye göre filtrele</label>
      <Select
        value={category || ALL}
        onValueChange={(v) => push({ category: v === ALL ? '' : v })}
      >
        <SelectTrigger
          aria-label="Kategoriye göre filtrele"
          className="h-10 w-full border-2 border-foreground bg-card font-mono text-xs tracking-[0.1em] uppercase shadow-xs sm:w-44"
        >
          <SelectValue placeholder="Kategori" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm kategoriler</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="sr-only">Markaya göre filtrele</label>
      <Select value={brand || ALL} onValueChange={(v) => push({ brand: v === ALL ? '' : v })}>
        <SelectTrigger
          aria-label="Markaya göre filtrele"
          className="h-10 w-full border-2 border-foreground bg-card font-mono text-xs tracking-[0.1em] uppercase shadow-xs sm:w-44"
        >
          <SelectValue placeholder="Marka" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tüm markalar</SelectItem>
          {brands.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" className="h-10 w-full px-5 sm:w-auto">
        <Search aria-hidden="true" />
        Ara
      </Button>

      {hasFilters && (
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => router.push('/urunler')}
        >
          <X aria-hidden="true" />
          Temizle
        </Button>
      )}
    </form>
  )
}
