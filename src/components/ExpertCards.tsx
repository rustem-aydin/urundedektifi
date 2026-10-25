'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { CaseCard } from '@/components/CaseCard'
import { FollowButton } from '@/components/FollowButton'
import { VerdictStamp } from '@/components/VerdictStamp'
import { useSession } from '@/components/session-provider'
import { cn } from '@/lib/utils'

/**
 * Uzman kartları + "Takip ettiklerim" süzgeci.
 *
 * Süzgeç istemcide çalışır: oturum jetonu localStorage'da tutulduğu için sunucu
 * kullanıcının takip listesini bilemez (çerezle paylaşılmıyor).
 */

export type ExpertCardData = {
  id: string
  slug: string
  name: string
  title?: string | null
  bio?: string | null
  avatarUrl?: string | null
  avatarAlt?: string | null
  verified?: boolean
  ruleCount: number
  ratingCount: number
}

export function ExpertCards({ experts }: { experts: ExpertCardData[] }) {
  const { user, restoring, followingIds } = useSession()
  const [onlyFollowing, setOnlyFollowing] = useState(false)

  const followingSet = useMemo(() => new Set(followingIds), [followingIds])
  const visible = onlyFollowing
    ? experts.filter((expert) => followingSet.has(expert.id))
    : experts

  return (
    <div className="mt-8">
      {!restoring && user ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Takip süzgeci">
          <button
            type="button"
            aria-pressed={onlyFollowing}
            onClick={() => setOnlyFollowing((value) => !value)}
            className={cn(
              'inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition-colors',
              onlyFollowing
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
            )}
          >
            Takip ettiklerim ({followingIds.length})
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {onlyFollowing
            ? 'Henüz uzman takip etmiyorsun. Bir uzmanın profilinden “Takip et” ile başla.'
            : 'Bu konuda henüz uzman yok.'}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((expert) => (
            <CaseCard key={expert.id} className="relative h-full transition-shadow hover:shadow-md">
              <Link
                href={`/uzmanlar/${expert.slug}`}
                aria-label={`${expert.name} profilini aç`}
                className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <div className="pointer-events-none relative z-10 flex h-full flex-col gap-2 p-4">
                <div className="flex items-center gap-3">
                  {expert.avatarUrl ? (
                    <img
                      src={expert.avatarUrl}
                      alt={expert.avatarAlt || expert.name}
                      className="size-11 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[0.65rem] uppercase text-faded"
                    >
                      {expert.name.slice(0, 2)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate font-medium">{expert.name}</p>
                    {expert.verified ? <VerdictStamp variant="safe">Doğrulandı</VerdictStamp> : null}
                  </div>
                </div>
                {expert.title ? (
                  <p className="text-sm text-muted-foreground">{expert.title}</p>
                ) : null}
                {expert.bio ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{expert.bio}</p>
                ) : null}
                <p className="mt-auto font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                  {expert.ruleCount} aktif kural · {expert.ratingCount} derece
                </p>
              </div>
              <div className="absolute bottom-3 right-3 z-20">
                <FollowButton
                  expertId={expert.id}
                  expertName={expert.name}
                  variant="chip"
                  className="bg-background"
                />
              </div>
            </CaseCard>
          ))}
        </div>
      )}
    </div>
  )
}
