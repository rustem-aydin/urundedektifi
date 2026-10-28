'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'

import { BrandCombobox } from '@/components/BrandCombobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Option = { id: string; name: string }

/** Ürün dosyasında en sık kullanılan etiketler (koleksiyon `enum`unun tamamı değil). */
export const LABEL_OPTIONS = [
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

type ProductsFilterBarProps = {
  q: string
  category: string
  brand: string
  labels: string[]
  categories: Option[]
  /** Seçili markanın adı; liste sunucuda tutulmaz (bkz. BrandCombobox). */
  brandName?: string | null
}

type FilterState = { q: string; category: string; brand: string; labels: string[] }

/** Filtre sözleşmesi `q`, `kategori`, `marka`, `etiket`; boş değer parametreye yazılmaz. */
function buildParams({ q, category, brand, labels }: FilterState) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (category) params.set('kategori', category)
  if (brand) params.set('marka', brand)
  for (const label of labels) params.append('etiket', label)
  return params
}

function filterKey(state: FilterState) {
  return [state.q, state.category, state.brand, ...state.labels].join('\u0001')
}

const CHIP_BASE =
  'inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-mono text-[0.7rem] tracking-[0.14em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-ring'
const CHIP_IDLE = 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
const CHIP_ACTIVE = 'border-foreground bg-foreground text-background'

function Chip({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_IDLE)}
    >
      {children}
    </button>
  )
}

/**
 * Ürün listesi süzgeci.
 *
 * Mobil uygulamadaki düzen: tek satır arama, altında "Filtreler" başlığı (kapalıyken yalnız
 * uygulanan filtreler çip olarak görünür). Panel açılınca kategori, marka ve etiket seçenekleri
 * gelir. Seçim URL'e yazılır (`q`, `kategori`, `marka`, `etiket`); sayfa ve sonsuz kaydırma ucu
 * aynı sözleşmeyi okur. Yerel durum iyimser güncellenir: sunucu yanıtı beklenirken çip anında döner.
 */
export function ProductsFilterBar({
  q,
  category,
  brand,
  labels,
  categories,
  brandName,
}: ProductsFilterBarProps) {
  const router = useRouter()
  const [state, setState] = useState<FilterState>({ q, category, brand, labels })
  const [draft, setDraft] = useState(q)
  const [brandLabel, setBrandLabel] = useState<string | null>(brandName ?? null)
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // URL'den gelen yeni filtre (geri/ileri, bağlantı) yerel kopyayı ezer.
  const incoming: FilterState = { q, category, brand, labels }
  const incomingKey = filterKey(incoming)
  const [lastKey, setLastKey] = useState(incomingKey)
  if (incomingKey !== lastKey) {
    setLastKey(incomingKey)
    setState(incoming)
    setDraft(q)
    setBrandLabel(brandName ?? null)
  }

  const apply = (patch: Partial<FilterState>) => {
    const next: FilterState = { ...state, ...patch }
    setState(next)
    if (patch.q !== undefined) setDraft(patch.q)
    const qs = buildParams(next).toString()
    startTransition(() => {
      // Panel açıkken sayfa başına sıçramasın; sonuç listesi yerinde güncellenir.
      router.push(qs ? `/urunler?${qs}` : '/urunler', { scroll: false })
    })
  }

  const clearAll = () => {
    setBrandLabel(null)
    apply({ q: '', category: '', brand: '', labels: [] })
  }

  const toggleLabel = (value: string) => {
    const active = state.labels.includes(value)
    apply({
      labels: active ? state.labels.filter((label) => label !== value) : [...state.labels, value],
    })
  }

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (state.category) {
    const name = categories.find((option) => option.id === state.category)?.name
    activeChips.push({
      key: 'kategori',
      label: `Kategori · ${name ?? '—'}`,
      clear: () => apply({ category: '' }),
    })
  }
  if (state.brand) {
    activeChips.push({
      key: 'marka',
      label: `Marka · ${brandLabel ?? '—'}`,
      clear: () => {
        setBrandLabel(null)
        apply({ brand: '' })
      },
    })
  }
  for (const value of state.labels) {
    const name = LABEL_OPTIONS.find((option) => option.value === value)?.label ?? value
    activeChips.push({ key: `etiket:${value}`, label: `Etiket · ${name}`, clear: () => toggleLabel(value) })
  }

  const activeCount = activeChips.length
  const hasFilters = activeCount > 0

  return (
    <div aria-busy={pending} className={cn('transition-opacity', pending && 'opacity-60')}>
      <form
        role="search"
        aria-label="Ürünleri filtrele"
        className="flex items-stretch gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q: draft.trim() })
        }}
      >
        <div className="relative min-w-0 flex-1">
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
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ürün adında ara…"
            className="h-10 border-2 border-foreground bg-card pl-8 shadow-xs"
          />
        </div>
        <Button type="submit" className="h-10 shrink-0 px-5">
          <Search aria-hidden="true" />
          Ara
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-border py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="urun-filtre-paneli"
          onClick={() => setOpen((previous) => !previous)}
          className="inline-flex items-center gap-2 rounded-sm py-1 font-mono text-[0.7rem] tracking-[0.14em] uppercase transition-colors hover:text-stamp focus-visible:outline-2 focus-visible:outline-ring"
        >
          <SlidersHorizontal
            aria-hidden="true"
            className={cn('size-3.5', hasFilters ? 'text-stamp' : 'text-muted-foreground')}
          />
          <span className={hasFilters ? 'text-stamp' : undefined}>
            Filtreler{hasFilters ? ` · ${activeCount}` : ''}
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            {open ? '[-] Kapat' : '[+] Aç'}
          </span>
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-sm py-1 font-mono text-[0.7rem] tracking-[0.14em] text-stamp uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-3.5" />
            Temizle
          </button>
        )}
      </div>

      {!open && activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Chip key={chip.key} active onClick={chip.clear} label={`${chip.label} filtresini kaldır`}>
              {chip.label}
              <X aria-hidden="true" className="size-3" />
            </Chip>
          ))}
        </div>
      )}

      {open && (
        <div
          id="urun-filtre-paneli"
          className="mt-3 flex flex-col gap-4 rounded-md border border-border bg-card p-3 sm:p-4"
        >
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">Kategori</p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              <Chip active={!state.category} onClick={() => apply({ category: '' })} label="Kategori: Tümü">
                Tümü
              </Chip>
              {categories.map((option) => (
                <Chip
                  key={option.id}
                  active={state.category === option.id}
                  onClick={() => apply({ category: option.id })}
                  label={`Kategori: ${option.name}`}
                >
                  {option.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">Marka</p>
            <BrandCombobox
              brand={state.brand}
              brandName={brandLabel}
              onChange={(id, name) => {
                setBrandLabel(name)
                apply({ brand: id })
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">Etiket</p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              <Chip active={state.labels.length === 0} onClick={() => apply({ labels: [] })} label="Etiket: Tümü">
                Tümü
              </Chip>
              {LABEL_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  active={state.labels.includes(option.value)}
                  onClick={() => toggleLabel(option.value)}
                  label={`Etiket: ${option.label}`}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
