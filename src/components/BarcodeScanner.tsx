'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode'
import { Focus, Minimize2, X, Zap, ZapOff } from 'lucide-react'
import { toast } from 'sonner'
import { Barcode } from '@/components/Barcode'
import { CaseCard } from '@/components/CaseCard'
import { VerdictStamp } from '@/components/VerdictStamp'
import { EvidenceTag } from '@/components/EvidenceTag'
import { Button } from '@/components/ui/button'

/**
 * Tarama ayarları:
 *
 * - `qrbox` yok: önizleme artık kırpılmadan gösterildiği için kutu, karenin
 *   kendisinden başka bir şeyi kırpmıyordu.
 * - `aspectRatio` yok: tarayıcı akışı istenen orana KIRPARAK uyarlıyor; dikey
 *   telefonda bu, sensörün görüş açısını ~3× yakınlaştırıyordu. Akışın doğal
 *   oranı korunur, görüntü kırpılmadan ekrana sığdırılır (bkz. index.css
 *   `.scanner-fullscreen video`).
 * - Yalnız genişlik istenir: genişlik + yükseklik birlikte istenirse tarayıcı
 *   yine o orana kırpar; yükseklik cihazın doğal oranından gelir.
 */
const SCAN_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'QR_CODE'] as const

/** DOM `MediaTrackCapabilities` tipinde tanımlı olmayan cihaz yetenekleri. */
type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean | boolean[]
  focusMode?: string[]
  zoom?: { min: number; max: number; step?: number }
}

const SCAN_CONFIG = {
  fps: 10,
  videoConstraints: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
  } as MediaTrackConstraints,
}

const ICON_BUTTON_CLASS =
  'pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-white outline-offset-2 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white'

type BarcodeScannerProps = {
  /** Katmanı kapatan geri çağırma: kamera durdurulur, açan yüzey bağlantıyı sıfırlar. */
  onClose: () => void
}

