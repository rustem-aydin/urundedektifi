'use client'

import { useEffect, useState } from 'react'

import { ProductCard } from '@/components/ProductCard'
import { useSession } from '@/components/session-provider'
import { fetchMatchCounts } from '@/lib/wizard/api'
import type { ProductCardData } from '@/lib/productCardData'

/**
 * Ürün kartı ızgarası.
 *
 * Kart rozeti ("N kural eşleşti") takibe bağlıdır: sayı, oturum sahibinin takip ettiği
 * uzmanların bu üründeki eşleşen kurallarıdır (`/api/products/match-counts`). Misafir ya
 * da hiç takip etmeyen kullanıcıda rozet görünmez.
 */

export function ProductGrid({
  products,
  className,
}: {
  products: ProductCardData[]
  className?: string
}) {
  const { token, restoring, followingIds } = useSession()
  const [counts, setCounts] = useState<Record<string, number>>({})

  const barcodes = products
    .map((product) => product.barcode)
    .filter((barcode): barcode is string => Boolean(barcode))
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

  return (
    <div className={className ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          href={product.href}
          name={product.name}
          brandName={product.brandName ?? null}
          categoryName={product.categoryName ?? null}
          imageUrl={product.imageUrl ?? null}
          imageAlt={product.imageAlt ?? null}
          verdictCount={product.barcode ? (counts[product.barcode] ?? 0) : 0}
          viewCount={product.viewCount}
        />
      ))}
    </div>
  )
}
