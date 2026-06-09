import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

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
