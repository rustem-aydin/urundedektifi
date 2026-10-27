'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { ProductGrid } from '@/components/ProductGrid'
import { PRODUCT_PAGE_SIZE, type ProductCardData } from '@/lib/productCardData'

type FeedPage = {
  products: ProductCardData[]
  totalDocs: number
  page: number
  pageSize: number
}

/**
 * Ürün ızgarasının sonsuz kaydırma sarmalayıcısı.
 *
 * İlk sayfa sunucuda render edilir; listenin sonundaki görünmez sentinel görüş alanına
 * girdiğinde sonraki sayfa `/urunler/akis` ucundan istenir. "Daha fazla yükle" düğmesi yoktur.
 * Uzun ekranda sentinel görünür kalırsa sayfalar zincirleme istenir; hata durumunda zincir
 * durur, yalnız kullanıcı "Tekrar dene"ye bastığında devam eder.
 */
export function InfiniteProductGrid({
  initialProducts,
  totalDocs,
  query,
}: {
  initialProducts: ProductCardData[]
  totalDocs: number
  /** Sayfanın filtre sorgusu (`q`, `kategori`, `marka`, `etiket`); `sayfa` burada eklenir. */
  query: string
}) {
  const [products, setProducts] = useState(initialProducts)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement | null>(null)
  const loadedPage = useRef(1)
  const exhausted = useRef(initialProducts.length >= totalDocs)
  const busy = useRef(false)

  const fetchNext = useCallback(async (): Promise<'more' | 'stop'> => {
    if (busy.current || exhausted.current) return 'stop'
    busy.current = true
    setLoading(true)
    setFailed(false)
    try {
      const params = new URLSearchParams(query)
      params.set('sayfa', String(loadedPage.current + 1))
      const response = await fetch(`/urunler/akis?${params.toString()}`)
      if (!response.ok) throw new Error(`liste ${response.status}`)
      const data = (await response.json()) as FeedPage
      const pageSize = data.pageSize || PRODUCT_PAGE_SIZE
      loadedPage.current = data.page
      setProducts((previous) => {
        const known = new Set(previous.map((item) => item.id))
        return [...previous, ...data.products.filter((item) => !known.has(item.id))]
      })
      exhausted.current = data.products.length < pageSize || data.page * pageSize >= data.totalDocs
      return exhausted.current ? 'stop' : 'more'
    } catch {
      setFailed(true)
      return 'stop'
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const element = sentinel.current
    if (!element) return
    let stopped = false

    /** Sentinel görüş alanındaysa (uzun ekran) sayfaları sırayla ister. */
    const pump = async () => {
      while (!stopped) {
        if (element.getBoundingClientRect().top >= window.innerHeight + 400) return
        if ((await fetchNext()) !== 'more') return
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void pump()
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(element)
    return () => {
      stopped = true
      observer.disconnect()
    }
  }, [fetchNext])

  return (
    <>
      <ProductGrid products={products} />
      <div ref={sentinel} aria-hidden="true" className="h-px w-full" />
      {loading && (
        <p
          role="status"
          className="mt-6 text-center font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase"
        >
          Sıradaki dosyalar yükleniyor…
        </p>
      )}
      {failed && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sonraki sayfa yüklenemedi.{' '}
          <button
            type="button"
            onClick={() => void fetchNext()}
            className="underline underline-offset-4 hover:text-foreground"
          >
            Tekrar dene
          </button>
        </p>
      )}
    </>
  )
}
