import { describe, expect, it } from 'vitest'

import {
  AKIS_LIMIT_PER_MINUTE,
  AKIS_MAX_PAGE,
  API_FORGOT_PASSWORD_LIMIT_PER_HOUR,
  API_GRAPHQL_LIMIT_PER_MINUTE,
  API_LOGIN_LIMIT_PER_MINUTE,
  API_MAX_PAGE,
  API_MAX_PAGE_SIZE,
  API_WRITE_LIMIT_PER_MINUTE,
  decideApiRequest,
  type ApiGuardInput,
  type ApiGuardDecision,
  type RateStore,
} from '@/lib/apiGuard'

const NOW = 1_760_000_000_000

function run(input: Partial<ApiGuardInput> = {}, store: RateStore = new Map()): ApiGuardDecision {
  return decideApiRequest(
    {
      method: 'GET',
      pathname: '/api/products',
      search: '',
      ip: '203.0.113.9',
      now: NOW,
      ...input,
    },
    store,
  )
}

function expectRejected(decision: ApiGuardDecision, status: 400 | 429): void {
  expect(decision.allowed).toBe(false)
  if (!decision.allowed) expect(decision.status).toBe(status)
}

describe('decideApiRequest — limit/page katı doğrulama', () => {
  it.each([
    'limit=abc',
    'limit=NaN',
    'limit=Infinity',
    'limit=-1',
    'limit=1.5',
    'limit=0',
    'limit=',
    'limit=%2050',
    `limit=${API_MAX_PAGE_SIZE + 1}`,
  ])('%s → 400', (search) => {
    expectRejected(run({ search: `?${search}` }), 400)
  })

  it.each(['page=abc', 'page=0', 'page=1.5', 'page=-2', `page=${API_MAX_PAGE + 1}`])(
    '%s → 400',
    (search) => {
      expectRejected(run({ search: `?${search}` }), 400)
    },
  )

  it('aynı parametrenin bozuk ikinci değeri doğrulamayı atlatamaz', () => {
    expectRejected(run({ search: '?limit=100&limit=0' }), 400)
    expectRejected(run({ search: '?page=1&page=abc' }), 400)
  })

  it('muaf okuma uçlarında da geçersiz limit 400 döner', () => {
    expectRejected(run({ pathname: '/api/users', search: '?limit=abc' }), 400)
  })

  it('sınır değerleri kabul edilir', () => {
    expect(run({ search: `?limit=${API_MAX_PAGE_SIZE}&page=${API_MAX_PAGE}` }).allowed).toBe(true)
  })
})

describe('decideApiRequest — GraphQL', () => {
  const validBody = JSON.stringify({ query: '{ products { docs { id } } }' })

  it('muaf değil: IP başına ayrı bütçe uygulanır', () => {
    const store: RateStore = new Map()
    for (let i = 0; i < API_GRAPHQL_LIMIT_PER_MINUTE; i += 1) {
      expect(run({ method: 'POST', pathname: '/api/graphql', body: validBody }, store).allowed).toBe(
        true,
      )
    }
    expectRejected(
      run({ method: 'POST', pathname: '/api/graphql', body: validBody }, store),
      429,
    )
  })

  it('gövdedeki limit: 0 → 400', () => {
    const body = JSON.stringify({ query: '{ products(limit: 0) { docs { id } } }' })
    expectRejected(run({ method: 'POST', pathname: '/api/graphql', body }), 400)
  })

  it('variables içindeki limit üst sınırı denetlenir', () => {
    const body = JSON.stringify({
      query: 'query ($limit: Int) { products(limit: $limit) { docs { id } } }',
      variables: { limit: API_MAX_PAGE_SIZE + 1 },
    })
    expectRejected(run({ method: 'POST', pathname: '/api/graphql', body }), 400)
  })

  it('GET query parametresindeki limit: 0 → 400', () => {
    const search = `?query=${encodeURIComponent('{ products(limit: 0) { docs { id } } }')}`
    expectRejected(run({ pathname: '/api/graphql', search }), 400)
  })

  it('sınır içindeki GraphQL limiti kabul edilir', () => {
    const body = JSON.stringify({
      query: `{ products(limit: ${API_MAX_PAGE_SIZE}) { docs { id } } }`,
      variables: { limit: 50 },
    })
    expect(run({ method: 'POST', pathname: '/api/graphql', body }).allowed).toBe(true)
  })

  it('gövde çok büyükse 400', () => {
    expectRejected(
      run({ method: 'POST', pathname: '/api/graphql', body: null, bodyTooLarge: true }),
      400,
    )
  })
})

