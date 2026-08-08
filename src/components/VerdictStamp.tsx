import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const stampVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center rounded-[3px] border-2 border-current px-2 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] select-none motion-safe:-rotate-2',
  {
    variants: {
      variant: {
        safe: 'text-evidence-green bg-evidence-green/10',
        warn: 'border-current text-foreground bg-tape-yellow/20',
        danger: 'text-stamp bg-stamp/10',
        neutral: 'text-faded bg-muted',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

export function VerdictStamp({
  className,
  variant,
  children,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof stampVariants>) {
  return (
    <span data-slot="verdict-stamp" className={cn(stampVariants({ variant }), className)} {...props}>
      <span className="opacity-90">{children}</span>
    </span>
  )
}

export { stampVariants }
