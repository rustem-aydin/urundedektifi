import configPromise from '@payload-config'
import { setTimeout as delay } from 'node:timers/promises'
import { getPayload } from 'payload'

/**
 * Dokploy healthcheck ucu.
 *
 * Konteyner "running" görünürken uygulamanın gerçekten veritabanına
 * erişebildiğini ayırt eder: ucuz bir `SELECT 1` çalıştırır. Gövde yalnız
 * sabit kod taşır; hata mesajı, bağlantı bilgisi veya yığın izi sızdırmaz.
 */
export const dynamic = 'force-dynamic'

const DB_TIMEOUT_MS = 2_000

type HealthStatus = 'ok' | 'db_unreachable'

function respond(status: HealthStatus, httpStatus: number): Response {
  return new Response(JSON.stringify({ status }), {
    status: httpStatus,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  })
}

async function probeDatabase(): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.db.pool.query('SELECT 1')
}

export async function GET(): Promise<Response> {
  const abort = new AbortController()
  const timeout = delay(DB_TIMEOUT_MS, undefined, { signal: abort.signal }).then(() => {
    throw new Error('healthz_timeout')
  })

  try {
    await Promise.race([probeDatabase(), timeout])
    return respond('ok', 200)
  } catch {
    return respond('db_unreachable', 503)
  } finally {
    abort.abort()
  }
}
