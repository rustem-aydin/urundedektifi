'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export type GalleryImage = { url: string; alt: string; label: string }

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0)
  const safeActive = images[active] ? active : 0
  const current = images[safeActive]

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-md border border-border bg-card shadow-sm">
        <span className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
          Görsel yok
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex aspect-square items-center justify-center rounded-md border border-border bg-card p-6 shadow-sm">
        <span
          className="absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs"
          aria-hidden="true"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.alt} className="max-h-full w-auto object-contain" />

        <span className="absolute bottom-2 left-2 rounded-sm bg-foreground/80 px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.14em] text-background uppercase">
          {safeActive + 1}/{images.length} · {current.label}
        </span>

        {images.length > 1 && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <button
              type="button"
              aria-label="Önceki görsel"
              onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
              className="flex size-11 items-center justify-center rounded-sm border border-border bg-background/90 text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:size-8"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Sonraki görsel"
              onClick={() => setActive((i) => (i + 1) % images.length)}
              className="flex size-11 items-center justify-center rounded-sm border border-border bg-background/90 text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:size-8"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Ürün görselleri"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {images.map((g, i) => (
            <button
              key={g.url + g.label}
              type="button"
              role="tab"
              aria-selected={i === safeActive}
              aria-label={`Görsel ${i + 1}: ${g.label}`}
              onClick={() => setActive(i)}
              className={cn(
                'flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-card p-1 transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:w-20',
                i === safeActive
                  ? 'border-2 border-stamp'
                  : 'border-border hover:border-foreground/50',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt="" className="max-h-full w-auto object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
