import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Yükleme iskeleti. Ekran okuyucuya kapalıdır: durumu taşıyan tek öğe,
 * sayfanın `role="status"` satırıdır. `prefers-reduced-motion` açıkken nabız durur.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
