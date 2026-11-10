import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Bilinmeyen adresler `(frontend)` grubuna düşsün diye yakalayıcı.
 *
 * Böylece 404, Next'in düzensiz varsayılan sayfası yerine site kabuğu (üst menü,
 * alt bilgi, 404 içeriği) ve gerçek 404 durum kodu ile döner. Daha özel rotalar
 * (`/urunler/akis`, `/api/*`, `/admin`) bu yakalayıcıdan önce eşleşir.
 */
export default function CatchAllNotFound() {
  notFound()
}
