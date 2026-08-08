'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getProduct } from '@/actions/product'
import { GeneratedForm } from './AddProduct'
import { VerdictStamp } from '@/components/VerdictStamp'
import { EvidenceTag } from '@/components/EvidenceTag'
import { Button } from '@/components/ui/button'
export const dynamic = 'force-dynamic'

export default function BarcodeScanner() {
  const router = useRouter()
  const scannerRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor...')
  const [isChecking, setIsChecking] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string>('')
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    let Html5QrcodeModule: any

    const initScanner = async () => {
      try {
        setCameraStatus('Kamera izni isteniyor...')
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop())

        setCameraStatus('Kütüphane yükleniyor...')
        const module = await import('html5-qrcode')
        Html5QrcodeModule = module.Html5Qrcode
        scannerRef.current = new Html5QrcodeModule('reader')
        setIsReady(true)
        setCameraStatus('Hazır, barkod okumaya hazır...')
      } catch (err: any) {
        console.error('Başlangıç hatası:', err)
        if (err.name === 'NotAllowedError') {
          setError('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından kamera izni verin.')
        } else if (err.name === 'NotFoundError') {
          setError('Kamera bulunamadı. Bilgisayarınıza bir kamera bağlı olduğundan emin olun.')
        } else {
          setError(`Kamera hatası: ${err.message}`)
        }
      }
    }

    initScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const handleBarcodeScanned = async (barcodeText: string) => {
    try {
      setIsChecking(true)
      setCameraStatus('Barkod sorgulanıyor...')
      setScannedBarcode(barcodeText)

      const barcodeNumber = parseInt(barcodeText, 10)

      if (isNaN(barcodeNumber)) {
        setError('Geçersiz barkod formatı!')
        setIsChecking(false)
        return
      }

      const result = await getProduct(barcodeNumber)

      if (scannerRef.current) {
        await scannerRef.current.stop()
      }

      if (result && result.docs && result.docs.length > 0) {
        setCameraStatus('Ürün bulundu!')
        toast.success('Ürün bulundu, dosyası açılıyor.')
        router.push(`/urun/${barcodeText}`)
      } else {
        setIsNotFound(true)
        setCameraStatus('Ürün bulunamadı!')
        toast.error('Ürün bulunamadı — ilk ekleyen siz olun.')
      }
    } catch (error) {
      console.error('Sorgulama hatası:', error)
      setError('Ürün sorgulanırken bir hata oluştu!')
      setCameraStatus('Hata oluştu, tekrar deneniyor...')
      toast.error('Ürün sorgulanırken bir hata oluştu!')

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
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          handleBarcodeScanned(decodedText)
        },
        (errorMessage: string) => {
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.warn(errorMessage)
          }
        },
      )
      setCameraStatus('Hazır, barkod okumaya hazır...')
      setError('')
    } catch (err) {
      console.error('Yeniden başlatma hatası:', err)
    }
  }

  useEffect(() => {
    if (!isReady || !scannerRef.current) return

    const startScanner = async () => {
      try {
        await scannerRef.current.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleBarcodeScanned(decodedText)
          },
          (errorMessage: string) => {
            if (!errorMessage.includes('No MultiFormat Readers')) {
              console.warn(errorMessage)
            }
          },
        )
      } catch (err: any) {
        console.error('Kamera başlatma hatası:', err)
        setError('Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.')
      }
    }

    startScanner()

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady])

  // Ürün bulunamadı → GeneratedForm göster
  if (isNotFound) {
    return <GeneratedForm barcode={scannedBarcode} />
  }

  // Hata durumu
  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-start gap-4 rounded-md border border-border bg-card p-5">
        <VerdictStamp variant="danger">Hata</VerdictStamp>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tekrar Dene
        </Button>
      </div>
    )
  }

  // Tarayıcı aktif
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <span
          className={`font-mono text-xs tracking-[0.18em] uppercase ${
            isChecking ? 'text-stamp' : 'text-muted-foreground'
          }`}
        >
          {cameraStatus}
        </span>
        {isChecking && (
          <span className="size-4 animate-spin rounded-full border-2 border-border border-b-stamp" />
        )}
      </div>
      <div className="relative w-full max-w-[500px]">
        <div id="reader" className="w-full overflow-hidden rounded-md border border-border" />
        <span
          aria-hidden="true"
          className="animate-scanline pointer-events-none absolute inset-x-3 top-0 h-0.5 bg-gradient-to-r from-transparent via-stamp to-transparent [--scan-height:100%]"
        />
      </div>
      <EvidenceTag>Barkodu kameraya gösterin</EvidenceTag>
    </div>
  )
}
