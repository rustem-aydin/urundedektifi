'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { getProduct } from '@/actions/product'
import { VerdictStamp } from '@/components/VerdictStamp'
import { EvidenceTag } from '@/components/EvidenceTag'
import { Button } from '@/components/ui/button'
export const dynamic = 'force-dynamic'

/**
 * Tarama ayarları — 1D barkodlar (EAN-13) için kritik:
 *
 * Sabit `qrbox` (ör. 250×250) çerçeveyi ortadan kırpıyor; EAN-13'ün 95 modülü
 * o pencereye sığmadığı için hiçbir kare çözülemiyordu (izin verilse bile
 * tarama sessizce başarısız). Kamera görüntüsünün %90'ı taranır, yükseklik
 * manzara/dikey orana göre daraltılır.
 */
const SCAN_FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'QR_CODE'] as const

const SCAN_CONFIG = {
  fps: 10,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => ({
    width: Math.round(viewfinderWidth * 0.9),
    height: Math.round(
      viewfinderHeight * (viewfinderWidth >= viewfinderHeight ? 0.6 : 0.45),
    ),
  }),
}

/**
 * Önizleme tam ekranı kapladığı için akışı ekran oranına yakın iste: oran
 * tutmazsa görüntü `object-fit: cover` ile kırpılır ve barkod sensörde
 * göründüğünden küçük kalır (dikey telefonda ~3× kayıp).
 */
function scanConfig() {
  return { ...SCAN_CONFIG, aspectRatio: window.innerWidth / window.innerHeight }
}

export default function BarcodeScanner() {
  const router = useRouter()
  const scannerRef = useRef<Html5QrcodeInstance | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor…')
  const [isChecking, setIsChecking] = useState(false)

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
  }

  /** Tam ekran tarayıcıdan çıkış: kamera kapatılır, kullanıcı geldiği yere döner. */
  const handleClose = async () => {
    await stopScanner()
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

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

  const handleBarcodeScanned = async (barcodeText: string) => {
    try {
      setIsChecking(true)
      setCameraStatus('Barkod sorgulanıyor…')

      const barcodeNumber = parseInt(barcodeText, 10)

      if (isNaN(barcodeNumber)) {
        setError('Geçersiz barkod biçimi.')
        setIsChecking(false)
        return
      }

      const found = await getProduct(barcodeNumber)

      await stopScanner()

      if (found) {
        setCameraStatus('Ürün bulundu.')
        toast.success('Ürün bulundu — dosyası açılıyor.')
        router.push(`/urun/${barcodeText}`)
      } else {
        // Tek yol her rol için aynı: ürün fotoğrafla katkı olarak açılır (ADR 0026).
        setCameraStatus('Ürün bulunamadı — katkı ekranı açılıyor.')
        toast.message('Ürün bulunamadı — dosyasını sen aç.')
        router.push(`/katki/${encodeURIComponent(barcodeText)}`)
      }
    } catch (error) {
      console.error('Sorgulama hatası:', error)
      setError('Ürün sorgulanamadı. Tekrar dene.')
      setCameraStatus('Sorgu başarısız; tarayıcı yeniden başlatılıyor…')
      toast.error('Ürün sorgulanamadı. Tekrar dene.')

      setTimeout(() => {
        if (scannerRef.current && isReady) {
          restartScanner()
        }
      }, 2000)
    } finally {
      setIsChecking(false)
    }
  }

  const restartScanner = async () => {
    if (!scannerRef.current) return

    try {
      await scannerRef.current.start(
        { facingMode: 'environment' },
        scanConfig(),
        (decodedText: string) => {
          handleBarcodeScanned(decodedText)
        },
        (errorMessage: string) => {
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.warn(errorMessage)
          }
        },
      )
      setCameraStatus('Hazır — barkodu kameraya göster.')
      setError('')
    } catch (err) {
      console.error('Yeniden başlatma hatası:', err)
    }
  }

  useEffect(() => {
    const scanner = scannerRef.current
    if (!isReady || !scanner) return

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          scanConfig(),
          (decodedText: string) => {
            handleBarcodeScanned(decodedText)
          },
          (errorMessage: string) => {
            if (!errorMessage.includes('No MultiFormat Readers')) {
              console.warn(errorMessage)
            }
          },
        )
      } catch (err) {
        console.error('Kamera başlatma hatası:', err)
        setError('Kamera başlatılamadı. Kamera iznini kontrol edip tekrar dene.')
      }
    }

    startScanner()

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

      {/* Üst şerit: durum + tam ekrandan çıkış */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/75 via-black/35 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
        <div className="flex min-w-0 flex-1 items-center gap-3 self-center">
          <span className="truncate font-mono text-xs tracking-[0.18em] text-white/85 uppercase [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
            {cameraStatus}
          </span>
          {isChecking ? (
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-b-white" />
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Taramayı kapat"
          className="pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-white outline-offset-2 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

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
            className="animate-scanline pointer-events-none absolute inset-x-6 top-0 z-10 h-0.5 bg-gradient-to-r from-transparent via-stamp to-transparent [--scan-height:100svh]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pt-12 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
            <EvidenceTag variant="tape">Barkodu çerçeveye getir</EvidenceTag>
            <p className="max-w-sm text-xs text-white/75">
              Ürün kayıtlıysa dosyası açılır; kayıtlı değilse ilk dosyayı sen açarsın.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
