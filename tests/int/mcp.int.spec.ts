import { createRequire } from 'module'
import crypto from 'crypto'
import path from 'path'
import { pathToFileURL } from 'url'

import { createLocalReq, getPayload, handleEndpoints, Payload } from 'payload'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

const require = createRequire(import.meta.url)
const mcpPluginDir = path.dirname(require.resolve('@payloadcms/plugin-mcp'))
const { getMCPHandler } = (await import(
  pathToFileURL(path.join(mcpPluginDir, 'mcp', 'getMcpHandler.js')).href
)) as {
  getMCPHandler: (
    pluginOptions: MCPPluginConfig,
    mcpAccessSettings: Record<string, unknown>,
    req: unknown,
  ) => (request: Request) => Promise<Response>
}

let payload: Payload
let pluginOptions: MCPPluginConfig

const mcpRequest = async (method: string, params: Record<string, unknown> = {}, apiKey?: string) => {
  if (!apiKey) {
    return handleEndpoints({
      config: payload.config,
      path: '/api/mcp',
      request: new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
      }),
    })
  }

  const req = await createLocalReq(
    {
      req: {
        headers: new Headers({ Authorization: `Bearer ${apiKey}` }),
        payloadAPI: 'MCP',
        url: 'http://localhost:3000/api/mcp',
      } as never,
    },
    payload,
  )

  const apiKeyIndex = crypto.createHmac('sha256', payload.secret).update(apiKey).digest('hex')
  const { docs } = await payload.find({
    collection: 'payload-mcp-api-keys' as never,
    depth: 1,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { apiKeyIndex: { equals: apiKeyIndex } },
  })
  const keyDoc = docs[0] as Record<string, unknown> & { user: Record<string, unknown> }
  keyDoc.user.collection = 'users'
  keyDoc.user._strategy = 'mcp-api-key'

  const handler = getMCPHandler(pluginOptions, keyDoc, req)

  return handler(
    new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: '1', method, params }),
    }),
  )
}

const parseMcpResponse = async (res: Response) => {
  const text = await res.text()
  const dataLine = text
    .split('\n')
    .find((line) => line.startsWith('data:'))
  const parsed = JSON.parse(dataLine ? dataLine.slice(5).trim() : text)
  return parsed
}

describe('MCP', () => {
  let apiKey: string

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const { mcpProductsPluginOptions } = await import('@/lib/mcpOptions')
    pluginOptions = mcpProductsPluginOptions

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'MCP Test Admin',
        email: `mcp-test-${Date.now()}@example.com`,
        password: 'test-password-123',
        role: 'admin',
      },
      overrideAccess: true,
    })

    apiKey = `mcp-test-key-${Date.now()}`
    await payload.create({
      collection: 'payload-mcp-api-keys',
      data: {
        label: 'Test Key',
        user: user.id,
        enableAPIKey: true,
        apiKey,
        products: { find: true, create: true, update: true, delete: true },
        'payload-mcp-tool': { getProductCaseByBarcode: true },
      },
      overrideAccess: true,
    } as Parameters<Payload['create']>[0])
  })

  it('rejects requests without an API key', async () => {
    const res = await mcpRequest('tools/list')
    expect(res.status).toBe(401)
  })

  it('lists the products tools and the custom case tool', async () => {
    const res = await mcpRequest('tools/list', {}, apiKey)
    expect(res.status).toBe(200)
    const body = await parseMcpResponse(res)
    const toolNames = body.result.tools.map((t: { name: string }) => t.name)
    expect(toolNames).toContain('findProducts')
    expect(toolNames).toContain('createProducts')
    expect(toolNames).toContain('updateProducts')
    expect(toolNames).toContain('deleteProducts')
    expect(toolNames).toContain('getProductCaseByBarcode')
  })

  it('creates, finds, updates and deletes a product over MCP', async () => {
    const barcode = `869${String(Date.now()).slice(-10)}`

    const createRes = await mcpRequest(
      'tools/call',
      {
        name: 'createProducts',
        arguments: {
          name: `MCP Test Ürünü ${barcode}`,
          barcode,
          nutrition: { per: '100g' },
        },
      },
      apiKey,
    )
    expect(createRes.status).toBe(200)
    const createBody = await parseMcpResponse(createRes)
    expect(createBody.error).toBeUndefined()
    expect(createBody.result.content[0].text).toContain(barcode)

    const findRes = await mcpRequest(
      'tools/call',
      {
        name: 'findProducts',
        arguments: {
          where: JSON.stringify({ barcode: { equals: barcode } }),
          select: JSON.stringify({ name: true, barcode: true }),
        },
      },
      apiKey,
    )
    const findBody = await parseMcpResponse(findRes)
    expect(findBody.error).toBeUndefined()
    expect(findBody.result.content[0].text).toContain(barcode)

    const found = await payload.find({
      collection: 'products',
      where: { barcode: { equals: barcode } },
      limit: 1,
      overrideAccess: true,
    })
    const doc = found.docs[0]
    expect(doc).toBeDefined()

    const updateRes = await mcpRequest(
      'tools/call',
      {
        name: 'updateProducts',
        arguments: { id: String(doc.id), name: 'MCP Test Ürünü (güncel)' },
      },
      apiKey,
    )
    const updateBody = await parseMcpResponse(updateRes)
    expect(updateBody.error).toBeUndefined()

    const updated = await payload.findByID({
      collection: 'products',
      id: doc.id,
      overrideAccess: true,
    })
    expect(updated.name).toBe('MCP Test Ürünü (güncel)')

    const deleteRes = await mcpRequest(
      'tools/call',
      { name: 'deleteProducts', arguments: { id: String(doc.id) } },
      apiKey,
    )
    const deleteBody = await parseMcpResponse(deleteRes)
    expect(deleteBody.error).toBeUndefined()

    const afterDelete = await payload.find({
      collection: 'products',
      where: { id: { equals: doc.id } },
      overrideAccess: true,
    })
    expect(afterDelete.totalDocs).toBe(0)
  })

  it('returns the Ürün Dosyası via getProductCaseByBarcode', async () => {
    const barcode = `869${String(Date.now()).slice(-9)}1`
    await payload.create({
      collection: 'products',
      data: {
        name: `MCP Dosya Ürünü ${barcode}`,
        barcode,
        status: 'published',
        nutrition: { per: '100g' },
      },
      draft: false,
      overrideAccess: true,
    })

    const res = await mcpRequest(
      'tools/call',
      { name: 'getProductCaseByBarcode', arguments: { barcode } },
      apiKey,
    )
    expect(res.status).toBe(200)
    const body = await parseMcpResponse(res)
    expect(body.error).toBeUndefined()
    expect(body.result.isError).not.toBe(true)
    const productCase = JSON.parse(body.result.content[0].text)
    expect(productCase.name).toBe(`MCP Dosya Ürünü ${barcode}`)
    expect(productCase.barcode).toBe(barcode)
    expect(productCase).toHaveProperty('verdict')
    expect(productCase).toHaveProperty('gallery')

    await payload.delete({
      collection: 'products',
      where: { barcode: { equals: barcode } },
      overrideAccess: true,
    })
  })
})
