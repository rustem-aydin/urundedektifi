'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { useSession } from '@/components/session-provider'
import { fetchMatchCounts } from '@/lib/wizard/api'

/**
 * Slider kart rozetlerinin sayacı.
 *
 * Sayı, ürün ızgarasındaki kart rozetiyle **aynı** kaynaktan gelir:
 * `/api/products/match-counts`, yani oturum sahibinin takip ettiği uzmanların bu
 * ürünlerde eşleşen kural sayısı. Takip yoksa (misafir) istek atılmaz ve rozet çizilmez;
 * böylece boş kartta hiçbir iz kalmaz. Tek istek sekiz kartın barkodunu birden taşır.
 */
const CountsContext = createContext<Record<string, number>>({})

export function SliderVerdictCounts({
  barcodes,
  children,
}: {
  barcodes: string[]
  children: ReactNode
}) {
  const { token, restoring, followingIds } = useSession()
  const [counts, setCounts] = useState<Record<string, number>>({})

  const barcodeKey = barcodes.join(',')
  // Takip kümesi değişince rozetler yeniden çekilir (aynı sayıda takip bile farklı uzman olabilir).
  const followingKey = [...followingIds].sort().join(',')

  useEffect(() => {
    if (restoring) return
    if (!token || followingIds.length === 0 || barcodes.length === 0) {
      setCounts({})
      return
    }
    let cancelled = false
    fetchMatchCounts(barcodes, token)
      .then((next) => {
        if (!cancelled) setCounts(next)
      })
      .catch(() => {
        if (!cancelled) setCounts({})
      })
    return () => {
      cancelled = true
    }
    // barcodeKey + followingKey: aynı küme için tekrar istek atılmaz.
  }, [barcodeKey, followingKey, token, restoring, followingIds.length])

  return <CountsContext.Provider value={counts}>{children}</CountsContext.Provider>
}

/**
 * Fiyat satırındaki "N görüş" rozeti. Sayı 0/sıfırlanmışsa `null`: ne boşluk ne
 * yer tutucu kalır. Metin ekran okuyucuda da "N görüş" olarak okunur.
 */
export function SliderVerdictBadge({ barcode }: { barcode?: string | null }) {
  const counts = useContext(CountsContext)
  const count = barcode ? counts[barcode] ?? 0 : 0
  if (count <= 0) return null

  return (
    <span className="inline-flex shrink-0 items-center rounded-[2px] border border-stamp/40 bg-stamp/10 px-1.5 py-px font-mono text-[0.6rem] leading-4 font-bold tracking-[0.1em] text-stamp uppercase">
      {count} görüş
    </span>
  )
}
