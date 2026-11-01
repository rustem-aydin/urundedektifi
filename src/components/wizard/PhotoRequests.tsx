'use client'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import type { Extraction } from '@/lib/wizard/ai'

/**
 * YZ'nin eksik bulduğu fotoğraflar: analiz sonrası sayfa akışında, fotoğraf çekmecesinin
 * dışında durur. Çekmece yalnız fotoğraf yönetir; talep listesi okunurken gözden kaçmasın
 * diye ana akışta kalır (ADR 0027).
 */
export function PhotoRequests({ requests }: { requests: Extraction['requests'] }) {
  if (!requests.length) return null

  return (
    <CaseCard className="flex flex-col gap-2 p-4" tape>
      <EvidenceTag variant="stamp">YAPAY ZEKÂ TALEBİ</EvidenceTag>
      <p className="font-display text-base">Eksik kalan fotoğraflar</p>
      {requests.map((request, index) => (
        <div key={`${request.need}-${index}`} className="flex flex-col gap-0.5">
          <p className="text-sm">
            {index + 1}. {request.need}
          </p>
          <p className="text-sm text-muted-foreground">{request.hint}</p>
          {request.fields.length ? (
            <p className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
              ALANLAR: {request.fields.join(', ')}
            </p>
          ) : null}
        </div>
      ))}
      <p className="text-sm text-muted-foreground">
        Fotoğrafı alttaki çekmeceden ekleyip yeniden analiz et.
      </p>
    </CaseCard>
  )
}
