'use client'

import Image from 'next/image'
import { Play } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'

/**
 * Ana sayfa tanıtım filmi.
 *
 * Remotion ile çizilen uygulama demosu HyperFrames'te film hâline getirilip tek MP4
 * olarak yayınlanır; açık ve koyu tema için ayrı filmler vardır. İki <video> birlikte
 * basılır, görünürlüğü CSS belirler (`dark:` varyantı): tema sınıfı hidrasyondan önce
 * yazıldığı için yanlış temanın bir karesi bile görünmez. Oynatma yalnız aktif olan
 * öğede başlar, diğeri duraklatılır; `preload="none"` sayesinde görünmeyen dosya
 * indirilmez.
 *
 * Performans sözleşmesi:
 * - Afiş, <video poster> yerine next/image ile basılır: 1280 px'te 75 KB'lık JPG yerine
 *   ~28 KB AVIF iner, `priority` sayesinde LCP'yi erkenden tetikler ve videonun altında
 *   katman olarak durur (oynatma başlayınca video onu örter).
 * - Koyu tema afişi `loading="lazy"` + `dark:` ile gizli durur; kullanıcı koyu temaya
 *   geçmedikçe indirilmez (eskiden iki afiş birlikte iniyordu).
 * - Video, sayfanın `load` olayından ve tarayıcı boştayken başlar: 1,5 MB'lık dosya
 *   LCP ve fontlarla bant genişliği yarışına girmez.
 * - Tasarruflu veri ya da 2G/3G bağlantıda kendiliğinden oynatılmaz; afiş kalır,
 *   kullanıcı düğmeyle başlatır.
 * - Hareket azaltma tercihi açıksa ya da tarayıcı oynatmayı reddederse video
 *   kendiliğinden başlamaz: afiş görünür ve kullanıcı düğmeyle başlatır.
 */
const SOURCES = {
  light: {
    video: '/video/barkod-dedektifi-tanitim-v5.mp4',
    poster: '/video/barkod-dedektifi-tanitim-v5-poster.jpg',
  },
  dark: {
    video: '/video/barkod-dedektifi-tanitim-v5-dark.mp4',
    poster: '/video/barkod-dedektifi-tanitim-v5-dark-poster.jpg',
  },
} as const

const POSTER_SIZES = '(min-width: 1024px) 620px, 100vw'

const LABEL = 'Barkod Dedektifi tanıtımı: barkodu göster, uzman kurallarının delillerini topla, hükmü gör.'

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

/** Tasarruflu veri ya da yavaş bağlantı: 1,5 MB'lık film kendiliğinden inmez. */
function prefersLightData(): boolean {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (!connection) return false
  if (connection.saveData) return true
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g'
}

/** `load` sonrası tarayıcı boşken çalıştır; desteklenmiyorsa kısa bir gecikmeyle. */
function whenIdle(callback: () => void): () => void {
  if (document.readyState === 'complete') {
    const handle = window.requestIdleCallback?.(callback, { timeout: 2000 })
    if (handle !== undefined) return () => window.cancelIdleCallback?.(handle)
    const timer = window.setTimeout(callback, 200)
    return () => window.clearTimeout(timer)
  }
  let cancel: (() => void) | undefined
  const onLoad = () => {
    cancel = whenIdle(callback)
  }
  window.addEventListener('load', onLoad, { once: true })
  return () => {
    window.removeEventListener('load', onLoad)
    cancel?.()
  }
}

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

    if (reducedMotion || prefersLightData()) {
      active.pause()
      active.currentTime = 0
      setNeedsTap(true)
      return
    }

    // Video ancak sayfa yüklendikten sonra indirilmeye başlar: afiş ve fontlarla
    // bant genişliği yarışına girmez.
    return whenIdle(() => {
      void active.play().then(
        () => setNeedsTap(false),
        () => setNeedsTap(true),
      )
    })
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
      {/* Afiş katmanı videonun ALTINDA durur: kare gelene kadar görünen budur,
          oynatma başlayınca opak video onu kendiliğinden örter (ekran titremesi yok). */}
      <Image
        src={SOURCES.light.poster}
        alt=""
        fill
        priority
        quality={75}
        sizes={POSTER_SIZES}
        className="object-cover dark:hidden"
      />
      {/* Koyu tema afişi yalnız koyu temada görünür; gizliyken indirilmez. */}
      <Image
        src={SOURCES.dark.poster}
        alt=""
        fill
        loading="lazy"
        quality={75}
        sizes={POSTER_SIZES}
        className="hidden object-cover dark:block"
      />

      <video
        ref={lightRef}
        className="absolute inset-0 size-full object-cover dark:hidden"
        muted
        loop
        playsInline
        preload="none"
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
        aria-label={LABEL}
      >
        <source src={SOURCES.dark.video} type="video/mp4" />
      </video>

      {needsTap && (
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
      )}
    </div>
  )
}
