import { NextResponse, type NextRequest } from 'next/server'

import { decideApiRead } from '@/lib/apiGuard'

/**
 * Genel API okuma kapısı (ADR: bot/scraper azaltma, 2026-11-11).
 *
 * Yalnız `/api/*` isteklerinde çalışır; HTML sayfaları, `/_next/image` ve
 * `urunler/akis` gibi uygulama rotaları bu kapıdan geçmez. Kurallar
 * `src/lib/apiGuard.ts` içinde saf fonksiyon olarak durur.
 */
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

export default function proxy(request: NextRequest) {
  const decision = decideApiRead({
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    ip: clientIp(request.headers),
  })

  if (decision.allowed) return NextResponse.next()

  const headers = new Headers({ 'cache-control': 'no-store' })
  if (decision.retryAfterSeconds) {
    headers.set('retry-after', String(decision.retryAfterSeconds))
  }

  return NextResponse.json({ message: decision.message }, { status: decision.status, headers })
}

export const config = {
  matcher: ['/api/:path*'],
}
