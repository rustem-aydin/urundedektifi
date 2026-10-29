import fs from 'fs'
import path from 'path'
import { z } from 'zod'

/**
 * Payload REST istemcisi — prod seed betiklerinin ortak yazma katmanı.
 * Kimlik: JWT (users/login). Tüm yanıtlar sınırda zod ile doğrulanır.
 */

const IdDoc = z.object({ id: z.number() }).loose()
export type IdDoc = z.infer<typeof IdDoc>

const LoginResponse = z.object({ token: z.string() })
const DocEnvelope = z.object({ doc: IdDoc })
const ListEnvelope = z.object({ docs: z.array(IdDoc), totalDocs: z.number() })

export type FindParams = {
  where?: Record<string, unknown>
  limit?: number
  depth?: number
  sort?: string
  page?: number
  /** Yalnız gereken alanları iste (denetim betiklerinde yanıt boyutunu küçültür). */
  select?: Record<string, boolean>
}

export type PayloadClient = {
  readonly api: string
  login(): Promise<void>
  find(collection: string, params?: FindParams): Promise<{ docs: IdDoc[]; totalDocs: number }>
  findAll(collection: string, params?: FindParams): Promise<IdDoc[]>
  findOne(collection: string, where: Record<string, unknown>): Promise<IdDoc | undefined>
  create(collection: string, data: unknown): Promise<IdDoc>
  update(collection: string, id: number, data: unknown): Promise<IdDoc>
  upsert(collection: string, where: Record<string, unknown>, data: unknown): Promise<IdDoc>
  remove(collection: string, id: number): Promise<void>
  upload(
    collection: string,
    filePath: string,
    data: Record<string, unknown>,
  ): Promise<IdDoc>
}

export function createPayloadClient(options: {
  api: string
  email: string
  password: string
  /**
   * Hazır JWT. Payload'da yeni giriş eski oturumları düşürebildiği için paralel
   * çalışan betikler tek jetonu paylaşır; verilirse `login()` yeniden giriş yapmaz.
   */
  token?: string
}): PayloadClient {
  const api = options.api.replace(/\/$/, '')
  let token = options.token ?? ''

  function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `JWT ${token}`, ...extra }
  }

  async function readJson(res: Response, label: string): Promise<unknown> {
    if (!res.ok) throw new Error(`${label} ${res.status}: ${await res.text()}`)
    return (await res.json()) as unknown
  }

  async function login(): Promise<void> {
    if (options.token) return
    const res = await fetch(`${api}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: options.email, password: options.password }),
    })
    token = LoginResponse.parse(await readJson(res, 'login')).token
  }

  async function find(
    collection: string,
    params: FindParams = {},
  ): Promise<{ docs: IdDoc[]; totalDocs: number }> {
    const search = new URLSearchParams({
      limit: String(params.limit ?? 10),
      depth: String(params.depth ?? 0),
    })
    if (params.where) search.set('where', JSON.stringify(params.where))
    if (params.sort) search.set('sort', params.sort)
    if (params.page) search.set('page', String(params.page))
    if (params.select) {
      // Payload REST `select` alanını `select[alan]=true` biçiminde bekler.
      for (const [field, enabled] of Object.entries(params.select)) {
        if (enabled) search.set(`select[${field}]`, 'true')
      }
    }

    const res = await fetch(`${api}/${collection}?${search.toString()}`, {
      headers: authHeaders(),
    })
    return ListEnvelope.parse(await readJson(res, `find ${collection}`))
  }

  async function findAll(
    collection: string,
    params: FindParams = {},
  ): Promise<IdDoc[]> {
    const pageSize = params.limit ?? 100
    const docs: IdDoc[] = []
    for (let page = 1; ; page++) {
      const result = await find(collection, { ...params, limit: pageSize, page })
      docs.push(...result.docs)
      if (result.docs.length < pageSize || docs.length >= result.totalDocs) return docs
    }
  }

  async function findOne(
    collection: string,
    where: Record<string, unknown>,
  ): Promise<IdDoc | undefined> {
    return (await find(collection, { where, limit: 1 })).docs[0]
  }

  async function create(collection: string, data: unknown): Promise<IdDoc> {
    const res = await fetch(`${api}/${collection}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    })
    return DocEnvelope.parse(await readJson(res, `create ${collection}`)).doc
  }

  async function update(collection: string, id: number, data: unknown): Promise<IdDoc> {
    const res = await fetch(`${api}/${collection}/${id}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    })
    return DocEnvelope.parse(await readJson(res, `update ${collection}/${id}`)).doc
  }

  async function upsert(
    collection: string,
    where: Record<string, unknown>,
    data: unknown,
  ): Promise<IdDoc> {
    const existing = await findOne(collection, where)
    return existing ? update(collection, existing.id, data) : create(collection, data)
  }

  async function remove(collection: string, id: number): Promise<void> {
    const res = await fetch(`${api}/${collection}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error(`delete ${collection}/${id} ${res.status}: ${await res.text()}`)
  }

  async function upload(
    collection: string,
    filePath: string,
    data: Record<string, unknown>,
  ): Promise<IdDoc> {
    const form = new FormData()
    const bytes = fs.readFileSync(filePath)
    const ext = path.extname(filePath).replace('.', '') || 'bin'
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), path.basename(filePath))
    form.append('_payload', JSON.stringify(data))

    const res = await fetch(`${api}/${collection}`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    return DocEnvelope.parse(await readJson(res, `upload ${collection}`)).doc
  }

  return { api, login, find, findAll, findOne, create, update, upsert, remove, upload }
}
