import Link from 'next/link'

import { cn } from '@/lib/utils'

export type RatingOption = {
  id: string | number
  name: string
  color?: string | null
  description?: string | null
}

const CHIP_BASE =
  'inline-flex items-center rounded-sm px-2 py-1 font-mono text-[0.7rem] tracking-[0.14em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-ring'
const CHIP_ALL_IDLE =
  'border border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'
const CHIP_ALL_ACTIVE = 'border border-foreground bg-foreground text-background'

/**
 * Uzmanın kendi derecelendirme ölçeğinden süzgeç.
 *
 * Durum URL'de taşınır (`param`); seçim sunucuda kural/hüküm sorgusuna girer, bu yüzden
 * bileşen istemci durumu tutmaz. "Tümü" bağlantısı parametreyi düşürür; her bağlantı
 * `extra` ile verilen sekme parametresini korur ve sayfa numarasını sıfırlar.
 * `prefetch` kapalı: uzman sayfası her istekte 3.900+ kural tarıyor, çiplerin ön yüklemesi
 * kabul edilemez maliyet.
 */
export function RatingFilterBar({
  options,
  activeId,
  basePath,
  param,
  label,
  extra,
}: {
  options: RatingOption[]
  activeId: string | null
  basePath: string
  param: string
  label: string
  extra?: Record<string, string>
}) {
  const hrefFor = (id: string | number | null) => {
    const params = new URLSearchParams(extra ?? {})
    if (id != null) params.set(param, String(id))
    const query = params.toString()
    return query ? `${basePath}?${query}` : basePath
  }

  if (options.length === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
        {label}
      </span>
      <Link
        href={hrefFor(null)}
        prefetch={false}
        scroll={false}
        aria-current={activeId ? undefined : 'true'}
        className={cn(CHIP_BASE, activeId ? CHIP_ALL_IDLE : CHIP_ALL_ACTIVE)}
      >
        Tümü
      </Link>
      {options.map((option) => {
        const active = activeId != null && String(option.id) === activeId
        return (
          <Link
            key={option.id}
            href={hrefFor(option.id)}
            prefetch={false}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            title={option.description || undefined}
            className={cn(
              CHIP_BASE,
              'border-2 border-current',
              active
                ? 'font-bold underline underline-offset-4'
                : 'font-bold opacity-70 hover:opacity-100',
            )}
            // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
            style={{ color: option.color || undefined }}
          >
            {option.name}
          </Link>
        )
      })}
    </div>
  )
}
