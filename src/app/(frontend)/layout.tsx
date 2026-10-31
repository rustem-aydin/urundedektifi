import React from 'react'
import type { Metadata } from 'next'
import { Inter, Special_Elite, JetBrains_Mono } from 'next/font/google'

import './index.css'

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
  title: {
    default: 'Şeffaf Ürün — Barkodu tara, kararı gör',
    template: '%s · Şeffaf Ürün',
  },
  description:
    'Barkodu tara; uzman kurallarına göre ürünün boykot, sağlık ve helal hükmünü anında gör.',
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
