import type { Draft, Resolution } from './productDraft'
import type { ProductWriteData, RawProduct } from './types'

/**
 * Saf gövde kurma katmanı (ADR 0008): ağ ve medya yok, yalnız form → Payload gövdesi.
 */

const TR_MAP: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

/** Backend `slugify` ile aynı sözleşme: küçük harf, Türkçe karakterler ASCII, boşluklar tire. */
export function slugify(input: string): string {
  // 'İ'.toLowerCase() "i" + birleşik nokta verir → "İz miktarda" slug'ı "i-z-miktarda" oluyordu.
  return input
    .trim()
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çğıöşü]/g, (char) => TR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export type MediaIds = {
  frontImage?: string
  ingredientsImage?: string
  nutritionImage?: string
  recyclingImage?: string
  additional: string[]
}

function percentNumber(raw: string): number | null {
  const trimmed = raw.replace(',', '.').trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value >= 0 ? value : null
}

function idOf(resolution: Resolution): string | null {
  return resolution.kind === 'existing' ? resolution.id : null
}

/**
 * Payload REST ilişki id'lerini SAYI olarak doğrular: "108" gönderilirse 400 döner
 * ("invalid relationships"). ID'ler `String(doc.id)` ile geldiği için burada sayıya çevrilir.
 */
export function relId(id: string): number | string {
  return /^\d+$/.test(id) ? Number(id) : id
}

function rel(id: string | null): number | string | null {
  return id ? relId(id) : null
}

export type BuildOutcome = { data: ProductWriteData; dropped: string[] }

/**
 * Formu Payload gövdesine çevirir. Eşlenmemiş satırlar ürüne bağlanmaz, `dropped`'a düşer.
 * `complete` (Düzenle, ADR 0009): temizlenen alanlar da gövdeye girer — boş dizi `null` değeriyle
 * alanın üzerine yazılır. Ekle'de alanlar yalnız doldurulduğu için `complete` kapalıdır.
 */
export function buildProductData(
  draft: Draft,
  media: MediaIds | null,
  options: { complete?: boolean } = {},
): BuildOutcome {
  const form = draft.form
  const dropped: string[] = []
  const complete = options.complete === true

  const items = form.ingredients.flatMap((row) => {
    const id = idOf(row.resolution)
    if (!id) {
      if (row.resolution.kind !== 'skip') dropped.push(row.name)
      return []
    }
    return [{ ingredients: relId(id), percent_estimate: percentNumber(row.percent) }]
  })

  const additives = form.additives.flatMap((row) => {
    const id = idOf(row.resolution)
    if (!id) {
      if (row.resolution.kind !== 'skip') dropped.push(row.code || row.name)
      return []
    }
    return [relId(id)]
  })

  // Şemada `allergens` tek ilişki: ilk eşleşen alerjen kaydedilir.
  const resolvedAllergens = form.allergens.filter((row) => idOf(row))
  const allergenId = resolvedAllergens.length ? rel(idOf(resolvedAllergens[0])) : null
  for (const row of resolvedAllergens.slice(1)) {
    dropped.push(`${row.name} (şema tek alerjen tutuyor)`)
  }

  const nutritionItems = form.nutrition.items.flatMap((row) => {
    const id = idOf(row.resolution)
    const amount = Number(row.amount.replace(',', '.'))
    if (!id || !Number.isFinite(amount)) {
      if (row.resolution.kind !== 'skip') dropped.push(row.name)
      return []
    }
    return [{ nutrient: relId(id), amount, unit: row.unit.trim() || 'mg' }]
  })

  const data: ProductWriteData = {
    barcode: form.barcode.trim(),
    name: form.name.trim(),
    brand: rel(idOf(form.brand)),
    category: rel(idOf(form.category)),
    manufacturer: form.manufacturer.trim() || null,
    size: form.size.trim() || null,
    packaging: form.packaging.trim() || null,
    description: form.description.trim() || null,
    usage: form.usage.trim() || null,
    storage: form.storage.trim() || null,
    labels: form.labels,
    items,
    additives,
    allergens: allergenId,
  }

  const specifications = form.specifications
    .filter((row) => row.key.trim() && row.value.trim())
    .map((row) => ({ key: row.key.trim(), value: row.value.trim(), unit: row.unit.trim() || null }))

  if (complete) {
    data.nutriscore = form.nutriscore || null
    data.nutrition = { per: form.nutrition.per, items: nutritionItems }
    data.warnings = form.warnings.filter((row) => row.text.trim())
    data.specifications = specifications
  } else {
    if (form.nutriscore) data.nutriscore = form.nutriscore
    if (nutritionItems.length) data.nutrition = { per: form.nutrition.per, items: nutritionItems }
    if (form.warnings.length) data.warnings = form.warnings
    if (specifications.length) data.specifications = specifications
  }
  if (media) {
    if (media.frontImage) data.frontImage = rel(media.frontImage)
    if (media.ingredientsImage) data.ingredientsImage = rel(media.ingredientsImage)
    if (media.nutritionImage) data.nutritionImage = rel(media.nutritionImage)
    if (media.recyclingImage) data.recyclingImage = rel(media.recyclingImage)
    if (media.additional.length) {
      data.additionalImages = media.additional.map((id) => ({ image: rel(id), caption: null }))
    }
  }
  if (form.price) {
    const amount = Number(form.price.amount.replace(',', '.'))
    if (Number.isFinite(amount) && amount > 0) {
      const parsed = form.price.date ? new Date(form.price.date) : new Date()
      const date = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
      data.prices = [{ amount, date }]
    }
  }
  data.status = form.isPublished ? 'published' : 'draft'

  return { data, dropped }
}

const EMPTY = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** Güncelleme modu: dolu alanlar ezilmez (ADR 0008, ADR 0002). */
export function onlyEmptyFields(data: ProductWriteData, existing: RawProduct): ProductWriteData {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (EMPTY(value)) continue
    // `status` içerik değil kullanıcı kararıdır: taslağı yayınlama niyeti her zaman uygulanır.
    if (key === 'status') {
      patch[key] = value
      continue
    }
    const current = (existing as unknown as Record<string, unknown>)[key]
    if (EMPTY(current)) patch[key] = value
  }
  return patch as ProductWriteData
}
