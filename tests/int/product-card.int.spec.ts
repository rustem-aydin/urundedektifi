import { describe, expect, it } from 'vitest'

import { productCardFromDoc } from '@/lib/productCardData'

const media = (url: string, alt?: string) => ({ id: 1, url, alt: alt ?? null })

describe('productCardFromDoc kapak seçimi', () => {
  it('ön yüz fotoğrafı varsa onu kullanır', () => {
    const card = productCardFromDoc({
      id: 1,
      name: 'Kraker',
      frontImage: media('/api/media/file/on.jpg', 'Ön yüz'),
      ingredientsImage: media('/api/media/file/icindekiler.jpg'),
    })
    expect(card.imageUrl).toBe('/api/media/file/on.jpg')
    expect(card.imageAlt).toBe('Ön yüz')
  })

  it('ön yüz yoksa içindekiler fotoğrafına düşer', () => {
    // Detay sayfasında görünen fotoğraf listede "Görsel yok" kalmamalı.
    const card = productCardFromDoc({
      id: 2,
      name: 'Ketçap',
      frontImage: null,
      ingredientsImage: media('/api/media/file/icindekiler.jpg'),
    })
    expect(card.imageUrl).toBe('/api/media/file/icindekiler.jpg')
  })

  it('kategorize fotoğraf yoksa ek fotoğrafa düşer', () => {
    const card = productCardFromDoc({
      id: 3,
      name: 'Soda',
      frontImage: null,
      additionalImages: [{ image: null }, { image: media('/api/media/file/ek.jpg', 'Arka yüz') }],
    })
    expect(card.imageUrl).toBe('/api/media/file/ek.jpg')
    expect(card.imageAlt).toBe('Arka yüz')
  })

  it('hiç fotoğraf yoksa görsel boş kalır, alt ürün adına düşer', () => {
    const card = productCardFromDoc({ id: 4, name: 'Mentos', frontImage: null })
    expect(card.imageUrl).toBeNull()
    expect(card.imageAlt).toBe('Mentos')
  })

  it('yalnız ilişki kimliği (depth 0) gelse de görsel sayılmaz', () => {
    const card = productCardFromDoc({ id: 5, name: 'Çay', frontImage: 42 })
    expect(card.imageUrl).toBeNull()
  })
})
