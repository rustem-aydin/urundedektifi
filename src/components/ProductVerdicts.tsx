'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { AsyncError } from '@/components/AsyncError'
import { CaseSection } from '@/components/CaseSection'
import { ExpertVerdicts, type ExpertAvatar } from '@/components/ExpertVerdicts'
import { useSession } from '@/components/session-provider'
import { VerdictStamp } from '@/components/VerdictStamp'
import { fetchVerdict, type ProductVerdict } from '@/lib/wizard/api'
import { userMessage } from '@/lib/userMessages'

/**
 * Ürün Dosyası'ndaki hükümler takibe bağlıdır: yalnız oturum sahibinin takip ettiği
 * uzmanların hükümleri görünür. Veri `/api/products/verdict/:barcode` ucundan JWT ile
 * çekilir; misafir ya da hiç takip etmeyen kullanıcı boş liste alır.
 *
 * Tek istek iki yerde kullanılır (üst bilgi rozeti + Dosya 01), bu yüzden provider
 * sayfa köküne konur.
 */

/**
 * Üç durum: yükleniyor | hata | veri (boş olabilir). Hata, "eşleşen kural yok"
 * iddiasına dönüşmemeli — boykot/helal gibi konularda yanlış güven verir.
 */
type VerdictState = {
  data: ProductVerdict | null
  loading: boolean
  error: string | null
  retry: () => void
}

const VerdictContext = createContext<VerdictState>({
  data: null,
  loading: true,
  error: null,
  retry: () => {},
})

export function ProductVerdictProvider({
  barcode,
  children,
}: {
  barcode: string
  children: ReactNode
}) {
  const { token, restoring, followingIds } = useSession()
  const [state, setState] = useState<Omit<VerdictState, 'retry'>>({
    data: null,
    loading: true,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)
  const followingKey = followingIds.join(',')

  useEffect(() => {
    if (restoring) return
    let cancelled = false
    setState((previous) => ({ data: previous.data, loading: true, error: null }))
    fetchVerdict(barcode, token)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({
            data: null,
            loading: false,
            error: `Görüşler yüklenemedi. ${userMessage(caught, 'Bağlantını kontrol edip tekrar dene.')}`,
          })
      })
    return () => {
      cancelled = true
    }
    // followingKey: takip değişince hüküm yeniden çekilir (başka sekmede takip edilmiş olabilir).
  }, [barcode, token, restoring, followingKey, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return <VerdictContext.Provider value={{ ...state, retry }}>{children}</VerdictContext.Provider>
}

/** Üst bilgi rozeti: takip edilen uzmanların eşleşen görüş sayısı. Hata/boşta rozet yok. */
export function MatchedStamp() {
  const { data, loading, error } = useContext(VerdictContext)
  if (loading || error || !data || data.totalMatched === 0) return null
  return <VerdictStamp variant="warn">{data.totalMatched} görüş</VerdictStamp>
}

/** Dosya 01: hüküm listesi ya da "uzman takip edin" boş durumu. */
export function VerdictSection({ avatars }: { avatars: Record<string, ExpertAvatar> }) {
  const { data, loading, error, retry } = useContext(VerdictContext)
  const verdicts = data?.byExpert ?? []
  const total = data?.totalMatched ?? 0

  // Hüküm listesinin üstünde "ne zaman güncellendi" görünmeli: marka itirazında
  // ilk sorulan şey görüşün yaşı. Tarih, eşleşen dayanakların en yeni güncellemesidir.
  const lastUpdated = verdicts
    .flatMap((entry) => entry.matchedRules)
    .map((rule) => rule.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const lastUpdatedLabel = lastUpdated
    ? new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(lastUpdated))
    : null

  return (
    <CaseSection
      id="gorusler"
      eyebrow="Dosya 01"
      title={
        <>
          Uzman görüşleri{' '}
          {data ? <span className="font-mono text-base text-faded">({total})</span> : null}
        </>
      }
      hasData={verdicts.length > 0}
      hasError={Boolean(error)}
      emptyMessage={
        loading
          ? 'Görüşler yükleniyor…'
          : data?.hasOtherMatches
            ? 'Bu ürünle eşleşen görüşler var, ama takip ettiğin uzmanlardan değil. İlgili uzmanları takip edince görüşler burada görünür.'
            : 'Bu ürünle eşleşen aktif görüş yok. Uzmanlar yeni dayanak ekledikçe bu bölüm güncellenir.'
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
      {error ? (
        <AsyncError className="mt-4" message={error} onRetry={retry} />
      ) : (
        <>
          {lastUpdatedLabel ? (
            <p className="mt-3 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
              Dayanakların son güncellemesi · {lastUpdatedLabel}
            </p>
          ) : null}
          <ExpertVerdicts verdicts={verdicts} avatars={avatars} />
        </>
      )}
    </CaseSection>
  )
}
