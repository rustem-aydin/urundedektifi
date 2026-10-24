import type { Extraction, PhotoRole } from './ai'
import { clearPhotoBlobs, deletePhotoBlob, getPhotoBlob } from './photoStore'
import type { ProductDoc, RelationRef } from './types'

/**
 * Ekle sihirbazının taslağı (ADR 0008, web uyarlaması).
 * Fotoğraf blob'ları IndexedDB'de (photoStore), taslağın kendisi `localStorage`'da tutulur.
 * `url` yalnız bellekte yaşayan object URL'dir; diske yazılmaz.
 */

const DRAFT_STORAGE = 'urundedektifi.ekle.draft'

export type DraftPhoto = {
  id: string
  role: PhotoRole
  source: 'camera' | 'library'
  /** Bellege bağlı görüntü adresi; `saveDraft` bunu yazmaz. */
  url?: string
}

type StoredPhoto = Omit<DraftPhoto, 'url'>

/** Master listeye eşleme kararı. */
export type Resolution = {
  /** pending: henüz karar verilmedi */
  kind: 'pending' | 'existing' | 'create' | 'skip'
  /** Etiketten/AI'dan gelen ad */
  name: string
  /** kind === 'existing' ise master kayıt id'si */
  id: string | null
  /** Ön-dolu eşleşme önerisi */
  suggestion: { id: string; name: string } | null
}

export type FormIngredient = { name: string; percent: string; resolution: Resolution }
export type FormAdditive = { code: string; name: string; resolution: Resolution }
export type FormNutrient = { name: string; amount: string; unit: string; resolution: Resolution }

export type NutritionPer = '100g' | '100ml' | 'serving'

export type ProductForm = {
  barcode: string
  name: string
  brand: Resolution
  category: Resolution
  manufacturer: string
  size: string
  packaging: string
  description: string
  usage: string
  storage: string
  nutriscore: '' | 'a' | 'b' | 'c' | 'd' | 'e'
  labels: string[]
  ingredients: FormIngredient[]
  additives: FormAdditive[]
  allergens: Resolution[]
  nutrition: { per: NutritionPer; items: FormNutrient[] }
  warnings: { severity: 'low' | 'medium' | 'high'; text: string }[]
  specifications: { key: string; value: string; unit: string }[]
  isPublished: boolean
  price: { amount: string; date: string } | null
}

export type Draft = {
  version: 1
  step: 1 | 2 | 3 | 4
  barcode: string
  mode: 'create' | 'update'
  /** update modunda mevcut ürünün id'si */
  productId: string | null
  photos: DraftPhoto[]
  extraction: Extraction | null
  form: ProductForm
  /** Kullanıcının elle değiştirdiği alanlar: yeniden analizde korunur. */
  touched: string[]
  analysisRounds: number
  usage: { prompt: number | null; completion: number | null } | null
  updatedAt: string
}

export type LoadedDraft = { draft: Draft; missingPhotos: number }

export function emptyResolution(name = ''): Resolution {
  return { kind: 'pending', name, id: null, suggestion: null }
}

export function emptyForm(): ProductForm {
  return {
    barcode: '',
    name: '',
    brand: emptyResolution(),
    category: emptyResolution(),
    manufacturer: '',
    size: '',
    packaging: '',
    description: '',
    usage: '',
    storage: '',
    nutriscore: '',
    labels: [],
    ingredients: [],
    additives: [],
    allergens: [],
    nutrition: { per: '100g', items: [] },
    warnings: [],
    specifications: [],
    isPublished: false,
    price: null,
  }
}

export function createEmptyDraft(): Draft {
  return {
    version: 1,
    step: 1,
    barcode: '',
    mode: 'create',
    productId: null,
    photos: [],
    extraction: null,
    form: emptyForm(),
    touched: [],
    analysisRounds: 0,
    usage: null,
    updatedAt: new Date().toISOString(),
  }
}

/* ----------------------------- eşleme ------------------------------ */

function resolutionFromList(name: string, previous: Resolution | undefined): Resolution {
  // Aynı adla daha önce karar verilmişse onu koru.
  if (previous && previous.name === name && previous.kind !== 'pending') return previous
  return emptyResolution(name)
}

function mergeIngredients(extraction: Extraction, previous: FormIngredient[]): FormIngredient[] {
  return extraction.ingredients.map((row) => {
    const existing = previous.find((item) => item.name === row.name)
    return {
      name: row.name,
      percent: row.percent === null ? (existing?.percent ?? '') : String(row.percent),
      resolution: resolutionFromList(row.name, existing?.resolution),
    }
  })
}

function mergeAdditives(extraction: Extraction, previous: FormAdditive[]): FormAdditive[] {
  return extraction.additives.map((row) => {
    const label = row.code ?? row.name ?? ''
    const existing = previous.find((item) => (item.code || item.name) === label)
    return {
      code: row.code ?? '',
      name: row.name ?? '',
      resolution: resolutionFromList(label, existing?.resolution),
    }
  })
}

