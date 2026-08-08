import * as React from 'react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

function EvidenceTape({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 -rotate-3 bg-tape-yellow/70 shadow-xs',
        className,
      )}
    />
  )
}

export function CaseCard({
  className,
  tape = false,
  children,
  ...props
}: React.ComponentProps<'div'> & { tape?: boolean }) {
  return (
    <Card
      data-slot="case-card"
      className={cn('relative border border-border shadow-sm', className)}
      {...props}
    >
      {tape && <EvidenceTape />}
      {children}
    </Card>
  )
}
