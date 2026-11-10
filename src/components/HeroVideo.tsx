'use client'

import { Play } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'

/**
 * Ana sayfa tanıtım videosu.
 *
 * Remotion ile çizilen uygulama demosu HyperFrames'te film hâline getirilip tek MP4
 * olarak yayınlanır; açık ve koyu tema için ayrı filmler vardır. İki <video> birlikte
 * basılır, görünürlüğü CSS belirler (`dark:` varyantı): tema sınıfı hidrasyondan önce
 * yazıldığı için yanlış temanın bir karesi bile görünmez. Oynatma yalnız aktif olan
 * öğede başlar, diğeri duraklatılır; `preload="none"` sayesinde görünmeyen dosya
 * indirilmez.
 *
 * Video sessizdir; bu yüzden otomatik oynatma tarayıcı tarafından engellenmez. Hareket
 * azaltma tercihi açıksa ya da tarayıcı oynatmayı reddederse video kendiliğinden
 * başlamaz: afiş görünür ve kullanıcı düğmeyle başlatır.
 */
const SOURCES = {
  light: {
    video: '/video/barkod-dedektifi-tanitim-v3.mp4',
    poster: '/video/barkod-dedektifi-tanitim-v3-poster.jpg',
  },
  dark: {
    video: '/video/barkod-dedektifi-tanitim-v3-dark.mp4',
    poster: '/video/barkod-dedektifi-tanitim-v3-dark-poster.jpg',
  },
} as const

const LABEL = 'Barkod Dedektifi tanıtımı: barkodu göster, uzman kurallarının delillerini topla, hükmü gör.'

export function HeroVideo() {
  const lightRef = useRef<HTMLVideoElement>(null)
  const darkRef = useRef<HTMLVideoElement>(null)
  const [needsTap, setNeedsTap] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // next-themes temayı hidrasyondan sonra açar; o ana kadar beklenir.
    if (!resolvedTheme) return
    const active = resolvedTheme === 'dark' ? darkRef.current : lightRef.current
    const inactive = resolvedTheme === 'dark' ? lightRef.current : darkRef.current
    inactive?.pause()
    if (!active) return

    if (reducedMotion) {
      active.pause()
      active.currentTime = 0
      setNeedsTap(true)
      return
    }

    void active.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true),
    )
  }, [resolvedTheme, reducedMotion])

  const start = () => {
    const active = resolvedTheme === 'dark' ? darkRef.current : lightRef.current
    if (!active) return
    void active.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true),
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-foreground/5">
      <video
        ref={lightRef}
        className="absolute inset-0 size-full object-cover dark:hidden"
        muted
        loop
        playsInline
        preload="none"
        poster={SOURCES.light.poster}
        aria-label={LABEL}
      >
        <source src={SOURCES.light.video} type="video/mp4" />
      </video>
      <video
        ref={darkRef}
        className="absolute inset-0 hidden size-full object-cover dark:block"
        muted
        loop
        playsInline
        preload="none"
        poster={SOURCES.dark.poster}
        aria-label={LABEL}
      >
        <source src={SOURCES.dark.video} type="video/mp4" />
      </video>

      {needsTap && (
        <>
          {/* Duraklatılmış videonun ilk karesi boş kâğıttır; afiş onun yerine ne olduğunu anlatır. */}
          <img
            src={SOURCES.light.poster}
            alt=""
            className="absolute inset-0 size-full object-cover dark:hidden"
          />
          <img
            src={SOURCES.dark.poster}
            alt=""
            className="absolute inset-0 hidden size-full object-cover dark:block"
          />
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 flex items-center justify-center bg-foreground/15 transition-colors hover:bg-foreground/25"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-card text-foreground shadow-md">
              <Play className="size-5 translate-x-px" aria-hidden="true" />
            </span>
            <span className="sr-only">Tanıtım videosunu oynat</span>
          </button>
        </>
      )}
    </div>
  )
}
