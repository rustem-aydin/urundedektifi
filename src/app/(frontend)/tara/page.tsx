'use client'

import dynamic from 'next/dynamic'

// Tarayıcı yalnız istemcide açılır: html5-qrcode kamera API'lerine doğrudan erişir.
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center gap-3 bg-black">
      <div className="size-6 animate-spin rounded-full border-2 border-white/25 border-b-white" />
      <span className="font-mono text-xs tracking-[0.18em] text-white/80 uppercase">
        Kamera yükleniyor…
      </span>
    </div>
  ),
})

export default function TaraPage() {
  return (
    <>
      <h1 className="sr-only">Barkodu tara</h1>
      <BarcodeScanner />
    </>
  )
}
