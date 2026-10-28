import { describe, expect, it } from 'vitest'
import { detectCountryFromBarcode } from '@/lib/barcodePrefixes'

/**
 * Barkod → ülke eşlemesi ürün formunun otomatik ülke atamasını besler.
 * GS1 aralıkları ve GTIN-14 ambalaj göstergesi burada sabitlenir.
 */

describe('detectCountryFromBarcode', () => {
  it('EAN-13 ilk üç hanesinden ülke bulur', () => {
    expect(detectCountryFromBarcode('8691234567890')).toMatchObject({ country: 'Türkiye', prefix: 869 })
    expect(detectCountryFromBarcode('7290000000001')).toMatchObject({ country: 'İsrail', prefix: 729 })
    expect(detectCountryFromBarcode('7501234567890')).toMatchObject({ country: 'Meksika', prefix: 750 })
  })

  it('GTIN-14 ambalaj göstergesini atlayarak prefix arar', () => {
    expect(detectCountryFromBarcode('68690504082721')).toMatchObject({ country: 'Türkiye', prefix: 869 })
  })

  it('geçerli ilk üç haneyi GTIN-14 için kaydırmaz', () => {
    expect(detectCountryFromBarcode('86974293300416')).toMatchObject({ country: 'Türkiye', prefix: 869 })
  })

  it('ülke aralığı olmayan ve kısa kodlarda null döner', () => {
    expect(detectCountryFromBarcode('1501234567890')).toBeNull()
    expect(detectCountryFromBarcode('12')).toBeNull()
    expect(detectCountryFromBarcode('ABC')).toBeNull()
    expect(detectCountryFromBarcode(null)).toBeNull()
  })
})
