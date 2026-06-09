import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { getAllCountries } from '@/lib/barcodePrefixes'

export async function POST() {
  try {
    const payload = await getPayload({ config: await config })
    const countries = getAllCountries()

    let created = 0
    let updated = 0
    const skipped: string[] = []

    for (const c of countries) {
      const existing = await payload.find({
        collection: 'countries',
        where: { name: { equals: c.name } },
        limit: 1,
      })

      const aliases = c.aliases.map((p) => ({ prefix: p }))

      if (existing.totalDocs > 0) {
        await payload.update({
          collection: 'countries',
          id: existing.docs[0].id,
          data: {
            name: c.name,
            code: c.code,
            iso: c.iso,
            aliases,
          },
        })
        updated++
      } else {
        await payload.create({
          collection: 'countries',
          data: {
            name: c.name,
            code: c.code,
            iso: c.iso,
            aliases,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${created} ülke oluşturuldu, ${updated} güncellendi (toplam ${countries.length}).`,
      created,
      updated,
      total: countries.length,
      skipped,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Bu endpoint Countries koleksiyonunu GS1 barkod prefixlerine göre doldurur/günceller.',
    usage: 'curl -X POST http://localhost:3000/api/seed-countries',
    note: 'Aynı isimdeki ülkeler güncellenir, yenileri eklenir. Silme yapmaz.',
  })
}
