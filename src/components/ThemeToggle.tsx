'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Tema değiştir"
      className="relative size-9"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
      <span className="sr-only">Tema değiştir</span>
    </Button>
  )
}
