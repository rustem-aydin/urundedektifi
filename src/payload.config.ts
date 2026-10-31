import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { tr } from '@payloadcms/translations/languages/tr'

import { mcpProductsPluginOptions } from './lib/mcpOptions'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Topics } from './collections/Topics'
import { Brands } from './collections/Brands'
import { Products } from './collections/Products'
import { ProductFeedback } from './collections/ProductFeedback'
import { ProductContributions } from './collections/ProductContributions'
import { Pages } from './collections/Pages'
import { Experts } from './collections/Experts'
import { ExpertRules } from './collections/ExpertRules'
import { Posts } from './collections/Posts'
import { RatingScales } from './collections/RatingScales'
import { Ingredients } from './collections/Ingredients'
import { Additives } from './collections/Additives'
import { Countries } from './collections/Countries'
import { migrations } from './migrations'
import { Nutrients } from './collections/Nutrients'
import { Allergens } from './collections/Allergens'
import { AiSettings } from './globals/AiSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // S3 istemci yükleme işleyicisi yalnızca S3_BUCKET tanımlıyken eklentiye
    // kaydolur, import map ise derleme sırasında .env'deki değere göre üretilir.
    // Üretimde S3 açıkken haritada bu bileşen bulunamazsa Payload yönetici
    // paneli boş açılıyor; bu yüzden bağımlılığı koşulsuz bildiriyoruz.
    dependencies: {
      s3ClientUploadHandler: {
        type: 'function',
        path: '@payloadcms/storage-s3/client#S3ClientUploadHandler',
      },
    },
    meta: {
      titleSuffix: ' — Şeffaf Ürün',
    },
  },
  // Yerelde mobil uygulamanın web hedefi (Expo web) API'ye başka porttan erişir.
  // Üretimde istemciler ya aynı kaynakta (web) ya da yerel (mobil) çalışır; CORS kapalı kalır.
  cors: process.env.NODE_ENV !== 'production' ? '*' : [],
  collections: [
    Users,
    Media,
    Categories,
    Topics,
    Brands,
    Nutrients,
    Products,
    ProductFeedback,
    ProductContributions,
    Allergens,
    Pages,
    Experts,
    ExpertRules,
    Posts,
    RatingScales,
    Ingredients,
    Additives,
    Countries,
  ],
  editor: lexicalEditor(),
  globals: [AiSettings],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    prodMigrations: migrations,
    push: process.env.NODE_ENV !== 'production',
  }),
  i18n: {
    supportedLanguages: { tr }, // default
  },
  sharp,
  plugins: [
    // Yerel geliştirmede S3 anahtarları boşsa medya diske yazılır (media/ dizini).
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: {
              media: true,
            },
            bucket: process.env.S3_BUCKET,
            config: {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY!,
                secretAccessKey: process.env.S3_SECRET_KEY!,
              },
              region: process.env.S3_REGION,
              endpoint: process.env.S3_ENDPOINT,
              forcePathStyle: true,
            },
          }),
        ]
      : []),
    mcpPlugin(mcpProductsPluginOptions),
  ],
  graphQL: {
    disable: false,
  },
})
