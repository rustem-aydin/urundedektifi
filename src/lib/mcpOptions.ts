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
