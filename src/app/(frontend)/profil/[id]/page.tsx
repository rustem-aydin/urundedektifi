import { getPayload } from 'payload'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

import config from '@/payload.config'
import { AccountActions } from '@/components/AccountActions'
import { CaseSection } from '@/components/CaseSection'
import { EvidenceTag } from '@/components/EvidenceTag'
import { ProfileContributions } from '@/components/ProfileContributions'
import { ProfileEditor } from '@/components/ProfileEditor'
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

/** Profil hem meta etiketlerinde hem gövdede istenir; React `cache` aynı istekte tek kez kurar. */
const loadProfile = cache(async (id: string) => {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  return buildPublicProfile(payload, id)
})

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
          <Image
            src={profile.avatarUrl}
            alt={profile.avatarAlt || profile.name}
            width={96}
            height={96}
            quality={75}
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
          <AccountActions profileId={profile.id} />
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
                    <Image
                      src={expert.avatarUrl}
                      alt={expert.avatarAlt || expert.name}
                      width={32}
                      height={32}
                      quality={60}
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

        {/* KATKILAR — yayındaki ürünler + (profil sahibine) incelemedeki katkılar; tek bölüm. */}
        <ProfileContributions
          profileId={profile.id}
          productCount={profile.stats.productCount}
          products={profile.products.map((product) => ({
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            frontImageUrl: product.frontImageUrl,
            frontImageAlt: product.frontImageAlt,
            views: product.goruntulenme,
            roles: product.roles,
          }))}
        />
      </div>
    </div>
  )
}
