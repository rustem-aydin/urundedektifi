import type { CollectionSlug, Payload, Where } from 'payload'

/**
 * Sayfalanmış toplu okuma.
 *
 * Payload'da `limit: 0` "hepsi" demek, ama 3.900+ kayıtta yol açtığı sorgu yolu
 * sayfa başına saniyeler sürüyor (ölçüldü: 3.951 kural ~2,5–32 sn, 500'lük sayfa ~0,3 sn).
 * Bu yüzden büyük listeler her zaman sabit sayfa boyutuyla gezilir.
 */
export type FindAllOptions = {
  where?: Where
  sort?: string | string[]
  depth?: number
  select?: Record<string, true>
  pageSize?: number
}

export async function findAllDocs<TDoc>(
  payload: Payload,
  collection: CollectionSlug,
  options: FindAllOptions = {},
): Promise<TDoc[]> {
  const pageSize = options.pageSize ?? 2000
  const docs: TDoc[] = []
  for (let page = 1; ; page++) {
    // Koleksiyon adı çalışma anında gelir; Payload'ın şema tipleri burada uygulanamaz.
    const result = await (payload.find as unknown as (args: unknown) => Promise<{
      docs: unknown[]
      hasNextPage?: boolean
    }>)({
      collection,
      where: options.where,
      sort: options.sort,
      depth: options.depth ?? 0,
      ...(options.select ? { select: options.select } : {}),
      limit: pageSize,
      page,
    })
    docs.push(...(result.docs as TDoc[]))
    if (!result.hasNextPage || result.docs.length === 0) return docs
  }
}
