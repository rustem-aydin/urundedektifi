'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Marka süzgeci.
 *
 * Katalog 3.950 markaya çıktığı için tüm markalar sunucuda render edilmiyor: arama
 * kutusuna yazıldıkça `/api/brands` (herkese açık okuma) üzerinden ilk 20 eşleşme
 * getirilir. Seçim `onChange` ile üst bileşene bildirilir; URL'i (ve sunucu süzgecini)
 * `ProductsFilterBar` yazar.
 */

type Option = { id: string; name: string }

type Props = {
  brand: string
  brandName?: string | null
  /** Seçim yapıldığında marka kimliği; "Tüm markalar" için boş dize. */
  onChange: (id: string, name: string | null) => void
}

export function BrandCombobox({ brand, brandName, onChange }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [options, setOptions] = React.useState<Option[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const term = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({ limit: '20', depth: '0', sort: 'name' })
      if (term) params.set('where[name][contains]', term)
      fetch(`/api/brands?${params.toString()}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { docs: [] }))
        .then((data: { docs?: { id: number | string; name?: string }[] }) => {
          setOptions(
            (data.docs ?? [])
              .filter((doc) => doc.name)
              .map((doc) => ({ id: String(doc.id), name: doc.name as string })),
          )
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 220)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [open, query])

  const select = (id: string, name: string | null) => {
    onChange(id, name)
    setOpen(false)
    setQuery('')
  }

  const label = brand ? (brandName ?? 'Seçili marka') : 'Tüm markalar'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Markaya göre filtrele"
          className="group flex w-full items-center justify-between gap-2 border-b border-border py-2 text-left font-mono text-[0.7rem] tracking-[0.14em] uppercase transition-colors hover:text-stamp focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-faded transition-colors group-hover:text-stamp">Marka</span>
            <span className={cn('truncate tracking-normal normal-case', brand ? 'text-stamp' : 'text-muted-foreground')}>
              {label}
            </span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Marka ara…"
            aria-label="Marka ara"
            className="h-9 pl-8"
          />
        </div>
        <div role="listbox" aria-label="Markalar" className="mt-2 max-h-72 overflow-y-auto">
          <button
            type="button"
            role="option"
            aria-selected={!brand}
            onClick={() => select('', null)}
            className={cn(
              'flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm hover:bg-muted',
              !brand && 'font-medium',
            )}
          >
            Tüm markalar
            {!brand && <Check aria-hidden="true" className="size-4" />}
          </button>
          {options.map((option) => {
            const active = option.id === brand
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(option.id, option.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted',
                  active && 'font-medium',
                )}
              >
                <span className="truncate">{option.name}</span>
                {active && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </button>
            )
          })}
          {!loading && options.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Marka bulunamadı.</p>
          )}
          {loading && <p className="px-2 py-3 text-sm text-muted-foreground">Aranıyor…</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
