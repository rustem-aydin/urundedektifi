import {
  createMasterDoc,
  createProduct,
  findMasterByName,
  findMasterDoc,
  findProductByBarcode,
  updateProduct,
  uploadMedia,
} from './api'
import type { Draft, ProductForm, Resolution } from './productDraft'
import type { MediaIds } from './productPayload'
import { buildProductData, onlyEmptyFields, slugify } from './productPayload'

/** Vision modellerinin içsel çözünürlüğü ~1568px; daha büyüğü token israfı. */
export const MAX_IMAGE_EDGE = 1568

export type ResizedImage = { blob: Blob; width: number; height: number }

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Fotoğraf sıkıştırılamadı.'))),
      'image/jpeg',
      0.8,
    )
  })
}

/** Fotoğrafı en fazla 1568px kenara indirir ve JPEG 0.8'e sıkıştırır. */
export async function resizeImage(file: File): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Bu tarayıcı fotoğraf işleyemiyor.')
    context.drawImage(bitmap, 0, 0, width, height)
    return { blob: await canvasBlob(canvas), width, height }
  } finally {
    bitmap.close()
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Fotoğraf okunamadı.'))
    reader.readAsDataURL(blob)
  })
}

export type PreparedPhoto = ResizedImage & { base64: string }

/** Analiz için: küçültülmüş blob + base64 (vision modeline giden gövde). */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const resized = await resizeImage(file)
  return { ...resized, base64: await blobToBase64(resized.blob) }
}

/* --------------------------- master kayıtlar ------------------------- */

export type MasterCreateError = { name: string; message: string }

export type ResolveOutcome = {
  draft: Draft
  created: number
  errors: MasterCreateError[]
}

async function resolveOne(
  collection: 'ingredients' | 'additives' | 'allergens' | 'nutrients' | 'brands' | 'categories',
  resolution: Resolution,
  data: { name?: string; code?: string; slug?: string },
  token: string,
): Promise<Resolution> {
  if (resolution.kind !== 'create') return resolution

  const link = (id: string, name: string): Resolution => ({
    ...resolution,
    kind: 'existing',
    id,
    suggestion: { id, name },
  })

  // Aynı ad master listede varsa YENİ kayıt açılmaz: kural motoru kimlik üzerinden eşleştiği
  // için kopya satır ("Su" ×3, "Şeker" ×3) ürünü mevcut kurallardan koparır. Sunucuya sormak
  // şart: istemci listesi bayat olabilir (web'de oturum boyunca önbellekte).
  const existing = data.name
    ? await findMasterByName(collection, data.name).catch(() => null)
    : null
  if (existing) return link(existing.id, existing.name)

  try {
    const doc = await createMasterDoc(collection, data, token)
    return link(doc.id, resolution.name)
  } catch (error) {
    // Aynı ad/kod zaten varsa (unique 400) mevcut kayda bağla; kayıt engellenmesin.
    const byCode = data.code
      ? await findMasterDoc(collection, 'code', data.code).catch(() => null)
      : null
    if (byCode) return link(byCode.id, byCode.name)
    const byName = data.name
      ? await findMasterDoc(collection, 'name', data.name).catch(() => null)
      : null
    if (byName) return link(byName.id, byName.name)
    throw error
  }
}

/**
 * Eşleme adımında "Yeni oluştur" işaretlenen master kayıtlarını sunucuda açar ve
 * kararları `existing` + id'ye çevirir. Hata alan satır olduğu gibi kalır (kayıt denenmez).
 */
