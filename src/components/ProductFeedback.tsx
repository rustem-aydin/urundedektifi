'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { CaseCard } from '@/components/CaseCard'
import { CaseSection } from '@/components/CaseSection'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { VerdictStamp } from '@/components/VerdictStamp'
import {
  deleteFeedbackComment,
  fetchProductFeedback,
  submitFeedbackComment,
  submitFeedbackVote,
} from '@/lib/wizard/api'
import type {
  FeedbackTargetKey,
  FeedbackVerdict,
  ProductFeedback,
} from '@/lib/wizard/types'
import { cn } from '@/lib/utils'

/**
 * Ürün verisi doğrulaması + yorumlar (ADR 0013).
 *
 * Bölüm başlığının yanında rozet ("%86 · 12 doğrulama") ve "Doğrula" durur. Doğrulama
 * bir yorumdur: varsayılan metin hazır gelir, "doğru değil" seçilirse metin
 * "Doğru olmadığını bildiriyorum çünkü ..." diye başlar. Yorumlar tek düz listede,
 * en yeni üstte; doğrulama yorumları hangi bölüme ait olduğunu taşır.
 */

export const FEEDBACK_TARGETS: { key: FeedbackTargetKey; label: string }[] = [
  { key: 'uyarilar', label: 'Uyarılar' },
  { key: 'icindekiler', label: 'İçindekiler' },
  { key: 'besin-degerleri', label: 'Besin değerleri' },
  { key: 'genel-bilgiler', label: 'Genel bilgiler' },
  { key: 'teknik-ozellikler', label: 'Teknik özellikler' },
  { key: 'aciklama', label: 'Açıklama' },
]

const TARGET_LABELS = Object.fromEntries(
  FEEDBACK_TARGETS.map((target) => [target.key, target.label]),
) as Record<FeedbackTargetKey, string>

const DEFAULT_CONFIRM_TEXT = 'Verilerin doğruluğunu teyit ediyorum.'
const REFUTE_PREFIX = 'Doğru olmadığını bildiriyorum çünkü '
const MAX_TEXT = 500

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

type FeedbackContextValue = {
  data: ProductFeedback | null
  loading: boolean
  pending: boolean
  error: string | null
  refresh: () => Promise<void>
  vote: (input: { target: FeedbackTargetKey; verdict: FeedbackVerdict; note: string }) => Promise<void>
  comment: (text: string) => Promise<void>
  remove: (id: string) => Promise<void>
  loadMore: () => Promise<void>
  openVerify: (target: FeedbackTargetKey) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('ProductFeedbackProvider eksik.')
  return value
}

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

