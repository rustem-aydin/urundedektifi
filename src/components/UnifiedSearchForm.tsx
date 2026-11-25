'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanBarcode, Search } from 'lucide-react'

import { BarcodeScanButton } from '@/components/BarcodeScanButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Yalnız barkod yazıldığında dosya sayfası doğrudan açılır (ADR 0024 akışı korunur). */
const BARCODE_ONLY = /^\d{8,14}$/

/**
 * Tek birleşik arama kutusu: ürün adı, marka adı ve barkod aynı alandan sorgulanır.
 *
 * - İsim/marka/eksik barkod → `/urunler?q=...` (sunucu tarafı üç alanda OR arar).
 * - 8–14 haneli barkod → `/urun/<barkod>` (dosya varsa ürün, yoksa katkı akışı).
 * - JS kapalıysa form `GET /urunler?q=` olarak çalışır.
 *
 * `h-14` = 56 px: dokunma hedefi mobilde de kutu yüksekliğinin altına düşmez.
 */
export function UnifiedSearchForm({ className }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => window.clearTimeout(resetTimer.current ?? undefined), [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return

    setIsNavigating(true)
    router.push(
      BARCODE_ONLY.test(value)
        ? `/urun/${value}`
        : `/urunler?q=${encodeURIComponent(value)}`,
    )
    // Gezinme başarısız olursa (çevrimdışı) düğme kilitli kalmasın.
    resetTimer.current = window.setTimeout(() => setIsNavigating(false), 8000)
  }

  return (
    <form
      role="search"
      aria-label="Ürün, marka ya da barkod ara"
      action="/urunler"
      method="get"
      onSubmit={handleSubmit}
      className={cn('flex w-full flex-col gap-3', className)}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="unified-search" className="sr-only">
          Ürün adı, marka ya da barkod
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="unified-search"
            name="q"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün, marka ya da barkod"
            className="h-14 border-2 border-foreground bg-card pr-3 pl-11 text-base shadow-xs placeholder:text-muted-foreground md:text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={isNavigating}
          className="h-14 shrink-0 px-6 text-base font-medium"
        >
          <Search aria-hidden="true" />
          {isNavigating ? 'Aranıyor…' : 'Ara'}
        </Button>
      </div>
      <BarcodeScanButton
        variant="outline"
        size="lg"
        className="h-14 w-full border-2 font-medium sm:w-auto"
      >
        <ScanBarcode aria-hidden="true" />
        Kamerayla tara
      </BarcodeScanButton>
    </form>
  )
}
