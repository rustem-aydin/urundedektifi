import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Yükleme hatası yüzeyi. Boş sonuç ("henüz yok") metniyle karışmaması için ayrı blok:
 * veri gelmediğinde "kural yok" gibi bir güvenlik iddiası basılmaz.
 * `onRetry` verilirse "Tekrar dene" düğmesi çıkar.
 */
export function AsyncError({
  message,
  onRetry,
  className,
}: {
  message: React.ReactNode
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-md border border-dashed border-stamp/40 bg-card/60 px-5 py-4',
        className,
      )}
    >
      <p className="text-sm text-stamp">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center rounded-sm border border-foreground/25 bg-card px-3 text-sm font-medium transition-colors hover:border-foreground/60 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Tekrar dene
        </button>
      ) : null}
    </div>
  )
}
