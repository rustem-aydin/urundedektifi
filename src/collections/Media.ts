import type { Access, CollectionConfig } from 'payload'
import { APIError } from 'payload'
import type { User } from '@/payload-types'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import fs from 'fs'
import { checkMediaUpload, MEDIA_ALLOWED_MIME_TYPES } from '@/lib/mediaUpload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Medya kaydını değiştirmek/silmek panel editörlerine aittir. Payload'un
 * varsayılanı `Boolean(user)` idi: kayıtlı herhangi bir tüketici hesabı mevcut
 * ürün görsellerini güncelleyebiliyor veya silebiliyordu.
 */
const canManageMedia: Access = ({ req: { user } }) => {
  const role = (user as null | User)?.role
  return role === 'admin' || role === 'editor'
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Medya',
    plural: 'Medyalar',
  },
  access: {
    // Ürün görselleri herkese açık kalır (`next/image` ve mobil istemci doğrudan okur).
    read: () => true,
    // Katkı akışı ve profil avatarı oturum açmış kullanıcıdan yükler (POST /api/media).
    create: ({ req: { user } }) => Boolean(user),
    update: canManageMedia,
    delete: canManageMedia,
  },
  admin: {
    group: 'Sistem',
    description: 'Yüklenen tüm görseller ve belgeler.',
  },
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    // `image/*` joker karakteri `image/svg+xml` dosyalarını da kabul ediyordu; medya
    // aynı kaynaktan servis edildiği için zararlı SVG doğrudan açıldığında betik
    // çalıştırabiliyordu. Liste yalnız raster görseller + PDF içerir.
    mimeTypes: [...MEDIA_ALLOWED_MIME_TYPES],
    // NOT: Payload 3.87 `upload.limits.fileSize` seçeneğini desteklemiyor (tip ve
    // çalışma zamanı yok). 8 MB sınırı aşağıdaki `beforeOperation` kancasında,
    // dosya diske/S3'e yazılmadan önce uygulanır (bkz. src/lib/mediaUpload.ts).
    // Türev (thumbnail/small/medium/large) üretilmez: her yükleme tek dosya olarak
    // saklanır, ölçeklendirme Next.js tarafında (next/image) yapılır. Uygulama bu
    // türevleri hiç kullanmıyordu; bucket'ta nesne sayısını 1/2,7'ye indirir.
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

        if (!file) return args

        // 3. Boyut/tür kapısı sıkıştırmadan önce: 9 MB'lık bir dosya küçültülüp
        //    kabul edilmemeli. `file.size` multipart tarafından doldurulur; yerel
        //    API çağrılarında tampon uzunluğu yedektir.
        const size = file.size > 0 ? file.size : (file.data?.length ?? 0)
        const rejection = checkMediaUpload({ name: file.name, mimetype: file.mimetype, size })
        if (rejection) throw new APIError(rejection.message, 400)

        // 4. Dosya görsel değilse geç (PDF vb.)
        if (!file.mimetype?.startsWith('image/')) {
          return args
        }

        let buffer: Buffer

        // 5. Dosyayı bellekten veya geçici dosyadan oku
        if (file.data && file.data.length > 0) {
          buffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
        } else if (file.tempFilePath) {
          buffer = fs.readFileSync(file.tempFilePath)
        } else {
          return args
        }

        const originalSize = buffer.length

        // 6. Zaten küçükse işlem yapma
        if (originalSize < 500 * 1024) return args

        try {
          // 7. Boyuta göre kalite ayarla
          let quality = 80
          if (originalSize > 5 * 1024 * 1024) quality = 30
          else if (originalSize > 3 * 1024 * 1024) quality = 40
          else if (originalSize > 2 * 1024 * 1024) quality = 50
          else if (originalSize > 1 * 1024 * 1024) quality = 60
          else if (originalSize > 500 * 1024) quality = 70

          // 8. Sıkıştır
          const compressedBuffer = await sharp(buffer)
            .rotate()
            .jpeg({ quality, mozjpeg: true })
            .toBuffer()

          // 9. Sadece küçüldüyse işle
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
