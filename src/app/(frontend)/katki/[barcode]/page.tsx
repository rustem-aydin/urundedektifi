import type { Metadata } from 'next'
import Link from 'next/link'

import { ContributionForm } from '@/components/ContributionForm'
import { EvidenceTag } from '@/components/EvidenceTag'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Ürün katkısı' }

const BARCODE = /^\d{8,14}$/

export default async function KatkiPage({
  params,
}: {
  params: Promise<{ barcode: string }>
}) {
  const { barcode } = await params
  const code = barcode.replace(/\D/g, '')

  if (!BARCODE.test(code)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EvidenceTag variant="stamp">GEÇERSİZ BARKOD</EvidenceTag>
        <h1 className="mt-2 font-display text-2xl">Barkod okunamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          8–14 haneli bir barkodla tekrar tara.
        </p>
        <Link href="/tara" className="mt-6 inline-block text-sm underline">
          Taramaya dön
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-col items-start gap-2">
        <EvidenceTag variant="stamp">DOSYA YOK · KATKI</EvidenceTag>
        <h1 className="font-display text-2xl sm:text-3xl">Ürün bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          {code} barkoduyla yayında bir dosya yok. Ürünün fotoğraflarını gönder; dosya incelemeye
          alınır, onaylandığında profilinde görünür.
        </p>
      </div>

      <div className="mt-8">
        <ContributionForm barcode={code} />
      </div>
    </div>
  )
}
