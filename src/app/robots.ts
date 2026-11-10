import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo'

/**
 * Arama motoru kuralları.
 *
 * `/api/media` bilinçli olarak engellenmez: ürün görselleri bu yoldan servis
 * edilir ve Google Görseller'in dosyaları okuyabilmesi gerekir. Yönetim paneli,
 * JSON API uçları ve oturum gerektiren sayfalar taranmaz.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/graphql',
          '/api/mcp',
          '/api/users',
          '/giris',
          '/kayit',
          '/duzenle',
          '/profil',
          '/inceleme',
          '/saglayici',
          '/katki',
          '/my-route',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
