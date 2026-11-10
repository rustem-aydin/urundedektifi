import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
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
