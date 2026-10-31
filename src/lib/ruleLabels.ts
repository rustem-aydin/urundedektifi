/** Kural tipi teknik kodlarının Türkçe etiketleri — web ve API aynı metni kullanır. */
const RULE_TYPE_LABELS: Record<string, string> = {
  ingredient_text: 'İçindekilerde ara',
  ingredient_excludes: 'İçindekilerde olmamalı',
  additive_code: 'Katkı kodu',
  allergen: 'Alerjen',
  country: 'Ülke',
  brand: 'Marka',
  category: 'Kategori',
  nutrition_max: 'Besin değeri üstünde',
  nutrition_min: 'Besin değeri altında',
  label_has: 'Etiket mevcut',
  label_missing: 'Etiket eksik',
}

export function ruleTypeLabel(ruleType: string): string {
  return RULE_TYPE_LABELS[ruleType] ?? ruleType
}
