import { describe, expect, it } from 'vitest'

import type { Extraction } from '@/lib/wizard/ai'
import {
  draftFromProduct,
  mergeExtraction,
  type Draft,
} from '@/lib/wizard/productDraft'
import type { ProductDoc } from '@/lib/wizard/types'

/**
 * Düzenle ekranının YZ birleştirmesi (ADR 0034): analiz kayıtlı ürünün dolu alanlarını
 * ezmez, yalnız boş alanları doldurur; etiket ve teknik özellikler küme gibi birleşir.
 */

const extraction: Extraction = {
  barcode: '8690000000001',
  name: 'Analizden gelen ad',
  brandName: 'Analiz Markası',
  categoryName: 'Atıştırmalık',
  manufacturer: 'Analiz Üretici',
  countryName: 'Türkiye',
  size: '100 g',
  packaging: 'Ambalaj',
  description: 'Analiz açıklaması',
  usage: 'Kullanım',
  storage: 'Saklama',
  nutriscore: 'b',
  labels: ['vegan', 'gluten-free'],
  ingredients: [{ name: 'Mısır', percent: 100 }],
  additives: [{ code: 'E322', name: 'Lesitin' }],
  allergens: ['gluten'],
  nutrition: {
    per: '100g',
    items: [{ name: 'Protein', amount: 7, unit: 'g' }],
  },
  warnings: [{ severity: 'low', text: 'Analiz uyarısı' }],
  specifications: [
    { key: 'Net miktar', value: '100', unit: 'g' },
    { key: 'Menşei', value: 'Türkiye', unit: null },
  ],
  photoRoles: [{ index: 0, role: 'front' }],
  requests: [],
  confidence: [],
  complete: true,
}

function productDoc(patch: Partial<ProductDoc> = {}): ProductDoc {
  return {
    id: 42,
    barcode: '8699999999999',
    name: 'Kayıtlı ürün adı',
    brand: { id: 7, name: 'Kayıtlı Marka' },
    category: null,
    manufacturer: '',
    size: '',
    packaging: '',
    description: '',
    usage: '',
    storage: '',
    nutriscore: null,
    labels: ['vegan'],
    status: 'published',
    items: [],
    additives: [],
    nutrition: { per: '100g', items: [] },
    specifications: [{ key: 'Net miktar', value: '100', unit: 'g' }],
    warnings: [],
    ...patch,
  } as ProductDoc
}

function draftWithPhotos(patch: Partial<ProductDoc> = {}): Draft {
  return {
    ...draftFromProduct(productDoc(patch)),
    photos: [{ id: 'p1', role: 'unknown', source: 'library' }, { id: 'p2', role: 'nutrition', source: 'library' }],
  }
}

describe('mergeExtraction · fill-missing', () => {
  it('dolu alanları, eşleşmeleri ve barkodu korur', () => {
    const next = mergeExtraction(draftWithPhotos(), extraction, { mode: 'fill-missing' })

    expect(next.form.barcode).toBe('8699999999999')
    expect(next.form.name).toBe('Kayıtlı ürün adı')
    expect(next.form.brand).toMatchObject({ kind: 'existing', id: '7', name: 'Kayıtlı Marka' })
  })

  it('boş alanları ve boş listeleri doldurur', () => {
    const next = mergeExtraction(draftWithPhotos(), extraction, { mode: 'fill-missing' })

    expect(next.form.manufacturer).toBe('Analiz Üretici')
    expect(next.form.nutriscore).toBe('b')
    expect(next.form.ingredients.map((row) => row.name)).toEqual(['Mısır'])
    expect(next.form.nutrition.items.map((row) => row.name)).toEqual(['Protein'])
    expect(next.form.allergens.map((row) => row.name)).toEqual(['gluten'])
  })

  it('etiketleri ve teknik özellikleri birleştirir, var olan değeri ezmez', () => {
    const next = mergeExtraction(draftWithPhotos(), extraction, { mode: 'fill-missing' })

    expect(next.form.labels).toEqual(['vegan', 'gluten-free'])
    expect(next.form.specifications).toEqual([
      { key: 'Net miktar', value: '100', unit: 'g' },
      { key: 'Menşei', value: 'Türkiye', unit: '' },
    ])
  })

  it('dolu içindekiler listesini korur', () => {
    const draft = draftWithPhotos({
      items: [{ ingredients: { id: 5, name: 'Tuz' }, percent_estimate: null }],
    })
    const next = mergeExtraction(draft, extraction, { mode: 'fill-missing' })

    expect(next.form.ingredients.map((row) => row.name)).toEqual(['Tuz'])
  })

  it('kullanıcının bilerek boşalttığı alanı doldurmaz', () => {
    const draft = { ...draftWithPhotos(), touched: ['manufacturer'] }
    const next = mergeExtraction(draft, extraction, { mode: 'fill-missing' })

    expect(next.form.manufacturer).toBe('')
  })

  it('kullanıcının seçtiği fotoğraf rolünü korur, bilinmeyen role analizden atar', () => {
    const next = mergeExtraction(draftWithPhotos(), extraction, { mode: 'fill-missing' })

    expect(next.photos[0].role).toBe('front')
    expect(next.photos[1].role).toBe('nutrition')
  })

  it('overwrite modu inceleme akışındaki eski davranışı korur', () => {
    const next = mergeExtraction(draftWithPhotos(), extraction)

    expect(next.form.name).toBe('Analizden gelen ad')
    expect(next.form.brand.name).toBe('Analiz Markası')
    expect(next.form.barcode).toBe('8699999999999')
  })
})