describe('decideApiRequest — /urunler/akis', () => {
  it('derin sayfalama tavanı 100 sayfa (2400 ürün)', () => {
    expect(AKIS_MAX_PAGE).toBe(100)
  })

  it('derin sayfalar guard tarafından 429 edilmez; liste sonunu rota döndürür', () => {
    for (const sayfa of ['21', '50', '100', '101', '999']) {
      expect(run({ pathname: '/urunler/akis', search: `?sayfa=${sayfa}` }).allowed).toBe(true)
    }
  })

  it('IP başına dakikada 60 istek', () => {
    const store: RateStore = new Map()
    for (let i = 0; i < AKIS_LIMIT_PER_MINUTE; i += 1) {
      expect(run({ pathname: '/urunler/akis', search: '?sayfa=1' }, store).allowed).toBe(true)
    }
    expectRejected(run({ pathname: '/urunler/akis', search: '?sayfa=1' }, store), 429)
  })
})

describe('decideApiRequest — yazma bütçeleri', () => {
  it(`POST /api/users dakikada ${API_WRITE_LIMIT_PER_MINUTE}`, () => {
    const store: RateStore = new Map()
    for (let i = 0; i < API_WRITE_LIMIT_PER_MINUTE; i += 1) {
      expect(run({ method: 'POST', pathname: '/api/users', body: '{}' }, store).allowed).toBe(true)
    }
    expectRejected(run({ method: 'POST', pathname: '/api/users', body: '{}' }, store), 429)
  })

  it(`POST /api/users/forgot-password e-posta başına saatte ${API_FORGOT_PASSWORD_LIMIT_PER_HOUR}`, () => {
    const store: RateStore = new Map()
    const body = JSON.stringify({ email: 'Kullanici@Example.invalid' })
    for (let i = 0; i < API_FORGOT_PASSWORD_LIMIT_PER_HOUR; i += 1) {
      expect(
        run({ method: 'POST', pathname: '/api/users/forgot-password', body }, store).allowed,
      ).toBe(true)
    }
    expectRejected(run({ method: 'POST', pathname: '/api/users/forgot-password', body }, store), 429)

    const other = JSON.stringify({ email: 'baska@example.invalid' })
    expect(run({ method: 'POST', pathname: '/api/users/forgot-password', body: other }, store).allowed).toBe(
      true,
    )
  })

  it('şifre sıfırlamada e-posta yoksa IP bütçesi uygulanır', () => {
    const store: RateStore = new Map()
    for (let i = 0; i < API_FORGOT_PASSWORD_LIMIT_PER_HOUR; i += 1) {
      expect(run({ method: 'POST', pathname: '/api/users/forgot-password', body: '{}' }, store).allowed).toBe(
        true,
      )
    }
    expectRejected(run({ method: 'POST', pathname: '/api/users/forgot-password', body: '{}' }, store), 429)
  })

  it(`POST /api/users/login dakikada ${API_LOGIN_LIMIT_PER_MINUTE}`, () => {
    const store: RateStore = new Map()
    for (let i = 0; i < API_LOGIN_LIMIT_PER_MINUTE; i += 1) {
      expect(run({ method: 'POST', pathname: '/api/users/login', body: '{}' }, store).allowed).toBe(true)
    }
    expectRejected(run({ method: 'POST', pathname: '/api/users/login', body: '{}' }, store), 429)
  })

  it('katkı ve geri bildirim yazıları bütçelenir', () => {
    for (const pathname of [
      '/api/products/contribute',
      '/api/product-feedback',
      '/api/products/feedback/8690000000001/vote',
    ]) {
      const store: RateStore = new Map()
      for (let i = 0; i < API_WRITE_LIMIT_PER_MINUTE; i += 1) {
        expect(run({ method: 'POST', pathname, body: '{}' }, store).allowed).toBe(true)
      }
      expectRejected(run({ method: 'POST', pathname, body: '{}' }, store), 429)
    }
  })

  it('listede olmayan yazma uçları (panel) etkilenmez', () => {
    expect(run({ method: 'PATCH', pathname: '/api/products/1', body: '{}' }).allowed).toBe(true)
  })
})

describe('decideApiRequest — muafiyetler', () => {
  it('medya istekleri sayılmaz', () => {
    for (let i = 0; i < 1_000; i += 1) {
      expect(run({ pathname: '/api/media/file/fotograf.jpg' }).allowed).toBe(true)
    }
  })

  it('okuma uçlarında limit yoksa sayfalama bütçesi uygulanmaz', () => {
    expect(run({ search: '?page=1&limit=24' }).allowed).toBe(true)
  })
})
