'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'

import { CaseSection } from '@/components/CaseSection'
import { EvidenceTag } from '@/components/EvidenceTag'
import { useSession } from '@/components/session-provider'
import {
  CONTRIBUTION_LABELS,
  PROFILE_VISIBLE_LIMIT,
  type ContributionKind,
} from '@/lib/contributionLabels'
import { fetchMyContributions, type ContributionProduct } from '@/lib/wizard/api'
import { userMessage } from '@/lib/userMessages'

const numberFormat = new Intl.NumberFormat('tr-TR')

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const STATUS_LABELS: Record<string, { label: string; tone: 'stamp' | 'evidence' | 'tape' }> = {
  draft: { label: 'İNCELEMEDE', tone: 'stamp' },
  published: { label: 'YAYINDA', tone: 'evidence' },
  archived: { label: 'ARŞİVDE', tone: 'tape' },
}

/** Sunucudan gelen herkese açık katkı özeti (bkz. `buildPublicProfile`). */
export type ProfileContributionSummary = {
  id: string
  name: string
  barcode: string | null
  frontImageUrl: string | null
  frontImageAlt: string | null
  views: number
  roles: ContributionKind[]
}

type ContributionCard = {
  key: string
  name: string
  barcode: string | null
  frontImageUrl: string | null
  frontImageAlt: string | null
  status: 'draft' | 'published' | 'archived'
  views: number | null
  roles: ContributionKind[]
  photoCount: number | null
  createdLabel: string | null
}

function ContributionCardView({ card }: { card: ContributionCard }) {
  const status = STATUS_LABELS[card.status] ?? STATUS_LABELS.draft
  const meta =
    card.status === 'published'
      ? `${numberFormat.format(card.views ?? 0)} görüntülenme`
      : [card.photoCount ? `${card.photoCount} fotoğraf` : null, card.createdLabel]
          .filter(Boolean)
          .join(' · ')

  const body = (
    <>
      {card.frontImageUrl ? (
        <Image
          src={card.frontImageUrl}
          alt={card.frontImageAlt || card.barcode || card.name}
          width={64}
          height={64}
          quality={60}
          className="size-16 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted font-mono text-[0.6rem] uppercase text-faded">
          KARE YOK
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <EvidenceTag variant={status.tone}>{status.label}</EvidenceTag>
          <EvidenceTag>{card.barcode ?? '—'}</EvidenceTag>
        </span>
        <span className="line-clamp-2 text-sm font-medium">{card.name}</span>
        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
        {card.roles.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {card.roles.map((role) => (
              <EvidenceTag key={role} variant={role === 'create' ? 'evidence' : 'stamp'}>
                {CONTRIBUTION_LABELS[role]}
              </EvidenceTag>
            ))}
          </span>
        ) : null}
        {card.status === 'published' && card.barcode ? (
          <span className="mt-auto text-xs underline">Ürün dosyasını aç</span>
        ) : (
          <span className="mt-auto text-xs text-muted-foreground">
            Onaylandığında burada ürün bağlantısı görünür.
          </span>
        )}
      </span>
    </>
  )

  const shell = 'flex h-full gap-3 rounded-xl border border-border bg-card p-3'

  if (card.status === 'published' && card.barcode) {
    return (
      <Link
        href={`/urun/${card.barcode}`}
        className={`${shell} transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      >
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}

/**
 * Profildeki katkı bölümü (ADR 0024). Herkese açık ziyaretçi yayındaki katkı ürünlerini görür;
 * profil sahibi giriş yaptığında incelenmeyi bekleyen katkıları aynı listenin başında görür.
 * Tek bölüm, en fazla `PROFILE_VISIBLE_LIMIT` kayıt.
 */
export function ProfileContributions({
  profileId,
  products,
  productCount,
}: {
  profileId: string
  products: ProfileContributionSummary[]
  productCount: number
}) {
  const { user, token, restoring } = useSession()
  const [mine, setMine] = useState<ContributionProduct[]>([])
  const [pending, setPending] = useState(0)
  const [limit, setLimit] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const own = Boolean(user && String(user.id) === String(profileId))

  useEffect(() => {
    if (restoring || !own || !token) return
    let active = true
    setLoading(true)
    fetchMyContributions(token)
      .then((result) => {
        if (!active) return
        setMine(result.items)
        setPending(result.pending)
        setLimit(result.limit)
      })
      .catch((error: unknown) => {
        if (!active) return
        setFailure(userMessage(error, 'Katkıların yüklenemedi. Bağlantını kontrol edip tekrar dene.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [own, restoring, token])

  const { cards, publishedShown } = useMemo(() => {
    const ownItems = own ? mine : []
    const byId = new Map(ownItems.map((item) => [String(item.id), item]))

    const pendingCards: ContributionCard[] = ownItems
      .filter((item) => item.status !== 'published')
      .slice(0, PROFILE_VISIBLE_LIMIT)
      .map((item) => ({
        key: `mine-${item.id}`,
        name: item.name?.trim() || 'İsimsiz katkı',
        barcode: item.barcode,
        frontImageUrl: item.frontImageUrl,
        frontImageAlt: item.frontImageAlt,
        status: item.status === 'archived' ? 'archived' : 'draft',
        views: null,
        roles: [],
        photoCount: item.photoCount,
        createdLabel: item.createdAt ? dateFormat.format(new Date(item.createdAt)) : null,
      }))

    const publishedCards: ContributionCard[] = products
      .slice(0, Math.max(0, PROFILE_VISIBLE_LIMIT - pendingCards.length))
      .map((product) => {
        const ownItem = byId.get(String(product.id))
        return {
          key: `product-${product.id}`,
          name: product.name,
          barcode: product.barcode,
          frontImageUrl: product.frontImageUrl,
          frontImageAlt: product.frontImageAlt,
          status: 'published' as const,
          views: product.views,
          roles: product.roles,
          photoCount: ownItem?.photoCount ?? null,
          createdLabel: ownItem?.createdAt ? dateFormat.format(new Date(ownItem.createdAt)) : null,
        }
      })

    return { cards: [...pendingCards, ...publishedCards], publishedShown: publishedCards.length }
  }, [mine, own, products])

  return (
    <CaseSection
      id="katkilarim"
      eyebrow="Katkı"
      title={
        own
          ? `Katkılarım (${numberFormat.format(productCount + pending)})`
          : `Katkı sağladığı ürünler (${numberFormat.format(productCount)})`
      }
      aside={
        own && limit ? (
          <EvidenceTag variant="tape">
            {pending}/{limit} bekleyen katkı
          </EvidenceTag>
        ) : null
      }
      hasData={cards.length > 0}
      emptyMessage={
        own
          ? 'Henüz katkı göndermedin. Taramada bulunamayan bir ürünün fotoğraflarını göndererek dosya açabilirsin.'
          : 'Bu kullanıcının yayında ürün katkısı yok. Katkı sağladıkça burada listelenir.'
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        {failure ? <p className="text-sm text-stamp">{failure}</p> : null}

        {own && loading ? (
          <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
            Katkılar yükleniyor…
          </p>
        ) : null}

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.key}>
              <ContributionCardView card={card} />
            </li>
          ))}
        </ul>

        {publishedShown < productCount ? (
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
            En çok görüntülenen {numberFormat.format(publishedShown)} ürün gösteriliyor · toplam{' '}
            {numberFormat.format(productCount)}
          </p>
        ) : null}
      </div>
    </CaseSection>
  )
}
