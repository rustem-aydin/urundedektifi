import Link from 'next/link'

import { cn } from '@/lib/utils'
import { CaseCard } from '@/components/CaseCard'
import { VerdictStamp } from '@/components/VerdictStamp'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ProductCardProps = {
  href?: string | null
  name: string
  brandName?: string | null
  categoryName?: string | null
  barcode?: string | number | null
  imageUrl?: string | null
  imageAlt?: string | null
  verdictCount?: number
  className?: string
}

export function ProductCard({
  href,
  name,
  brandName,
  categoryName,
  barcode,
  imageUrl,
  imageAlt,
  verdictCount,
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
      <div className="flex aspect-[4/3] items-center justify-center border-b border-border bg-muted/50 p-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt || name}
            className="max-h-full w-auto object-contain"
          />
        ) : (
          <span className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">
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
          <VerdictStamp variant="warn">{verdictCount} delil eşleşti</VerdictStamp>
        )}
        <p className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-border pt-2 font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
          {barcode ? <span>KANIT NO: {barcode}</span> : <span />}
          {categoryName && <span className="truncate">{categoryName}</span>}
        </p>
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
