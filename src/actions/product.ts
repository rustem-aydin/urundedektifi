'use server'
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

export const getProduct = async (barcode: number) => {
  try {
    const data = await payload.find({
      collection: 'products',
      where: {
        barcode: {
          equals: barcode,
        },
      },
    })
    return data
  } catch (error) {
    throw error
  }
}
