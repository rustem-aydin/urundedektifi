'use client'

import { Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Ana sayfa tanıtım videosu.
 *
 * Remotion ile çizilen uygulama demosu HyperFrames'te film hâline getirilip tek MP4
 * olarak yayınlanır. Video sessizdir; bu yüzden otomatik oynatma tarayıcı tarafından
 * engellenmez. Hareket azaltma tercihi açıksa ya da tarayıcı oynatmayı reddederse
 * video kendiliğinden başlamaz: afiş görünür ve kullanıcı düğmeyle başlatır.
 */
const VIDEO_BASE = '/video/barkod-dedektifi-tanitim-v2'
const POSTER = `${VIDEO_BASE}-poster.jpg`

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      if (query.matches) {
        video.pause()
        setNeedsTap(true)
        return
      }
      void video.play().then(
        () => setNeedsTap(false),
        () => setNeedsTap(true),
      )
    }

    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  const start = () => {
    const video = videoRef.current
    if (!video) return
    void video.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true),
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-foreground/5">
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        poster={POSTER}
        aria-label="Barkod Dedektifi tanıtımı: barkodu göster, uzman kurallarının delillerini topla, hükmü gör."
      >
        <source src={`${VIDEO_BASE}.mp4`} type="video/mp4" />
      </video>
      {needsTap && (
        <>
          {/* Duraklatılmış videonun ilk karesi boş kâğıttır; afiş onun yerine ne olduğunu anlatır. */}
          <img src={POSTER} alt="" className="absolute inset-0 size-full object-cover" />
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
