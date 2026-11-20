import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { GOOGLE_ISSUERS, issueUserToken, verifyGoogleIdToken } from '@/lib/googleAuth'

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

describe('issueUserToken', () => {
  it('Payload’ın çözebileceği HS256 oturum jetonu üretir', async () => {
    const secret = 'test-payload-secret'
    const { token, exp } = await issueUserToken({
      id: '42',
      email: 'user@example.com',
      secret,
      tokenExpiration: 604800,
    })

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    expect(payload).toMatchObject({ id: '42', collection: 'users', email: 'user@example.com' })
    expect(exp - Number(payload.iat)).toBe(604800)
  })
})
