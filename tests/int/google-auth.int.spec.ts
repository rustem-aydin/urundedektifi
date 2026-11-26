import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { issueSessionToken } from '@/lib/googleAuth'

/**
 * Google girişinin ürettiği jetonun gerçek Payload kimlik doğrulamasından geçmesi.
 *
 * Regresyon: `sid`siz elle imzalanan jeton `payload.auth` içinde reddediliyordu
 * (`req.user === null`), bu yüzden kimlikli uçlar 401 dönüyordu.
 */

let payload: Payload
let userId: number | string | undefined

describe('Google oturum jetonu (sid)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    if (userId !== undefined) {
      await payload
        .delete({ collection: 'users', id: userId as never, overrideAccess: true })
        .catch(() => undefined)
    }
  })

  it('üretilen jeton payload.auth ile aynı kullanıcıya çözülür', async () => {
    const email = `sid-test-${Date.now()}@example.com`
    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'sid test',
        email,
        password: 'test-password-123',
        role: 'user',
      } as never,
      overrideAccess: true,
    })
    userId = user.id

    const { token } = await issueSessionToken({
      payload,
      req: { payload, headers: new Headers(), context: {} } as unknown as PayloadRequest,
      user,
    })

    const { user: authed } = await payload.auth({
      headers: new Headers({ authorization: `JWT ${token}` }),
    })

    // `TypedUser` iki kimlik doğrulamalı koleksiyonun birleşimi (`users` + MCP API anahtarı);
    // jeton `users` koleksiyonuna çözülmeli.
    if (!authed || !('email' in authed)) {
      throw new Error('Google jetonu users koleksiyonundaki kullanıcıya çözülmedi')
    }

    expect(authed.id).toBe(user.id)
    expect(authed.email).toBe(email)
  })
})
