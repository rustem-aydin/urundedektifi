import { NextResponse, type NextRequest } from 'next/server'

import { decideApiRequest } from '@/lib/apiGuard'

/**
 * Genel API kapısı (ADR: bot/scraper azaltma, 2026-11-11).
 *
 * `/api/*` isteklerinin yanı sıra `/urunler/akis` sayfalama ucunu da denetler;
 * HTML sayfaları ve `/_next/image` bu kapıdan geçmez. Kurallar
 * `src/lib/apiGuard.ts` içinde saf fonksiyon olarak durur.
 *
 * GraphQL ve şifre sıfırlama gövdesi yalnız bu iki uç için (klonlanarak) okunur:
 * `limit` üst sınırı ve e-posta bazlı bütçe gövdeye bağlıdır. Diğer isteklerin
 * gövdesine dokunulmaz, akış downstream'e olduğu gibi kalır.
 */
const INSPECT_BODY_MAX_BYTES = 256 * 1024

function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]
    if (first && first.trim()) return first.trim()
  }

  return headers.get('x-real-ip')?.trim() || 'unknown'
}

function inspectableBody(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '')
  return path === '/api/graphql' || path === '/api/users/forgot-password'
}

function declaredBodyTooLarge(request: NextRequest): boolean {
  const header = request.headers.get('content-length')
  if (!header) return false
  const length = Number(header)
  return Number.isFinite(length) && length > INSPECT_BODY_MAX_BYTES
}

export default async function proxy(request: NextRequest) {
  const method = request.method
  let body: string | null = null
  let bodyTooLarge = false

  if (method !== 'GET' && method !== 'HEAD' && inspectableBody(request.nextUrl.pathname)) {
    if (declaredBodyTooLarge(request)) {
      bodyTooLarge = true
    } else {
      try {
        body = await request.clone().text()
      } catch {
        // Gövde okunamazsa bütçe yine uygulanır; içerik denetimi atlanır.
        body = null
      }
    }
  }

  const decision = decideApiRequest({
    method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    ip: clientIp(request.headers),
    body,
    bodyTooLarge,
  })

  if (decision.allowed) return NextResponse.next()

  const headers = new Headers({ 'cache-control': 'no-store' })
  if (decision.retryAfterSeconds) {
    headers.set('retry-after', String(decision.retryAfterSeconds))
  }

  return NextResponse.json({ message: decision.message }, { status: decision.status, headers })
}

export const config = {
  matcher: ['/api/:path*', '/urunler/akis'],
}