export async function resolveCreatedMasters(draft: Draft, token: string): Promise<ResolveOutcome> {
  const errors: MasterCreateError[] = []
  let created = 0
  const form: ProductForm = { ...draft.form }

  const attempt = async (
    name: string,
    input: Resolution,
    run: () => Promise<Resolution>,
  ): Promise<Resolution | null> => {
    try {
      const resolution = await run()
      if (input.kind === 'create' && resolution.kind === 'existing') created += 1
      return resolution
    } catch (error) {
      errors.push({ name, message: error instanceof Error ? error.message : 'Bilinmeyen hata' })
      return null
    }
  }

  const brand = await attempt(form.brand.name, form.brand, () =>
    resolveOne('brands', form.brand, { name: form.brand.name }, token),
  )
  if (brand) form.brand = brand

  const category = await attempt(form.category.name, form.category, () =>
    resolveOne('categories', form.category, { name: form.category.name }, token),
  )
  if (category) form.category = category

  const ingredients = []
  for (const row of form.ingredients) {
    const resolved = await attempt(row.resolution.name, row.resolution, () =>
      resolveOne('ingredients', row.resolution, { name: row.resolution.name }, token),
    )
    ingredients.push(resolved ? { ...row, resolution: resolved } : row)
  }
  form.ingredients = ingredients

  const additives = []
  for (const row of form.additives) {
    const name = row.name || row.code
    if (!name) {
      // E-kodu opsiyonel; en az bir ad gerekir (Additives.name zorunlu).
      errors.push({
        name: 'katkı',
        message: 'Ne E-kodu ne de ad yazılmış: katkı kaydı oluşturulamaz.',
      })
      additives.push(row)
      continue
    }
    const resolved = await attempt(name, row.resolution, () =>
      resolveOne(
        'additives',
        row.resolution,
        row.code ? { code: row.code, name } : { name },
        token,
      ),
    )
    additives.push(resolved ? { ...row, resolution: resolved } : row)
  }
  form.additives = additives

  const allergens = []
  for (const row of form.allergens) {
    const resolved = await attempt(row.name, row, () =>
      resolveOne('allergens', row, { name: row.name, slug: slugify(row.name) }, token),
    )
    allergens.push(resolved ?? row)
  }
  form.allergens = allergens

  const nutritionItems = []
  for (const row of form.nutrition.items) {
    const resolved = await attempt(row.resolution.name, row.resolution, () =>
      resolveOne(
        'nutrients',
        row.resolution,
        { name: row.resolution.name, slug: slugify(row.resolution.name) },
        token,
      ),
    )
    nutritionItems.push(resolved ? { ...row, resolution: resolved } : row)
  }
  form.nutrition = { ...form.nutrition, items: nutritionItems }

  return { draft: { ...draft, form }, created, errors }
}

/* ------------------------------- medya ------------------------------ */

export type UploadablePhoto = {
  id: string
  blob: Blob
  role: Draft['photos'][number]['role']
  alt: string
}

/** Rolü bilinen fotoğrafları medya koleksiyonuna yükler; en fazla 6 görsel şemaya bağlanır. */
export async function uploadDraftPhotos(
  photos: UploadablePhoto[],
  token: string,
): Promise<MediaIds> {
  const ids: MediaIds = { additional: [] }
  for (const photo of photos) {
    const media = await uploadMedia(photo.blob, `${photo.id}.jpg`, token, photo.alt)
    const id = String(media.id)
    switch (photo.role) {
      case 'front':
        ids.frontImage ??= id
        break
      case 'ingredients':
        ids.ingredientsImage ??= id
        break
      case 'nutrition':
        ids.nutritionImage ??= id
        break
      case 'recycling':
        ids.recyclingImage ??= id
        break
      case 'additional':
        if (ids.additional.length < 2) ids.additional.push(id)
        break
      default:
        break
    }
  }
  return ids
}

/* ------------------------------ kaydet ------------------------------ */

export type SaveOutcome = {
  productId: string
  created: boolean
  dropped: string[]
}

export async function saveProduct(
  draft: Draft,
  token: string,
  photos: UploadablePhoto[],
): Promise<SaveOutcome> {
  const media = photos.length ? await uploadDraftPhotos(photos, token) : null
  const { data, dropped } = buildProductData(draft, media)

  if (draft.mode === 'update' && draft.productId) {
    const existing = await findProductByBarcode(data.barcode ?? '')
    if (!existing) throw new Error('Güncellenecek ürün bulunamadı. Dosyayı yenileyip tekrar dene.')
    const patch = onlyEmptyFields(data, existing)
    const doc = await updateProduct(existing.id, patch, token)
    return { productId: doc.id, created: false, dropped }
  }

  const doc = await createProduct(data, token)
  return { productId: doc.id, created: true, dropped }
}

/**
 * Düzenle ekranının kaydı (ADR 0009): form değerleri ürünün üzerine yazılır, "yalnız boş alan"
 * kuralı yoktur. Fotoğraf eklenmediyse mevcut görseller ve fiyat geçmişi gövdede yer almaz.
 */
export async function saveProductEdits(
  draft: Draft,
  token: string,
  photos: UploadablePhoto[],
): Promise<SaveOutcome> {
  if (!draft.productId) throw new Error('Düzenlenecek ürün belirlenmedi.')
  const media = photos.length ? await uploadDraftPhotos(photos, token) : null
  const { data, dropped } = buildProductData(draft, media, { complete: true })
  const doc = await updateProduct(draft.productId, data, token)
  return { productId: doc.id, created: false, dropped }
}
