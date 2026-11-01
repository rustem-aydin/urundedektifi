'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { CaseSection } from '@/components/CaseSection'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import { ApiError, fetchMyContributions, type ContributionProduct } from '@/lib/wizard/api'

const STATUS_LABELS: Record<string, { label: string; tone: 'stamp' | 'evidence' | 'tape' }> = {
  draft: { label: 'İNCELEMEDE', tone: 'stamp' },
  published: { label: 'YAYINDA', tone: 'evidence' },
  archived: { label: 'ARŞİVDE', tone: 'tape' },
}

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * Profildeki "Katkılarım" bölümü (ADR 0024). Yalnız profil sahibi giriş yaptığında görünür;
 * incelemedeki katkı "incelemede" olarak durur, onaylanınca ürün bağlantısı açılır.
 */
export function MyContributions({ profileId }: { profileId: string }) {
  const { user, token, restoring } = useSession()
  const [items, setItems] = useState<ContributionProduct[]>([])
  const [pending, setPending] = useState(0)
  const [limit, setLimit] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const own = Boolean(user && String(user.id) === String(profileId))

  useEffect(() => {
    if (restoring || !own || !token) return
    let active = true
    fetchMyContributions(token)
      .then((result) => {
        if (!active) return
        setItems(result.items)
        setPending(result.pending)
        setLimit(result.limit)
      })
      .catch((error: unknown) => {
        if (!active) return
        setFailure(error instanceof ApiError ? error.message : 'Katkılar yüklenemedi.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [own, restoring, token, profileId])

  if (restoring || !own) return null

  return (
    <CaseSection
      id="katkilarim"
      eyebrow="Katkı"
      title={`Katkılarım (${items.length})`}
      hasData={items.length > 0}
      emptyMessage="Henüz katkı göndermedin. Taramada bulunamayan bir ürünün fotoğraflarını göndererek dosya açabilirsin."
    >
      <div className="mt-4 flex flex-col gap-3">
        {limit ? (
          <EvidenceTag variant="tape">
            {pending}/{limit} bekleyen katkı
          </EvidenceTag>
        ) : null}

      {failure ? <p className="text-sm text-stamp">{failure}</p> : null}

      {loading ? (
        <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
          Katkılar yükleniyor…
        </p>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const status = STATUS_LABELS[item.status ?? ''] ?? { label: 'BİLİNMİYOR', tone: 'tape' as const }
          return (
            <li key={item.id}>
              <div className="flex h-full gap-3 rounded-xl border border-border bg-card p-3">
                {item.frontImageUrl ? (
                  <img
                    src={item.frontImageUrl}
                    alt={item.frontImageAlt || item.barcode || 'Katkı fotoğrafı'}
                    className="size-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted font-mono text-[0.6rem] uppercase text-faded">
                    KARE YOK
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EvidenceTag variant={status.tone}>{status.label}</EvidenceTag>
                    <EvidenceTag>{item.barcode ?? '—'}</EvidenceTag>
                  </div>
                  <p className="text-sm font-medium">{item.name?.trim() || 'İsimsiz katkı'}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.photoCount} fotoğraf
                    {item.createdAt ? ` · ${dateFormat.format(new Date(item.createdAt))}` : ''}
                  </p>
                  {item.status === 'published' && item.barcode ? (
                    <Link
                      href={`/urun/${item.barcode}`}
                      className="mt-auto text-xs underline"
                    >
                      Ürün dosyasını aç
                    </Link>
                  ) : (
                    <span className="mt-auto text-xs text-muted-foreground">
                      Onaylandığında burada ürün bağlantısı görünür.
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
        </ul>
      </div>
    </CaseSection>
  )
}
