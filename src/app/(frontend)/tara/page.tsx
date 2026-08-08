'use client'

import dynamic from 'next/dynamic'

import { EvidenceTag } from '@/components/EvidenceTag'

const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-3 p-8">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-b-stamp" />
      <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
        Kamera yükleniyor…
      </span>
    </div>
  ),
})

export default function TaraPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">CANLI İNCELEME</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Barkodu tarat</h1>
        <p className="text-sm text-muted-foreground">
          Barkodu kameraya gösterin; ürün kayıtlıysa dosyası açılır, kayıtlı değilse ilk ekleyen
          siz olursunuz.
        </p>
      </div>

      <div className="mt-8 rounded-md border border-border bg-card p-4 shadow-sm sm:p-6">
        <BarcodeScanner />
      </div>
    </div>
  )
}
