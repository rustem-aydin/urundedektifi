/**
 * Ürün listesi sıralaması (`?sirala=`).
 *
 * Sunucu sorgusu (Payload `sort`) ile istemci denetimi aynı sözleşmeyi okur; bu modül
 * istemci bileşenlerinden de içe aktarıldığı için **bağımlılıksızdır** (Payload, LRU yok).
 * `created_at`/`name` indeksleri `20261120_140000_products_sort_indexes` migration'ındadır;
 * yeni bir sıralama eklenirse önce indeksini düşün.
 */

/** Liste sıralaması; varsayılan `views` (en çok görüntülenen). */
export type ProductSort = 'views' | 'newest' | 'oldest' | 'name' | 'name-desc'

export const PRODUCT_SORT_DEFAULT: ProductSort = 'views'

export const PRODUCT_SORT_OPTIONS: {
  value: ProductSort
  label: string
  order: string[]
  caption: string
}[] = [
  {
    value: 'views',
    label: 'En çok görüntülenen',
    order: ['-goruntulenme', '-createdAt'],
    caption: 'önce en çok görüntülenenler',
  },
  {
    value: 'newest',
    label: 'En yeni eklenen',
    order: ['-createdAt'],
    caption: 'önce en yeni eklenenler',
  },
  {
    value: 'oldest',
    label: 'En eski eklenen',
    order: ['createdAt'],
    caption: 'önce en eski eklenenler',
  },
  {
    value: 'name',
    label: 'Ada göre (A→Z)',
    order: ['name'],
    caption: 'ada göre A→Z',
  },
  {
    value: 'name-desc',
    label: 'Ada göre (Z→A)',
    order: ['-name'],
    caption: 'ada göre Z→A',
  },
]

/** URL'den gelen `sirala` değerini bilinen bir sıralamaya indirger; tanınmayan değer varsayılana döner. */
export function productSortFromParam(value?: string | string[] | null): ProductSort {
  const raw = Array.isArray(value) ? value[0] : value
  return PRODUCT_SORT_OPTIONS.find((option) => option.value === raw)?.value ?? PRODUCT_SORT_DEFAULT
}

function productSortOption(sort: ProductSort | undefined) {
  return PRODUCT_SORT_OPTIONS.find((option) => option.value === sort) ?? PRODUCT_SORT_OPTIONS[0]
}

/** Sıralamanın Payload `sort` değeri. */
export function productSortOrder(sort: ProductSort | undefined): string[] {
  return productSortOption(sort).order
}

/** Sayaç satırının sıralama eki: "N ürün listeleniyor · önce en yeni eklenenler". */
export function productSortCaption(sort: ProductSort | undefined): string {
  return productSortOption(sort).caption
}
