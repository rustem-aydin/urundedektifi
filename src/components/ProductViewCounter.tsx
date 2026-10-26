'use client'

import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'

import { recordProductView } from '@/lib/wizard/api'
import { cn } from '@/lib/utils'

/**
 * Ürün görüntülenme sayacı.
 *
 * Sunucudan gelen sayı ilk değerdir; istemci ürün dosyası açıldığında sayacı bir kez
 * artırır ve dönen taze değeri gösterir. Artırma sekme oturumu başına tek seferdir:
 * `sessionStorage` işareti React StrictMode'un çift effect'ini ve sayfa yenilemeyi
 * ikinci görüntülenme saymaktan korur. Depolama kapalıysa modül kümesi devreye girer.
 * Liste kartları bu bileşeni kullanmaz — kartın görünmesi görüntülenme değildir.
 */

const counted = new Set<string>()
const numberFormat = new Intl.NumberFormat('tr-TR')

export function ProductViewCounter({
  id,
  initial,
  className,
}: {
  id: string
  initial: number
  className?: string
}) {
  const [count, setCount] = useState(initial)

  useEffect(() => {
    if (counted.has(id)) return
    const storageKey = `urun-goruntulenme:${id}`
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        counted.add(id)
        return
      }
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // Depolama kapalı: modül kümesi yeterli.
    }
    counted.add(id)

    recordProductView(id)
      .then((value) => {
        if (value !== null) setCount(value)
      })
      .catch(() => {
        // Sayaç yazılamazsa sunucudan gelen sayı gösterilmeye devam eder.
      })
  }, [id])

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase',
        className,
      )}
    >
      <Eye className="size-3.5" aria-hidden="true" />
      {numberFormat.format(count)} görüntülenme
    </span>
  )
}
