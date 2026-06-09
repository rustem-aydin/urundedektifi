export type PriceRecord = {
  amount: number
  date?: string
}

export type PriceSummary = {
  count: number
  min: number
  max: number
  average: number
  rangeText: string
  averageText: string
}

function formatNumber(n: number): string {
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function summarizePrices(
  prices: PriceRecord[] | null | undefined,
): PriceSummary | null {
  if (!prices || prices.length === 0) return null

  const valid = prices.filter(
    (p) => typeof p.amount === 'number' && !isNaN(p.amount) && p.amount > 0,
  )
  if (valid.length === 0) return null

  const amounts = valid.map((p) => p.amount)
  const min = Math.min(...amounts)
  const max = Math.max(...amounts)
  const average = amounts.reduce((a, b) => a + b, 0) / amounts.length

  return {
    count: amounts.length,
    min,
    max,
    average,
    rangeText: `${formatNumber(min)} - ${formatNumber(max)} ₺`,
    averageText: `${formatNumber(average)} ₺`,
  }
}
