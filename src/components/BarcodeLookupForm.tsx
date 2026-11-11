'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ScanBarcode, Search } from 'lucide-react'

import { BarcodeScanButton } from '@/components/BarcodeScanButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BarcodeLookupForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => window.clearTimeout(resetTimer.current ?? undefined), [])

  /**
   * Ön sorgu YOK: `/urun/<barkod>` rotası dosya varsa ürünü, yoksa katkı formunu
   * kendisi açar (ADR 0024). Eski akış önce bir sunucu eylemiyle "var mı" sorup
   * (medyan ~240 ms) ancak sonra yönlendiriyordu; o tur kaldırıldı.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 14) {
      toast.error('Geçersiz barkod — 8–14 hane gir.')
      return
    }
    setIsNavigating(true)
    router.push(`/urun/${digits}`)
    // Gezinme başarısız olursa (çevrimdışı) düğme kilitli kalmasın.
    resetTimer.current = window.setTimeout(() => setIsNavigating(false), 8000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="barcode-input" className="sr-only">
          Barkod numarası
        </label>
        <div className="relative flex-1">
          <Input
            id="barcode-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="8690000000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11 border-2 border-foreground bg-card pl-3 font-mono text-base tracking-[0.2em] shadow-xs placeholder:text-faded/60 md:text-base"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isNavigating}
          className="h-11 px-5 font-medium"
        >
          <Search aria-hidden="true" />
          {isNavigating ? 'Açılıyor…' : 'Ürünü sorgula'}
        </Button>
      </div>
      <BarcodeScanButton
        variant="outline"
        size="lg"
        className="h-11 border-2 font-medium sm:w-auto"
      >
        <ScanBarcode aria-hidden="true" />
        Kamerayla tara
      </BarcodeScanButton>
    </form>
  )
}
