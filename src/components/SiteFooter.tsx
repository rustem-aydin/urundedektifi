import Link from 'next/link'
import { ScanBarcode } from 'lucide-react'

const FOOTER_NAV = [
  { href: '/tara', label: 'Tara' },
  { href: '/urunler', label: 'Ürünler' },
  { href: '/konular', label: 'Konular' },
  { href: '/uzmanlar', label: 'Uzmanlar' },
]

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <Link
              href="/"
              className="flex w-fit items-center gap-2 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="flex size-7 items-center justify-center rounded-sm bg-foreground text-background">
                <ScanBarcode className="size-4" aria-hidden="true" />
              </span>
              <span className="font-display text-base tracking-wide">Ürün Dedektifi</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Barkodu gösterin; boykot, sağlık ve helal kuralları uzmanların kaleminden ürüne
              uygulanır.
            </p>
          </div>

          <nav aria-label="Alt gezinme" className="flex flex-col gap-2">
            <p className="font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase">Dizin</p>
            <ul className="flex flex-col gap-1.5">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-4">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            DOSYA NO: UD-2026
          </p>
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
            Tüm hakları saklıdır
          </p>
        </div>
      </div>
    </footer>
  )
}
