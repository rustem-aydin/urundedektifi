'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'

/**
 * Katkı girişi (ADR 0024): barkod biliniyorsa elle yazılır, bilinmiyorsa kamerayla taranır.
 * Ürün kayıtlıysa dosyası açılır; değilse fotoğraf formuna geçilir.
 */
export function ContributionEntry() {
  const router = useRouter()
  const { user } = useSession()
  const [code, setCode] = useState('')
  const digits = code.replace(/\D/g, '')

  return (
    <CaseCard className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[0.65rem] tracking-[0.16em] text-faded uppercase">
          BARKOD
        </span>
        <p className="text-sm text-muted-foreground">
          Elindeki ürünün barkodunu yaz. Kayıtlıysa dosyası açılır; kayıtlı değilse fotoğraflarını
          gönderip dosyayı sen açarsın.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          inputMode="numeric"
          autoComplete="off"
          placeholder="8690000000000"
          aria-label="Barkod numarası"
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 14))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && digits.length >= 8) router.push(`/katki/${digits}`)
          }}
          className="h-11 w-full flex-1 rounded-md border-2 border-foreground bg-card px-3 font-mono text-base tracking-[0.2em] sm:w-auto"
        />
        <Button
          type="button"
          className="h-11 px-5"
          disabled={digits.length < 8}
          onClick={() => router.push(`/katki/${digits}`)}
        >
          Devam et
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" asChild>
          <Link href="/tara">Kamerayla tara</Link>
        </Button>
        {user ? (
          <Button type="button" variant="ghost" className="h-11" asChild>
            <Link href={`/profil/${user.id}`}>Katkılarım</Link>
          </Button>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <EvidenceTag variant="tape">1–6 FOTOĞRAF</EvidenceTag>
        <EvidenceTag variant="tape">İNCELEME SONRASI YAYIN</EvidenceTag>
        Katkı için giriş gerekir; gönderdiğin dosya editör onayına düşer.
      </p>
    </CaseCard>
  )
}
