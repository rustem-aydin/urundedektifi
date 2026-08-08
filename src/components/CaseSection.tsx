import * as React from 'react'

import { cn } from '@/lib/utils'

type CaseSectionProps = {
  id?: string
  eyebrow: string
  title: React.ReactNode
  aside?: React.ReactNode
  hasData: boolean
  emptyMessage: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function CaseSection({
  id,
  eyebrow,
  title,
  aside,
  hasData,
  emptyMessage,
  className,
  children,
}: CaseSectionProps) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={cn('scroll-mt-20', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-foreground/80 pb-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[0.65rem] font-medium tracking-[0.2em] text-stamp uppercase">
            {eyebrow}
          </span>
          <h2 id={headingId} className="font-display text-xl sm:text-2xl">
            {title}
          </h2>
        </div>
        {aside}
      </div>

      {hasData ? (
        children
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border bg-card/60 px-5 py-4">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  )
}
