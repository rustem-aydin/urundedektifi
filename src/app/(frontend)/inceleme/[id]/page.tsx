import type { Metadata } from 'next'
import Link from 'next/link'

import { EvidenceTag } from '@/components/EvidenceTag'
import { ReviewWizard } from '@/components/wizard/ReviewWizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Taslağı incele' }

export default async function IncelemeDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">İNCELEME · #{id}</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Taslağı incele</h1>
        <p className="text-sm text-muted-foreground">
          Katkı fotoğrafları hazır. "Analiz et" yapay zekâyla alanları doldurur; analiz, eşleme ve
          kayıt aynı ekranda. Yayın durumunu seçip kaydet. Katkı onaylanınca katkı sahibinin
          profilinde görünür.
        </p>
        <Link href="/inceleme" className="text-sm underline">
          Kuyruğa dön
        </Link>
      </div>

      <div className="mt-8">
        <ReviewWizard productId={id} />
      </div>
    </div>
  )
}
