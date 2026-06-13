import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Görsel sıkıştırma hook'u - tip belirtilmeden
const compressImage = async (args: { data: Record<string, any> }) => {
  const { data } = args
  const file = data.file

  // Sadece görselleri sıkıştır (PDF dahil etme)
  if (file?.data && file.mimeType?.startsWith('image/')) {
    try {
      const buffer = Buffer.from(file.data, 'base64')
      const originalSize = buffer.length

      // Boyuta göre kalite ayarla
      let quality = 80
      if (originalSize > 3 * 1024 * 1024) quality = 40
      else if (originalSize > 2 * 1024 * 1024) quality = 50
      else if (originalSize > 1 * 1024 * 1024) quality = 60
      else if (originalSize > 500 * 1024) quality = 70

      let compressedBuffer = await sharp(buffer)
        .rotate()
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()

      // Hala çok büyükse kaliteyi daha düşür
      if (compressedBuffer.length > 500 * 1024) {
        compressedBuffer = await sharp(buffer)
          .rotate()
          .jpeg({ quality: 25, mozjpeg: true })
          .toBuffer()
      }

      // Sadece orijinalden küçükse kullan
      if (compressedBuffer.length < originalSize) {
        data.file.data = compressedBuffer.toString('base64')
        data.file.size = compressedBuffer.length
        data.file.mimeType = 'image/jpeg'
      }
    } catch (error) {
      console.error('Görsel sıkıştırma hatası:', error)
    }
  }

  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Medya',
    plural: 'Medyalar',
  },
  access: {
    read: () => true,
  },
  admin: {
    group: 'Sistem',
    description:
      'Yüklenen tüm görseller ve belgeler (ürün fotoğrafları, uzman fotoğrafları, kanıt belgeleri).',
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      { name: 'thumbnail', width: 240, height: 240, position: 'centre' },
      { name: 'small', width: 480 },
      { name: 'medium', width: 800 },
      { name: 'large', width: 1200 },
    ],
    // uploadLimits BURADA YOK - silindi
  },
  hooks: {
    beforeChange: [compressImage as any], // any ile tip hatasını bypass et
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alternatif Metin (Alt Text)',
      admin: {
        description:
          'Görseli açıklayan kısa metin. SEO ve görme engelli kullanıcılar için önerilir (Örn: "Coca-Cola 1L kola şişesi"). Boş bırakılabilir.',
      },
    },
  ],
}
