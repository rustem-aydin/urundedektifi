'use server'
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

/**
 * Tarama sorgusu: yalnız YAYINDAKİ ürünü döndürür. Yerel API varsayılan olarak erişimi
 * atlar; taslak/arşiv kayıt "bulunamadı" sayılmalı ki katkı akışı doğru açılsın (ADR 0024).
 */
export const getProduct = async (barcode: number) => {
  const data = await payload.find({
    collection: 'products',
    where: {
      and: [{ barcode: { equals: barcode } }, { status: { equals: 'published' } }],
    },
    limit: 1,
  })
  return data
}
