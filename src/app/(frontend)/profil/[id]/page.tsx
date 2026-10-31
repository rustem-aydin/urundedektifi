import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { CaseSection } from '@/components/CaseSection'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ProfileEditor } from '@/components/ProfileEditor'
import { CONTRIBUTION_LABELS } from '@/lib/contributionLabels'
import { buildPublicProfile } from '@/lib/productContributions'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Yönetici',
  editor: 'Editör',
  expert: 'Uzman',
  user: 'Üye',
}

const numberFormat = new Intl.NumberFormat('tr-TR')

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  month: 'long',
  year: 'numeric',
})

async function loadProfile(id: string) {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  return buildPublicProfile(payload, id)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const profile = await loadProfile(id).catch(() => null)
  if (!profile) return { title: 'Profil bulunamadı' }
  return {
    title: `${profile.name} — Katkı profili`,
    description:
      profile.bio ??
      `${profile.name} adlı kullanıcının katkı sağladığı ürünler ve takip ettikleri.`,
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await loadProfile(id)
  if (!profile) notFound()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      {/* KİMLİK */}
      <header className="flex flex-col gap-5 rounded-xl border border-border bg-card px-5 py-6 sm:flex-row sm:items-start">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.avatarAlt || profile.name}
            className="size-20 shrink-0 rounded-full border border-border object-cover sm:size-24"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-20 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-lg uppercase text-faded sm:size-24"
          >
            {profile.name.slice(0, 2)}
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <EvidenceTag variant="stamp">KATKI PROFİLİ</EvidenceTag>
            <EvidenceTag>{ROLE_LABELS[profile.role] ?? 'Üye'}</EvidenceTag>
            {profile.createdAt ? (
              <EvidenceTag variant="tape">
                {dateFormat.format(new Date(profile.createdAt))} tarihinden beri
              </EvidenceTag>
            ) : null}
          </div>

          <h1 className="font-display text-2xl leading-tight sm:text-3xl">{profile.name}</h1>
          {profile.bio ? <p className="text-sm text-muted-foreground">{profile.bio}</p> : null}

          <ProfileEditor
            profileId={profile.id}
            name={profile.name}
            bio={profile.bio}
            avatarUrl={profile.avatarUrl}
          />
        </div>
      </header>

      {/* SAYILAR */}
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Katkı sağladığı ürün',
            value: profile.stats.productCount,
            hint: 'Yayındaki ürünler',
          },
          {
            label: 'Toplam görüntülenme',
            value: profile.stats.viewTotal,
            hint: 'Bu ürünlerin toplam açılışı',
          },
          {
            label: 'Katkı işi',
            value: profile.stats.contributionCount,
            hint: 'Oluşturma + düzenleme + doğrulama',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-3"
          >
            <dt className="font-mono text-[0.65rem] tracking-[0.16em] text-faded uppercase">
              {stat.label}
            </dt>
            <dd className="mt-1 font-display text-2xl">{numberFormat.format(stat.value)}</dd>
            <dd className="text-xs text-muted-foreground">{stat.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex flex-col gap-10">
        {/* TAKİP ETTİKLERİ */}
        <CaseSection
          id="takip"
          eyebrow="Takip"
          title={`Takip ettikleri (${profile.following.length})`}
          hasData={profile.following.length > 0}
          emptyMessage="Henüz uzman takip etmiyor. Takip edilen uzmanların hükümleri ürün dosyalarında kişiselleşir."
        >
          <ul className="mt-4 flex flex-wrap gap-2">
            {profile.following.map((expert) => (
              <li key={expert.id}>
                <Link
                  href={`/uzmanlar/${expert.slug}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-4 pl-1.5 transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {expert.avatarUrl ? (
                    <img
                      src={expert.avatarUrl}
                      alt={expert.avatarAlt || expert.name}
                      className="size-8 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-8 items-center justify-center rounded-full border border-border bg-muted font-mono text-[0.6rem] uppercase text-faded"
                    >
                      {expert.name.slice(0, 2)}
                    </span>
                  )}
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{expert.name}</span>
                    {expert.title ? (
                      <span className="text-xs text-muted-foreground">{expert.title}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CaseSection>

        {/* KATKI SAĞLADIĞI ÜRÜNLER */}
        <CaseSection
          id="katki-urunleri"
          eyebrow="Dosya"
          title={`Katkı sağladığı ürünler (${profile.stats.productCount})`}
          hasData={profile.products.length > 0}
          emptyMessage="Bu kullanıcının yayında ürün katkısı yok. Katkı sağladıkça burada listelenir."
        >
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.products.map((product) => (
              <li key={product.id}>
                <Link
                  href={product.barcode ? `/urun/${product.barcode}` : '/urunler'}
                  className="flex h-full gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {product.frontImageUrl ? (
                    <img
                      src={product.frontImageUrl}
                      alt={product.frontImageAlt || product.name}
                      className="size-16 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted font-mono text-[0.6rem] uppercase text-faded"
                    >
                      KARE YOK
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                    <span className="font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
                      {numberFormat.format(product.goruntulenme)} görüntülenme
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {product.roles.map((role) => (
                        <EvidenceTag
                          key={role}
                          variant={role === 'create' ? 'evidence' : 'stamp'}
                        >
                          {CONTRIBUTION_LABELS[role]}
                        </EvidenceTag>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {profile.products.length < profile.stats.productCount ? (
            <p className="mt-3 font-mono text-[0.65rem] tracking-[0.14em] text-faded uppercase">
              En çok görüntülenen {profile.products.length} ürün gösteriliyor · toplam{' '}
              {numberFormat.format(profile.stats.productCount)}
            </p>
          ) : null}
        </CaseSection>
      </div>
    </div>
  )
}
