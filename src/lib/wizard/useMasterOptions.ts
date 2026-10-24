'use client'

import { useEffect, useState } from 'react'

import { fetchMasterOptions } from './api'
import type { MasterCollection, MasterOption } from './types'

/**
 * Eşleme adımının master listeleri. Sihirbaz içinde sekmeler arasında gezinirken yeniden
 * indirilmesin diye modül düzeyinde söz önbelleği tutulur (mobildeki 5 dk staleTime karşılığı).
 */
const cache = new Map<MasterCollection, Promise<MasterOption[]>>()

function load(collection: MasterCollection): Promise<MasterOption[]> {
  const existing = cache.get(collection)
  if (existing) return existing
  const pending = fetchMasterOptions(collection).catch((error) => {
    cache.delete(collection)
    throw error
  })
  cache.set(collection, pending)
  return pending
}

export function useMasterOptions(collection: MasterCollection): {
  data: MasterOption[]
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<MasterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    load(collection)
      .then((options) => {
        if (!active) return
        setData(options)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'Liste alınamadı.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [collection])

  return { data, loading, error }
}
