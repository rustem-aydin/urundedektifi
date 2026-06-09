// components/BarcodeScanner.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Camera, X } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  isOpen: boolean
  onClose: () => void
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, isOpen, onClose }) => {
  const [error, setError] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerDivId = 'barcode-scanner'

  useEffect(() => {
    if (isOpen) {
      startScanner()
    } else {
      stopScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen])

  const startScanner = async () => {
    try {
      setError('')
      const html5QrCode = new Html5Qrcode(scannerDivId)
      scannerRef.current = html5QrCode

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => {
          // Ignore scan errors
        },
      )
    } catch (err) {
      setError('Kamera başlatılamadı. Lütfen kamera izinlerini kontrol edin.')
      console.error('Scanner error:', err)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (error) {
        console.error('Error stopping scanner:', error)
      }
      scannerRef.current = null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Barkod / QR Kod Tara
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div id={scannerDivId} className="w-full aspect-square" />
          {error && <div className="text-red-500 text-sm p-3 bg-red-50 rounded-md">{error}</div>}
          <div className="text-sm text-gray-500 text-center">
            Kamerayı barkoda veya QR koda doğru tutun
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              stopScanner()
              onClose()
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
