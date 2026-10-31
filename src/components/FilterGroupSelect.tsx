'use client'

import * as React from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type FilterGroupOption = { value: string; label: string }

type Props = {
  /** Grup başlığı; açılır menüyü açan düğmenin solunda durur. */
  label: string
  options: FilterGroupOption[]
  /** Seçili değerler; tek seçimde en fazla bir öğe. */
  values: string[]
  /** `true` ise menü kapanmadan birden çok seçim yapılabilir. */
  multiple?: boolean
  onChange: (next: string[]) => void
}

/**
 * Grup başlıklı, aranabilir filtre menüsü.
 *
 * Kategori ve etiket gibi uzun listeler çip yığını yerine tek bir açılır menüde toplanır:
 * başlığa basınca arama kutusu ve seçenek listesi açılır. Tek seçimde seçim menüyü kapatır;
 * çok seçimde (etiket) menü açık kalır ve her satır bir onay işareti taşır.
 */
export function FilterGroupSelect({ label, options, values, multiple = false, onChange }: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const needle = query.trim().toLocaleLowerCase('tr')
  const filtered = needle
    ? options.filter((option) => option.label.toLocaleLowerCase('tr').includes(needle))
    : options

  const selected = new Set(values)

  const summary = (() => {
    if (values.length === 0) return 'Tümü'
    if (!multiple) return options.find((option) => option.value === values[0])?.label ?? values[0]
    if (values.length === 1) return options.find((option) => option.value === values[0])?.label ?? values[0]
    return `${values.length} seçili`
  })()

  const select = (value: string | null) => {
    if (!multiple) {
      onChange(value ? [value] : [])
      setOpen(false)
      setQuery('')
      return
    }
    if (value === null) {
      onChange([])
      return
    }
    onChange(selected.has(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={`${label} filtresini aç`}
          className="group flex w-full items-center justify-between gap-2 border-b border-border py-2 text-left font-mono text-[0.7rem] tracking-[0.14em] uppercase transition-colors hover:text-stamp focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-faded transition-colors group-hover:text-stamp">{label}</span>
            <span className={cn('truncate tracking-normal normal-case', values.length > 0 ? 'text-stamp' : 'text-muted-foreground')}>
              {summary}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-2">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${label} ara…`}
            aria-label={`${label} ara`}
            className="h-9 pl-8"
          />
        </div>
        <div role="listbox" aria-label={label} aria-multiselectable={multiple} className="mt-2 max-h-72 overflow-y-auto">
          <button
            type="button"
            role="option"
            aria-selected={values.length === 0}
            onClick={() => select(null)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted',
              values.length === 0 && 'font-medium',
            )}
          >
            Tümü
            {values.length === 0 && <Check aria-hidden="true" className="size-4 shrink-0" />}
          </button>
          {filtered.map((option) => {
            const active = selected.has(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(option.value)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted',
                  active && 'font-medium',
                )}
              >
                <span className="truncate">{option.label}</span>
                {active && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Eşleşen {label.toLocaleLowerCase('tr')} yok.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
