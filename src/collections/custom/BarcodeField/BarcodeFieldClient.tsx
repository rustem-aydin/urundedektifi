'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import jsQR from 'jsqr'
import styles from './BarcodeFieldClient.module.css'

type Props = {
  path: string
  value?: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export const BarcodeFieldClient: React.FC<Props> = ({
  path,
  value: initialValue,
  onChange,
  readOnly,
}) => {
  const [value, setValue] = useState(initialValue || '')
  const [checking, setChecking] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [foundProduct, setFoundProduct] = useState<{ id: string; name: string } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number>(0)

  useEffect(() => {
    setValue(initialValue || '')
  }, [initialValue])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const getDocumentId = () => {
    const pathname = window.location.pathname
    const match = pathname.match(/\/collections\/products\/([^/]+)/)
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
    onChange?.(newValue)
    if (foundProduct) setFoundProduct(null)
  }

  const goToEdit = () => {
    if (foundProduct) {
      window.location.href = `/admin/collections/products/${foundProduct.id}`
    }
  }

  // ✨ Kamera İşlemleri
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Arka kamerayı aç
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsScanning(true)
        // Okuma döngüsünü başlat
        requestAnimationFrame(scanFrame)
      }
    } catch (err) {
      alert('Kamera erişimi reddedildi veya kamera bulunamadı.')
      console.error(err)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setIsScanning(false)
  }

  const scanFrame = () => {
    if (!videoRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code?.data) {
        // Kod okundu!
        stopCamera()
        handleChange(code.data)
        checkBarcode(code.data)
        return // Döngüden çık
      }
    }

    // Kod bulunamadı, devam et
    animationFrameRef.current = requestAnimationFrame(scanFrame)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            name={path}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => checkBarcode(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                checkBarcode(value)
              }
            }}
            readOnly={readOnly || isScanning}
            placeholder={
              isScanning ? 'Kamera okuması bekleniyor...' : 'Barkod/QR girin veya taratın...'
            }
            className={`
              ${styles.input} 
              ${foundProduct ? styles.hasWarning : ''} 
              ${readOnly ? styles.readOnly : ''}
            `}
          />
          {checking && <div className={styles.spinner} />}
        </div>

        {!readOnly && !isScanning && (
          <button type="button" className={styles.scanBtn} onClick={startCamera}>
            📷 Kamera ile Okut
          </button>
        )}
      </div>

      {/* Kamera Açıksa Gösterilecek Alan */}
      {isScanning && (
        <div className={styles.cameraContainer}>
          <video ref={videoRef} className={styles.cameraVideo} playsInline muted />
          <div className={styles.cameraOverlay}>
            <div className={styles.scanningFrame}>
              <div className={styles.scanningLine} />
            </div>
          </div>
          <button
            type="button"
            className={styles.closeCameraBtn}
            onClick={stopCamera}
            title="Kamerayı Kapat"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ürün Bulundu Uyarısı */}
      {foundProduct && !readOnly && (
        <div className={styles.alert}>
          <p className={styles.alertTitle}>⚠️ Kopya Barkod / QR Kod Tespit Edildi</p>
          <p className={styles.alertDescription}>
            Sistemde bu koda sahip kayıtlı bir ürün bulundu. Yeni bir ürün oluşturmak yerine mevcut
            ürünü düzenlemeniz önerilir.
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
