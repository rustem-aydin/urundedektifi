import type { Resolution } from './productDraft'
import type { MasterOption } from './types'

/**
 * Master liste eşlemesi için normalizasyon: Türkçe karakterler ASCII'ye, küçük harf, tek boşluk.
 * Örn. "Palm Yağı" → "palm yagi", "E 322" → "e 322".
 */
const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' }

export function normalizeText(value: string): string {
  // 'İ'.toLowerCase() JS'te "i" + birleşik nokta (U+0307) üretir; naif sıra ("İnülin" →
  // "i nulin") master adıyla eşleşmeyi bozar. Büyük I'lar önce "i"ye iner.
  return value
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çğıöşü]/g, (char) => TR[char] ?? char)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * En iyi eşleşmeyi döndürür: tam ad, tam alternatif ad, sonra "içerir" eşleşmeleri.
 * Zayıf eşleşme (tek kelimelik kısa ortaklık) önerilmez; yanlış öneri insanı yanıltır.
 */
export function bestMatch(options: MasterOption[], query: string): MasterOption | null {
  const needle = normalizeText(query)
  if (!needle) return null

  const exact = options.find((option) => normalizeText(option.name) === needle)
  if (exact) return exact

  const codeExact = options.find((option) => option.code && normalizeText(option.code) === needle)
  if (codeExact) return codeExact

  const aliasExact = options.find(
    (option) => option.aliases?.some((alias) => normalizeText(alias) === needle) ?? false,
  )
  if (aliasExact) return aliasExact

  const contains = options.find((option) => {
    const haystack = [option.name, option.code ?? '', ...(option.aliases ?? [])].map(normalizeText)
    return haystack.some(
      (value) => value.length > 3 && (value.includes(needle) || needle.includes(value)),
    )
  })
  return contains ?? null
}

/**
 * Toplu kararın tek satırı: "yeni oluştur" isteği ÖNCE eşleştirir.
 * Adı master listede duran satır yeni kayıt açmaz (aksi hâlde tek dokunuş tüm listeyi kopya
 * master kaydına çeviriyordu: üretimde "Su" ×3, "Şeker" ×3); yalnız gerçekten yeni satır `create`
 * olur. Karar verilmiş satır (`existing`/`skip`) ve `skip` isteği olduğu gibi uygulanır.
 */
export function resolveSelection(
  resolution: Resolution,
  kind: 'create' | 'skip',
  options: MasterOption[],
): Resolution {
  if (resolution.kind !== 'pending') return resolution
  if (kind === 'create') {
    const match = resolution.suggestion ?? bestMatch(options, resolution.name)
    if (match) return { ...resolution, kind: 'existing', id: match.id, suggestion: match }
  }
  return { ...resolution, kind }
}

/** Eşleme ekranındaki serbest arama: ad veya alternatif ad içinde geçen ilk 8 satır. */
export function searchOptions(options: MasterOption[], query: string, limit = 8): MasterOption[] {
  const needle = normalizeText(query)
  if (!needle) return []
  return options
    .filter((option) =>
      [option.name, option.code ?? '', ...(option.aliases ?? [])]
        .map(normalizeText)
        .some((value) => value.includes(needle)),
    )
    .slice(0, limit)
}
