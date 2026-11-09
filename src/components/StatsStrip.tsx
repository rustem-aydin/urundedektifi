'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * Ana sayfa istatistik şeridi.
 *
 * Sayılar sunucudan hazır gelir; istemcide hızlı bir sayma animasyonuyla hedefe
 * çıkar (varsayılan 800 ms, easeOutCubic). `prefers-reduced-motion` açıksa sayı
 * doğrudan son değeriyle yazılır. Ekran okuyucu, animasyon sırasındaki ara
 * değerleri değil yalnız nihai sayıyı duyar.
 */

const numberFormat = new Intl.NumberFormat('tr-TR')

const DEFAULT_DURATION = 800

function useCountUp(target: number, duration = DEFAULT_DURATION) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(Math.max(0, Math.trunc(target) || 0))
      return
    }

    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

function StatValue({ value }: { value: number }) {
  const count = useCountUp(value)

  return (
    <>
      <span aria-hidden="true">{numberFormat.format(count)}</span>
      <span className="sr-only">{numberFormat.format(value)}</span>
    </>
  )
}

export type SiteStat = {
  label: string
  value: number
}

export function StatsStrip({ stats, className }: { stats: SiteStat[]; className?: string }) {
  if (stats.length === 0) return null

  return (
    <section aria-labelledby="stats-heading" className={cn('border-y border-border py-8', className)}>
      <h2 id="stats-heading" className="sr-only">
        Site istatistikleri
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse gap-1 border-l-2 border-stamp/25 pl-3"
          >
            <dt className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
              {stat.label}
            </dt>
            <dd className="font-display text-2xl leading-none tabular-nums sm:text-3xl">
              <StatValue value={stat.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
