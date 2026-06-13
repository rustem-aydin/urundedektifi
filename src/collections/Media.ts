import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
    description: 'Yüklenen tüm görseller ve belgeler.',
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
  },
  // FTP örneğindeki gibi doğrudan koleksiyon seviyesinde hooks kullanıyoruz
  hooks: {
    // S3 ile çalışırken beforeValidate ZORUNLUDUR.
    // Çünkü S3 eklentisi dosyayı beforeChange'den önce S3'e yollar.
    beforeValidate: [
      async ({ data, operation }) => {
        // Sadece dosya yükleme (create) anında çalışsın
        if (operation !== 'create') return data

        const file = data?.file

        // Dosya yoksa veya görsel değilse hiçbir şey yapma
        if (!file?.data || !file.mimeType?.startsWith('image/')) {
          return data
        }

        try {
          const buffer = Buffer.from(file.data, 'base64')
          const originalSize = buffer.length

          // Boyuta göre kalite ayarla
          let quality = 80
          if (originalSize > 5 * 1024 * 1024) quality = 30
          else if (originalSize > 3 * 1024 * 1024) quality = 40
          else if (originalSize > 2 * 1024 * 1024) quality = 50
          else if (originalSize > 1 * 1024 * 1024) quality = 60
          else if (originalSize > 500 * 1024) quality = 70

          // Sharp ile sıkıştır
          const compressedBuffer = await sharp(buffer)
            .rotate() // EXIF rotasyonunu koru
            .jpeg({ quality, mozjpeg: true })
            .toBuffer()

          // Sadece küçüldüyse data içindeki dosyayı değiştir
          if (compressedBuffer.length < originalSize) {
            file.data = compressedBuffer.toString('base64')
            file.size = compressedBuffer.length
            file.mimeType = 'image/jpeg'

            console.log(
              `✅ Sıkıştırıldı: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedBuffer.length / 1024).toFixed(0)}KB`,
            )
          }
        } catch (error) {
          console.error('Sıkıştırma hatası:', error)
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alternatif Metin (Alt Text)',
      admin: {
        description: 'Görseli açıklayan kısa metin.',
      },
    },
  ],
}
