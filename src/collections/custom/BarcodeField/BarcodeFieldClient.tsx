'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useField } from '@payloadcms/ui'

type Props = {
  path: string
  readOnly?: boolean
}

export const BarcodeFieldClient: React.FC<Props> = ({ path, readOnly }) => {
  const { value, setValue, errorMessage } = useField<string>({ path })
  const [checking, setChecking] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [foundProduct, setFoundProduct] = useState<{ id: string; name: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [isSupported, setIsSupported] = useState(true) // ✅ Tarayıcı desteği kontrolü

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const nativeDetectorRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    // Tarayıcı EAN-13 okuyabiliyor mu?
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      nativeDetectorRef.current = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'], // ✅ Sadece 1D Barkodlar
      })
      setIsSupported(true)
    } else {
      setIsSupported(false) // ❌ Desteklenmiyorsa kamerayı açmaya gerek yok
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const getDocumentId = () => {
    const match = window.location.pathname.match(/\/collections\/products\/([^/]+)/)
    return match ? match[1] : null
  }

  const checkBarcode = useCallback(async (barcodeValue: string) => {
    if (!barcodeValue || barcodeValue.length < 3) {
      setFoundProduct(null)
      return
    }
    setChecking(true)
    setFoundProduct(null)
    try {
      const res = await fetch(
        `/api/products?where[barcode][equals]=${encodeURIComponent(barcodeValue)}&limit=1&depth=0`,
      )
      const data = await res.json()
      if (data.docs?.length > 0) {
        const product = data.docs[0]
        const documentId = getDocumentId()
        if (documentId && product.id === documentId) return
        setFoundProduct({ id: product.id, name: product.name })
      }
    } catch (err) {
      console.error('Barkod sorgulama hatası:', err)
    } finally {
      setChecking(false)
    }
  }, [])

  const handleChange = (newValue: string) => {
    setValue(newValue)
    if (foundProduct) setFoundProduct(null)
  }

  const goToEdit = () => {
    if (foundProduct) {
      window.location.href = `/admin/collections/products/${foundProduct.id}`
    }
  }

  const startCamera = async () => {
    if (!isSupported) {
      alert('Tarayıcınız kamera ile barkod okumayı desteklemiyor. Lütfen barkodu manuel girin.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      frameCountRef.current = 0
      setScanCount(0)
      setIsScanning(true)

      setTimeout(() => {
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.onloadeddata = () => {
          video.play()
          animationFrameRef.current = requestAnimationFrame(scanFrame)
        }
      }, 300)
    } catch (err) {
      alert('Kamera erişimi reddedildi.\n\n' + String(err))
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = 0
    }
    setIsScanning(false)
  }

  const scanFrame = async () => {
    const video = videoRef.current
    if (!video || !streamRef.current || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    frameCountRef.current++
    if (frameCountRef.current % 15 === 0) setScanCount(frameCountRef.current)

    try {
      // ✅ Sadece ve sadece donanımsal Native API ile EAN-13 okuma
      const barcodes = await nativeDetectorRef.current.detect(video)
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue
        stopCamera()
        handleChange(code)
        checkBarcode(code)
        return
      }
    } catch (e) {
      // Hata olursa sessizce devam et
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame)
  }

  const cameraOverlay =
    mounted && isScanning
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.9)',
              zIndex: 2147483647,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <div
              style={{
                background: '#1a1a2e',
                borderRadius: 16,
                overflow: 'hidden',
                width: '100%',
                maxWidth: 500,
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: '#16213e',
                  borderBottom: '1px solid #0f3460',
                }}
              >
                <span style={{ color: '#e0e0e0', fontSize: 15, fontWeight: 600 }}>
                  📷 EAN-13 Barkod Okutma
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  style={{
                    background: '#e74c3c',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ✕ Kapat
                </button>
              </div>

              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 360,
                  background: '#000',
                  overflow: 'hidden',
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Yatay EAN-13 çerçevesi */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '85%',
                    height: '30%', // ✅ EAN-13 yatay olduğu için çerçeveyi yatırdık
                    border: '2px solid rgba(0,255,136,0.7)',
                    borderRadius: 8,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '5%',
                      width: '90%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                      boxShadow: '0 0 10px #00ff88', // ✅ Sabit çizgi (EAN-13 yatay tarama için daha uygun)
                    }}
                  />
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#00ff88',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    textAlign: 'center',
                  }}
                >
                  Taranan Kare: {scanCount} | EAN-13 Modu Aktif
                </div>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  color: '#ccc',
                  fontSize: 14,
                  padding: '14px 16px',
                  background: '#1a1a2e',
                  fontWeight: 500,
                }}
              >
                Ürün üzerindeki dikey çizgili barkodu çerçeveye hizalayın
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            name={path}
            value={(value as string) || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                checkBarcode((value as string) || '')
              }
            }}
            readOnly={readOnly || isScanning}
            placeholder="EAN-13 barkodunu girin..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${foundProduct ? '#f59e0b' : errorMessage ? '#d32f2f' : '#d1d5db'}`,
              borderRadius: 4,
              fontSize: 14,
              background: foundProduct
                ? '#fffbeb'
                : errorMessage
                  ? '#fef2f2'
                  : readOnly
                    ? '#f3f4f6'
                    : '#fff',
              outline: 'none',
              boxSizing: 'border-box',
              opacity: readOnly ? 0.7 : 1,
            }}
          />
          {checking && (
            <div
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                border: '2px solid #e5e7eb',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
          )}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={startCamera}
            disabled={isScanning || !isSupported}
            style={{
              padding: '8px 14px',
              background: !isSupported ? '#6b7280' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              cursor: !isSupported ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: !isSupported ? 0.6 : 1,
            }}
            title={
              !isSupported ? 'Tarayıcınız kamera ile barkod okumayı desteklemiyor' : 'Kamerayı Aç'
            }
          >
            📷 Okut
          </button>
        )}
      </div>

      {/* Tarayıcı uyumsuzluğu uyarısı */}
      {!isSupported && !readOnly && (
        <p
          style={{
            margin: 0,
            color: '#b45309',
            fontSize: 12,
            backgroundColor: '#fffbeb',
            padding: '6px 10px',
            borderRadius: 4,
          }}
        >
          ⚠️ Tarayıcınız kamera ile barkod okumayı desteklemiyor. Lütfen barkodu yukarıdaki kutuya
          manuel olarak girip <strong>Enter</strong>'a basın.
        </p>
      )}

      {errorMessage && (
        <p style={{ color: '#d32f2f', fontSize: 12, margin: 0 }}>
          {typeof errorMessage === 'string' ? errorMessage : 'Geçersiz değer'}
        </p>
      )}

      {foundProduct && !readOnly && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: 6,
            padding: 12,
          }}
        >
          <p style={{ margin: '0 0 4px 0', color: '#92400e', fontSize: 13, fontWeight: 600 }}>
            ⚠️ Kopya Barkod Tespit Edildi
          </p>
          <p style={{ margin: '0 0 8px 0', color: '#78350f', fontSize: 12, lineHeight: 1.4 }}>
            Sistemde bu barkoda sahip kayıtlı bir ürün bulundu.
          </p>
          <div
            style={{
              background: '#fef3c7',
              padding: '8px 10px',
              borderRadius: 4,
              marginBottom: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong>{foundProduct.name}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(Eşleşen Kayıt)</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={goToEdit}
              style={{
                padding: '7px 14px',
                background: '#f59e0b',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ✏️ Ürünü Düzenle
            </button>
            <button
              type="button"
              onClick={() => handleChange('')}
              style={{
                padding: '7px 14px',
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              🔄 Yine De Yeni Oluştur
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
      {cameraOverlay}
    </div>
  )
}
