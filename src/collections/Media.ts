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
    beforeOperation: [
      async ({ args, operation }) => {
        // 1. Sadece create veya update işlemlerinde çalış
        if (operation !== 'create' && operation !== 'update') {
          return args
        }

        // 2. Payload 3.x'te dosya req.file üzerinden erişilir
        const file = args.req?.file

        // 3. Dosya yoksa veya görsel değilse geç
        if (!file || !file.mimetype?.startsWith('image/')) {
          return args
        }

        let buffer: Buffer

        // 4. Dosyayı bellekten veya geçici dosyadan oku
        if (file.data && file.data.length > 0) {
          buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
        } else if (file.tempFilePath) {
          buffer = fs.readFileSync(file.tempFilePath)
        } else {
          return args
        }

        const originalSize = buffer.length

        // 5. Zaten küçükse işlem yapma
        if (originalSize < 500 * 1024) return args

        try {
          // 6. Boyuta göre kalite ayarla
          let quality = 80
          if (originalSize > 5 * 1024 * 1024) quality = 30
          else if (originalSize > 3 * 1024 * 1024) quality = 40
          else if (originalSize > 2 * 1024 * 1024) quality = 50
          else if (originalSize > 1 * 1024 * 1024) quality = 60
          else if (originalSize > 500 * 1024) quality = 70

          // 7. Sıkıştır
          const compressedBuffer = await sharp(buffer)
            .rotate()
            .jpeg({ quality, mozjpeg: true })
            .toBuffer()

          // 8. Sadece küçüldüyse işle
          if (compressedBuffer.length < originalSize) {
            // req.file üzerindeki veriyi güncelle
            file.data = compressedBuffer
            file.size = compressedBuffer.length
            file.mimetype = 'image/jpeg'

            // Eğer dosya diske yazılmışsa (tempFilePath varsa), tekrar yaz
            if (file.tempFilePath) {
              fs.writeFileSync(file.tempFilePath, compressedBuffer)
            }

            // Dosya adını güncelle (uzantıyı .jpg yap)
            const originalName = file.name || 'image'
            const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '')
            file.name = `${nameWithoutExt}.jpg`

            console.log(
              `✅ Sıkıştırıldı: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedBuffer.length / 1024).toFixed(0)}KB`,
            )
          }
        } catch (error) {
          console.error('Sıkıştırma hatası:', error)
        }

        return args
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