export function ProductFeedbackProvider({
  barcode,
  children,
}: {
  barcode: string
  children: ReactNode
}) {
  const { token, user, restoring } = useSession()
  const [data, setData] = useState<ProductFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [openTarget, setOpenTarget] = useState<FeedbackTargetKey | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(
    async (nextLimit: number) => {
      const next = await fetchProductFeedback(barcode, token, { limit: nextLimit })
      if (mounted.current) setData(next)
      return next
    },
    [barcode, token],
  )

  useEffect(() => {
    if (restoring) return
    let active = true
    setLoading(true)
    fetchProductFeedback(barcode, token, { limit })
      .then((next) => {
        if (!active) return
        setData(next)
        setError(null)
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught, 'Yorumlar yüklenemedi.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [barcode, token, restoring, limit])

  const refresh = useCallback(async () => {
    await load(limit)
  }, [load, limit])

  /** Yazma yanıtı ilk sayfayı taşır; daha fazla yorum açılmışsa tamamı yeniden çekilir. */
  const apply = useCallback(
    async (next: ProductFeedback) => {
      if (limit === 20) setData(next)
      else await load(limit)
    },
    [limit, load],
  )

  const value: FeedbackContextValue = {
    data,
    loading,
    pending,
    error,
    refresh,
    async vote(input) {
      if (!token) throw new Error('Giriş gerekli.')
      setPending(true)
      setError(null)
      try {
        await apply(await submitFeedbackVote(barcode, input, token))
        setOpenTarget(null)
      } catch (caught) {
        setError(errorMessage(caught, 'Doğrulama gönderilemedi.'))
        throw caught
      } finally {
        setPending(false)
      }
    },
    async comment(text) {
      if (!token) throw new Error('Giriş gerekli.')
      setPending(true)
      setError(null)
      try {
        await apply(await submitFeedbackComment(barcode, text, token))
      } catch (caught) {
        setError(errorMessage(caught, 'Yorum eklenemedi.'))
        throw caught
      } finally {
        setPending(false)
      }
    },
    async remove(id) {
      if (!token) throw new Error('Giriş gerekli.')
      setPending(true)
      setError(null)
      try {
        await apply(await deleteFeedbackComment(barcode, id, token))
      } catch (caught) {
        setError(errorMessage(caught, 'Yorum silinemedi.'))
        throw caught
      } finally {
        setPending(false)
      }
    },
    async loadMore() {
      const nextLimit = limit + 20
      setLimit(nextLimit)
      await load(nextLimit).catch((caught) => {
        setError(errorMessage(caught, 'Yorumlar yüklenemedi.'))
      })
    },
    openVerify(target) {
      if (!user) return
      setOpenTarget(target)
    },
  }

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <VerifyDialog
        target={openTarget}
        initialVerdict={openTarget ? (data?.myVotes[openTarget] ?? null) : null}
        pending={pending}
        error={error}
        onClose={() => setOpenTarget(null)}
        onSubmit={(input) => {
          void value.vote(input).catch(() => {
            /* hata context üzerinden gösterilir */
          })
        }}
      />
    </FeedbackContext.Provider>
  )
}

/** Bölüm başlığı hizası: yüzde + doğrulama sayısı + "Doğrula". */
export function FeedbackAside({ target }: { target: FeedbackTargetKey }) {
  const { data, loading, openVerify } = useFeedback()
  const { user } = useSession()
  const pathname = usePathname()
  const summary = data?.targets[target]
  const myVote = data?.myVotes[target]

  const badge = summary?.total
    ? `%${summary.percent ?? 0} · ${summary.confirm} doğrulama`
    : loading
      ? 'Doğrulamalar yükleniyor…'
      : 'Henüz doğrulanmadı'

  const buttonClass =
    'inline-flex min-h-7 items-center rounded-sm border border-stamp/60 bg-stamp/5 px-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase text-stamp transition-colors hover:bg-stamp/10'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
        {badge}
      </span>
      {summary?.refute ? (
        <span className="font-mono text-[0.65rem] tracking-[0.14em] text-stamp uppercase">
          {summary.refute} itiraz
        </span>
      ) : null}
      {myVote ? (
        <span
          className={cn(
            'font-mono text-[0.65rem] tracking-[0.14em] uppercase',
            myVote === 'confirm' ? 'text-evidence-green' : 'text-stamp',
          )}
        >
          {myVote === 'confirm' ? 'Oyun: doğru' : 'Oyun: doğru değil'}
        </span>
      ) : null}
      {user ? (
        <button type="button" className={buttonClass} onClick={() => openVerify(target)}>
          {myVote ? 'Oyunu değiştir' : 'Doğrula'}
        </button>
      ) : (
        <Link
          href={pathname ? `/giris?next=${encodeURIComponent(pathname)}` : '/giris'}
          className={buttonClass}
        >
          Doğrula
        </Link>
      )}
    </div>
  )
}

function VerifyDialog({
  target,
  initialVerdict,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  target: FeedbackTargetKey | null
  initialVerdict: FeedbackVerdict | null
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: { target: FeedbackTargetKey; verdict: FeedbackVerdict; note: string }) => void
}) {
  const [verdict, setVerdict] = useState<FeedbackVerdict>('confirm')
  const [note, setNote] = useState(DEFAULT_CONFIRM_TEXT)
  const open = target !== null
  const key = target ? `${target}:${initialVerdict ?? 'new'}` : null
  const initializedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!key || initializedFor.current === key) return
    initializedFor.current = key
    const nextVerdict: FeedbackVerdict = initialVerdict ?? 'confirm'
    setVerdict(nextVerdict)
    setNote(nextVerdict === 'confirm' ? DEFAULT_CONFIRM_TEXT : '')
  }, [key, initialVerdict])

  useEffect(() => {
    if (!open) initializedFor.current = null
  }, [open])

  if (!target) return null

  function pick(next: FeedbackVerdict) {
    if (next === verdict) return
    setVerdict(next)
    if (next === 'confirm') {
      setNote(note.trim() === '' ? DEFAULT_CONFIRM_TEXT : note)
    } else if (note.trim() === DEFAULT_CONFIRM_TEXT) {
      setNote('')
    }
  }

  const submitDisabled = pending || (verdict === 'refute' && note.trim().length === 0)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${TARGET_LABELS[target]} doğrulaması`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
        <CaseCard className="bg-card">
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[0.65rem] tracking-[0.2em] text-stamp uppercase">
                Doğrulama
              </span>
              <h2 className="font-display text-xl">{TARGET_LABELS[target]}</h2>
              <p className="text-sm text-muted-foreground">
                Verilerin doğru olduğunu teyit edebilir ya da neden doğru olmadığını yazabilirsin.
                Yorumun ürün sayfasında görünür.
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Doğrulama kararı">
              <button
                type="button"
                aria-pressed={verdict === 'confirm'}
                onClick={() => pick('confirm')}
                className={cn(
                  'min-h-9 rounded-sm border px-3 font-mono text-[0.7rem] tracking-[0.12em] uppercase transition-colors',
                  verdict === 'confirm'
                    ? 'border-evidence-green bg-evidence-green/10 text-evidence-green'
                    : 'border-border bg-card text-foreground hover:border-foreground/60',
                )}
              >
                Doğru
              </button>
              <button
                type="button"
                aria-pressed={verdict === 'refute'}
                onClick={() => pick('refute')}
                className={cn(
                  'min-h-9 rounded-sm border px-3 font-mono text-[0.7rem] tracking-[0.12em] uppercase transition-colors',
                  verdict === 'refute'
                    ? 'border-stamp bg-stamp/10 text-stamp'
                    : 'border-border bg-card text-foreground hover:border-foreground/60',
                )}
              >
                Doğru değil
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                Yorum
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={MAX_TEXT}
                rows={4}
                placeholder={
                  verdict === 'confirm' ? DEFAULT_CONFIRM_TEXT : 'Neden doğru değil?'
                }
                className="w-full resize-y rounded-sm border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/60"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {verdict === 'confirm'
                ? 'Boş bırakırsan varsayılan metin eklenir.'
                : `Yorumun "${REFUTE_PREFIX.trim()} …" diye başlar; nedeni sen yazarsın.`}
            </p>

            {error ? (
              <p role="alert" className="text-sm text-stamp">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={submitDisabled}
                onClick={() => onSubmit({ target, verdict, note: note.trim() })}
                className="min-h-9 rounded-sm bg-stamp px-4 font-mono text-[0.7rem] tracking-[0.16em] uppercase text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-9 rounded-sm border border-border px-3 font-mono text-[0.7rem] tracking-[0.16em] uppercase text-foreground transition-colors hover:border-foreground/60"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </CaseCard>
      </div>
    </div>
  )
}

/** Dosya 09: yorum kutusu + yorum/doğrulama akışı. */
export function FeedbackCommentsSection() {
  const { data, loading, pending, error, comment, remove, loadMore } = useFeedback()
  const [draft, setDraft] = useState('')
  const pathname = usePathname()

  async function send() {
    const text = draft.trim()
    if (!text) return
    try {
      await comment(text)
      setDraft('')
    } catch {
      /* hata context üzerinden gösterilir; taslak korunur */
    }
  }

  return (
    <CaseSection
      id="yorumlar"
      eyebrow="Dosya 09"
      title={`Yorumlar${data ? ` (${data.totalComments})` : ''}`}
      hasData={Boolean(data)}
      emptyMessage={
        loading
          ? 'Yorumlar yükleniyor…'
          : 'Bu ürüne henüz yorum yazılmadı. İlk yorumu sen ekle.'
      }
    >
      <div className="mt-4 flex flex-col gap-4">
        {data?.signedIn ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                Yorumun
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={MAX_TEXT}
                rows={3}
                placeholder="Ürün hakkında bildiğin bir şey var mı? (en fazla 500 karakter)"
                className="w-full resize-y rounded-sm border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/60"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending || draft.trim().length === 0}
                onClick={() => void send()}
                className="min-h-9 rounded-sm bg-stamp px-4 font-mono text-[0.7rem] tracking-[0.16em] uppercase text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? 'Gönderiliyor…' : 'Yorum ekle'}
              </button>
              <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                {draft.trim().length}/{MAX_TEXT}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Yorum yazmak ve verileri doğrulamak için{' '}
            <Link
              href={pathname ? `/giris?next=${encodeURIComponent(pathname)}` : '/giris'}
              className="underline underline-offset-2 hover:text-foreground"
            >
              giriş yap
            </Link>
            .
          </p>
        )}

        {error ? (
          <p role="alert" className="text-sm text-stamp">
            {error}
          </p>
        ) : null}

        {data && data.totalComments === 0 ? (
          <p className="text-sm text-muted-foreground">Bu ürüne henüz yorum yazılmadı.</p>
        ) : null}

        {data?.comments.map((entry) => (
          <CaseCard key={entry.id}>
            <div className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-medium">{entry.authorName}</span>
                <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                  {dateFormat.format(new Date(entry.createdAt))}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {entry.targetLabel ? <EvidenceTag>{entry.targetLabel}</EvidenceTag> : null}
                {entry.verdict === 'confirm' ? (
                  <VerdictStamp variant="safe">Doğruladı</VerdictStamp>
                ) : null}
                {entry.verdict === 'refute' ? (
                  <VerdictStamp variant="danger">İtiraz</VerdictStamp>
                ) : null}
                {entry.kind === 'comment' ? <EvidenceTag variant="tape">Yorum</EvidenceTag> : null}
              </div>
              <p className="text-sm leading-7 whitespace-pre-line text-foreground">{entry.text}</p>
              {entry.canDelete ? (
                <button
                  type="button"
                  className="self-end font-mono text-[0.65rem] tracking-[0.14em] text-stamp uppercase hover:underline"
                  onClick={() => {
                    if (window.confirm('Bu yorum kalıcı olarak silinecek. Devam edilsin mi?')) {
                      void remove(entry.id).catch(() => {
                        /* hata context üzerinden gösterilir */
                      })
                    }
                  }}
                >
                  Sil
                </button>
              ) : null}
            </div>
          </CaseCard>
        ))}

        {data?.hasMore ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="self-start rounded-sm border border-border px-3 py-2 font-mono text-[0.7rem] tracking-[0.16em] uppercase transition-colors hover:border-foreground/60"
          >
            Daha fazla yorum
          </button>
        ) : null}
      </div>
    </CaseSection>
  )
}
