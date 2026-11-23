import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` sürüm parmak izi bırakmasın.
  poweredByHeader: false,
  // Tüm yollara (admin paneli ve /api dahil) uygulanan güvenlik başlıkları.
  // CSP bilinçli olarak dar: Next ve Payload admin inline script/stil kullanıyor;
  // nonce/hash altyapısı olmadan `script-src`/`style-src` koymak paneli kırar.
  // Bu yüzden yalnızca çerçeveleme, nesne gömme ve base-uri kısıtlanır.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ]
  },
  // Stil dosyası HTML'e gömülür: 16 KB brotli CSS ayrı istek olarak 15 JS chunk'ıyla
  // bant paylaşıp ilk boyayı ~700 ms geciktiriyordu (ölçüm: cssEnd 977 ms).
  experimental: { inlineCss: true },
  allowedDevOrigins: ['192.168.1.101'],
  images: {
    // Payload medyası kendi rotasından (`/api/media/file/<dosya>`) servis edilir;
    // S3 deposu da aynı göreli URL'i döndürür.
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        // Ana sayfa tanıtım filminin afişi public/ altında durur; optimize edilerek
        // (AVIF/WebP) servis edilmesi için yol izin listesine eklenir.
        pathname: '/video/**',
      },
    ],
    // Tarayıcı AVIF destekliyorsa AVIF, yoksa WebP alır: JPEG orijinallere göre
    // liste sayfası ~3,2 MB yerine ~250 KB görsel indirir.
    formats: ['image/avif', 'image/webp'],
    // Kullanılan kaliteler açıkça listelenir (Next 16 bilinmeyen `quality` değerini reddeder).
    qualities: [60, 75],
    // Medya dosya adları içerikle birlikte değişmez (uuid/barkod); 7 gün optimize
    // edilmiş çıktıyı diskte tutmak yeniden boyutlandırmayı tekrar tetiklemez.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    // Üretilen türev genişlikleri: kart (96–256 px), galeri (480–1024 px), tam ekran.
    deviceSizes: [420, 640, 828, 1080, 1280, 1920],
    imageSizes: [48, 64, 96, 128, 192, 256, 384],
  },
  // Turbopack'i kapat - Payload CMS şu an için Webpack ile daha stabil
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
