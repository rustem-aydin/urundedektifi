'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { Button } from '@/components/ui/button'

/**
 * Sunucu bileşeni hata verdiğinde gösterilir. `reset` yalnız hata sınırını
 * yeniden dener; sayfa yenilenmez. Teknik ayrıntı yerine `digest` kodu verilir,
 * kullanıcı onu destek talebine ekleyebilir.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6 px-4 py-16">
      <EvidenceTag variant="stamp">DOSYA AÇILAMADI</EvidenceTag>
      <CaseCard className="w-full p-6 sm:p-8">
        <p className="font-mono text-[0.7rem] tracking-[0.3em] text-faded uppercase">
          Beklenmeyen hata
        </p>
        <h1 className="mt-2 font-display text-2xl sm:text-3xl">Bir şeyler ters gitti</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Dosya açılırken beklenmeyen bir sorun çıktı. Tekrar deneyebilirsin; sorun sürerse ana
          sayfadan devam et.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs break-all text-muted-foreground">
            Hata kodu: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" className="h-9 px-4" onClick={() => reset()}>
            <RotateCcw aria-hidden="true" />
            Tekrar dene
          </Button>
          <Button asChild variant="outline" className="h-9 px-4">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Ana sayfa
            </Link>
          </Button>
        </div>
      </CaseCard>
    </div>
  )
}
