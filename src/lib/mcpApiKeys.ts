import type { CollectionBeforeChangeHook, CollectionConfig, Field } from 'payload'

import type { User } from '@/payload-types'

/**
 * MCP API anahtarı güvenliği (K1).
 *
 * Neden: `@payloadcms/plugin-mcp` kendi `payload-mcp-api-keys` koleksiyonunu
 * `access` tanımlamadan ekler; Payload varsayılanı "oturum açmış herkes".
 * `users` koleksiyonunda kayıt açık olduğu için kayıt olan herkes kendine
 * anahtar üretip `/api/mcp` üzerinden tüm CMS'i okuyup yazabiliyordu.
 *
 * Bu sarmalayıcı koleksiyonu `overrideApiKeyCollection` ile sıkılaştırır:
 * - tüm CRUD yalnız `role === 'admin'`
 * - anahtar sahibi (`user`) her zaman anahtarı üreten oturumdur; gövdeden gelen
 *   değer yok sayılır (admin de başka kullanıcı adına anahtar üretemez)
 * - sahip alanı güncellemede değiştirilemez
 * - `apiKey` alanı hiçbir okumada dönmez; anahtar yalnız panelde üretildiği anda
 *   bir kez görünür (istemci anahtarı `uuidv4` ile üretir, kayıttan sonra okunamaz)
 */

type FieldWithName = Field & { name?: string; access?: Record<string, unknown> }

const isAdmin = (user: unknown): boolean => (user as User | null)?.role === 'admin'

const forceOwner: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const owner = req.user?.id
  // Yerel API çağrılarında (seed, test, betik) oturum yoktur; sahip çağıranın verdiği değerdir.
  if (owner === undefined) return data
  return { ...data, user: owner }
}

export function hardenMcpApiKeysCollection(collection: CollectionConfig): CollectionConfig {
  return {
    ...collection,
    access: {
      create: ({ req: { user } }) => isAdmin(user),
      read: ({ req: { user } }) => isAdmin(user),
      update: ({ req: { user } }) => isAdmin(user),
      delete: ({ req: { user } }) => isAdmin(user),
    },
    fields: [
      ...collection.fields.map((field): Field => {
        const named = field as FieldWithName
        if (named.name === 'user') {
          return { ...named, access: { ...named.access, update: () => false } } as Field
        }
        return field
      }),
      // `apiKey`/`apiKeyIndex` auth alanları eklenti koleksiyonunda tanımlı değildir;
      // Payload bunları auth sanitize sırasında ekler. Aynı adla alan tanımlamak
      // `mergeBaseFields` ile temel alanı ezer, böylece okuma kapısı uygulanır.
      {
        name: 'apiKey',
        type: 'text',
        access: { read: () => false },
      },
    ],
    hooks: {
      ...collection.hooks,
      beforeChange: [...(collection.hooks?.beforeChange ?? []), forceOwner],
    },
  }
}
