'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/components/session-provider'
import { requestFollow } from '@/lib/followIntent'
import { userMessage } from '@/lib/userMessages'
import { cn } from '@/lib/utils'

/**
 * Uzman takip düğmesi.
 *
 * Oturum yoksa giriş akışına yönlendirir (`next` ile geri döner); oturum varsa iyimser
 * güncellemeyle `users.following` alanını yazar. Aynı düğme hüküm satırlarında çip
 * görünümüyle de kullanılır.
 */
export function FollowButton({
  expertId,
  expertName,
  variant = 'solid',
  className,
}: {
  expertId: string | number
  expertName?: string
  variant?: 'solid' | 'chip'
  className?: string
}) {
  const { user, restoring, isFollowing, toggleFollow } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const following = isFollowing(expertId)
  const label = following ? 'Takiptesin' : 'Takip et'
  const accessibleLabel = expertName ? `${expertName} — ${label}` : label

  const base =
    variant === 'chip'
      ? 'inline-flex min-h-7 items-center rounded-sm border px-2 font-mono text-[0.65rem] tracking-[0.14em] uppercase transition-colors'
      : 'inline-flex min-h-9 items-center rounded-sm border px-3 text-sm font-medium transition-colors'

  const tone = following
    ? 'border-evidence-green/60 bg-evidence-green/10 text-evidence-green hover:bg-evidence-green/15'
    : 'border-foreground/25 bg-card text-foreground hover:border-foreground/60 hover:bg-muted'

  if (restoring) {
    return (
      <span className={cn(base, 'border-border bg-muted text-faded', className)} aria-hidden="true">
        …
      </span>
    )
  }

  if (!user) {
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ''
    return (
      <Link
        href={`/giris${next}`}
        aria-label={`${accessibleLabel} — giriş yapman gerekir`}
        onClick={() => requestFollow(expertId)}
        className={cn(base, tone, className)}
      >
        {label}
      </Link>
    )
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-1', className)}>
      <button
        type="button"
        aria-pressed={following}
        aria-label={accessibleLabel}
        disabled={pending}
        onClick={async () => {
          setFailure(null)
          setPending(true)
          const wasFollowing = following
          try {
            await toggleFollow(expertId)
            toast.success(
              wasFollowing
                ? `${expertName ?? 'Uzman'} takibi bırakıldı.`
                : `${expertName ?? 'Uzman'} takip edildi. Yazıları anasayfanda görünecek.`,
            )
            // Sunucu-render edilen takipçi sayısı/profil verisi de tazelensin.
            router.refresh()
          } catch (error) {
            const message = userMessage(error, 'Takip güncellenemedi. Tekrar dene.')
            setFailure(message)
            toast.error(message)
          } finally {
            setPending(false)
          }
        }}
        className={cn(base, tone, pending && 'opacity-60')}
      >
        {pending ? '…' : label}
      </button>
      {failure ? (
        <span role="alert" className="text-[0.7rem] text-stamp">
          {failure}
        </span>
      ) : null}
    </span>
  )
}
