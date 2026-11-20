import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

/**
 * Google ile giriş (web + mobil).
 *
 * İki istemci de Google'dan bir **ID token** (JWT) alır ve `/api/users/google` ucuna yollar.
 * Uç, jetonu Google'ın JWKS anahtarlarıyla doğrular; e-posta Google tarafından doğrulanmışsa
 * Payload kullanıcısını bulur/açar ve Payload'ın kendi imzaladığı oturum jetonunu döndürür.
 * Böylece istemci başına ayrı OAuth yönlendirme akışı ve istemci sırrı gerekmez.
 */

export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

/** Web, Android ve iOS istemcilerinin ayrı client ID'leri olabilir; hepsi geçerli seyircidir. */
export function allowedGoogleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
}

export type GoogleProfile = {
  /** Google'ın kararlı kullanıcı kimliği (`sub`). */
  sub: string
  email: string
  name: string
}

/** Jeton imzası, seyirci, veren ve e-posta doğrulaması geçmezse `null`. */
export async function verifyGoogleIdToken(
  idToken: string,
  audiences: string[],
  keySet: JWTVerifyGetKey = GOOGLE_JWKS,
): Promise<GoogleProfile | null> {
  if (!idToken || audiences.length === 0) return null

  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: GOOGLE_ISSUERS,
    audience: audiences,
    clockTolerance: 60,
  })

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  // Google, doğrulanmamış e-posta ile ID token verebilir; hesap eşleştirmesi buna dayanamaz.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'
  const sub = typeof payload.sub === 'string' ? payload.sub : ''
  if (!sub || !email || !emailVerified) return null

  const claimName = typeof payload.name === 'string' ? payload.name.trim() : ''
  return {
    sub,
    email,
    name: claimName || email.split('@')[0],
  }
}

/**
 * Payload'ın kendi oturum jetonu (HS256). `JWTAuthentication` jetonu çözer, `id` ile kullanıcıyı
 * yeniden yükler; bu yüzden yük yalnız kimlik + koleksiyon + e-posta taşır.
 */
export async function issueUserToken(args: {
  id: number | string
  email: string
  secret: string
  tokenExpiration: number
}): Promise<{ token: string; exp: number }> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const exp = issuedAt + args.tokenExpiration
  const token = await new SignJWT({ id: args.id, collection: 'users', email: args.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(args.secret))
  return { token, exp }
}
