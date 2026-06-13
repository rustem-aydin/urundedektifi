'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useField } from '@payloadcms/ui'
import jsQR from 'jsqr'

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
  const [scanCount, setScanCount] = useState(0) // ✅ Debug: kaç kare tarandı

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)
  const frameCountRef = useRef(0) // ✅ Performans için ref'te tut

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
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
    try {
      console.log('📷 Kamera başlatılıyor...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
        },
      })

      console.log('✅ Stream alındı:', stream.getVideoTracks()[0]?.label)
      console.log('✅ Track settings:', stream.getVideoTracks()[0]?.getSettings())

      streamRef.current = stream
      frameCountRef.current = 0
      setScanCount(0)
      setIsScanning(true)

      setTimeout(() => {
        const video = videoRef.current
        if (!video) {
          console.error('❌ videoRef null!')
          return
        }

        video.srcObject = stream

        video.onloadeddata = () => {
          console.log('🎬 Video YÜKLendi - boyut:', video.videoWidth, 'x', video.videoHeight)
          console.log('🎬 readyState:', video.readyState)
          video
            .play()
            .then(() => {
              console.log('▶️ Video oynatılıyor')
              animationFrameRef.current = requestAnimationFrame(scanFrame)
            })
            .catch((err) => {
              console.error('❌ Play hatası:', err)
            })
        }

        video.onerror = (e) => {
          console.error('❌ Video error:', e)
        }

        // Fallback: 3 saniye sonra da başlatmayı dene
        setTimeout(() => {
          if (video.readyState >= 2 && !animationFrameRef.current) {
            console.log('⏰ Fallback başlatma')
            video.play()
            animationFrameRef.current = requestAnimationFrame(scanFrame)
          }
        }, 3000)
      }, 300)
    } catch (err) {
      console.error('❌ Kamera hatası:', err)
      alert('Kamera erişimi reddedildi veya kamera bulunamadı.\n\n' + String(err))
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

  const scanFrame = () => {
    const video = videoRef.current
    if (!video || !streamRef.current) return

    // Video henüz hazır değilse bekle
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    const w = video.videoWidth
    const h = video.videoHeight

    if (!w || !h) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    ctx.drawImage(video, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)

    // ✅ Her 30 karede bir logla (console spam olmasın)
    frameCountRef.current++
    if (frameCountRef.current % 30 === 0) {
      setScanCount(frameCountRef.current)
      console.log(
        `🔄 Taranan kare: ${frameCountRef.current} | Boyut: ${w}x${h} | Pixel: ${imageData.data.length}`,
      )
    }

    try {
      // ✅ attemptBoth: hem normal hem ters çevrilerek dener
      const code = jsQR(imageData.data, w, h, {
        inversionAttempts: 'attemptBoth',
      })

      if (code && code.data) {
        console.log('🎉✅✅ QR/BARKOD OKUNDU:', code.data)
        console.log('📍 Konum:', code.location)
        stopCamera()
        handleChange(code.data)
        checkBarcode(code.data)
        return
      }
    } catch (err) {
      console.error('❌ jsQR hatası:', err)
    }

    // ✅ Her 60 karede bir jsQR çalıştığını doğrula
    if (frameCountRef.current % 60 === 0) {
      console.log('🔍 jsQR çalışıyor ama kod bulunamadı, taramaya devam...')
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
              background: 'rgba(0,0,0,0.85)',
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
              {/* Başlık */}
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
                  📷 Barkod / QR Okutma
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

              {/* Video */}
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

                {/* Tarama çerçevesi */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '70%',
                    height: '55%',
                    border: '2px solid rgba(0,255,136,0.6)',
                    borderRadius: 10,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      left: -2,
                      width: 24,
                      height: 24,
                      borderTop: '3px solid #00ff88',
                      borderLeft: '3px solid #00ff88',
                      borderRadius: '10px 0 0 0',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 24,
                      height: 24,
                      borderTop: '3px solid #00ff88',
                      borderRight: '3px solid #00ff88',
                      borderRadius: '0 10px 0 0',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: -2,
                      width: 24,
                      height: 24,
                      borderBottom: '3px solid #00ff88',
                      borderLeft: '3px solid #00ff88',
                      borderRadius: '0 0 0 10px',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 24,
                      height: 24,
                      borderBottom: '3px solid #00ff88',
                      borderRight: '3px solid #00ff88',
                      borderRadius: '0 0 10px 0',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '5%',
                      width: '90%',
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                      boxShadow: '0 0 12px #00ff88',
                      animation: 'barcodeScan 2s ease-in-out infinite',
                    }}
                  />
                </div>

                {/* ✅ Debug: Tarama sayacı */}
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#00ff88',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  Kare: {scanCount}
                </div>
              </div>

              {/* Alt bilgi */}
              <div
                style={{
                  textAlign: 'center',
                  color: '#888',
                  fontSize: 13,
                  padding: '12px 16px',
                  background: '#1a1a2e',
                }}
              >
                Barkod veya QR kodu çerçeveye hizalayın...
              </div>
            </div>

            <style>{`
        @keyframes barcodeScan {
          0%, 100% { top: 5%; }
          50% { top: 90%; }
        }
      `}</style>
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
            placeholder={
              isScanning ? 'Kamera okuması bekleniyor...' : 'Barkod/QR girin veya taratın...'
            }
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

        {!readOnly && !isScanning && (
          <button
            type="button"
            onClick={startCamera}
            style={{
              padding: '8px 14px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            📷 Kamera ile Okut
          </button>
        )}
      </div>

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
            ⚠️ Kopya Barkod / QR Kod Tespit Edildi
          </p>
          <p style={{ margin: '0 0 8px 0', color: '#78350f', fontSize: 12, lineHeight: 1.4 }}>
            Sistemde bu koda sahip kayıtlı bir ürün bulundu. Mevcut ürünü düzenlemeniz önerilir.
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

      <style>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>

      {cameraOverlay}
    </div>
  )
}
