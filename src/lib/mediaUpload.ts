/**
 * Medya yükleme doğrulaması.
 *
 * Payload 3.87 `upload.limits.fileSize` seçeneğini artık desteklemiyor (tip ve
 * çalışma zamanı yok); boyut sınırı bu yüzden `Media` koleksiyonunun
 * `beforeOperation` kancasında, dosya diske/S3'e yazılmadan önce uygulanır.
 *
 * MIME listesi bilinçli olarak raster görseller + PDF ile sınırlıdır:
 * `image/*` joker karakteri `image/svg+xml` dosyalarını da kabul ediyordu ve
 * medya aynı kaynaktan (`/api/media/file/...`) servis edildiği için zararlı bir
 * SVG doğrudan açıldığında betik çalıştırabiliyordu (XSS). SVG sitede medya
 * olarak kullanılmıyor (`grep -rn "image/svg" src` boş); statik SVG'ler
 * `public/` altında durur ve bu koleksiyondan geçmez.
 */

export const MAX_MEDIA_FILE_BYTES = 8 * 1024 * 1024
export const MEDIA_MAX_FILE_LABEL = '8 MB'

export const MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const

export const MEDIA_TYPE_REJECTION =
  'Yalnızca JPEG, PNG, WebP, AVIF, GIF, HEIC/HEIF görselleri ve PDF yüklenebilir.'

export const MEDIA_SIZE_REJECTION = `Dosya ${MEDIA_MAX_FILE_LABEL} sınırını aşıyor. Lütfen daha küçük bir dosya yükleyin.`

export type MediaUploadInput = {
  name?: null | string
  mimetype?: null | string
  size?: null | number
}

export type MediaUploadRejection = {
  message: string
}

export function checkMediaUpload(input: MediaUploadInput): MediaUploadRejection | null {
  // `image/png; charset=...` gibi parametreler kimlik karşılaştırmasını bozmasın.
  const mimetype = (input.mimetype ?? '').split(';', 1)[0].trim().toLowerCase()
  const name = (input.name ?? '').trim().toLowerCase()

  // Dosya adı veya MIME türü SVG'yi işaret ediyorsa reddet. İçerik koklaması
  // Payload'ın kendi `checkFileRestrictions` adımında ayrıca yapılır (SVG/XML
  // olarak algılanan içerik listeye girmez).
  if (name.endsWith('.svg') || name.endsWith('.svgz') || mimetype === 'image/svg+xml') {
    return { message: MEDIA_TYPE_REJECTION }
  }

  if (!(MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(mimetype)) {
    return { message: MEDIA_TYPE_REJECTION }
  }

  const size = input.size
  if (typeof size === 'number' && Number.isFinite(size) && size > MAX_MEDIA_FILE_BYTES) {
    return { message: MEDIA_SIZE_REJECTION }
  }

  return null
}
