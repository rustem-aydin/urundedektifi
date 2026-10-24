import type { Metadata } from 'next'

import { EvidenceTag } from '@/components/EvidenceTag'
import { SaglayiciForm } from '@/components/SaglayiciForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Yapay Zekâ Sağlayıcısı' }

export default function SaglayiciPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">
      <EvidenceTag variant="stamp">SİSTEM</EvidenceTag>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">Sağlayıcı</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ekle sihirbazının etiket okuma adımı bu sağlayıcıyı kullanır.
      </p>
      <div className="mt-8">
        <SaglayiciForm />
      </div>
    </div>
  )
}
