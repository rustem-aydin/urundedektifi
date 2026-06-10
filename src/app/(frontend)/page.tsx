import BarcodeScanner from '@/components/BarcodeScanner'
import dynamic from 'next/dynamic'

// Dinamik import ile SSR'ı devre dışı bırak

export default function TaraPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Barkod Tarayıcı</h1>

      <BarcodeScanner />
    </div>
  )
}
