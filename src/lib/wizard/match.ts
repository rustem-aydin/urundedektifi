import type { MasterOption } from './types'

/**
 * Master liste eşlemesi için normalizasyon: Türkçe karakterler ASCII'ye, küçük harf, tek boşluk.
 * Örn. "Palm Yağı" → "palm yagi", "E 322" → "e 322".
 */
const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u' }

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
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
