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
      <body> {children}</body>
    </html>
  )
}
