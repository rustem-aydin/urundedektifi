import React from 'react'
import './index.css'

export const metadata = {
  description: 'Ürünlerin boykot, sağlık ve helal durumunu uzmanlarla birlikte öğrenin.',
  title: 'Ürün Dedektifi — Barkodla Ürünü Tara, Dedektifler Yorumlasın',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="tr">
      <body>
        <header className="site-header">
          <div className="container">
            <a href="/" className="logo">
              🔍 Ürün Dedektifi
            </a>
            <nav>
              <a href="/tara">Tara</a>
              <a href="/uzmanlar">Uzmanlar</a>
              <a href="/konular">Konular</a>
              <a href="/sayfa/hakkimizda">Hakkımızda</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p>© {new Date().getFullYear()} Ürün Dedektifi. Tüm hakları saklıdır.</p>
            <p>
              <a href="/sayfa/metodoloji">Metodoloji</a> · <a href="/sayfa/gizlilik">Gizlilik</a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
