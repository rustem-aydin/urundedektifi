'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ScanBarcode, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useSession } from '@/components/session-provider'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV_ITEMS = [
  { href: '/tara', label: 'Tara' },
  { href: '/urunler', label: 'Ürünler' },
  { href: '/kategoriler', label: 'Kategoriler' },
  { href: '/konular', label: 'Konular' },
  { href: '/uzmanlar', label: 'Uzmanlar' },
  { href: '/ekle', label: 'Ekle' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { user, canAddProduct } = useSession()
  const accountLabel = user ? (canAddProduct ? 'Yetkili' : 'Hesap') : 'Giriş'

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
            Şeffaf Ürün
          </span>
        </Link>

        <nav aria-label="Ana gezinme" className="hidden items-center gap-1 md:flex">
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
          <Link
            href={user ? `/profil/${user.id}` : '/giris'}
            className={cn(
              'ml-1 rounded-md border border-border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
              (canAddProduct || user) && 'border-stamp/50 text-stamp',
            )}
          >
            {accountLabel}
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
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
          className="border-t border-border px-4 pt-2 pb-3 md:hidden"
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
            <li>
              <Link
                href={user ? `/profil/${user.id}` : '/giris'}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center rounded-md px-3 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {accountLabel}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
