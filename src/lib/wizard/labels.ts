import { LABEL_VALUES } from './ai'

/** `products.labels` seçeneklerinin Türkçe adları (backend Products.ts ile aynı). */
export const LABEL_NAMES: Record<string, string> = {
  vegan: 'Vegan',
  vegetarian: 'Vejetaryen',
  'gluten-free': 'Glütensiz',
  'lactose-free': 'Laktozsuz',
  organic: 'Organik / Bio',
  'halal-certified': 'Helal Sertifikalı',
  kosher: 'Koşer',
  'non-gmo': 'GDO içermez',
  natural: 'Doğal',
  'no-additives': 'Katkısız',
  'sugar-free': 'Şekersiz',
  'ce-mark': 'CE İşareti',
  rohs: 'RoHS Uyumlu',
  'energy-star': 'Energy Star',
  'cruelty-free': 'Hayvan Deneysiz',
  'vegan-certified-cosmetics': 'Vegan Sertifikalı (Kozmetik)',
  'bpa-free': 'BPA İçermez',
  'paraben-free': 'Paraben İçermez',
  'sulfate-free': 'Sülfatsız',
  recyclable: 'Geri Dönüştürülebilir',
  disposable: 'Tek Kullanımlık',
  reusable: 'Yeniden Kullanılabilir',
  'oeko-tex': 'Oeko-Tex 100',
  gots: 'GOTS',
  'fair-trade': 'Fair Trade',
  fsc: 'FSC Sertifikalı',
  'energy-a-plus-plus-plus': 'Enerji A+++',
  'energy-a-plus-plus': 'Enerji A++',
  'energy-a-plus': 'Enerji A+',
  'energy-a': 'Enerji A',
  'energy-b': 'Enerji B',
}

export const LABEL_OPTIONS = LABEL_VALUES.map((value) => ({
  value,
  label: LABEL_NAMES[value] ?? value,
}))

export const PHOTO_ROLE_NAMES: Record<string, string> = {
  front: 'Ön yüz',
  ingredients: 'İçindekiler',
  nutrition: 'Besin tablosu',
  recycling: 'Geri dönüşüm',
  additional: 'Ek',
  unknown: 'Bağlanmaz',
}
