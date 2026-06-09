'use client'

import { useState } from 'react'

export default function TaraPage() {
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = barcode.trim()
    if (!trimmed) {
      setError('Lütfen bir barkod girin')
      return
    }
    setError(null)
    window.location.href = `/urun?barcode=${encodeURIComponent(trimmed)}`
  }

  return (
    <div className="container scanner">
      <h1>📷 Ürünü Tara</h1>
      <p>QR kod veya barkod okutarak ürün bilgilerine ulaşın.</p>

      <div className="scanner-options">
        <div className="scanner-box">
          <h2>1. Kamera ile Tara</h2>
          <p>
            Telefonunuzun kamerasıyla barkod okutmak için{' '}
            <a href="/api/scan" className="cta-button">Kamerayı Aç</a>
          </p>
          <p className="muted">
            Not: Tarayıcı kamera izni gerektirir. Geliştirme aşamasında{' '}
            <code>@zxing/library</code> veya <code>html5-qrcode</code> entegre edilecek.
          </p>
        </div>

        <div className="scanner-box">
          <h2>2. Manuel Barkod Gir</h2>
          <form onSubmit={onSubmit}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Örn: 8690504001234"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="barcode-input"
            />
            <button type="submit" className="cta-button">Ürünü Bul</button>
            {error && <p className="error">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  )
}
