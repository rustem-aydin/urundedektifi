import type { MetadataRoute } from 'next'

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: 'tr-TR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f4ee',
    theme_color: '#1c1b17',
    categories: ['food', 'shopping', 'utilities'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