export default function BarcodeScanner({ onClose }: BarcodeScannerProps) {
  const router = useRouter()
  const scannerRef = useRef<Html5QrcodeInstance | null>(null)
  /** İlk okumadan sonra kilitlenir: kamera durana kadar gelen kareler yok sayılır. */
  const scanLock = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor…')
  /** Okunan barkod: dolu olduğunda "tarama tamamlandı" katmanı gösterilir. */
  const [scanned, setScanned] = useState<string | null>(null)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [focusSupported, setFocusSupported] = useState(false)
  const [zoomSupported, setZoomSupported] = useState(false)

  /**
   * Tarayıcıyı durdurur. html5-qrcode zaten durmuş tarayıcı için hata fırlatır
   * (bileşen kaldırılırken ve başarılı okumadan sonra iki kez çağrılabiliyor);
   * temizlik yolunda bu hata konsola düşmemeli.
   */
  const stopScanner = async () => {
    try {
      await scannerRef.current?.stop()
    } catch {
      // tarayıcı zaten durmuş
    }
    setTorchOn(false)
  }

  /**
   * `torch`/`focusMode`/`zoom` gibi gelişmiş kısıtları `advanced` içinde uygular
   * (masaüstü tarayıcıların uyguladığı tek biçim). Desteklenmeyen cihazda
   * `applyConstraints` reddeder; çağıranlar bunu yakalar.
   */
  const applyAdvanced = async (
    scanner: Html5QrcodeInstance,
    constraints: Record<string, unknown>,
  ) => {
    await scanner.applyVideoConstraints({
      advanced: [constraints],
    } as unknown as MediaTrackConstraints)
  }

  /**
   * Tarama başladıktan sonra cihazın yeteneklerini okur ve kamerayı geniş açıya
   * çeker: bazı cihazlar dijital zoom'la açıldığı için görüntü yakın görünür.
   */
  const syncCameraFeatures = async (scanner: Html5QrcodeInstance) => {
    try {
      const capabilities = scanner.getRunningTrackCapabilities() as CameraCapabilities
      const settings = scanner.getRunningTrackSettings() as MediaTrackSettings & {
        zoom?: number
      }
      const torch = capabilities.torch
      setTorchSupported(torch === true || (Array.isArray(torch) && torch.includes(true)))
      setFocusSupported(
        Array.isArray(capabilities.focusMode) &&
          (capabilities.focusMode.includes('continuous') ||
            capabilities.focusMode.includes('single-shot')),
      )
      setZoomSupported(typeof capabilities.zoom?.min === 'number')
      if (typeof capabilities.zoom?.min === 'number' && settings.zoom !== capabilities.zoom.min) {
        await applyAdvanced(scanner, { zoom: capabilities.zoom.min })
      }
    } catch (err) {
      // Yetenek API'si olmayan tarayıcılarda önizleme yine çalışır.
      console.warn('Kamera yetenekleri okunamadı:', err)
    }
  }

  const toggleTorch = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    const next = !torchOn
    try {
      await applyAdvanced(scanner, { torch: next })
      setTorchOn(next)
    } catch {
      setTorchSupported(false)
      toast.error('Flaş açılamadı: bu tarayıcı kameranın flaşını denetlemiyor.')
    }
  }

  const resetZoom = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      const capabilities = scanner.getRunningTrackCapabilities() as CameraCapabilities
      if (typeof capabilities.zoom?.min !== 'number') return
      await applyAdvanced(scanner, { zoom: capabilities.zoom.min })
      setCameraStatus('Geniş açı — barkodu kameraya göster.')
    } catch {
      toast.error('Yakınlaştırma ayarlanamadı.')
    }
  }

  const refocus = async () => {
    const scanner = scannerRef.current
    if (!scanner) return
    try {
      const capabilities = scanner.getRunningTrackCapabilities() as CameraCapabilities
      const focusModes = capabilities.focusMode ?? []
      const focusMode = focusModes.includes('continuous') ? 'continuous' : 'single-shot'
      if (!focusModes.includes(focusMode)) {
        setFocusSupported(false)
        toast.error('Odak ayarlanamadı: kamera otomatik odak denetimini sunmuyor.')
        return
      }
      setCameraStatus('Odaklanıyor…')
      await applyAdvanced(scanner, { focusMode })
      setCameraStatus('Odaklandı — barkodu kameraya göster.')
    } catch {
      setCameraStatus('Hazır — barkodu kameraya göster.')
      toast.error('Odak ayarlanamadı. Kamerayı barkodun üstünde tutup tekrar dene.')
    }
  }

  /** Taramayı başlatır; ardından flaş/odak/zoom durumunu eşitler. */
  const startScanner = async (scanner: Html5QrcodeInstance) => {
    await scanner.start(
      { facingMode: 'environment' },
      SCAN_CONFIG,
      (decodedText: string) => {
        handleBarcodeScanned(decodedText)
      },
      (errorMessage: string) => {
        if (!errorMessage.includes('No MultiFormat Readers')) {
          console.warn(errorMessage)
        }
      },
    )
    await syncCameraFeatures(scanner)
    setCameraStatus('Hazır — barkodu kameraya göster.')
    setError('')
  }

  /** Katmanı kapatır: kamera durur, açan sayfa olduğu gibi kalır. */
  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void handleClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const initScanner = async () => {
      try {
        setCameraStatus('Kamera izni isteniyor…')
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop())

        setCameraStatus('Tarayıcı hazırlanıyor…')
        // html5-qrcode tarayıcı API'lerine dokunur: SSR kapalı olduğundan ve ilk
        // yükleme maliyeti tarama dışında ödenmesin diye izinden sonra yüklenir.
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        const formats = SCAN_FORMATS.map((name) => Html5QrcodeSupportedFormats[name])
        scannerRef.current = new Html5Qrcode('reader', {
          verbose: false,
          formatsToSupport: formats.length > 0 ? formats : undefined,
        })
        setIsReady(true)
        setCameraStatus('Hazır — barkodu kameraya göster.')
      } catch (err) {
        console.error('Başlangıç hatası:', err)
        setCameraStatus('Kamera açılamadı.')
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setError('Kamera izni verilmedi. Tarayıcı ayarlarından bu siteye kamera izni ver.')
        } else if (err instanceof Error && err.name === 'NotFoundError') {
          setError('Kamera bulunamadı. Cihaza bir kamera bağlı olduğundan emin ol.')
        } else {
          setError('Kamera açılamadı. Sayfayı yenileyip tekrar dene.')
        }
      }
    }

    initScanner()

    return () => {
      if (scannerRef.current) {
        void stopScanner()
      }
    }
  }, [])

  // Tam ekran katmanı açıkken sayfa arkada kaymasın.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  /**
   * İlk okumada kamera durur ve "tarama tamamlandı" katmanı açılır.
   *
   * Eşleştirme burada YAPILMAZ: `/urun/<barkod>` rotası yayında dosya varsa ürünü,
   * yoksa katkı formunu kendisi açar (ADR 0024). Eski akış önce bir sunucu eylemiyle
   * "ürün var mı" sorguluyor, ancak ondan sonra yönlendiriyordu; bu, sayfa açılmadan
   * önce fazladan bir sunucu turu (~0,4 sn) harcıyor ve o sırada kamera taramaya devam
   * ettiği için aynı barkod birden çok kez okunuyordu.
   */
  const handleBarcodeScanned = (decoded: string) => {
    if (scanLock.current) return

    const digits = decoded.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 14) {
      // Okuyucu nadiren barkod olmayan metin üretir; tarama kesilmeden devam etsin.
      toast.error('Barkod okunamadı — barkodun tamamı çerçevede olsun.')
      return
    }

    scanLock.current = true
    setScanned(digits)
    setCameraStatus('Tarama tamamlandı — yönlendiriliyorsunuz…')
    void stopScanner()
    // Dokunsal onay: kamera durduğu hâlde ekranın değişmediği izlenimini kırar.
    if (typeof navigator.vibrate === 'function') navigator.vibrate([35, 40, 60])
    router.push(`/urun/${digits}`)
  }

  useEffect(() => {
    const scanner = scannerRef.current
    if (!isReady || !scanner) return

    const start = async () => {
      try {
        await startScanner(scanner)
      } catch (err) {
        console.error('Kamera başlatma hatası:', err)
        setError('Kamera başlatılamadı. Kamera iznini kontrol edip tekrar dene.')
      }
    }

    void start()

    return () => {
      if (scannerRef.current) {
        void stopScanner()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Barkod tarama"
      className="fixed inset-0 z-[60] overflow-hidden overscroll-none bg-black touch-none"
    >
      {/* Kamera sahnesi: html5-qrcode <video> öğesini buraya enjekte eder. */}
      <div id="reader" className="scanner-fullscreen absolute inset-0" />

      {/* Üst şerit: durum + kamera kontrolleri + katmanı kapat */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
        <div className="flex min-w-0 flex-1 items-center gap-3 self-center">
          <span className="truncate font-mono text-xs tracking-[0.18em] text-white/85 uppercase [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
            {cameraStatus}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isReady && torchSupported ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? 'Flaşı kapat' : 'Flaşı aç'}
              aria-pressed={torchOn}
              className={`${ICON_BUTTON_CLASS} ${torchOn ? 'bg-white text-black hover:bg-white/90' : ''}`}
            >
              {torchOn ? (
                <ZapOff className="size-5" aria-hidden="true" />
              ) : (
                <Zap className="size-5" aria-hidden="true" />
              )}
            </button>
          ) : null}
          {isReady && focusSupported ? (
            <button
              type="button"
              onClick={refocus}
              aria-label="Odağı yenile"
              className={ICON_BUTTON_CLASS}
            >
              <Focus className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          {isReady && zoomSupported ? (
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Geniş açıya dön"
              className={ICON_BUTTON_CLASS}
            >
              <Minimize2 className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Taramayı kapat"
            className={ICON_BUTTON_CLASS}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Okuma anı: kamera durduruldu, hedef sayfa hazırlanıyor. Katman yönlendirme
          tamamlanana kadar açık kalır (eski sayfa RSC yanıtı gelene kadar görünür),
          böylece kullanıcı "okumadı" sanıp barkodu tekrar taramaz. */}
      {scanned ? (
        <div
          role="status"
          aria-live="assertive"
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/85 px-5 backdrop-blur-sm"
        >
          <CaseCard tape className="w-full max-w-sm bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <VerdictStamp variant="safe">Okundu</VerdictStamp>
              <span className="flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
                <span
                  aria-hidden="true"
                  className="size-3.5 animate-spin rounded-full border-2 border-border border-b-foreground motion-reduce:animate-none"
                />
                Yönlendiriliyorsunuz…
              </span>
            </div>

            <h2 className="mt-3 font-display text-xl text-foreground">Tarama tamamlandı</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Barkod okundu, ürün dosyası açılıyor.
            </p>

            <Barcode
              value={scanned}
              height={44}
              className="mt-4 w-full"
              barClassName="text-foreground/85"
              digitsClassName="text-xs tracking-[0.3em] text-foreground"
            />

            <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                aria-hidden="true"
                className="block h-full w-1/3 animate-pulse rounded-full bg-stamp motion-reduce:animate-none"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="mt-3 px-0 text-xs text-muted-foreground"
            >
              Kapat
            </Button>
          </CaseCard>
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 px-5 py-24">
          <div className="flex w-full max-w-sm flex-col items-start gap-4 rounded-md border border-border bg-card p-5 shadow-lg">
            <VerdictStamp variant="danger">Hata</VerdictStamp>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Tekrar dene
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="animate-scanline pointer-events-none absolute inset-x-6 top-0 z-10 hidden h-0.5 bg-gradient-to-r from-transparent via-stamp to-transparent lg:block [--scan-height:100svh]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pt-12 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
            <EvidenceTag
              variant="tape"
              className="border-tape-yellow/70 bg-black/55 text-white"
            >
              Barkodun tamamı görünsün
            </EvidenceTag>
            <p className="max-w-sm text-xs text-white/75">
              Ürün kayıtlıysa dosyası açılır; kayıtlı değilse ilk dosyayı sen açarsın.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
