'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ImageLightbox } from '@/components/ImageLightbox'
import { cn } from '@/lib/utils'

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
    <div className="flex min-w-0 flex-col gap-2 [container-type:inline-size]">
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
          <Image
            src={current.url}
            alt={current.alt}
            fill
            // Detay sayfasının LCP görseli: ilk fotoğraf öncelikli indirilir.
            priority={safeActive === 0}
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-contain p-6 transition-transform duration-200 group-hover:scale-[1.015]"
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
        <div role="tablist" aria-label="Ürün görselleri" className="product-thumbs">
          {images.map((g, i) => (
            <button
              key={g.url + g.label}
              type="button"
              role="tab"
              aria-selected={i === safeActive}
              aria-label={`Görsel ${i + 1}: ${g.label}`}
              onClick={() => setActive(i)}
              className={cn(
                'relative overflow-hidden rounded-sm border bg-card transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                i === safeActive
                  ? 'border-2 border-stamp'
                  : 'border-border hover:border-foreground/50',
              )}
            >
              {/* Küçük türev: 80 px kutuya 48–96 px arası optimize dosya yeter. */}
              <Image
                src={g.url}
                alt=""
                fill
                quality={60}
                sizes="80px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}

      {/* Tam ekran görsel görüntüleyici: mobildeki diyaloğun web karşılığı. */}
      <ImageLightbox
        images={images}
        index={safeActive}
        onIndexChange={setActive}
        open={zoomed}
        onOpenChange={setZoomed}
      />
    </div>
  )
}
