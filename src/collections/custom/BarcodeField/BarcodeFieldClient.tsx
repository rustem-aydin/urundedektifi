'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useField, FieldLabel, FieldDescription, FieldError, fieldBaseClass } from '@payloadcms/ui'

type Props = {
  path: string
  field: any
  readOnly?: boolean
}

export const BarcodeFieldClient: React.FC<Props> = ({ path, field, readOnly }) => {
  const { label, required, admin } = field
  const { value, setValue, errorMessage, showError } = useField<string>({ path })

  const [checking, setChecking] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [foundProduct, setFoundProduct] = useState<{ id: string; name: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [isSupported, setIsSupported] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const nativeDetectorRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    // Sadece EAN-13 ve 1D barkodları destekleyen native API
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      nativeDetectorRef.current = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      })
      setIsSupported(true)
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
    if (!barcodeValue || barcodeValue.length < 3) return
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
      console.error('Sorgu hatası:', err)
    } finally {
      setChecking(false)
    }
  }, [])

  const handleChange = (newValue: string) => {
    setValue(newValue)
    if (foundProduct) setFoundProduct(null)
  }

  const startCamera = async () => {
    if (!isSupported) {
      alert('Bu tarayıcı kamera ile barkod okumayı desteklemiyor.')
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
      alert('Kamera erişimi reddedildi.')
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
      const barcodes = await nativeDetectorRef.current.detect(video)
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue
        stopCamera()
        handleChange(code)
        checkBarcode(code)
        return
      }
    } catch (e) {}

    animationFrameRef.current = requestAnimationFrame(scanFrame)
  }

  // =====================================================================
  // MODAL: TAMAMEN INLINE STYLE İLE YAZILDI (PAYLOAD CSS ÇAKIŞMASI ÖNLENDİ)
  // =====================================================================
  const cameraModal =
    mounted && isScanning
      ? createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              zIndex: 9999999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              boxSizing: 'border-box',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '500px',
                backgroundColor: '#1a1a2e',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                border: '1px solid #333',
              }}
            >
              {/* Başlık */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  backgroundColor: '#16213e',
                  borderBottom: '1px solid #0f3460',
                }}
              >
                <span style={{ color: '#e0e0e0', fontSize: '16px', fontWeight: '600' }}>
                  📷 EAN-13 Barkod Okutma
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  style={{
                    backgroundColor: '#e74c3c',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                  }}
                >
                  ✕ Kapat
                </button>
              </div>

              {/* Kamera Alanı */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '300px',
                  backgroundColor: '#000',
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

                {/* Yatay Tarama Çerçevesi */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '85%',
                    height: '35%',
                    border: '2px solid rgba(0, 255, 136, 0.8)',
                    borderRadius: '10px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {/* Orta Lazer Çizgisi */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      width: '100%',
                      height: '2px',
                      backgroundColor: '#00ff88',
                      boxShadow: '0 0 10px #00ff88',
                      transform: 'translateY(-50%)',
                    }}
                  />
                </div>

                {/* Kare Sayacı */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: '#00ff88',
                    padding: '6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                  }}
                >
                  Taranan Kare: {scanCount} | EAN-13 Modu Aktif
                </div>
              </div>

              {/* Alt Bilgi */}
              <div
                style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: '#a0a0a0',
                  fontSize: '14px',
                  backgroundColor: '#1a1a2e',
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
    <div className={[fieldBaseClass, 'custom-barcode-field'].filter(Boolean).join(' ')}>
      <FieldLabel label={label} path={path} required={required} />

      <div className={`${fieldBaseClass}__wrap`}>
        <FieldError path={path} message={errorMessage} showError={showError} />

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              id={`field-${path.replace(/\./g, '__')}`}
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
              disabled={readOnly || isScanning}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${errorMessage ? '#d32f2f' : foundProduct ? '#f59e0b' : '#d1d5db'}`,
                borderRadius: '4px',
                fontSize: '14px',
                background: readOnly || isScanning ? '#f3f4f6' : '#fff',
                outline: 'none',
                boxSizing: 'border-box',
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
                padding: '10px 16px',
                background: !isSupported || isScanning ? '#6b7280' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: !isSupported || isScanning ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              📷 Okut
            </button>
          )}
        </div>

        {!isSupported && !readOnly && (
          <p
            style={{
              margin: '8px 0 0',
              color: '#b45309',
              fontSize: '13px',
              background: '#fffbeb',
              padding: '8px 12px',
              borderRadius: '4px',
            }}
          >
            ⚠️ Tarayıcınız kamera ile barkod okumayı desteklemiyor. Lütfen manuel girin.
          </p>
        )}

        {foundProduct && !readOnly && (
          <div
            style={{
              marginTop: '12px',
              background: '#fffbeb',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              padding: '12px',
            }}
          >
            <p style={{ margin: '0 0 4px', color: '#92400e', fontSize: '14px', fontWeight: '600' }}>
              ⚠️ Kopya Barkod Tespit Edildi
            </p>
            <p style={{ margin: '0 0 8px', color: '#78350f', fontSize: '13px' }}>
              Sistemde bu barkoda sahip kayıtlı bir ürün bulundu.
            </p>
            <div
              style={{
                background: '#fef3c7',
                padding: '8px 10px',
                borderRadius: '4px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong>{foundProduct.name}</strong>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>(Eşleşen Kayıt)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() =>
                  (window.location.href = `/admin/collections/products/${foundProduct.id}`)
                }
                style={{
                  padding: '8px 14px',
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                ✏️ Ürünü Düzenle
              </button>
              <button
                type="button"
                onClick={() => handleChange('')}
                style={{
                  padding: '8px 14px',
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                🔄 Yine De Yeni Oluştur
              </button>
            </div>
          </div>
        )}

        {admin?.description && <FieldDescription description={admin.description} path={path} />}
      </div>

      {/* Spinner animasyonu için minimum düzey inline css */}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>

      {cameraModal}
    </div>
  )
}