function mergeNutrients(extraction: Extraction, previous: FormNutrient[]): FormNutrient[] {
  const items = extraction.nutrition?.items ?? []
  return items.map((row) => {
    const existing = previous.find((item) => item.name === row.name)
    return {
      name: row.name,
      amount: String(row.amount),
      unit: row.unit || 'mg',
      resolution: resolutionFromList(row.name, existing?.resolution),
    }
  })
}

/**
 * Analiz sonucunu forma yazar; kullanıcının elle dokunduğu alanlar korunur.
 * `touched` anahtarları ProductForm alan adlarıyla aynıdır ('name', 'ingredients', ...).
 */
export function mergeExtraction(draft: Draft, extraction: Extraction): Draft {
  const form = draft.form
  const keep = (field: string) => draft.touched.includes(field)
  const text = (field: keyof ProductForm, next: string | null) =>
    keep(field) ? (form[field] as string) : (next ?? (form[field] as string))

  const next: ProductForm = {
    ...form,
    barcode: keep('barcode') || form.barcode ? form.barcode : (extraction.barcode ?? ''),
    name: text('name', extraction.name),
    brand: keep('brand')
      ? form.brand
      : resolutionFromList(extraction.brandName ?? form.brand.name, form.brand),
    category: keep('category')
      ? form.category
      : resolutionFromList(extraction.categoryName ?? form.category.name, form.category),
    manufacturer: text('manufacturer', extraction.manufacturer),
    size: text('size', extraction.size),
    packaging: text('packaging', extraction.packaging),
    description: text('description', extraction.description),
    usage: text('usage', extraction.usage),
    storage: text('storage', extraction.storage),
    nutriscore: keep('nutriscore') ? form.nutriscore : (extraction.nutriscore ?? form.nutriscore),
    labels: keep('labels') ? form.labels : extraction.labels.length ? extraction.labels : form.labels,
    ingredients: keep('ingredients')
      ? form.ingredients
      : mergeIngredients(extraction, form.ingredients),
    additives: keep('additives') ? form.additives : mergeAdditives(extraction, form.additives),
    allergens: keep('allergens')
      ? form.allergens
      : extraction.allergens.map((name) => {
          const existing = form.allergens.find((item) => item.name === name)
          return resolutionFromList(name, existing)
        }),
    nutrition: keep('nutrition')
      ? form.nutrition
      : {
          per: extraction.nutrition?.per ?? form.nutrition.per,
          items: mergeNutrients(extraction, form.nutrition.items),
        },
    warnings: keep('warnings') ? form.warnings : extraction.warnings,
    specifications: keep('specifications')
      ? form.specifications
      : extraction.specifications.map((row) => ({
          key: row.key,
          value: row.value,
          unit: row.unit ?? '',
        })),
    isPublished: form.isPublished,
    price: form.price,
  }

  return {
    ...draft,
    form: next,
    extraction,
    photos: draft.photos.map((photo, index) => ({
      ...photo,
      role: extraction.photoRoles.find((entry) => entry.index === index)?.role ?? photo.role,
    })),
    updatedAt: new Date().toISOString(),
  }
}

/* ---------------------------- sayaçlar ----------------------------- */

export type ResolutionCounts = {
  matched: number
  created: number
  skipped: number
  pending: number
  total: number
}

export function resolutionCounts(draft: Draft): ResolutionCounts {
  const resolutions: Resolution[] = [
    draft.form.brand,
    draft.form.category,
    ...draft.form.ingredients.map((row) => row.resolution),
    ...draft.form.additives.map((row) => row.resolution),
    ...draft.form.allergens,
    ...draft.form.nutrition.items.map((row) => row.resolution),
  ].filter((resolution) => resolution.name.trim().length > 0)

  return {
    matched: resolutions.filter((resolution) => resolution.kind === 'existing').length,
    created: resolutions.filter((resolution) => resolution.kind === 'create').length,
    skipped: resolutions.filter((resolution) => resolution.kind === 'skip').length,
    pending: resolutions.filter((resolution) => resolution.kind === 'pending').length,
    total: resolutions.length,
  }
}

/* ---------------------------- düzenleme ---------------------------- */

const NUTRISCORES = ['a', 'b', 'c', 'd', 'e'] as const
const NUTRITION_PERS = ['100g', '100ml', 'serving'] as const
const SEVERITIES = ['low', 'medium', 'high'] as const

function relationName(relation: RelationRef): string {
  if (!relation) return ''
  if (typeof relation === 'object') return relation.name ?? relation.code ?? `#${relation.id}`
  return `#${relation}`
}

/** `depth=2` ilişkiyi "mevcut kayda bağlı" karara çevirir; id korunur ki kayıt bozulmasın. */
function resolutionOfRelation(relation: RelationRef): Resolution {
  if (!relation) return emptyResolution()
  const id = typeof relation === 'object' ? String(relation.id) : String(relation)
  const name = relationName(relation)
  return { kind: 'existing', name, id, suggestion: { id, name } }
}

