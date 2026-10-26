/**
 * Türkçe karakterleri dönüştürerek URL-dostu slug üretir.
 * Tüm collection'lardaki kopya slug mantığının tek kaynağı.
 */
export function slugify(text: string): string {
  // 'İ'.toLowerCase() "i" + birleşik nokta verir → "İz miktarda" slug'ı "i-z-miktarda" oluyordu.
  return text
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
