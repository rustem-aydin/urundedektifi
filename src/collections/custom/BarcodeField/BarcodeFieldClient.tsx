'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useField } from '@payloadcms/ui'
import styles from './BarcodeFieldClient.module.css'

// ✅ label ve description eklendi
type Props = {
  path: string
  label?: string
  description?: string
  readOnly?: boolean
}

// ✅ Props'u buraya da ekle
export const BarcodeFieldClient: React.FC<Props> = ({ path, label, description, readOnly }) => {
  const { value, setValue, errorMessage } = useField<string>({ path })
  const [checking, setChecking] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [foundProduct, setFoundProduct] = useState<{ id: string; name: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [isSupported, setIsSupported] = useState(true)

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
    } else {
      setIsSupported(false)
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

  const cameraOverlay =
    mounted && isScanning
      ? createPortal(
          <div className={styles.overlay} style={{ zIndex: 2147483647 }}>
            <div className={styles.overlayContent}>
              <div className={styles.overlayHeader}>
                <h3>📷 EAN-13 Barkod Okutma</h3>
                <button type="button" onClick={stopCamera} className={styles.closeBtn}>
                  ✕ Kapat
                </button>
              </div>

              <div className={styles.videoWrapper}>
                <video ref={videoRef} playsInline muted className={styles.cameraVideo} />
                <div className={styles.scanFrame}>
                  <div className={styles.scanLine} />
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

              <div className={styles.overlayHint}>
                Ürün üzerindeki dikey çizgili barkodu çerçeveye hizalayın
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={styles.wrapper}>
      {/* ✅ LABEL EKLENDİ */}
      {label && (
        <label htmlFor={path} className={styles.fieldLabel}>
          {label}
        </label>
      )}

      {/* ✅ DESCRIPTION EKLENDİ */}
      {description && <div className={styles.fieldDescription}>{description}</div>}

      <div className={styles.inputRow}>
        <div className={styles.inputContainer}>
          <input
            id={path} // ✅ Label ile eşleşmesi için id eklendi
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
            className={`${styles.input} ${foundProduct ? styles.hasWarning : ''} ${errorMessage ? styles.hasError : ''} ${readOnly ? styles.readOnly : ''}`}
          />
          {checking && <div className={styles.spinner} />}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={startCamera}
            disabled={isScanning || !isSupported}
            className={styles.scanBtn}
            title={
              !isSupported ? 'Tarayıcınız kamera ile barkod okumayı desteklemiyor' : 'Kamerayı Aç'
            }
          >
            📷 Okut
          </button>
        )}
      </div>

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
        <p className={styles.fieldError}>
          {typeof errorMessage === 'string' ? errorMessage : 'Geçersiz değer'}
        </p>
      )}

      {foundProduct && !readOnly && (
        <div className={styles.alert}>
          <p className={styles.alertTitle}>⚠️ Kopya Barkod Tespit Edildi</p>
          <p className={styles.alertDescription}>
            Sistemde bu barkoda sahip kayıtlı bir ürün bulundu.
          </p>
          <div className={styles.alertMessage}>
            <strong>{foundProduct.name}</strong>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>(Eşleşen Kayıt)</span>
          </div>
          <div className={styles.alertActions}>
            <button
              type="button"
              onClick={goToEdit}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              ✏️ Ürünü Düzenle
            </button>
            <button
              type="button"
              onClick={() => handleChange('')}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              🔄 Yine De Yeni Oluştur
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
