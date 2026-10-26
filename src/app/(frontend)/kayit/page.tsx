import type { Metadata } from 'next'
import { Suspense } from 'react'

import { EvidenceTag } from '@/components/EvidenceTag'
import { RegisterForm } from '@/components/RegisterForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Hesap oluştur' }

export default function KayitPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <EvidenceTag variant="stamp">HESAP</EvidenceTag>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">Hesap aç</h1>
      <div className="mt-8">
        <Suspense
          fallback={
            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
              Oturum okunuyor…
            </p>
          }
        >
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
