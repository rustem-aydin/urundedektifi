'use client'

import Link from 'next/link'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { CaseSection } from '@/components/CaseSection'
import { ExpertVerdicts, type ExpertAvatar } from '@/components/ExpertVerdicts'
import { useSession } from '@/components/session-provider'
import { VerdictStamp } from '@/components/VerdictStamp'
import { fetchVerdict, type ProductVerdict } from '@/lib/wizard/api'

/**
 * Ürün Dosyası'ndaki hükümler takibe bağlıdır: yalnız oturum sahibinin takip ettiği
 * uzmanların hükümleri görünür. Veri `/api/products/verdict/:barcode` ucundan JWT ile
 * çekilir; misafir ya da hiç takip etmeyen kullanıcı boş liste alır.
 *
 * Tek istek iki yerde kullanılır (üst bilgi rozeti + Dosya 01), bu yüzden provider
 * sayfa köküne konur.
 */

type VerdictState = { data: ProductVerdict | null; loading: boolean }

const VerdictContext = createContext<VerdictState>({ data: null, loading: true })

export function ProductVerdictProvider({
  barcode,
  children,
}: {
  barcode: string
  children: ReactNode
}) {
  const { token, restoring, followingIds } = useSession()
  const [state, setState] = useState<VerdictState>({ data: null, loading: true })
  const followingKey = followingIds.join(',')

  useEffect(() => {
    if (restoring) return
    let cancelled = false
    setState((previous) => ({ data: previous.data, loading: true }))
    fetchVerdict(barcode, token)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false })
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false })
      })
    return () => {
      cancelled = true
    }
    // followingKey: takip değişince hüküm yeniden çekilir (başka sekmede takip edilmiş olabilir).
  }, [barcode, token, restoring, followingKey])

  return <VerdictContext.Provider value={state}>{children}</VerdictContext.Provider>
}

/** Üst bilgi rozeti: takip edilen uzmanların eşleşen kural sayısı. */
export function MatchedStamp() {
  const { data, loading } = useContext(VerdictContext)
  if (loading || !data || data.totalMatched === 0) return null
  return <VerdictStamp variant="warn">{data.totalMatched} delil eşleşti</VerdictStamp>
}

/** Dosya 01: hüküm listesi ya da "uzman takip edin" boş durumu. */
export function VerdictSection({ avatars }: { avatars: Record<string, ExpertAvatar> }) {
  const { data, loading } = useContext(VerdictContext)
  const verdicts = data?.byExpert ?? []
  const total = data?.totalMatched ?? 0

  return (
    <CaseSection
      id="hukumler"
      eyebrow="Dosya 01"
      title={
        <>
          Uzman hükümleri <span className="font-mono text-base text-faded">({total})</span>
        </>
      }
      hasData={verdicts.length > 0}
      emptyMessage={
        loading
          ? 'Hükümler yükleniyor…'
          : data?.hasOtherMatches
            ? 'Bu ürünle eşleşen hükümler var, ama takip ettiğin uzmanlardan değil. Hükümleri görmek için o uzmanları takip et.'
            : 'Bu ürünle eşleşen aktif kural yok. Uzmanlar yeni kural ekledikçe bu dosya güncellenir.'
      }
      emptyAction={
        loading ? null : (
          <Link
            href="/uzmanlar"
            className="inline-flex min-h-9 items-center rounded-sm border border-foreground/25 bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/60 hover:bg-muted"
          >
            Uzmanlara git
          </Link>
        )
      }
    >
      <ExpertVerdicts verdicts={verdicts} avatars={avatars} />
    </CaseSection>
  )
}
