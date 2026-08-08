import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const tagVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-border bg-muted text-muted-foreground',
        evidence: 'border-border bg-card text-foreground',
        tape: 'border-tape-yellow/60 bg-tape-yellow/15 text-foreground',
        stamp: 'border-stamp/50 bg-stamp/10 text-stamp',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export function EvidenceTag({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof tagVariants>) {
  return (
    <span data-slot="evidence-tag" className={cn(tagVariants({ variant }), className)} {...props} />
  )
}

export { tagVariants }
