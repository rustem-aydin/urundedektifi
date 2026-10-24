import type { Metadata } from 'next'
import { Suspense } from 'react'

import { EvidenceTag } from '@/components/EvidenceTag'
import { LoginForm } from '@/components/LoginForm'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Giriş' }

export default function GirisPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <EvidenceTag variant="stamp">SİSTEM</EvidenceTag>
      <h1 className="mt-2 font-display text-2xl sm:text-3xl">Hesap</h1>
      <div className="mt-8">
        <Suspense
          fallback={
            <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
              Oturum okunuyor…
            </p>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