/**
 * Mevcut ürünü Düzenle formuna açar (ADR 0009). Fotoğraflar taşınmaz: mevcut görseller
 * yalnız yeni fotoğraf yüklenirse değişir; eşleşmeler `existing` başlar, hiçbir satır karar beklemez.
 */
export function draftFromProduct(doc: ProductDoc): Draft {
  const form: ProductForm = {
    barcode: doc.barcode ?? '',
    name: doc.name ?? '',
    brand: resolutionOfRelation(doc.brand ?? null),
    category: resolutionOfRelation(doc.category ?? null),
    manufacturer: doc.manufacturer ?? '',
    size: doc.size ?? '',
    packaging: doc.packaging ?? '',
    description: doc.description ?? '',
    usage: doc.usage ?? '',
    storage: doc.storage ?? '',
    nutriscore:
      doc.nutriscore && (NUTRISCORES as readonly string[]).includes(doc.nutriscore)
        ? (doc.nutriscore as ProductForm['nutriscore'])
        : '',
    labels: doc.labels ?? [],
    ingredients: (doc.items ?? []).map((row) => ({
      name: relationName(row.ingredients ?? null),
      percent:
        row.percent_estimate === null || row.percent_estimate === undefined
          ? ''
          : String(row.percent_estimate),
      resolution: resolutionOfRelation(row.ingredients ?? null),
    })),
    additives: (doc.additives ?? []).map((relation) => ({
      code: relation && typeof relation === 'object' ? (relation.code ?? '') : '',
      name: relationName(relation),
      resolution: resolutionOfRelation(relation),
    })),
    allergens: doc.allergens ? [resolutionOfRelation(doc.allergens)] : [],
    nutrition: {
      per:
        doc.nutrition?.per && (NUTRITION_PERS as readonly string[]).includes(doc.nutrition.per)
          ? (doc.nutrition.per as NutritionPer)
          : '100g',
      items: (doc.nutrition?.items ?? []).map((row) => ({
        name: relationName(row.nutrient ?? null),
        amount: row.amount === null || row.amount === undefined ? '' : String(row.amount),
        unit: row.unit ?? 'mg',
        resolution: resolutionOfRelation(row.nutrient ?? null),
      })),
    },
    warnings: (doc.warnings ?? []).flatMap((row) =>
      row.text
        ? [
            {
              severity:
                row.severity && (SEVERITIES as readonly string[]).includes(row.severity)
                  ? (row.severity as 'low' | 'medium' | 'high')
                  : 'medium',
              text: row.text,
            },
          ]
        : [],
    ),
    specifications: (doc.specifications ?? []).map((row) => ({
      key: row.key ?? '',
      value: row.value ?? '',
      unit: row.unit ?? '',
    })),
    isPublished: doc.status === 'published',
    price: null,
  }

  return {
    version: 1,
    step: 2,
    barcode: form.barcode,
    mode: 'update',
    productId: String(doc.id),
    photos: [],
    extraction: null,
    form,
    touched: [],
    analysisRounds: 0,
    usage: null,
    updatedAt: new Date().toISOString(),
  }
}

/* -------------------------- kalıcılık ------------------------------ */

function browser(): boolean {
  return typeof window !== 'undefined'
}

export async function loadDraft(): Promise<LoadedDraft | null> {
  if (!browser()) return null
  const raw = window.localStorage.getItem(DRAFT_STORAGE)
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) {
    return null
  }
  const stored = parsed as Draft
  const photos: DraftPhoto[] = []
  let missingPhotos = 0
  for (const photo of stored.photos) {
    try {
      const blob = await getPhotoBlob(photo.id)
      if (!blob) {
        missingPhotos += 1
        continue
      }
      photos.push({ ...photo, url: URL.createObjectURL(blob) })
    } catch {
      missingPhotos += 1
    }
  }
  return { draft: { ...stored, photos }, missingPhotos }
}

export async function saveDraft(draft: Draft): Promise<void> {
  if (!browser()) return
  const photos: StoredPhoto[] = draft.photos.map(({ url: _url, ...rest }) => rest)
  window.localStorage.setItem(
    DRAFT_STORAGE,
    JSON.stringify({ ...draft, photos, updatedAt: new Date().toISOString() }),
  )
}

export async function clearDraft(): Promise<void> {
  if (!browser()) return
  window.localStorage.removeItem(DRAFT_STORAGE)
  await clearPhotoBlobs().catch(() => undefined)
}

/** Tek fotoğrafı diskten ve bellekten düşürür. */
export async function forgetPhoto(photo: DraftPhoto): Promise<void> {
  if (photo.url) URL.revokeObjectURL(photo.url)
  await deletePhotoBlob(photo.id).catch(() => undefined)
}
