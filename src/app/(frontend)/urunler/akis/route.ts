import { getPayload } from 'payload'
import type { NextRequest } from 'next/server'

import config from '@/payload.config'
import { AKIS_MAX_PAGE } from '@/lib/apiGuard'
import { PRODUCT_PAGE_SIZE, listProductCards, type ProductCardData } from '@/lib/productCardData'
import { productSortFromParam } from '@/lib/productSort'

export const dynamic = 'force-dynamic'

type FeedBody = {
  products: ProductCardData[]
  totalDocs: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

function feedResponse(body: FeedBody): Response {
  // Dinamik, filtreye bağlı sayfa: ara katman (Cloudflare) 200 yanıtı önbelleklemesin.
  return Response.json(body, { headers: { 'cache-control': 'no-store' } })
}

/**
 * `/urunler` sonsuz kaydırmasının sayfa ucu.
 *
 * Sayfa ilk turu sunucuda render eder; aşağı kaydırıldıkça istemci buradan sıradaki
 * `PRODUCT_PAGE_SIZE` kartı ister. Filtre parametreleri sayfanın URL'iyle birebir aynıdır
 * (`q`, `kategori`, `marka`, `etiket`); `sayfa` 1 tabanlıdır.
 *
 * Derin sayfalama tavanı `AKIS_MAX_PAGE` (100 × 24 = 2400 ürün). Tavan aşılırsa
 * 429/400 yerine listenin bittiği söylenir: HTTP 200, boş `products`,
 * `hasNextPage: false`. İstemci hata kutusu göstermeden durur. Gerçek hız aşımı
 * (IP başına dakikada 60 istek) proxy'de 429 olarak kalır.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const requested = Number.parseInt(params.get('sayfa') ?? '1', 10)
  const page = Number.isFinite(requested) && requested > 0 ? requested : 1
  const q = (params.get('q') ?? '').trim()
  // Detay sayfası kategori + tüm alt kategorileri tekrarlı `kategori` parametresiyle gönderir.
  const categoryIds = params.getAll('kategori').filter(Boolean)
  const brand = params.get('marka') ?? ''
  const labels = params.getAll('etiket')
  const sort = productSortFromParam(params.get('sirala'))

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const filter = {
    q,
    categories: categoryIds.length > 0 ? categoryIds : undefined,
    brand,
    labels,
    sort,
  }

  if (page > AKIS_MAX_PAGE) {
    // Tavan aşımı: sayfa kartlarını çekme; yalnız `totalDocs` sözleşmesi için
    // tek kartlık sorgu (LRU'da önbelleklenir).
    const { totalDocs } = await listProductCards(payload, { ...filter, page: 1, limit: 1 })
    return feedResponse({
      products: [],
      totalDocs,
      page,
      pageSize: PRODUCT_PAGE_SIZE,
      hasNextPage: false,
    })
  }

  const { docs, totalDocs } = await listProductCards(payload, {
    ...filter,
    page,
    limit: PRODUCT_PAGE_SIZE,
  })

  return feedResponse({
    products: docs,
    totalDocs,
    page,
    pageSize: PRODUCT_PAGE_SIZE,
    // Tavan sayfasında istemciye "devam var" denmez: sıradaki istek boş liste sonu olurdu.
    hasNextPage: page < AKIS_MAX_PAGE && page * PRODUCT_PAGE_SIZE < totalDocs,
  })
}
