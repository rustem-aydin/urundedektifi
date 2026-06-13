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
                backgroundColor: '#121212',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 25px 80px rgba(0,0,0,0.9)',
                border: '1px solid #333',
              }}
            >
              {/* Başlık Çubuğu */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  backgroundColor: '#1a1a1a',
                  borderBottom: '1px solid #333',
                }}
              >
                <span
                  style={{
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>📷</span> Barkod Tarayıcı
                </span>
                <button
                  type="button"
                  onClick={stopCamera}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#888',
                    border: '1px solid #444',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Vazgeç
                </button>
              </div>

              {/* Kamera Görünümü */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '320px',
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

                {/* Tarama Alanı (Maskeleme) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '88%',
                    height: '35%',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                    borderRadius: '0px', // Dikdörtgen barkod için köşesiz
                  }}
                >
                  {/* ÜST ÇUBUK */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                    }}
                  />
                  {/* ALT ÇUBUK */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                    }}
                  />

                  {/* HAREKETLİ LAZER EFEKTI */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '2%',
                      width: '96%',
                      height: '2px',
                      background: '#00ff88',
                      boxShadow: '0 0 12px 2px #00ff88',
                      animation: 'scanMove 2.5s ease-in-out infinite',
                      zIndex: 10,
                    }}
                  />

                  {/* KÖŞE TASARIMLARI (Şık durması için) */}
                  {/* Sol Üst */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      left: '-2px',
                      width: '24px',
                      height: '24px',
                      borderTop: '3px solid #00ff88',
                      borderLeft: '3px solid #00ff88',
                    }}
                  />
                  {/* Sağ Üst */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '24px',
                      height: '24px',
                      borderTop: '3px solid #00ff88',
                      borderRight: '3px solid #00ff88',
                    }}
                  />
                  {/* Sol Alt */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      left: '-2px',
                      width: '24px',
                      height: '24px',
                      borderBottom: '3px solid #00ff88',
                      borderLeft: '3px solid #00ff88',
                    }}
                  />
                  {/* Sağ Alt */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      width: '24px',
                      height: '24px',
                      borderBottom: '3px solid #00ff88',
                      borderRight: '3px solid #00ff88',
                    }}
                  />
                </div>

                {/* Alt Bilgi Ekranı (HUD) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                    padding: '30px 16px 16px 16px',
                    color: '#fff',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'rgba(0, 255, 136, 0.1)',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: '#00ff88',
                    }}
                  >
                    <span>● CANLI</span>
                    <span>KARE: {scanCount}</span>
                  </div>
                </div>
              </div>

              {/* Alt Yardım Metni */}
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '14px',
                  backgroundColor: '#121212',
                }}
              >
                EAN-13 barkodunu çerçevenin içine hizalayın
              </div>
            </div>

            {/* Lazer Animasyonu */}
            <style>{`
        @keyframes scanMove {
          0% { top: 5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={[fieldBaseClass, 'custom-barcode-field'].filter(Boolean).join(' ')}>
      <FieldLabel label={label} path={path} required={required} />

      <div className={`${fieldBaseClass}__wrap`}>
        <FieldError path={path} message={errorMessage} showError={showError} />

        {/* ✅ GÜZEL GÖRÜNEN STANDART PAYLOAD INPUT TASARIMI */}
        <div className={`${fieldBaseClass}__input-wrap`} style={{ position: 'relative' }}>
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
            className={`${fieldBaseClass}__input`}
            style={{
              width: '100%',
              minHeight: '48px', // ✅ Inputu biraz uzun yaptı
              height: '48px', // ✅ Sabit yükseklik
              minWidth: '250px', // ✅ Minimum genişlik
              boxSizing: 'border-box',
              fontSize: '15px', // ✅ Yazıyı biraz büyüttük
              paddingRight: !readOnly && isSupported ? '110px' : '12px',
            }}
          />

          {/* ✅ INPUT'UN İÇİNE YERLEŞTİRİLMİŞ BUTON */}
          {!readOnly && (
            <button
              type="button"
              onClick={startCamera}
              disabled={isScanning || !isSupported}
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '6px 12px',
                background:
                  !isSupported || isScanning
                    ? '#4b5563'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: !isSupported || isScanning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: !isSupported || isScanning ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s ease',
                zIndex: 2,
              }}
            >
              📷 Okut
            </button>
          )}
        </div>

        {/* Spinner */}
        {checking && (
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#6b7280',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                border: '2px solid #e5e7eb',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }}
            />
            Sorgulanıyor...
          </div>
        )}

        {/* Uyumsuzluk Uyarısı */}
        {!isSupported && !readOnly && (
          <p
            style={{
              margin: '8px 0 0',
              color: '#92400e',
              fontSize: '13px',
              background: '#fffbeb',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #fde68a',
            }}
          >
            ⚠️ Tarayıcınız kamera ile barkod okumayı desteklemiyor. Lütfen manuel girin.
          </p>
        )}

        {/* Kopya Ürün Uyarısı */}
        {foundProduct && !readOnly && (
          <div
            style={{
              marginTop: '16px',
              background: '#fffbeb',
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            }}
          >
            <p
              style={{
                margin: '0 0 6px',
                color: '#92400e',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⚠️ Kopya Barkod Tespit Edildi
            </p>
            <p
              style={{ margin: '0 0 12px', color: '#78350f', fontSize: '13px', lineHeight: '1.5' }}
            >
              Sistemde bu barkoda sahip kayıtlı bir ürün bulundu. Mevcut ürünü düzenlemeniz
              önerilir.
            </p>
            <div
              style={{
                background: '#fef3c7',
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #fde68a',
              }}
            >
              <strong style={{ color: '#92400e' }}>{foundProduct.name}</strong>
              <span
                style={{
                  fontSize: '11px',
                  color: '#b45309',
                  background: '#fde68a',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                Eşleşen Kayıt
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() =>
                  (window.location.href = `/admin/collections/products/${foundProduct.id}`)
                }
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(245, 158, 11, 0.3)',
                }}
              >
                ✏️ Ürünü Düzenle
              </button>
              <button
                type="button"
                onClick={() => handleChange('')}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#fff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
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

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
      {cameraModal}
    </div>
  )
}
