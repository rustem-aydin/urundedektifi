import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import fs from 'fs'

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
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        // 1. data yoksa veya create işlemi değilse direkt geç
        if (!data || operation !== 'create') return data

        const rawFile = req.files?.file
        const fileObj = Array.isArray(rawFile) ? rawFile[0] : rawFile

        // 2. Dosya yoksa veya görsel değilse geç
        if (!fileObj || !fileObj.mimetype?.startsWith('image/')) {
          return data
        }

        let buffer: Buffer

        // 3. Dosyayı bellekten veya geçici dosyadan oku
        if (fileObj.data && fileObj.data.length > 0) {
          buffer = Buffer.isBuffer(fileObj.data) ? fileObj.data : Buffer.from(fileObj.data)
        } else if (fileObj.tempFilePath) {
          buffer = fs.readFileSync(fileObj.tempFilePath)
        } else {
          return data
        }

        const originalSize = buffer.length

        // Zaten küçükse işlem yapma
        if (originalSize < 500 * 1024) return data

        try {
          // 4. Boyuta göre kalite ayarla
          let quality = 80
          if (originalSize > 5 * 1024 * 1024) quality = 30
          else if (originalSize > 3 * 1024 * 1024) quality = 40
          else if (originalSize > 2 * 1024 * 1024) quality = 50
          else if (originalSize > 1 * 1024 * 1024) quality = 60
          else if (originalSize > 500 * 1024) quality = 70

          // 5. Sıkıştır
          const compressedBuffer = await sharp(buffer)
            .rotate()
            .jpeg({ quality, mozjpeg: true })
            .toBuffer()

          // 6. Sadece küçüldüyse işle
          if (compressedBuffer.length < originalSize) {
            // Bellekteki veriyi güncelle
            fileObj.data = compressedBuffer
            fileObj.size = compressedBuffer.length
            fileObj.mimetype = 'image/jpeg'

            // Eğer dosya diske yazılmışsa (Docker vs.), S3'ün okuyacağı yere tekrar yaz
            if (fileObj.tempFilePath) {
              fs.writeFileSync(fileObj.tempFilePath, compressedBuffer)
            }

            // Payload'ın veritabanına kaydedeceği veriyi güncelle
            if (data.file) {
              data.file.data = compressedBuffer.toString('base64')
              data.file.size = compressedBuffer.length
              data.file.mimeType = 'image/jpeg'
            }

            console.log(
              `✅ Sıkıştırıldı: ${(originalSize / 1024).toFixed(0)}MB -> ${(compressedBuffer.length / 1024).toFixed(0)}KB`,
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
