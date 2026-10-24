import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import { z as zod3 } from 'zod3'

import { getProductCase } from './productCase'

type ZodRawShape = NonNullable<
  NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]['parameters']
>

// Root zod is v4 but the plugin's ZodRawShape expects its own zod v3 — alias `zod3` resolves to zod@3.25.76 via package.json
const z = zod3

export const mcpProductsPluginOptions: MCPPluginConfig = {
  collections: {
    products: {
      enabled: true,
      description:
        'Sistemdeki ürün kayıtları. Barkod, isim, marka, kategori ve yayın durumuna göre aranabilir.',
    },
    categories: {
      enabled: true,
      description: 'Ürün kategorileri (hiyerarşik). Ürünlerin "category" alanı bu koleksiyona bağlanır.',
    },
    topics: {
      enabled: true,
      description: 'Uzman değerlendirme konuları (ör. Helal, Vegan, Sağlık).',
    },
    brands: {
      enabled: true,
      description: 'Markalar. Ürünlerin "brand" alanı bu koleksiyona bağlanır.',
    },
    nutrients: {
      enabled: true,
      description: 'Besin değeri master listesi (enerji, yağ, şeker, protein, tuz...).',
    },
    allergens: {
      enabled: true,
      description: 'Alerjen master listesi (gluten, süt, yumurta...).',
    },
    ingredients: {
      enabled: true,
      description: 'İçindekiler master listesi; kural motoru bu adlar ve alternatif adlar üzerinden eşleşir.',
    },
    additives: {
      enabled: true,
      description: 'Katkı maddeleri master listesi (E kodları, fonksiyon, risk, helal/vegan durumu).',
    },
    countries: {
      enabled: true,
      description: 'Üretim/ menşe ülkeleri ve GS1 barkod önekleri.',
    },
    'rating-scales': {
      enabled: true,
      description: 'Uzman bazlı derecelendirme ölçekleri (kuralların "rating" alanı).',
    },
    experts: {
      enabled: true,
      description: 'Değerlendirme uzmanları.',
    },
    'expert-rules': {
      enabled: true,
      description: 'Uzman kuralları; ürün hükümlerini besleyen kural seti.',
    },
    pages: {
      enabled: true,
      description: 'Statik içerik sayfaları (hakkımızda, gizlilik, kullanım koşulları...).',
    },
  },
  mcp: {
    handlerOptions: {
      verboseLogs: process.env.NODE_ENV === 'development',
    },
    tools: [
      {
        name: 'getProductCaseByBarcode',
        description:
          'Barkoda ait tam Ürün Dosyasını (çözümlenmiş ürün + hükümler + galeri + fiyat özeti) tek çağrıda döndürür.',
        parameters: z
          .object({
            barcode: z.string().describe('GS1/EAN-13, UPC veya EAN-8 barkod'),
          })
          .shape,
        handler: async (args, req) => {
          const barcode = String(args.barcode ?? '')
          const productCase = await getProductCase(req.payload, barcode)
          return {
            content: [
              {
                type: 'text',
                text: productCase
                  ? JSON.stringify(productCase)
                  : JSON.stringify({ error: 'Ürün bulunamadı' }),
              },
            ],
          }
        },
      },
    ],
  },
}
