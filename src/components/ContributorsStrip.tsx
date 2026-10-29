'use client'

import Link from 'next/link'
import { useState } from 'react'

import { EvidenceTag } from '@/components/EvidenceTag'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CONTRIBUTION_LABELS } from '@/lib/contributionLabels'
import type { Contributor } from '@/lib/productContributions'

/** Avatar grubunda yan yana duran yüz sayısı; fazlası "+N" rozetinde toplanır. */
const VISIBLE_AVATARS = 5

function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full border border-border bg-muted font-mono uppercase text-faded ${className ?? ''}`}
    >
      {name.slice(0, 2)}
    </span>
  )
}

/**
 * "Katkıda Bulunanlar" — ürünün altındaki avatar grubu.
 *
 * Ürünü oluşturan, düzenleyen ve doğrulayan kişiler tek grupta, kişi başına tek avatar
 * olarak durur (aynı kişi üç işi de yaptıysa tekrar etmez). Gruba tıklanınca web'de
 * diyalog, mobilde alt çekmece açılır ve her kişi yaptığı işlerin rozetleriyle listelenir.
 * Her satır kişinin herkese açık profiline gider.
 */
export function ContributorsStrip({
  contributors,
  total,
}: {
  contributors: Contributor[]
  total: number
}) {
  const [open, setOpen] = useState(false)

  if (contributors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu dosyaya henüz katkı kaydı yok. Ürün eklendikçe, düzenlendikçe ve doğrulandıkça
        katkıda bulunanlar burada listelenir.
      </p>
    )
  }

  const visible = contributors.slice(0, VISIBLE_AVATARS)
  const hidden = total - visible.length

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Katkıda bulunanlar: ${total} kişi. Listeyi aç.`}
          className="group flex items-center rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="flex items-center">
            {visible.map((contributor, index) => (
              <span
                key={contributor.id}
                className={`relative flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted transition-transform group-hover:-translate-y-0.5 ${index === 0 ? '' : '-ml-2.5'}`}
                style={{ zIndex: VISIBLE_AVATARS - index }}
              >
                {contributor.avatarUrl ? (
                  <img
                    src={contributor.avatarUrl}
                    alt={contributor.avatarAlt || contributor.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <Initials name={contributor.name} className="size-full text-[0.6rem]" />
                )}
              </span>
            ))}
            {hidden > 0 ? (
              <span className="-ml-2.5 flex size-9 items-center justify-center rounded-full border-2 border-background bg-foreground font-mono text-[0.6rem] text-background">
                +{hidden}
              </span>
            ) : null}
          </span>
          <span className="ml-3 font-mono text-[0.65rem] tracking-[0.2em] text-faded uppercase group-hover:text-foreground">
            {total} kişi · listeyi aç
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Katkıda Bulunanlar</DialogTitle>
            <DialogDescription>
              Bu dosyayı oluşturan, düzenleyen ve doğrulayan {total} kişi. Bir kişi birden çok iş
              yaptıysa tek satırda, yaptığı işler rozet olarak görünür.
            </DialogDescription>
          </DialogHeader>
          <ul className="mt-4 flex flex-col gap-2">
            {contributors.map((contributor) => (
              <li key={contributor.id}>
                <Link
                  href={`/profil/${contributor.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 hover:ring-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {contributor.avatarUrl ? (
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.avatarAlt || contributor.name}
                      className="size-10 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <Initials name={contributor.name} className="size-10 shrink-0 text-[0.65rem]" />
                  )}
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-sm font-medium">{contributor.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {contributor.roles.map((role) => (
                        <EvidenceTag key={role} variant={role === 'create' ? 'evidence' : 'stamp'}>
                          {CONTRIBUTION_LABELS[role]}
                        </EvidenceTag>
                      ))}
                    </span>
                    {contributor.bio ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {contributor.bio}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
