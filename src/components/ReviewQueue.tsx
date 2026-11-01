'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ImageLightbox, type LightboxImage } from '@/components/ImageLightbox'
import { useSession } from '@/components/session-provider'
import { Button } from '@/components/ui/button'
import {
  ApiError,
  fetchReviewQueue,
  markReviewed,
  rejectContribution,
  type ReviewItem,
} from '@/lib/wizard/api'

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı.'
}

/**
 * İnceleme kuyruğu (ADR 0024): taslak ürünler, görülmemişler önce.
 * "Analiz et" mevcut sihirbazı `productId` modunda açar; yayınlama oradan yapılır.
 * Reddedilen katkı silinir — katkı sahibinin profiline düşmez.
 */
export function ReviewQueue() {
  const router = useRouter()
  const { user, token, restoring } = useSession()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ images: LightboxImage[]; index: number } | null>(null)

  const allowed = user?.role === 'admin' || user?.role === 'editor'

  const load = useCallback(async () => {
    if (!token || !allowed) return
    setLoading(true)
    try {
      setItems(await fetchReviewQueue(token))
      setFailure(null)
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setLoading(false)
    }
  }, [allowed, token])

  useEffect(() => {
    if (restoring) return
    void load()
  }, [load, restoring])

  async function toggleSeen(item: ReviewItem) {
    if (!token) return
    setBusyId(item.id)
    try {
      await markReviewed(item.id, !item.seen, token)
      setItems((current) =>
        current
          .map((row) => (row.id === item.id ? { ...row, seen: !row.seen } : row))
          .sort((a, b) => {
            if (a.seen !== b.seen) return a.seen ? 1 : -1
            return (a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1
          }),
      )
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusyId(null)
    }
  }

  async function reject(item: ReviewItem) {
    if (!token) return
    const ok = window.confirm(
      `"${item.barcode ?? item.id}" katkısı silinsin mi? Bu işlem geri alınamaz; katkı sahibinin profilinde görünmez.`,
    )
    if (!ok) return
    setBusyId(item.id)
    try {
      await rejectContribution(item.id, token)
      setItems((current) => current.filter((row) => row.id !== item.id))
    } catch (error) {
      setFailure(describe(error))
    } finally {
      setBusyId(null)
    }
  }

  if (restoring) {
    return (
      <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
        Oturum okunuyor…
      </p>
    )
  }

  if (!user) {
    return (
      <CaseCard className="flex flex-col items-start gap-3 p-5">
        <EvidenceTag variant="stamp">GİRİŞ GEREKLİ</EvidenceTag>
        <p className="text-sm text-muted-foreground">
          İnceleme kuyruğu yalnız editör ve yöneticilere açıktır.
        </p>
        <Button asChild>
          <Link href={`/giris?next=${encodeURIComponent('/inceleme')}`}>Giriş yap</Link>
        </Button>
      </CaseCard>
    )
  }

  if (!allowed) {
    return (
      <CaseCard className="flex flex-col items-start gap-3 p-5">
        <EvidenceTag variant="stamp">YETKİ YOK</EvidenceTag>
        <p className="text-sm text-muted-foreground">
          Bu sayfa editör ve yönetici hesaplarına açıktır.
        </p>
      </CaseCard>
    )
  }

  const unseen = items.filter((item) => !item.seen).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceTag variant="tape">{items.length} taslak</EvidenceTag>
        <EvidenceTag>{unseen} görülmemiş</EvidenceTag>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </Button>
      </div>

      {failure ? (
        <p role="alert" className="text-sm text-stamp">
          {failure}
        </p>
      ) : null}

      {items.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">İncelenecek taslak yok.</p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <CaseCard className="flex h-full gap-3 p-3">
              {item.photos.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setViewer({
                      index: 0,
                      images: item.photos.map((photo, index) => ({
                        url: photo.url,
                        alt: photo.alt || item.barcode || 'Katkı fotoğrafı',
                        label: index === 0 ? 'Ön yüz' : `Fotoğraf ${index + 1}`,
                      })),
                    })
                  }
                  aria-label={`${item.barcode ?? 'Katkı'} fotoğraflarını tam boyut aç`}
                  className="group relative size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.photos[0].url}
                    alt={item.frontImageAlt || item.barcode || 'Katkı fotoğrafı'}
                    className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  {item.photos.length > 1 ? (
                    <span className="pointer-events-none absolute right-0 bottom-0 rounded-tl-sm bg-foreground/80 px-1 py-0.5 font-mono text-[0.6rem] text-background">
                      {item.photos.length} foto
                    </span>
                  ) : null}
                </button>
              ) : (
                <span className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted font-mono text-[0.6rem] uppercase text-faded">
                  KARE YOK
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <EvidenceTag>{item.barcode ?? '—'}</EvidenceTag>
                  {item.seen ? <EvidenceTag variant="tape">BAKILDI</EvidenceTag> : <EvidenceTag variant="stamp">YENİ</EvidenceTag>}
                </div>
                <p className="line-clamp-2 text-sm font-medium break-words">
                  {item.name?.trim() || 'İsimsiz katkı'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.submitterName ?? 'Bilinmeyen kullanıcı'} · {item.photoCount} fotoğraf
                  {item.createdAt ? ` · ${dateFormat.format(new Date(item.createdAt))}` : ''}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push(`/inceleme/${item.id}`)}
                  >
                    Analiz et
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => void toggleSeen(item)}
                  >
                    {item.seen ? 'İşareti kaldır' : 'Baktım'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busyId === item.id}
                    onClick={() => void reject(item)}
                  >
                    Reddet
                  </Button>
                </div>
              </div>
            </CaseCard>
          </li>
        ))}
      </ul>

      <ImageLightbox
        images={viewer?.images ?? []}
        index={viewer?.index ?? 0}
        onIndexChange={(index) =>
          setViewer((current) => (current ? { ...current, index } : current))
        }
        open={viewer !== null}
        onOpenChange={(open) => {
          if (!open) setViewer(null)
        }}
      />
    </div>
  )
}
