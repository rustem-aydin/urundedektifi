'use client'

import Link from 'next/link'
import { useState } from 'react'

import { EvidenceTag } from '@/components/EvidenceTag'
import { FollowButton } from '@/components/FollowButton'
import { VerdictStamp } from '@/components/VerdictStamp'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ExpertVerdict } from '@/lib/verdictEngine'

export type ExpertAvatar = { url: string | null; alt: string | null }

/**
 * Dosya 01 — Uzman hükümleri.
 *
 * Her satır bir uzmanı temsil eder: solda uzman (avatar + ad), sağda o uzmanın bu
 * ürün için verdiği hüküm (derecelendirme damgaları). Satıra tıklamak hükmün
 * ayrıntısını (derece açıklaması + eşleşen deliller) bulanık arka planlı diyalogda açar.
 * Mobilde aynı içerik alt çekmecede (bottom drawer) açılır.
 */
export function ExpertVerdicts({
  verdicts,
  avatars,
}: {
  verdicts: ExpertVerdict[]
  avatars: Record<string, ExpertAvatar>
}) {
  const [open, setOpen] = useState<ExpertVerdict | null>(null)

  return (
    <>
      <ul className="mt-4 flex flex-col gap-3">
        {verdicts.map((verdict) => {
          const avatar = avatars[verdict.expert.slug]
          return (
            <li
              key={verdict.expert.id}
              className="group flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/40 hover:ring-foreground/30"
            >
              <button
                type="button"
                onClick={() => setOpen(verdict)}
                aria-label={`${verdict.expert.name}: ${verdict.ratings
                  .map((rating) => rating.name)
                  .join(', ')}. Ayrıntıyı aç.`}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
              >
                <ExpertAvatarImage avatar={avatar} name={verdict.expert.name} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{verdict.expert.name}</span>
                  <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                    {verdict.matchedRules.length} delil
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {verdict.ratings.map((rating) => (
                    <VerdictStamp
                      key={rating.id}
                      // Derecelendirme rengi CMS'ten serbest gelir; token dışı tek renk burada, inline stil ile uygulanır
                      style={{ color: rating.color || undefined }}
                      title={rating.description || rating.name}
                    >
                      {rating.name}
                    </VerdictStamp>
                  ))}
                </span>
                <span aria-hidden="true" className="font-mono text-faded">
                  ›
                </span>
              </button>
              <FollowButton
                expertId={verdict.expert.id}
                expertName={verdict.expert.name}
                variant="chip"
                className="shrink-0"
              />
            </li>
          )
        })}
      </ul>

      <Dialog
        open={Boolean(open)}
        onOpenChange={(next) => {
          if (!next) setOpen(null)
        }}
      >
        {open ? (
          <DialogContent
            overlayClassName="bg-background/60 supports-backdrop-filter:backdrop-blur-md"
            className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          >
            <DialogHeader className="gap-3">
              <div className="flex items-center gap-3">
                <ExpertAvatarImage avatar={avatars[open.expert.slug]} name={open.expert.name} large />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[0.65rem] tracking-[0.2em] text-stamp uppercase">
                    Uzman hükmü
                  </span>
                  <DialogTitle className="font-display text-xl">{open.expert.name}</DialogTitle>
                </div>
              </div>
              <DialogDescription>
                {open.expert.name} bu ürün için {open.matchedRules.length} kuralla eşleşti.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                {open.ratings.map((rating) => (
                  <div key={rating.id} className="flex flex-col gap-1">
                    <VerdictStamp style={{ color: rating.color || undefined }}>
                      {rating.name}
                    </VerdictStamp>
                    {rating.description ? (
                      <p className="text-xs text-muted-foreground">{rating.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                  Deliller ({open.matchedRules.length})
                </p>
                <ul className="flex flex-col gap-3">
                  {open.matchedRules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex flex-col gap-1 border-t border-dashed border-border pt-3"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        {rule.topic ? (
                          <Link href={`/konu/${rule.topic.slug}`} className="hover:underline">
                            <EvidenceTag>
                              {rule.topic.icon ? `${rule.topic.icon} ` : ''}
                              {rule.topic.name}
                            </EvidenceTag>
                          </Link>
                        ) : null}
                        {rule.rating?.name ? (
                          <VerdictStamp style={{ color: rule.rating.color || undefined }}>
                            {rule.rating.name}
                          </VerdictStamp>
                        ) : null}
                      </span>
                      <p className="font-medium">{rule.name}</p>
                      {rule.matchedValue ? (
                        <p className="text-sm">
                          <span className="font-mono text-[0.65rem] tracking-[0.18em] text-faded uppercase">
                            Eşleşme:{' '}
                          </span>
                          {rule.matchedValue}
                        </p>
                      ) : null}
                      {rule.description ? (
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      ) : null}
                      {rule.sources?.length ? (
                        <span className="flex flex-col gap-0.5">
                          {rule.sources.map((source, index) =>
                            source.url ? (
                              <a
                                key={`${source.url}-${index}`}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase hover:underline"
                              >
                                Kaynak · {source.title ?? source.url}
                              </a>
                            ) : null,
                          )}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={`/uzmanlar/${open.expert.slug}`}
                className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase hover:underline"
              >
                Uzmanın profili ›
              </Link>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

function ExpertAvatarImage({
  avatar,
  name,
  large = false,
}: {
  avatar?: ExpertAvatar
  name: string
  large?: boolean
}) {
  const size = large ? 'size-12' : 'size-11'
  if (!avatar?.url) {
    return (
      <span
        aria-hidden="true"
        className={`${size} flex shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase`}
      >
        {name.slice(0, 2)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- medya URL'i Payload'dan göreli gelir; galeri ve uzman sayfaları da düz img kullanır
    <img
      src={avatar.url}
      alt={avatar.alt || name}
      className={`${size} shrink-0 rounded-[4px] border border-border object-cover`}
    />
  )
}
