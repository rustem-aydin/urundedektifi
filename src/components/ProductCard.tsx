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
  const card = (
    <CaseCard
      className={cn(
        'h-full overflow-hidden transition-shadow',
        href && 'group-hover:shadow-md',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border bg-muted/50">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt || name}
            className="absolute inset-0 size-full p-4 object-contain"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
            Görsel yok
          </span>
        )}
      </div>
      <CardHeader className="gap-1">
        <CardTitle className="line-clamp-2 text-base">{name}</CardTitle>
        {brandName && <p className="text-sm text-muted-foreground">{brandName}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {typeof verdictCount === 'number' && verdictCount > 0 && (
          <VerdictStamp variant="warn">{verdictCount} kural eşleşti</VerdictStamp>
        )}
        {typeof viewCount === 'number' && (
          <p className="flex items-center gap-1 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            <Eye className="size-3" aria-hidden="true" />
            {viewFormat.format(Math.max(0, Math.trunc(viewCount)))} görüntülenme
          </p>
        )}
        {categoryName && (
          <p className="mt-auto truncate border-t border-dashed border-border pt-2 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            {categoryName}
          </p>
        )}
      </CardContent>
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
