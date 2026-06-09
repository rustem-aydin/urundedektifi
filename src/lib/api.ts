// lib/api.ts
import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_PAYLOAD_API_URL || 'http://localhost:3000/api'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor for auth
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('payload-token')
  if (token) {
    config.headers.Authorization = `JWT ${token}`
  }
  return config
})

// Relations API
export const fetchRelations = async () => {
  const [brands, categories, countries, ingredients, additives] = await Promise.all([
    api.get('/brands?limit=1000'),
    api.get('/categories?limit=1000'),
    api.get('/countries?limit=1000'),
    api.get('/ingredients?limit=1000'),
    api.get('/additives?limit=1000'),
  ])

  return {
    brands: brands.data.docs,
    categories: categories.data.docs,
    countries: countries.data.docs,
    ingredients: ingredients.data.docs,
    additives: additives.data.docs,
  }
}

// Barkod tarama sonrası ürün kontrolü
export const checkBarcode = async (barcode: string) => {
  try {
    const response = await api.get(`/products?where[barcode][equals]=${barcode}`)
    return response.data.docs[0] || null
  } catch (error) {
    return null
  }
}

// Medya yükleme
export const uploadMedia = async (file: File, altText: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('alt', altText)

  const response = await api.post('/media', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data.doc
}

// Ürün oluşturma
export const createProduct = async (data: any) => {
  const response = await api.post('/products', data)
  return response.data.doc
}
