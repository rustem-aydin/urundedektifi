import Link from 'next/link'
import { Eye } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CaseCard } from '@/components/CaseCard'
import { VerdictStamp } from '@/components/VerdictStamp'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ProductCardProps = {
  href?: string | null
  name: string
  brandName?: string | null
  categoryName?: string | null
  imageUrl?: string | null
  imageAlt?: string | null
  verdictCount?: number
  /** Sunucudaki dosya açılma sayısı; liste sıralaması da bu değere göre (çoktan aza). */
  viewCount?: number
  className?: string
}

const viewFormat = new Intl.NumberFormat('tr-TR')

/**
 * Ürün kartı.
 *
 * Mobilde (taban kırılım) kart bir liste satırıdır: solda küçük kare görsel, sağda ad /
 * marka / sayaçlar. `sm` ve üzerinde dikey kart düzenine döner.
 */
export function ProductCard({
  href,
  name,
  brandName,
  categoryName,
  imageUrl,
  imageAlt,
  verdictCount,
  viewCount,
  className,
}: ProductCardProps) {
  const hasVerdicts = typeof verdictCount === 'number' && verdictCount > 0

  const card = (
    <CaseCard
      className={cn(
        'h-full overflow-hidden py-0 transition-shadow sm:py-(--card-spacing)',
        href && 'group-hover:shadow-md',
        className,
      )}
    >
      <div className="flex h-full gap-3 p-3 sm:flex-col sm:gap-4 sm:p-0">
        <div className="relative w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50 sm:aspect-[4/3] sm:w-auto sm:rounded-none sm:border-0 sm:border-b">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt || name}
              className="absolute inset-0 size-full object-contain p-2 sm:p-4"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center p-1 text-center font-mono text-[0.6rem] leading-tight tracking-[0.1em] text-faded uppercase sm:text-[0.65rem] sm:tracking-[0.2em]">
              Görsel yok
            </span>
          )}
          {hasVerdicts && (
            <div className="absolute right-1 bottom-1 left-1 z-10 hidden justify-start sm:flex">
              <VerdictStamp variant="warn">{verdictCount} kural eşleşti</VerdictStamp>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-0">
          <CardHeader className="gap-1 px-0 sm:px-(--card-spacing)">
            <CardTitle className="line-clamp-2 text-sm sm:text-base">{name}</CardTitle>
            {brandName && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">{brandName}</p>
            )}
          </CardHeader>
          {hasVerdicts && (
            <div className="sm:hidden">
              <VerdictStamp variant="warn">{verdictCount} kural eşleşti</VerdictStamp>
            </div>
          )}
          <CardContent className="mt-auto flex flex-col gap-1.5 px-0 pt-1.5 sm:gap-2 sm:px-(--card-spacing)">
            {typeof viewCount === 'number' && (
              <p className="flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                <Eye className="size-3" aria-hidden="true" />
                {viewFormat.format(Math.max(0, Math.trunc(viewCount)))} görüntülenme
              </p>
            )}
            {categoryName && (
              <p className="truncate border-t border-dashed border-border pt-2 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                {categoryName}
              </p>
            )}
          </CardContent>
        </div>
      </div>
    </CaseCard>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className="group block rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {card}
    </Link>
  )
}
