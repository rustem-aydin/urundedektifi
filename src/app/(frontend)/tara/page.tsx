'use client'

import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onScan }: { onScan: (result: string) => void }) {
  const scannerRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor...')

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
        setCameraStatus('Hazır, kamera başlatılıyor...')
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

  useEffect(() => {
    if (!isReady || !scannerRef.current) return

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }

    scannerRef.current
      .start(
        { facingMode: 'environment' }, // arka kamera
        config,
        (decodedText: string) => {
          onScan(decodedText)
          setCameraStatus('Tarama başarılı!')
          scannerRef.current.stop()
        },
        (errorMessage: string) => {
          // Normal tarama hatalarını ignore et
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.warn(errorMessage)
          }
        },
      )
      .catch((err: any) => {
        console.error('Kamera başlatma hatası:', err)
        setError('Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.')
      })
  }, [isReady, onScan])

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 rounded">
        <p className="text-red-700 font-bold">Hata:</p>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
        >
          Tekrar Dene
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 text-sm text-gray-600">{cameraStatus}</div>
      <div id="reader" style={{ width: '100%', maxWidth: '500px' }}></div>
    </div>
  )
}
