'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

// Dinamik import ile SSR'ı devre dışı bırak
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false })

export default function TaraPage() {
  const [lastScanned, setLastScanned] = useState<string>('')

  const handleScan = (result: string) => {
    setLastScanned(result)
    // Tarayıcı zaten yönlendirme işlemini handleBarcodeScanned içinde yapıyor
    // Burada sadece son taranan barkodu göstermek için kullanabilirsin
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-6">Barkod Tarayıcı</h1>

      <BarcodeScanner onScan={handleScan} />

      {lastScanned && (
        <div className="mt-4 p-3 bg-blue-100 rounded text-center">
          <p className="text-sm text-blue-700">
            Son taranan barkod: <span className="font-mono">{lastScanned}</span>
          </p>
        </div>
      )}
    </div>
  )
}
