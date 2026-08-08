'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ScanBarcode, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/tara', label: 'Tara' },
  { href: '/urunler', label: 'Ürünler' },
  { href: '/konular', label: 'Konular' },
  { href: '/uzmanlar', label: 'Uzmanlar' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex size-7 items-center justify-center rounded-sm bg-foreground text-background">
            <ScanBarcode className="size-4" aria-hidden="true" />
          </span>
          <span className="font-display text-base leading-none tracking-wide sm:text-lg">
            Ürün Dedektifi
          </span>
        </Link>

        <nav aria-label="Ana gezinme" className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:px-3',
                  active && 'bg-muted text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setOpen((v) => !v)}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobil gezinme"
          className="border-t border-border px-4 pt-2 pb-3 sm:hidden"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                      active && 'bg-muted text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </header>
  )
}
