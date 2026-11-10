'use client'

import { useState } from 'react'
import type { ComponentProps } from 'react'

import BarcodeScanner from '@/components/BarcodeScanner'
import { Button } from '@/components/ui/button'

type BarcodeScanButtonProps = Omit<ComponentProps<typeof Button>, 'type' | 'onClick' | 'asChild'>

/**
 * Kamera taramasını tam ekran katman olarak açar (ayrı bir /tara rotası yok).
 * Tarama sonucu /urun veya /katki rotasına gider; katman kapanınca sayfa korunur.
 */
export function BarcodeScanButton({ children, ...props }: BarcodeScanButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      {open ? <BarcodeScanner onClose={() => setOpen(false)} /> : null}
    </>
  )
}
