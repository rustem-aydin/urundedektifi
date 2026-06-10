'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProduct } from '@/actions/product'
export default function BarcodeScanner() {
  const router = useRouter()
  const scannerRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor...')
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    let Html5QrcodeModule: any

    const initScanner = async () => {
      try {
        // Önce kamera iznini kontrol et
        setCameraStatus('Kamera izni isteniyor...')
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach((track) => track.stop()) // Test için hemen durdur

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

      // Barkodu number'a çevir (barkod genellikle sayısal değerdir)
      const barcodeNumber = parseInt(barcodeText, 10)

      if (isNaN(barcodeNumber)) {
        setError('Geçersiz barkod formatı!')
        setIsChecking(false)
        return
      }

      // Ürünü sorgula
      const result = await getProduct(barcodeNumber)

      // Ürün var mı kontrol et
      if (result && result.docs && result.docs.length > 0) {
        // Ürün bulundu
        setCameraStatus('✅ Ürün bulundu! Yönlendiriliyor...')
        setTimeout(() => {
          // Ürün detay sayfasına yönlendir
          router.push(`/products/${result.docs[0].id}`)
        }, 1000)
      } else {
        // Ürün bulunamadı
        setCameraStatus('⚠️ Ürün bulunamadı! Yeni ürün ekleme sayfasına yönlendiriliyor...')
        setTimeout(() => {
          // Yeni ürün ekleme sayfasına barkod değerini gönder
          router.push(`/ekle?barcode=${barcodeText}`)
        }, 1500)
      }

      // Tarayıcıyı durdur
      if (scannerRef.current) {
        await scannerRef.current.stop()
      }
    } catch (error) {
      console.error('Sorgulama hatası:', error)
      setError('Ürün sorgulanırken bir hata oluştu!')
      setCameraStatus('Hata oluştu, tekrar deneniyor...')

      // Hata durumunda tarayıcıyı yeniden başlat
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
  }, [isReady])

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 rounded">
        <p className="text-red-700 font-bold">Hata:</p>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Tekrar Dene
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <div className={`text-sm font-medium ${isChecking ? 'text-yellow-600' : 'text-gray-600'}`}>
          {cameraStatus}
        </div>
        {isChecking && (
          <div className="mt-2 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      <div id="reader" style={{ width: '100%', maxWidth: '500px' }}></div>
      <div className="mt-4 text-xs text-gray-500 text-center">
        Barkodu kameraya gösterin, otomatik olarak algılanacaktır.
      </div>
    </div>
  )
}
