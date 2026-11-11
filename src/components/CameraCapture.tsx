'use client'

import {
  Camera,
  Check,
  Focus,
  Grid3x3,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
  ZapOff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

type Shot = { id: string; file: File; url: string }

type Props = {
  open: boolean
  /** Kalan fotoğraf hakkı: bu sayıya ulaşınca deklanşör kapanır, "Tamam" ile dönülür. */
  max: number
  onClose: () => void
  onDone: (files: File[]) => void
}

type Range = { min: number; max: number; step?: number }

/**
 * `MediaTrackCapabilities` DOM tipinde tanımlı olmayan cihaz yetenekleri.
 * Tarayıcılar bu anahtarları yalnız `getCapabilities()` çıktısında verir.
 */
type CameraCapabilities = {
  torch: boolean
  zoom: Range | null
  focusDistance: Range | null
  exposure: Range | null
  focusModes: string[]
}

type FocusPreset = 'auto' | 'macro' | 'manual'

const ERRORS: Record<string, string> = {
  NotAllowedError: 'Kamera izni verilmedi. Tarayıcı ayarlarından izin ver ya da galeriden seç.',
  NotFoundError: 'Cihazda kamera bulunamadı. Galeriden fotoğraf seçebilirsin.',
  NotReadableError: 'Kamera başka bir uygulama tarafından kullanılıyor. Kapatıp tekrar dene.',
  OverconstrainedError: 'Kamera bu çözünürlüğü desteklemiyor.',
  SecurityError: 'Kamera yalnız güvenli bağlantıda (https) açılabilir.',
}

const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-white'
const INACTIVE_BUTTON = 'bg-black/40 text-white hover:bg-black/60'

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Kareyi JPEG'e çevirir; tarayıcı kodlamayı bitirene kadar beklenir. */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

function validRange(range?: Range): Range | null {
  if (!range) return null
  if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) return null
  if (range.max <= range.min) return null
  return range
}

/** Cihazın sunduğu ayarları okur; desteklenmeyen her özellik null kalır ve arayüzde gizlenir. */
function readCapabilities(track: MediaStreamTrack): CameraCapabilities {
  const empty: CameraCapabilities = {
    torch: false,
    zoom: null,
    focusDistance: null,
    exposure: null,
    focusModes: [],
  }
  if (typeof track.getCapabilities !== 'function') return empty
  try {
    const raw = track.getCapabilities() as MediaTrackCapabilities & {
      torch?: boolean
      zoom?: Range
      focusDistance?: Range
      exposureCompensation?: Range
      focusMode?: string[]
    }
    return {
      torch: raw.torch === true,
      zoom: validRange(raw.zoom),
      focusDistance: validRange(raw.focusDistance),
      exposure: validRange(raw.exposureCompensation),
      focusModes: Array.isArray(raw.focusMode) ? raw.focusMode : [],
    }
  } catch {
    // Yetenek API'si olmayan tarayıcılarda önizleme yine çalışır, yalnız ayarlar gizlenir.
    return empty
  }
}

function formatZoom(factor: number): string {
  return `${factor >= 10 ? factor.toFixed(0) : factor.toFixed(1)}×`
}

/**
 * Kesintisiz kamera: deklanşöre her basışta kare alt şeride eklenir, kamera kapanmaz.
 * "Tamam" çekilen kareleri tek seferde forma aktarır (ADR 0024 katkı akışı).
 * Kamera açılamazsa (masaüstü, izin reddi) kullanıcı galeri yoluna yönlendirilir.
 *
 * Tarayıcı taramasındaki kamera kontrolleri (flaş, odak, geniş açı) burada da vardır;
 * ek olarak yakınlaştırma kaydırıcısı, makro odak, pozlama ve kılavuz çizgileri sunulur.
 * Her kontrol cihazın `getCapabilities()` çıktısına göre açılır: desteklenmeyen ayar
 * gizlenir, sahte bir düğme gösterilmez.
 */
