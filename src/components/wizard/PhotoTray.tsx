'use client'

import { ImagePlus, Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import { EvidenceTag } from '@/components/EvidenceTag'
import { CaseCard } from '@/components/CaseCard'
import type { Extraction, PhotoRole } from '@/lib/wizard/ai'
import { PHOTO_ROLE_NAMES } from '@/lib/wizard/labels'
import type { DraftPhoto } from '@/lib/wizard/productDraft'
import { cn } from '@/lib/utils'

import { Chip } from './controls'

const ROLES: PhotoRole[] = ['front', 'ingredients', 'nutrition', 'recycling', 'additional', 'unknown']

type Props = {
  photos: DraftPhoto[]
  requests: Extraction['requests']
  disabled?: boolean
  onAdd: (files: File[], source: 'camera' | 'library') => void
  onRemove: (id: string) => void
  onRole: (id: string, role: PhotoRole) => void
}

/** Fotoğraf toplama: kamera + dosya seçimi, rol etiketleri ve YZ talepleri. */
export function PhotoTray({ photos, requests, disabled, onAdd, onRemove, onRole }: Props) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  function take(input: React.RefObject<HTMLInputElement | null>, source: 'camera' | 'library') {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (files.length) onAdd(files, source)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.length ? (
        <CaseCard className="flex flex-col gap-2 p-4" tape>
          <EvidenceTag variant="stamp">YAPAY ZEKÂ TALEBİ</EvidenceTag>
          <p className="font-display text-base">Eksik kalan fotoğraflar</p>
          {requests.map((request, index) => (
            <div key={`${request.need}-${index}`} className="flex flex-col gap-0.5">
              <p className="text-sm">
                {index + 1}. {request.need}
              </p>
              <p className="text-sm text-muted-foreground">{request.hint}</p>
              {request.fields.length ? (
                <p className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">
                  ALANLAR: {request.fields.join(', ')}
                </p>
              ) : null}
            </div>
          ))}
        </CaseCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={disabled} onClick={() => cameraInput.current?.click()}>
          <ImagePlus aria-hidden="true" />
          Fotoğraf çek
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => libraryInput.current?.click()}
        >
          Galeriden seç
        </Button>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={take(cameraInput, 'camera')}
        />
        <input
          ref={libraryInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={take(libraryInput, 'library')}
        />
      </div>

      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
        {photos.length} FOTOĞRAF · ÜRÜNE EN FAZLA 6 GÖRSEL BAĞLANIR
      </p>

      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- object URL, next/image optimizasyonu anlamsız */}
          <img
            src={photo.url}
            alt={`Fotoğraf ${index + 1}`}
            className="size-20 shrink-0 rounded-sm bg-muted object-cover"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="font-mono text-[0.62rem] tracking-[0.14em] text-muted-foreground uppercase">
              FOTOĞRAF {index + 1}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((role) => (
                <Chip
                  key={role}
                  label={PHOTO_ROLE_NAMES[role]}
                  selected={photo.role === role}
                  disabled={disabled}
                  onClick={() => onRole(photo.id, role)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('w-fit text-stamp')}
              disabled={disabled}
              onClick={() => onRemove(photo.id)}
            >
              <Trash2 aria-hidden="true" />
              Kaldır
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
