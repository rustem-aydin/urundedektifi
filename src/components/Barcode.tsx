import { cn } from '@/lib/utils'

type BarcodeProps = {
  value: string
  className?: string
  barClassName?: string
  digitsClassName?: string
  height?: number
  showDigits?: boolean
}

function barsFor(value: string): number[] {
  const widths: number[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    widths.push((code % 4) + 1)
    widths.push(((code >> 2) % 3) + 1)
  }
  return widths
}

export function Barcode({
  value,
  className,
  barClassName,
  digitsClassName,
  height = 64,
  showDigits = true,
}: BarcodeProps) {
  const widths = barsFor(value)
  const gap = 2
  const total = widths.reduce((a, b) => a + b + gap, -gap)

  let x = 0
  const rects = widths.map((w, i) => {
    const rect = <rect key={i} x={x} y={0} width={w} height={height} fill="currentColor" />
    x += w + gap
    return rect
  })

  return (
    <span className={cn('inline-flex flex-col items-center gap-1', className)}>
      <svg
        viewBox={`0 0 ${total} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={cn('block', barClassName)}
      >
        {rects}
      </svg>
      {showDigits && (
        <span
          className={cn(
            'font-mono text-[0.65rem] tracking-[0.35em] text-faded',
            digitsClassName,
          )}
        >
          {value}
        </span>
      )}
    </span>
  )
}
