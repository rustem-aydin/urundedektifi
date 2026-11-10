import { ImageResponse } from 'next/og'

import { SITE_TAGLINE } from '@/lib/seo'

const BARS = [18, 7, 12, 6, 20, 7, 14, 6, 18, 7, 12]

const SIZE = { width: 1200, height: 630 }

/**
 * Varsayılan sosyal kart — sabit adres (`/og`).
 *
 * Next'in dosya-konvansiyonu OG rotası içerik hash'li bir yol üretir; paylaşılan
 * bağlantılarda ve metadata alanında sabit kalsın diye açık route kullanılır.
 */
export const dynamic = 'force-static'

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#f7f4ee',
          color: '#1c1b17',
          padding: 56,
          border: '18px solid #f7f4ee',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: '2px dashed #d9d4c6',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: '#b3341e',
              color: '#f7f4ee',
              padding: '8px 16px',
              fontSize: 22,
              letterSpacing: 4,
            }}
          >
            VAKA DOSYASI · TÜKETİCİ
          </div>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, color: '#6e6a5e' }}>
            BD-2026
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '0 24px',
            marginTop: 64,
          }}
        >
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, letterSpacing: -3 }}>
            Barkod Dedektifi
          </div>
          <div style={{ display: 'flex', fontSize: 40, color: '#b3341e' }}>
            {SITE_TAGLINE}.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              lineHeight: 1.4,
              color: '#6e6a5e',
              maxWidth: 760,
            }}
          >
            Boykot, sağlık ve helal kuralları ürüne uygulanır; geriye tek bakışta okunacak net bir
            hüküm kalır.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 'auto',
            padding: '0 24px',
          }}
        >
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 3, color: '#6e6a5e' }}>
            barkoddedektifi.com
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {BARS.map((width, index) => (
              <div
                key={index}
                style={{
                  width,
                  height: 74,
                  background: index % 4 === 0 ? '#b3341e' : '#1c1b17',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}
