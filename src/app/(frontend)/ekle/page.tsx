import { GeneratedForm } from '@/components/AddProduct'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: any) {
  // ✅ Doğru: Promise'i await ile çözüyoruz
  const { barcode } = await searchParams
  return (
    <div>
      {barcode}
      <GeneratedForm />
    </div>
  )
}
