import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { getFieldsToSign, jwtSign, type Payload, type PayloadRequest } from 'payload'
import { addSessionToUser } from 'payload/shared'

import type { User } from '@/payload-types'

/**
 * Google ile giriş (web + mobil).
 *
 * İki istemci de Google'dan bir **ID token** (JWT) alır ve `/api/users/google` ucuna yollar.
 * Uç, jetonu Google'ın JWKS anahtarlarıyla doğrular; e-posta Google tarafından doğrulanmışsa
 * Payload kullanıcısını bulur/açar ve Payload'ın kendi `login` akışıyla aynı biçimde
 * (oturum kaydı + `sid`) imzalanmış oturum jetonunu döndürür. Böylece istemci başına ayrı
 * OAuth yönlendirme akışı ve istemci sırrı gerekmez.
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
 * Payload'ın kendi `login` operasyonuyla aynı sırayı izleyen oturum jetonu üretimi.
 *
 * Jetonun `sid` taşıması zorunlu: Payload 3.87'de `auth.useSessions` varsayılanı `true` ve
 * `JWTAuthentication` her istekte `sid`'i kullanıcının `sessions` dizisinde arar. Elle
 * imzalanan (`sid`'siz) jeton doğrulanır ama `req.user` her zaman `null` kalır.
 *
 * Oturum dizisi yalnız DB'den gelen ham belgede tamdır; API katmanından geçen belgeyle
 * yazmak eski oturumları silebilir. Bu yüzden tıpkı `login` gibi `db.findOne` kullanılır.
 */
export async function issueSessionToken(args: {
  payload: Payload
  req: PayloadRequest
  user: User
}): Promise<{ token: string; exp: number }> {
  const { payload, req, user } = args
  const collectionConfig = payload.collections.users.config

  const stored = await payload.db.findOne<User>({
    collection: 'users',
    req,
    where: { id: { equals: user.id } },
  })
  if (!stored) throw new Error('Oturum açılacak kullanıcı bulunamadı')

  const { sid } = await addSessionToUser({ collectionConfig, payload, req, user: stored })
  const fieldsToSign = getFieldsToSign({
    collectionConfig,
    email: String(stored.email),
    sid,
    user: stored,
  })

  return jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  })
}
