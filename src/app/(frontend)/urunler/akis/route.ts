import { getPayload } from 'payload'
import type { NextRequest } from 'next/server'

import config from '@/payload.config'
import { PRODUCT_PAGE_SIZE, listProductCards } from '@/lib/productCardData'

export const dynamic = 'force-dynamic'

/**
 * `/urunler` sonsuz kaydırmasının sayfa ucu.
 *
 * Sayfa ilk turu sunucuda render eder; aşağı kaydırıldıkça istemci buradan sıradaki
 * `PRODUCT_PAGE_SIZE` kartı ister. Filtre parametreleri sayfanın URL'iyle birebir aynıdır
 * (`q`, `kategori`, `marka`, `etiket`); `sayfa` 1 tabanlıdır.
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

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { docs, totalDocs } = await listProductCards(payload, {
    q,
    categories: categoryIds.length > 0 ? categoryIds : undefined,
    brand,
    labels,
    page,
    limit: PRODUCT_PAGE_SIZE,
  })

  return Response.json({
    products: docs,
    totalDocs,
    page,
    pageSize: PRODUCT_PAGE_SIZE,
  })
}
