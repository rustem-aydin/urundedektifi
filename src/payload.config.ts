import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'
import { tr } from '@payloadcms/translations/languages/tr'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Topics } from './collections/Topics'
import { Brands } from './collections/Brands'
import { Products } from './collections/Products'
import { Pages } from './collections/Pages'
import { Experts } from './collections/Experts'
import { ExpertRules } from './collections/ExpertRules'
import { RatingScales } from './collections/RatingScales'
import { Ingredients } from './collections/Ingredients'
import { Additives } from './collections/Additives'
import { Countries } from './collections/Countries'
import { migrations } from './migrations'
import { Nutrients } from './collections/Nutrients'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — Ürün Dedektifi',
    },
  },
  collections: [
    Users,
    Media,
    Categories,
    Topics,
    Brands,
    Nutrients,
    Products,
    Pages,
    Experts,
    ExpertRules,
    RatingScales,
    Ingredients,
    Additives,
    Countries,
  ],
  editor: lexicalEditor(),
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
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.S3_BUCKET!,
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
  ],
  graphQL: {
    disable: false,
  },
})
