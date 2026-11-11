'use server'
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

/**
 * Elle giriş sorgusu: barkodun YAYINDA bir ürünü var mı?
 *
 * Yalnız formdaki elle giriş (`BarcodeLookupForm`) kullanır; kamerayla tarama bu
 * sorguyu yapmaz, doğrudan `/urun/<barkod>` rotasına gider (rota eksik dosyayı katkı
 * formuyla açar) — tarama yolunda fazladan sunucu turu olmasın diye.
 *
 * Yerel API varsayılan olarak erişimi atlar; taslak/arşiv kayıt "bulunamadı" sayılmalı ki
 * katkı akışı doğru açılsın (ADR 0024). İstemci yalnız var/yok bilgisini kullanır: eskiden
 * tüm ürün belgesi (depth 2, bir-çok tablolar dahil) tarayıcıya taşınıyordu.
 */
export const getProduct = async (barcode: number) => {
  const data = await payload.find({
    collection: 'products',
    where: {
      and: [{ barcode: { equals: barcode } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    pagination: false,
    select: { barcode: true },
  })
  return data.docs.length > 0
}
