import React from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter, Special_Elite, JetBrains_Mono } from 'next/font/google'

import './index.css'

import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/seo'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/session-provider'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
})

const specialElite = Special_Elite({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-special-elite',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jb-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'food',
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: SITE_NAME,
    url: '/',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og',
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1b17' },
  ],
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${inter.variable} ${specialElite.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-svh flex-col font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster position="bottom-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
