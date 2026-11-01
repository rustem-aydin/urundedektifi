import type { Metadata } from 'next'

import { EvidenceTag } from '@/components/EvidenceTag'
import { ReviewQueue } from '@/components/ReviewQueue'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'İnceleme kuyruğu' }

export default function IncelemePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">İNCELEME</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Taslak ürünler</h1>
        <p className="text-sm text-muted-foreground">
          Kullanıcı katkıları burada birikir. "Analiz et" ürünü sihirbazda fotoğraflarıyla açar;
          yayınlama oradan yapılır. Reddedilen katkı silinir.
        </p>
      </div>

      <div className="mt-8">
        <ReviewQueue />
      </div>
    </div>
  )
}
