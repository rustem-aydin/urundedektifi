'use client'

import React, { useState, useCallback } from 'react'
import { useField } from '@payloadcms/ui'
import styles from './BarcodeFieldClient.module.css'

type Props = {
  path: string
  readOnly?: boolean
}

export const BarcodeFieldClient: React.FC<Props> = ({ path, readOnly }) => {
  // ✅ Payload'ın kendi form state'ini kullanıyoruz
  const { value, setValue, errorMessage } = useField<string>({ path })

  const [checking, setChecking] = useState(false)
  const [foundProduct, setFoundProduct] = useState<{ id: string; name: string } | null>(null)

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
    setValue(newValue) // ✅ Payload'ın setValue fonksiyonu
    if (foundProduct) setFoundProduct(null)
  }

  const goToEdit = () => {
    if (foundProduct) {
      window.location.href = `/admin/collections/products/${foundProduct.id}`
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <div className={styles.inputContainer}>
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
            readOnly={readOnly || checking}
            placeholder="Barkod/QR kodunu girin..."
            className={`
              ${styles.input} 
              ${foundProduct ? styles.hasWarning : ''} 
              ${errorMessage ? styles.hasError : ''}
              ${readOnly ? styles.readOnly : ''}
            `}
          />
          {checking && <div className={styles.spinner} />}
        </div>

        {!readOnly && (
          <button
            type="button"
            className={styles.scanBtn}
            onClick={() => checkBarcode((value as string) || '')}
            disabled={!value || (value as string).length < 3 || checking}
          >
            {checking ? 'Sorgulanıyor...' : '🔍 Sorgula'}
          </button>
        )}
      </div>

      {/* Payload doğrulama hatası */}
      {errorMessage && (
        <p className={styles.fieldError}>
          {typeof errorMessage === 'string' ? errorMessage : 'Geçersiz değer'}
        </p>
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
