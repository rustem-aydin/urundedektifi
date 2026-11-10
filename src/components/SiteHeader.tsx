'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ScanBarcode, UserRound, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { BrandName } from '@/components/BrandName'
import { useSession } from '@/components/session-provider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { fetchReviewCount } from '@/lib/wizard/api'

const NAV_ITEMS = [
  { href: '/urunler', label: 'Ürünler' },
  { href: '/kategoriler', label: 'Kategoriler' },
  { href: '/konular', label: 'Konular' },
  { href: '/uzmanlar', label: 'Uzmanlar' },
]

/**
 * Katkı her role açıktır: ürün önce fotoğrafla açılır, yayına alma inceleme kuyruğunda olur
 * (ADR 0026). "İnceleme" yalnız admin/editör menüsünde, bekleyen taslak sayısıyla görünür.
 */
function navItemsFor(isPanel: boolean) {
  const items = [...NAV_ITEMS, { href: '/katki', label: 'Katkı' }]
  return isPanel ? [...items, { href: '/inceleme', label: 'İnceleme' }] : items
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const { user, token, isPanel } = useSession()
  const profileHref = user ? `/profil/${user.id}` : '/giris'
  const accountLabel = user ? 'Profilim' : 'Giriş'
  const navItems = navItemsFor(isPanel)

  /** Menü etiketi: inceleme girdisinde bekleyen taslak sayısı rozet olarak eklenir. */
  function labelOf(item: { href: string; label: string }) {
    if (item.href !== '/inceleme' || pending === 0) return item.label
    return (
      <span className="inline-flex items-center gap-1">
        {item.label}
        <span className="rounded-sm bg-foreground/10 px-1 font-mono text-[0.6rem] leading-4">
          {pending}
        </span>
      </span>
    )
  }

  useEffect(() => {
    if (!isPanel || !token) {
      setPending(0)
      return
    }
    let active = true
    fetchReviewCount(token)
      .then((count) => {
        if (active) setPending(count.unseen)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [isPanel, token, pathname])

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
          <BrandName className="text-base leading-none sm:text-lg" />
        </Link>

        <nav aria-label="Ana gezinme" className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
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
                {labelOf(item)}
              </Link>
            )
          })}
          <Link
            href={profileHref}
            aria-label={accountLabel}
            title={accountLabel}
            className="ml-1 flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <UserRound className="size-4" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Link
            href={profileHref}
            aria-label={accountLabel}
            title={accountLabel}
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
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
            {navItems.map((item) => {
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
                    {labelOf(item)}
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
