import { describe, expect, it } from 'vitest'
import { buildCountrySeed, planCountrySeed } from '@/lib/seed/countries'

/**
 * Ülke seed planı iki ortamda (yerel Local API, üretim REST) aynı sonucu
 * üretmeli. Buradaki testler eşleştirme ve birleştirme kurallarını korur:
 * ISO ile eşleşme, elle girilmiş GS1 kodunun korunması, tekilleştirilmiş
 * ek prefixler ve idempotentlik.
 */

const records = buildCountrySeed()
const record = (name: string) => {
  const found = records.find((country) => country.name === name)
  if (!found) throw new Error(`Kayıt yok: ${name}`)
  return found
}

describe('buildCountrySeed', () => {
  it('193 BM üyesini tek ISO ve adla listeler', () => {
    expect(records).toHaveLength(193)
    expect(new Set(records.map((country) => country.iso)).size).toBe(193)
    expect(new Set(records.map((country) => country.name)).size).toBe(193)
  })

  it('GS1 ana prefixini ek prefixlerden ayırır', () => {
    for (const country of records) {
      if (country.code) expect(country.aliases).not.toContain(country.code)
    }
  })
})

describe('planCountrySeed', () => {
  it('boş veritabanında tüm ülkeleri yaratır', () => {
    const plan = planCountrySeed([], records)
    expect(plan.creates).toHaveLength(193)
    expect(plan.updates).toHaveLength(0)
    expect(plan.unchanged).toBe(0)
  })

  it('ISO ile eşleşen kaydı günceller ve adı kanonikleştirir', () => {
    const plan = planCountrySeed([{ id: 42, name: 'Türkiye Cumhuriyeti', iso: 'TR' }], records)
    expect(plan.creates).toHaveLength(192)
    expect(plan.updates).toEqual([
      {
        id: 42,
        data: {
          name: 'Türkiye',
          iso: 'TR',
          code: record('Türkiye').code,
          aliases: record('Türkiye').aliases.map((prefix) => ({ prefix })),
        },
      },
    ])
  })

  it('GS1 aralığı olmayan ülkede elle girilmiş prefixi korur', () => {
    const plan = planCountrySeed(
      [{ id: 7, name: 'Afganistan İslam Cumhuriyeti', iso: 'AF', code: '999' }],
      records,
    )
    expect(plan.updates[0]?.data.name).toBe('Afganistan')
    expect(plan.updates[0]?.data.code).toBe('999')
    expect(plan.updates[0]?.data.aliases).toEqual([])
  })

  it('ek prefixleri birleştirir, ana prefixi tekrar etmez', () => {
    const turkey = record('Türkiye')
    const plan = planCountrySeed(
      [
        {
          id: 1,
          name: 'Türkiye',
          iso: 'TR',
          code: '099',
          aliases: [{ prefix: turkey.code! }, '869', { prefix: '099' }],
        },
      ],
      records,
    )
    const prefixes = plan.updates[0]?.data.aliases.map((alias) => alias.prefix) ?? []
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(prefixes).not.toContain(turkey.code)
    expect(prefixes).toEqual(expect.arrayContaining(['869', '099']))
  })

  it('aynı veriyle ikinci çalıştırmada hiçbir şey yazmaz', () => {
    const existing = records.map((country, index) => ({
      id: index + 1,
      name: country.name,
      iso: country.iso,
      code: country.code,
      aliases: country.aliases.map((prefix) => ({ prefix })),
    }))
    const plan = planCountrySeed(existing, records)
    expect(plan.creates).toHaveLength(0)
    expect(plan.updates).toHaveLength(0)
    expect(plan.unchanged).toBe(193)
  })
})
