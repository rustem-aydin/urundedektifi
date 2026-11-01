'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

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

      {/* Tam ekran görsel görüntüleyici: mobildeki diyaloğun web karşılığı.
          Koyu (mürekkep) zemin tüm ekranı kaplar, görsel kendi oranını korur. */}
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-[#1c1b17]/95 backdrop-blur-none"
          className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-none flex-col gap-0 rounded-none bg-[#1c1b17] p-0 text-[#f7f4ee] ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">
            {current.label} görseli — {safeActive + 1}/{images.length}
          </DialogTitle>
          <DialogDescription className="sr-only">Tam boyut görsel görünümü.</DialogDescription>

          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[#f7f4ee]/60 uppercase">
                {safeActive + 1}/{images.length}
              </p>
              <p className="truncate text-sm font-medium">{current.label}</p>
            </div>
            <button
              type="button"
              aria-label="Kapat"
              onClick={() => setZoomed(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-[#f7f4ee] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6"
            onClick={(event) => {
              // Görselin dışına (karartıya) tıklamak kapatır; mobildeki davranışla aynı.
              if (event.target === event.currentTarget) setZoomed(false)
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-full max-w-full object-contain"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Önceki görsel"
                  onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
                  className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-[#f7f4ee] transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-ring sm:left-6"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Sonraki görsel"
                  onClick={() => setActive((i) => (i + 1) % images.length)}
                  className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-[#f7f4ee] transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-ring sm:right-6"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
