'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Marka süzgeci.
 *
 * Katalog 3.950 markaya çıktığı için tüm markalar sunucuda render edilmiyor: arama
 * kutusuna yazıldıkça `/api/brands` (herkese açık okuma) üzerinden ilk 20 eşleşme
 * getirilir. Seçim URL'e `marka=<id>` olarak yazılır; sayfa sunucuda süzer.
 */

type Option = { id: string; name: string }

type Props = {
  brand: string
  brandName?: string | null
  baseParams: string
}

const ALL = '__all__'

export function BrandCombobox({ brand, brandName, baseParams }: Props) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [options, setOptions] = React.useState<Option[]>([])
  const [selectedName, setSelectedName] = React.useState<string | null>(brandName ?? null)
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

  const apply = (id: string, name: string | null) => {
    const params = new URLSearchParams(baseParams)
    if (id === ALL) params.delete('marka')
    else params.set('marka', id)
    const qs = params.toString()
    router.push(qs ? `/urunler?${qs}` : '/urunler')
    setSelectedName(name)
    setOpen(false)
    setQuery('')
  }

  const label = brand && selectedName ? selectedName : brand ? 'Seçili marka' : 'Tüm markalar'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Markaya göre filtrele"
          className="h-10 w-full justify-between overflow-hidden border-2 border-foreground bg-card font-mono text-xs tracking-[0.1em] uppercase shadow-xs sm:w-44"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown aria-hidden="true" className="ml-2 size-3.5 shrink-0 opacity-60" />
        </Button>
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
            onClick={() => apply(ALL, null)}
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
                onClick={() => apply(option.id, option.name)}
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
