'use server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Product } from '@/payload-types'

const payload = await getPayload({ config })

export const AddProduct = async (data: Product) => {
  try {
    console.log(data)
  } catch (error) {}
}
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
