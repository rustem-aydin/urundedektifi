'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ScanBarcode, Search } from 'lucide-react'
import Link from 'next/link'

import { getProduct } from '@/actions/product'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BarcodeLookupForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length < 8) {
      toast.error('Geçersiz barkod — en az 8 hane girin.')
      return
    }
    setIsChecking(true)
    try {
      const result = await getProduct(Number(digits))
      if (result && result.docs && result.docs.length > 0) {
        toast.success('Ürün bulundu, dosyası açılıyor.')
        router.push(`/urun/${digits}`)
      } else {
        toast.error('Ürün bulunamadı — ilk ekleyen siz olun.')
        router.push(`/ekle/${digits}`)
      }
    } catch {
      toast.error('Sorgu sırasında bir hata oluştu. Tekrar deneyin.')
    } finally {
      setIsChecking(false)
    }
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
          disabled={isChecking}
          className="h-11 px-5 font-medium"
        >
          <Search aria-hidden="true" />
          {isChecking ? 'Sorgulanıyor…' : 'Ürünü Sorgula'}
        </Button>
      </div>
      <Button asChild variant="outline" size="lg" className="h-11 w-full border-2 sm:w-auto">
        <Link href="/tara">
          <ScanBarcode aria-hidden="true" />
          Kamerayla Tara
        </Link>
      </Button>
    </form>
  )
}
