import { cn } from '@/lib/utils'

/**
 * Marka adı. "Dedektifi" fareyle seçilmiş metin gibi durur: sitedeki ::selection
 * kuralıyla aynı tape-yellow zemin, dar tutulmuş yatay dolgu.
 *
 * Metin rengi bilerek accent-foreground (her iki temada #1c1b17): koyu temada
 * text-foreground açık kâğıt rengi olduğu için sarı zemin üzerinde okunmazdı.
 */
export function BrandName({ className }: { className?: string }) {
  return (
    <span className={cn('font-display tracking-wide', className)}>
      Barkod <span className="bg-tape-yellow px-[0.15em] text-accent-foreground">Dedektifi</span>
    </span>
  )
}
