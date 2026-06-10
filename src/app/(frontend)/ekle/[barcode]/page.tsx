import { GeneratedForm } from '@/components/AddProduct'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ barcode: string }> }) {
  const { barcode } = await params
  return (
    <div>
      {barcode}
      <GeneratedForm />
    </div>
  )
}
