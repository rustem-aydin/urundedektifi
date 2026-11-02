'use client'

import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'

export type LightboxImage = { url: string; alt: string; label: string }

/**
 * Tam ekran görsel görüntüleyici: ürün galerisi ve inceleme kuyruğu aynı
 * mobil diyaloğu kullanır. Koyu (mürekkep) zemin tüm ekranı kaplar, görsel
 * kendi oranını korur. Görselin dışına tıklamak kapatır.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  images: LightboxImage[]
  index: number
  onIndexChange: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const safeIndex = images[index] ? index : 0
  const current = images[safeIndex]
  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#1c1b17]/95 backdrop-blur-none"
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-none flex-col gap-0 rounded-none bg-[#1c1b17] p-0 text-[#f7f4ee] ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          {current.label} görseli — {safeIndex + 1}/{images.length}
        </DialogTitle>
        <DialogDescription className="sr-only">Tam boyut görsel görünümü.</DialogDescription>

        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[#f7f4ee]/60 uppercase">
              {safeIndex + 1}/{images.length}
            </p>
            <p className="truncate text-sm font-medium">{current.label}</p>
          </div>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => onOpenChange(false)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-[#f7f4ee] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6"
          onClick={(event) => {
            // Görselin dışına (karartıya) tıklamak kapatır; mobildeki davranışla aynı.
            if (event.target === event.currentTarget) onOpenChange(false)
          }}
        >
          {/*
            `fill` + `object-contain`: görsel kendi oranını korur, tam ekranı kaplar.
            `pointer-events-none` görselin altındaki karartıya tıklamayı korur.
          */}
          <Image
            src={current.url}
            alt={current.alt}
            fill
            sizes="100vw"
            className="pointer-events-none object-contain p-3 sm:p-6"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Önceki görsel"
                onClick={() => onIndexChange((safeIndex - 1 + images.length) % images.length)}
                className="absolute top-1/2 left-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-[#f7f4ee] transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-ring sm:left-6"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Sonraki görsel"
                onClick={() => onIndexChange((safeIndex + 1) % images.length)}
                className="absolute top-1/2 right-3 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-[#f7f4ee] transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-ring sm:right-6"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
