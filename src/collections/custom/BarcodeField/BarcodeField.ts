import type { Field } from 'payload'

type BarcodeFieldOptions = {
  /** Field name — veritabanında saklanacak kolon adı */
  name: string
  /** Alan etiketi */
  label?: string
  /** Açıklama metni */
  description?: string
  /** Zorunlu mu? */
  required?: boolean
  /** Sadece okunabilir mi? */
  readOnly?: boolean
  /** Admin paneli ek ayarları */
  admin?: Record<string, unknown>
}

/**
 * barcodeField()
 * Payload CMS 3.x için özel barkod sorgulama field factory.
 *
 * Kullanım:
 *   import { barcodeField } from '@/fields/BarcodeField'
 *
 *   fields: [
 *     barcodeField({ name: 'barcode', label: 'Barkod' }),
 *   ]
 */
export const barcodeField = ({
  name,
  label,
  description,
  required = false,
  readOnly = false,
  admin = {},
}: BarcodeFieldOptions): Field => ({
  name,
  type: 'text',
  label,
  required,
  unique: true,
  index: true,
  validate: (val: unknown) => {
    if (!val) return required ? 'Bu alan zorunludur.' : true
    if (typeof val !== 'string') return 'Geçersiz değer.'
    // Basit bir barkod uzunluk kontrolü (EAN-8, EAN-13, UPC-A vb.)
    if (!/^\d{8,14}$/.test(val.replace(/-/g, ''))) {
      return 'Geçerli bir barkod girin (Sadece rakamlar, 8-14 hane).'
    }
    return true
  },
  admin: {
    readOnly,
    description: description || 'Barkod okutulduğunda sistemde eşleşme arar.',
    // ✅ Payload 3.x — Object formatında custom field component
    components: {
      Field: {
        path: '@/collections/custom/BarcodeField/BarcodeFieldClient',
        exportName: 'BarcodeFieldClient',
      },
    },
    ...admin,
  },
})
