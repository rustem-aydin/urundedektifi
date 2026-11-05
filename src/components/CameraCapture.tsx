'use client'

import { Camera, Check, RotateCcw, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

type Shot = { id: string; file: File; url: string }

type Props = {
  open: boolean
  /** Kalan fotoğraf hakkı: bu sayıya ulaşınca deklanşör kapanır, "Tamam" ile dönülür. */
  max: number
  onClose: () => void
  onDone: (files: File[]) => void
}

const ERRORS: Record<string, string> = {
  NotAllowedError: 'Kamera izni verilmedi. Tarayıcı ayarlarından izin ver ya da galeriden seç.',
  NotFoundError: 'Cihazda kamera bulunamadı. Galeriden fotoğraf seçebilirsin.',
  NotReadableError: 'Kamera başka bir uygulama tarafından kullanılıyor. Kapatıp tekrar dene.',
  OverconstrainedError: 'Kamera bu çözünürlüğü desteklemiyor.',
  SecurityError: 'Kamera yalnız güvenli bağlantıda (https) açılabilir.',
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Kesintisiz kamera: deklanşöre her basışta kare alt şeride eklenir, kamera kapanmaz.
 * "Tamam" çekilen kareleri tek seferde forma aktarır (ADR 0024 katkı akışı).
 * Kamera açılamazsa (masaüstü, izin reddi) kullanıcı galeri yoluna yönlendirilir.
 */
export function CameraCapture({ open, max, onClose, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const [shots, setShots] = useState<Shot[]>([])
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  // Akış yalnız modal açıkken yaşar; kamera değişince yeniden bağlanır.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setReady(false)
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Bu tarayıcı kamerayı desteklemiyor. Galeriden fotoğraf seçebilirsin.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            // Otomatik oynatma engellendi: ilk kare gelene kadar kullanıcı bekler.
          }
        }
      } catch (cause) {
        if (cancelled) return
        const name = cause instanceof DOMException ? cause.name : ''
        setError(ERRORS[name] ?? 'Kamera açılamadı. Galeriden fotoğraf seçebilirsin.')
      }
    })()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, facing, stopStream])

  // Modal yaşam döngüsü: kareleri sıfırla, EKA ile kapat, arka planı kilitle.
  useEffect(() => {
    if (!open) return
    setShots([])
    setError(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      setShots((current) => {
        current.forEach((shot) => URL.revokeObjectURL(shot.url))
        return []
      })
    }
  }, [open])

  const capture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !ready) return
    const width = video.videoWidth
    const height = video.videoHeight
    if (!width || !height) return
    if (shots.length >= max) return
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Bu tarayıcı fotoğrafı işleyemiyor.')
      return
    }
    context.drawImage(video, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) {
      setError('Fotoğraf alınamadı. Tekrar dene.')
      return
    }
    const file = new File([blob], `kamera-${newId()}.jpg`, { type: 'image/jpeg' })
    setShots((current) =>
      current.length >= max
        ? current
        : [...current, { id: newId(), file, url: URL.createObjectURL(blob) }],
    )
  }, [max, ready, shots.length])

  function removeShot(id: string) {
    setShots((current) => {
      const target = current.find((shot) => shot.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((shot) => shot.id !== id)
    })
  }

  function confirm() {
    if (!shots.length) return
    const files = shots.map((shot) => shot.file)
    setShots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.url))
      return []
    })
    onDone(files)
  }

  if (!open) return null

  const full = shots.length >= max

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotoğraf çek"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
    >
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onCanPlay={() => setReady(true)}
          onLoadedMetadata={() => setReady(true)}
          className="size-full object-cover"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <span className="font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            {shots.length}/{max} fotoğraf
          </span>
          <div className="pointer-events-auto flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Ön/arka kamerayı değiştir"
              onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
              className="border-white/40 bg-black/40 text-white hover:bg-black/60 hover:text-white"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Kamerayı kapat"
              onClick={() => closeRef.current()}
              className="border-white/40 bg-black/40 text-white hover:bg-black/60 hover:text-white"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center">
            <p className="max-w-sm text-sm text-white/85">{error}</p>
            <Button type="button" variant="outline" onClick={() => closeRef.current()}>
              Kapat
            </Button>
          </div>
        ) : null}

        {!error && !ready ? (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-xs tracking-[0.14em] uppercase text-white/70">
            Kamera hazırlanıyor…
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/15 bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {shots.length ? (
          <ul className="flex gap-2 overflow-x-auto">
            {shots.map((shot, index) => (
              <li key={shot.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- kamera karesi, sunucu optimizasyonu yok */}
                <img
                  src={shot.url}
                  alt={`Çekilen fotoğraf ${index + 1}`}
                  className="size-16 rounded-sm object-cover"
                />
                <button
                  type="button"
                  aria-label={`Fotoğraf ${index + 1} sil`}
                  onClick={() => removeShot(shot.id)}
                  className="absolute -top-1 -right-1 rounded-full bg-black/80 p-1 text-white shadow"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={!ready || full || Boolean(error)}
            onClick={() => void capture()}
          >
            <Camera aria-hidden="true" />
            {full ? 'Sınır doldu' : 'Fotoğraf çek'}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!shots.length}
            onClick={confirm}
          >
            <Check aria-hidden="true" />
            Tamam{shots.length ? ` (${shots.length})` : ''}
          </Button>
        </div>
        <p className="text-center font-mono text-[0.6rem] tracking-[0.14em] text-white/60 uppercase">
          Deklanşöre her basışta yeni kare eklenir · bitirince Tamam
        </p>
      </div>
    </div>
  )
}
