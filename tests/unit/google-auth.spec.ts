import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'

import type { User } from '@/payload-types'
import { GOOGLE_ISSUERS, issueSessionToken, verifyGoogleIdToken } from '@/lib/googleAuth'

/**
 * Google ID token doğrulaması: seyirci (aud), veren (iss), imza ve e-posta doğrulaması.
 * Anahtar çifti test içinde üretilir; Google'a ağ isteği yapılmaz.
 */

const WEB_CLIENT_ID = 'web-client.example'
const ANDROID_CLIENT_ID = 'android-client.example'

let keySet: JWTVerifyGetKey
let privateKey: CryptoKey

async function googleToken(claims: Record<string, unknown>, audience = WEB_CLIENT_ID) {
  return new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(GOOGLE_ISSUERS[0])
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  keySet = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'RS256', kid: 'test-key', use: 'sig' }],
  })
})

describe('verifyGoogleIdToken', () => {
  it('doğrulanmış Google profilini normalize eder', async () => {
    const token = await googleToken({
      sub: 'google-123',
      email: '  User@Example.COM ',
      name: 'Ayşe Yılmaz',
    })

    await expect(verifyGoogleIdToken(token, [WEB_CLIENT_ID], keySet)).resolves.toEqual({
      sub: 'google-123',
      email: 'user@example.com',
      name: 'Ayşe Yılmaz',
    })
  })

  it('Android istemci ID’sini de seyirci olarak kabul eder', async () => {
    const token = await googleToken(
      { sub: 'google-android', email: 'android@example.com', name: 'Android' },
      ANDROID_CLIENT_ID,
    )

    await expect(
      verifyGoogleIdToken(token, [WEB_CLIENT_ID, ANDROID_CLIENT_ID], keySet),
    ).resolves.toMatchObject({ sub: 'google-android' })
  })

  it('farklı seyirci için jetonu reddeder', async () => {
    const token = await googleToken(
      { sub: 'google-other', email: 'other@example.com', name: 'Other' },
      'another-client.example',
    )

    await expect(verifyGoogleIdToken(token, [WEB_CLIENT_ID], keySet)).rejects.toThrow()
  })

  it('e-postası doğrulanmamış jetonu reddeder', async () => {
    const token = await googleToken({
      sub: 'google-unverified',
      email: 'unverified@example.com',
      name: 'Unverified',
      email_verified: false,
    })

    await expect(verifyGoogleIdToken(token, [WEB_CLIENT_ID], keySet)).resolves.toBeNull()
  })

  it('farklı veren (iss) için jetonu reddeder', async () => {
    const token = await new SignJWT({
      sub: 'google-evil',
      email: 'evil@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://evil.example')
      .setAudience(WEB_CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)

    await expect(verifyGoogleIdToken(token, [WEB_CLIENT_ID], keySet)).rejects.toThrow()
  })

  it('seyirci listesi boşsa doğrulamaz', async () => {
    const token = await googleToken({ sub: 'google-empty', email: 'empty@example.com' })
    await expect(verifyGoogleIdToken(token, [], keySet)).resolves.toBeNull()
  })
})

describe('issueSessionToken', () => {
  it('sid taşıyan, Payload’ın doğrulayacağı HS256 oturum jetonu üretir', async () => {
    const secret = 'test-payload-secret'
    const user = { id: 42, email: 'user@example.com' } as User
    // Ham DB belgesi: oturum dizisi burada tam olur (temiz kullanıcıda boş).
    const stored = { ...user, sessions: [] } as unknown as User
    const writes: Array<Record<string, unknown>> = []

    const payload = {
      collections: {
        users: {
          config: {
            slug: 'users',
            auth: { useSessions: true, tokenExpiration: 604800 },
            fields: [],
          },
        },
      },
      db: {
        findOne: async () => stored,
        updateOne: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data)
        },
      },
      secret,
    } as unknown as Payload

    const { token, exp } = await issueSessionToken({
      payload,
      req: {} as PayloadRequest,
      user,
    })

    const { payload: claims } = await jwtVerify(token, new TextEncoder().encode(secret))
    expect(claims).toMatchObject({ id: 42, collection: 'users', email: 'user@example.com' })
    expect(typeof claims.sid).toBe('string')
    expect(claims.sid).toBeTruthy()
    // `exp` (saniye) ile `iat` arasındaki fark tokenExpiration olmalı.
    expect(exp - Number(claims.iat)).toBe(604800)

    // `sid` yalnız jetonda kalmamalı; kullanıcının oturum dizisine de yazılmalı.
    const sessions = writes[0]?.sessions as Array<{ id: string }>
    expect(sessions).toEqual([expect.objectContaining({ id: claims.sid })])
  })
})
