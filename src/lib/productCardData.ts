import type { ProductCase } from './productCase'

/** Ürün listelerinde (ızgara) karta taşınan alanlar; tam Dosya istemciye gönderilmez. */
export type ProductCardData = {
  id: string
  href: string | null
  name: string
  brandName?: string | null
  categoryName?: string | null
  barcode?: string | null
  imageUrl?: string | null
  imageAlt?: string | null
  viewCount?: number
}

/** `/urunler` ve sonsuz kaydırma ucunun ortak sayfa boyutu. */
export const PRODUCT_PAGE_SIZE = 24

export function toProductCardData(product: ProductCase): ProductCardData {
  const frontImage = product.gallery[0] ?? null
  return {
    id: String(product.id),
    href: product.barcode ? `/urun/${product.barcode}` : null,
    name: product.name || 'İsimsiz ürün',
    brandName: product.brand?.name ?? null,
    categoryName: product.category?.name ?? null,
    barcode: product.barcode,
    imageUrl: frontImage?.url || null,
    imageAlt: frontImage?.alt || product.name,
    viewCount: product.goruntulenme,
  }
}
