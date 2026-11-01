import type { Metadata } from 'next'

import { ContributionEntry } from '@/components/ContributionEntry'
import { EvidenceTag } from '@/components/EvidenceTag'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Ürün katkısı' }

export default function KatkiGirisPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">KATKI</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürün fotoğrafı gönder</h1>
        <p className="text-sm text-muted-foreground">
          Katalogda olmayan bir ürün mü elinde? Barkodunu yaz, fotoğraflarını gönder; dosya
          incelemeye alınır, onaylandığında profilinizde gösterilir.
        </p>
      </div>

      <div className="mt-8">
        <ContributionEntry />
      </div>
    </div>
  )
}