export function CameraCapture({ open, max, onClose, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [exposure, setExposure] = useState(0)
  const [focusPreset, setFocusPreset] = useState<FocusPreset>('auto')
  const [focusDistance, setFocusDistance] = useState(0)
  const [proOpen, setProOpen] = useState(false)
  const [grid, setGrid] = useState(false)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    clearTimeout(noticeTimer.current ?? undefined)
    noticeTimer.current = setTimeout(() => setNotice(null), 3500)
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }, [])

  /** Gelişmiş kısıtı çalışan kameraya uygular (tarayıcıdaki tek ortak biçim `advanced`). */
  const applyConstraint = useCallback(
    async (settings: Record<string, unknown>) => {
      const track = streamRef.current?.getVideoTracks()[0]
      if (!track) return false
      try {
        await track.applyConstraints({
          advanced: [settings],
        } as unknown as MediaTrackConstraints)
        return true
      } catch {
        return false
      }
    },
    [],
  )

  // Akış yalnız modal açıkken yaşar; kamera değişince yeniden bağlanır.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setReady(false)
    setCapabilities(null)
    setTorchOn(false)
    setFocusPreset('auto')
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

        const track = stream.getVideoTracks()[0]
        if (!track) return
        const capabilities = readCapabilities(track)
        const settings = track.getSettings() as MediaTrackSettings & {
          zoom?: number
          exposureCompensation?: number
        }
        setCapabilities(capabilities)

        // Geniş açıyla başla: bazı cihazlar önceki zoom'u hatırlayıp yakın açılıyor.
        if (capabilities.zoom) {
          setZoom(capabilities.zoom.min)
          if (settings.zoom !== capabilities.zoom.min) {
            try {
              await track.applyConstraints({
                advanced: [{ zoom: capabilities.zoom.min }],
              } as unknown as MediaTrackConstraints)
            } catch {
              // Geniş açı uygulanamadı: mevcut görüntüyle devam edilir.
            }
          }
        }
        if (capabilities.exposure) {
          const current =
            typeof settings.exposureCompensation === 'number'
              ? settings.exposureCompensation
              : 0
          setExposure(
            Math.min(capabilities.exposure.max, Math.max(capabilities.exposure.min, current)),
          )
        }
        if (capabilities.focusDistance) {
          setFocusDistance(capabilities.focusDistance.min)
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
    setNotice(null)
    setProOpen(false)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      clearTimeout(noticeTimer.current ?? undefined)
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
    const blob = await canvasToBlob(canvas)
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

  const zoomFactor = useMemo(() => {
    if (!capabilities?.zoom || capabilities.zoom.min <= 0) return 1
    return zoom / capabilities.zoom.min
  }, [capabilities, zoom])

  const zoomStep = useMemo(() => {
    const range = capabilities?.zoom
    if (!range) return 1
    return range.step && range.step > 0 ? range.step : (range.max - range.min) / 20
  }, [capabilities])

  const setZoomValue = useCallback(
    (value: number) => {
      const range = capabilities?.zoom
      if (!range) return
      const next = Math.min(range.max, Math.max(range.min, value))
      setZoom(next)
      void applyConstraint({ zoom: next })
    },
    [applyConstraint, capabilities],
  )

  const toggleTorch = useCallback(async () => {
    if (!capabilities?.torch) return
    const next = !torchOn
    const applied = await applyConstraint({ torch: next })
    if (!applied) {
      showNotice('Flaş açılamadı: bu kamera flaşı denetlemiyor.')
      return
    }
    setTorchOn(next)
  }, [applyConstraint, capabilities, showNotice, torchOn])

  const setExposureValue = useCallback(
    (value: number) => {
      setExposure(value)
      void applyConstraint({ exposureCompensation: value })
    },
    [applyConstraint],
  )

  const applyFocus = useCallback(
    async (preset: FocusPreset, distance?: number) => {
      if (!capabilities) return
      if (preset === 'macro') {
        if (!capabilities.focusDistance) {
          showNotice('Bu kamera manuel odak sunmuyor. Makro için kamerayı 5–10 cm yaklaştır.')
          return
        }
        const applied = await applyConstraint({
          focusMode: 'manual',
          focusDistance: capabilities.focusDistance.min,
        })
        if (applied) {
          setFocusPreset('macro')
          setFocusDistance(capabilities.focusDistance.min)
          showNotice('Makro odak: en yakın mesafe kilitlendi.')
        } else {
          showNotice('Makro odak ayarlanamadı.')
        }
        return
      }
      if (preset === 'manual') {
        if (!capabilities.focusDistance || typeof distance !== 'number') return
        setFocusDistance(distance)
        const applied = await applyConstraint({ focusMode: 'manual', focusDistance: distance })
        if (applied) setFocusPreset('manual')
        return
      }
      const applied = await applyConstraint({ focusMode: 'continuous' })
      if (applied) {
        setFocusPreset('auto')
        showNotice('Odak: otomatik.')
      }
    },
    [applyConstraint, capabilities, showNotice],
  )

  /** Manuel odak yoksa bile tek karelik yeniden odaklama çoğu cihazda çalışır. */
  const refocus = useCallback(async () => {
    if (!capabilities) return
    const mode = capabilities.focusModes.includes('single-shot')
      ? 'single-shot'
      : capabilities.focusModes.includes('continuous')
        ? 'continuous'
        : null
    if (!mode) {
      showNotice('Bu kamera odak denetimini sunmuyor.')
      return
    }
    const applied = await applyConstraint({ focusMode: mode })
    showNotice(applied ? 'Odak yenilendi.' : 'Odak yenilenemedi.')
  }, [applyConstraint, capabilities, showNotice])

  if (!open) return null

  const full = shots.length >= max
  const hasPro = Boolean(capabilities?.focusDistance || capabilities?.exposure)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotoğraf çek"
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onCanPlay={() => setReady(true)}
          onLoadedMetadata={() => setReady(true)}
          className="absolute inset-0 size-full object-cover"
        />

        {grid ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <span className="font-mono text-[0.65rem] tracking-[0.14em] uppercase">
            {shots.length}/{max} fotoğraf
          </span>
          <div className="pointer-events-auto flex gap-2">
            {ready && capabilities?.torch ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? 'Flaşı kapat' : 'Flaşı aç'}
                aria-pressed={torchOn}
                className={`${ICON_BUTTON} ${torchOn ? 'bg-white text-black hover:bg-white/90' : INACTIVE_BUTTON}`}
              >
                {torchOn ? (
                  <ZapOff aria-hidden="true" className="size-5" />
                ) : (
                  <Zap aria-hidden="true" className="size-5" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Ön/arka kamerayı değiştir"
              onClick={() => setFacing((current) => (current === 'environment' ? 'user' : 'environment'))}
              className={`${ICON_BUTTON} ${INACTIVE_BUTTON}`}
            >
              <RotateCcw aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Kamerayı kapat"
              onClick={() => closeRef.current()}
              className={`${ICON_BUTTON} ${INACTIVE_BUTTON}`}
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>

        {notice ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-3 top-20 rounded-sm bg-black/70 px-3 py-2 text-center text-xs text-white/90"
          >
            {notice}
          </p>
        ) : null}

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

      <div className="flex max-h-[58svh] flex-col gap-3 overflow-y-auto overscroll-contain border-t border-white/15 bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

        {ready && capabilities?.zoom ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Uzaklaştır"
              onClick={() => setZoomValue(zoom - zoomStep)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <input
              type="range"
              aria-label="Yakınlaştırma"
              min={capabilities.zoom.min}
              max={capabilities.zoom.max}
              step={zoomStep}
              value={zoom}
              onChange={(event) => setZoomValue(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-white"
            />
            <button
              type="button"
              aria-label="Yakınlaştır"
              onClick={() => setZoomValue(zoom + zoomStep)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
            <span className="w-10 shrink-0 text-right font-mono text-xs">
              {formatZoom(zoomFactor)}
            </span>
          </div>
        ) : null}

        {ready ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProOpen((current) => !current)}
              aria-expanded={proOpen}
              className={`flex items-center gap-2 rounded-full px-3 py-2 font-mono text-[0.65rem] tracking-[0.12em] uppercase ${
                proOpen ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Pro çekim
            </button>
            <button
              type="button"
              onClick={refocus}
              aria-label="Odağı yenile"
              className={`${ICON_BUTTON} ${INACTIVE_BUTTON} size-9`}
            >
              <Focus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setGrid((current) => !current)}
              aria-label="Kılavuz çizgileri"
              aria-pressed={grid}
              className={`${ICON_BUTTON} ${grid ? 'bg-white text-black hover:bg-white/90' : INACTIVE_BUTTON} size-9`}
            >
              <Grid3x3 aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : null}

        {ready && proOpen ? (
          <div className="flex flex-col gap-3 rounded-md border border-white/15 bg-black/60 p-3">
            {capabilities?.exposure ? (
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] uppercase text-white/70">
                  <span>Pozlama</span>
                  <span>
                    {exposure > 0 ? '+' : ''}
                    {exposure.toFixed(1)}
                  </span>
                </span>
                <input
                  type="range"
                  aria-label="Pozlama düzeltmesi"
                  min={capabilities.exposure.min}
                  max={capabilities.exposure.max}
                  step={capabilities.exposure.step && capabilities.exposure.step > 0 ? capabilities.exposure.step : 0.1}
                  value={exposure}
                  onChange={(event) => setExposureValue(Number(event.target.value))}
                  className="h-1.5 cursor-pointer accent-white"
                />
              </label>
            ) : null}

            {capabilities?.focusDistance ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void applyFocus('auto')}
                    aria-pressed={focusPreset === 'auto'}
                    className={`rounded-full px-3 py-1.5 font-mono text-[0.65rem] uppercase ${
                      focusPreset === 'auto' ? 'bg-white text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    Otomatik
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyFocus('macro')}
                    aria-pressed={focusPreset === 'macro'}
                    className={`rounded-full px-3 py-1.5 font-mono text-[0.65rem] uppercase ${
                      focusPreset === 'macro' ? 'bg-white text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    Makro
                  </button>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] uppercase text-white/70">
                    <span>Odak</span>
                    <span>Yakın ⇠ ⇢ Uzak</span>
                  </span>
                  <input
                    type="range"
                    aria-label="Odak mesafesi"
                    min={capabilities.focusDistance.min}
                    max={capabilities.focusDistance.max}
                    step={capabilities.focusDistance.step && capabilities.focusDistance.step > 0 ? capabilities.focusDistance.step : 0.1}
                    value={focusDistance}
                    onChange={(event) => void applyFocus('manual', Number(event.target.value))}
                    className="h-1.5 cursor-pointer accent-white"
                  />
                </label>
              </div>
            ) : (
              <p className="text-xs text-white/70">
                Bu kamera manuel odak sunmuyor. Makro çekim için telefonu 5–10 cm yaklaştır;
                otomatik odak devreye girer. Işığı arkandan ver, etikete gölge düşürme.
              </p>
            )}

            <p className="font-mono text-[0.6rem] tracking-[0.12em] text-white/50 uppercase">
              {hasPro
                ? 'Ayarlar çekilen kareye uygulanır'
                : 'Cihazın sunduğu ayarlar gösterilir'}
            </p>
          </div>
        ) : null}

        <p className="text-center font-mono text-[0.6rem] tracking-[0.14em] text-white/60 uppercase">
          Deklanşöre her basışta yeni kare eklenir · bitirince Tamam
        </p>

        <div className="sticky bottom-0 flex gap-2 bg-black/80">
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
      </div>
    </div>
  )
}
