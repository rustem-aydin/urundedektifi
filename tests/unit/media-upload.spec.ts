import { describe, expect, it } from 'vitest'

import {
  checkMediaUpload,
  MAX_MEDIA_FILE_BYTES,
  MEDIA_SIZE_REJECTION,
  MEDIA_TYPE_REJECTION,
} from '@/lib/mediaUpload'

describe('medya yükleme doğrulaması', () => {
  it('raster görselleri ve PDF dosyalarını kabul eder', () => {
    const accepted = [
      { name: 'foto.jpg', mimetype: 'image/jpeg' },
      { name: 'foto.HEIC', mimetype: 'image/heic' },
      { name: 'foto.png', mimetype: 'image/png; charset=binary' },
      { name: 'etiket.pdf', mimetype: 'application/pdf' },
      { name: 'son-sinir.png', mimetype: 'image/png', size: MAX_MEDIA_FILE_BYTES },
    ]

    for (const input of accepted) {
      expect(checkMediaUpload(input)).toBeNull()
    }
  })

  it('SVG dosyalarını MIME türü ya da uzantı üzerinden reddeder', () => {
    expect(checkMediaUpload({ name: 'logo.svg', mimetype: 'image/svg+xml' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
    // MIME sahtelemesi: içerik SVG olsa da dosya adı yakalar.
    expect(checkMediaUpload({ name: 'logo.svg', mimetype: 'image/png' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
    expect(checkMediaUpload({ name: 'logo.svgz', mimetype: 'image/png' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
    expect(checkMediaUpload({ name: 'logo.svg', mimetype: 'image/svg+xml; charset=utf-8' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
  })

  it('listede olmayan türleri ve türsüz dosyaları reddeder', () => {
    expect(checkMediaUpload({ name: 'foto.bmp', mimetype: 'image/bmp' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
    expect(checkMediaUpload({ name: 'arsiv.zip', mimetype: 'application/zip' })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
    expect(checkMediaUpload({ name: 'foto.jpg', mimetype: null })).toEqual({
      message: MEDIA_TYPE_REJECTION,
    })
  })

  it('8 MB üzerindeki dosyayı reddeder', () => {
    expect(
      checkMediaUpload({
        name: 'buyuk.jpg',
        mimetype: 'image/jpeg',
        size: MAX_MEDIA_FILE_BYTES + 1,
      }),
    ).toEqual({ message: MEDIA_SIZE_REJECTION })
  })
})
