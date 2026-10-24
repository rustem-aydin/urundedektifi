import type { Metadata } from 'next'

import { EvidenceTag } from '@/components/EvidenceTag'
import { EkleWizard } from '@/components/wizard/EkleWizard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Ürün Ekle' }

export default async function EklePage({
  searchParams,
}: {
  searchParams: Promise<{ barcode?: string }>
}) {
  const { barcode } = await searchParams

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">YENİ DOSYA</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürün Ekle</h1>
        <p className="text-sm text-muted-foreground">
          Barkodu yaz, fotoğrafları ekle, yapay zekâ etiketi okusun. Sonra onayla, master kayıtlara bağla
          ve dosyayı kaydet. Taslak bulunduğun adımda saklanır.
        </p>
      </div>

      <div className="mt-8">
        <EkleWizard initialBarcode={barcode ?? ''} />
      </div>
    </div>
  )
}
