import { GeneratedForm } from '@/components/AddProduct'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ barcode: string }> }) {
  // ✅ Doğru: Promise'i await ile çözüyoruz
  const { barcode } = await params
  return (
    <div>
      {barcode}
      <GeneratedForm />
    </div>
  )
}
