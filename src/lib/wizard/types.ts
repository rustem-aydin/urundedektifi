/**
 * Ekle/Düzenle yüzeylerinin ihtiyaç duyduğu Payload tipleri.
 * Mobil uygulamadaki `src/lib/types.ts` ile aynı sözleşme (ADR 0008/0009).
 */

export type PayloadList<T> = {
  docs: T[]
  totalDocs: number
  limit: number
  page: number
  totalPages: number
}

export type MediaRef = {
  id: string | number
  url?: string | null
  alt?: string | null
}

export type UserRole = 'admin' | 'editor' | 'expert' | 'user'

export type User = {
  id: string | number
  email: string
  name: string
  role: UserRole
}

export type AuthResponse = { token: string; user: User; exp?: number }

/** Ham `products` dokümanı (depth 0). */
export type RawProduct = {
  id: string
  barcode?: string | null
  name?: string | null
  slug?: string | null
  brand?: string | number | null
  category?: string | number | null
  manufacturer?: string | null
  country?: string | number | null
  size?: string | null
  packaging?: string | null
  description?: string | null
  usage?: string | null
  storage?: string | null
  nutriscore?: string | null
  labels?: string[] | null
  items?: { ingredients?: string | number | null; percent_estimate?: number | null }[] | null
  additives?: (string | number)[] | null
  allergens?: string | number | null
  nutrition?: {
    per?: string | null
    items?: { nutrient?: string | number | null; amount?: number | null; unit?: string | null }[] | null
  } | null
  specifications?: { key?: string | null; value?: string | null; unit?: string | null }[] | null
  warnings?: { severity?: string | null; text?: string | null }[] | null
  frontImage?: string | number | null
  ingredientsImage?: string | number | null
  nutritionImage?: string | number | null
  recyclingImage?: string | number | null
  additionalImages?: { image?: string | number | null; caption?: string | null }[] | null
  status?: string | null
  is_submit?: boolean | null
  prices?: { amount?: number | null; date?: string | null }[] | null
}

/** Ürün yazma gövdesi: yalnız doldurulan alanlar gönderilir. */
export type ProductWriteData = Partial<Omit<RawProduct, 'id'>>

/** `depth=2` ile gelmiş ilişki: nesne (ad/kod açılmış) ya da açılmamış id. */
export type RelationRef =
  | { id: string | number; name?: string | null; code?: string | null }
  | string
  | number
  | null

/** Ham `products` dokümanı, `depth=2`: Düzenle formu bundan doldurulur (ADR 0009). */
export type ProductDoc = {
  id: string | number
  barcode?: string | null
  name?: string | null
  slug?: string | null
  brand?: RelationRef
  category?: RelationRef
  manufacturer?: string | null
  country?: RelationRef
  size?: string | null
  packaging?: string | null
  description?: string | null
  usage?: string | null
  storage?: string | null
  nutriscore?: string | null
  labels?: string[] | null
  status?: string | null
  items?: { ingredients?: RelationRef; percent_estimate?: number | null }[] | null
  additives?: RelationRef[] | null
  allergens?: RelationRef
  nutrition?: {
    per?: string | null
    items?: { nutrient?: RelationRef; amount?: number | null; unit?: string | null }[] | null
  } | null
  specifications?: { key?: string | null; value?: string | null; unit?: string | null }[] | null
  warnings?: { severity?: string | null; text?: string | null }[] | null
  prices?: { amount?: number | null; date?: string | null }[] | null
}

/** Master listelerin eşleme adımında kullandığı hafif satır. */
export type MasterOption = {
  id: string
  name: string
  code?: string | null
  aliases?: string[]
}

export type MasterCollection =
  | 'ingredients'
  | 'additives'
  | 'allergens'
  | 'nutrients'
  | 'brands'
  | 'categories'
