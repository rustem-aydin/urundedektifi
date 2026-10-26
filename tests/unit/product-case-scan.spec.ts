import { describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { listProductsMatchingRule } from '@/lib/productCase'

/**
 * Kural eşleştirmesi yayındaki TÜM ürünleri taramalı. Ürün sayısı on binlere
 * çıktığı için tek istekte 500 kayıtla sınırlamak eşleşmeleri sessizce
 * kaybettiriyordu; bu test 500'ün ötesindeki eşleşmeyi arar.
 */

const RULE = { id: 1, ruleType: 'label_has', label: 'vegan', isActive: true } as never

type FakeDoc = {
  id: number
  barcode: string
  name: string
  slug: string
  labels: string[]
}

function fakePayload(total: number, matchId: number) {
  const docs: FakeDoc[] = Array.from({ length: total }, (_, index) => ({
    id: index + 1,
    barcode: `B${index + 1}`,
    name: `Ürün ${index + 1}`,
    slug: `urun-${index + 1}`,
    labels: index + 1 === matchId ? ['vegan'] : [],
  }))
  const pages: number[] = []

  const payload = {
    find: async ({ page = 1, limit = 500, where }: any) => {
      pages.push(page)
      const ids = where?.and?.[1]?.id?.in as number[] | undefined
      // İkinci aşama: eşleşen kimlikler tek tek istenir.
      if (ids) {
        return {
          docs: ids.map((id) => docs[id - 1]).filter(Boolean),
          totalDocs: ids.length,
        }
      }
      const start = (page - 1) * limit
      return { docs: docs.slice(start, start + limit), totalDocs: docs.length }
    },
  }

  return { payload: payload as unknown as Payload, pages }
}

describe('kural eşleştirmesinde sayfalama', () => {
  it('500. kayıttan sonraki eşleşmeyi bulur', async () => {
    const { payload, pages } = fakePayload(1200, 902)

    const matched = await listProductsMatchingRule(payload, RULE)

    expect(matched.map((productCase) => productCase.barcode)).toEqual(['B902'])
    // Tarama 500'lük sayfalarla ilerledi: 1, 2, 3 (son sayfa) + kimlik sorgusu.
    expect(pages).toContain(2)
    expect(pages).toContain(3)
  })

  it('ilk sayfadaki eşleşmeyi ve tarama sırasını korur', async () => {
    const { payload } = fakePayload(1200, 42)

    const matched = await listProductsMatchingRule(payload, RULE)

    expect(matched).toHaveLength(1)
    expect(matched[0].barcode).toBe('B42')
    expect(matched[0].name).toBe('Ürün 42')
  })
})
