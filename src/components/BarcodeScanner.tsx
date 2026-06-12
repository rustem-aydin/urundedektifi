'use client'

import { useEffect, useRef, useState } from 'react'
import { getProduct } from '@/actions/product'
import { GeneratedForm } from './AddProduct'
import { Brand, Category, Product } from '@/payload-types'

export default function BarcodeScanner() {
  const scannerRef = useRef<any>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string>('')
  const [cameraStatus, setCameraStatus] = useState<string>('Başlatılıyor...')
  const [isChecking, setIsChecking] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string>('')
  const [productData, setProductData] = useState<Product | null>(null)
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
        setProductData(result?.docs[0] as Product)
        setCameraStatus('✅ Ürün bulundu!')
      } else {
        setIsNotFound(true)
        setCameraStatus('⚠️ Ürün bulunamadı!')
      }
    } catch (error) {
      console.error('Sorgulama hatası:', error)
      setError('Ürün sorgulanırken bir hata oluştu!')
      setCameraStatus('Hata oluştu, tekrar deneniyor...')

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

  // Ürün bulunamadı → GeneratedForm göster
  if (isNotFound) {
    return <GeneratedForm barcode={scannedBarcode} />
  }

  // Ürün bulundu → Ürün bilgilerini göster
  if (productData) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <div className="text-green-500 text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-800">Ürün Bulundu</h2>
          <p className="text-sm text-gray-500 mt-1">Barkod: {scannedBarcode}</p>
        </div>

        <div className="space-y-3">
          {productData.name && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-xs text-gray-500">Ürün Adı</span>
              <p className="font-semibold text-gray-800">{productData.name}</p>
            </div>
          )}
          {productData.brand && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-xs text-gray-500">Marka</span>
              <p className="font-semibold text-gray-800">{(productData.brand as Brand).name}</p>
            </div>
          )}
          {productData.category && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-xs text-gray-500">Kategori</span>
              <p className="font-semibold text-gray-800">
                {(productData.category as Category).name}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              setProductData(null)
              setScannedBarcode('')
              setIsNotFound(false)
              restartScanner()
            }}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Yeni Tarat
          </button>
        </div>
      </div>
    )
  }

  // Hata durumu
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

  // Tarayıcı aktif
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
