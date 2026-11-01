'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export type GalleryImage = { url: string; alt: string; label: string }

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
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
      <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <span
          className="pointer-events-none absolute -top-2 left-1/2 z-10 h-4 w-20 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`${current.label} görselini tam boyut aç`}
          className="group absolute inset-0 z-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ring"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            className="size-full p-6 object-contain transition-transform duration-200 group-hover:scale-[1.015]"
          />
        </button>

        <span className="pointer-events-none absolute bottom-2 left-2 z-20 rounded-sm bg-foreground/80 px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.14em] text-background uppercase">
          {safeActive + 1}/{images.length} · {current.label}
        </span>

        {images.length > 1 && (
          <div className="absolute right-2 bottom-2 z-20 flex gap-1">
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
                'relative aspect-square w-16 shrink-0 overflow-hidden rounded-sm border bg-card transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:w-20',
                i === safeActive
                  ? 'border-2 border-stamp'
                  : 'border-border hover:border-foreground/50',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt="" className="absolute inset-0 size-full p-1 object-contain" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] w-auto max-w-[calc(100vw-2rem)] gap-3 overflow-hidden bg-card p-3 sm:max-w-[min(1100px,92vw)]"
        >
          <DialogTitle className="sr-only">
            {current.label} görseli — {safeActive + 1}/{images.length}
          </DialogTitle>
          <DialogDescription className="sr-only">Tam boyut görsel görünümü.</DialogDescription>

          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-[78vh] w-auto max-w-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{current.label}</p>
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                {safeActive + 1}/{images.length}
              </p>
            </div>
            {images.length > 1 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Önceki görsel"
                  onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
                  className="flex size-10 items-center justify-center rounded-sm border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Sonraki görsel"
                  onClick={() => setActive((i) => (i + 1) % images.length)}
                  className="flex size-10 items-center justify-center rounded-sm border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
