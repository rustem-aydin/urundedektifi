import type { Metadata } from 'next'

import { EvidenceTag } from '@/components/EvidenceTag'
import { DuzenleScreen } from '@/components/wizard/DuzenleScreen'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Ürün düzenle' }

export default async function DuzenlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">DÜZENLEME</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürün düzenle</h1>
        <p className="text-sm text-muted-foreground">
          Form ürünün kayıtlı değerleriyle dolar. Kaydettiğinde bu değerler ürünün üzerine yazılır;
          eşlenmemiş satırlar ürüne bağlanmaz.
        </p>
      </div>

      <div className="mt-8">
        <DuzenleScreen productId={id} />
      </div>
    </div>
  )
}
