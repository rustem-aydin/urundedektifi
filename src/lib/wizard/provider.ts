import { API_BASE } from './api'

/**
 * Yapay zekâ sağlayıcısı durumu (ADR 0008/0021).
 *
 * Sağlayıcı adresi, model ve API anahtarı tek merkezde — Payload panelindeki `ai-settings`
 * global'i — tutulur. Tarayıcıda anahtar saklanmaz; istemci yalnız "hazır mı, hangi model"
 * bilgisini sunucudan okur ve analiz isteğini sunucu vekiline gönderir.
 */

export type ProviderStatus = {
  configured: boolean
  baseUrl: string | null
  model: string | null
}

const UNSET: ProviderStatus = { configured: false, baseUrl: null, model: null }

/** Durum ucu anahtar döndürmez. Oturum yoksa/rol yetmiyorsa hazır sayılmaz. */
export async function fetchProviderStatus(token: string | null): Promise<ProviderStatus> {
  if (!token) return UNSET
  const response = await fetch(`${API_BASE}/globals/ai-settings/status`, {
    headers: { Accept: 'application/json', Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return UNSET
  const body = (await response.json()) as Partial<ProviderStatus>
  return {
    configured: body.configured === true,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : null,
    model: typeof body.model === 'string' ? body.model : null,
  }
}
