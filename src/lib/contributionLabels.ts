/**
 * Katkı türleri — istemci tarafında da güvenle import edilebilen küçük modül.
 * Sunucu yardımcıları (`productContributions.ts`) Payload API'sine dokunur; istemci
 * bileşenleri yalnız bu dosyayı kullanır.
 */

export const CONTRIBUTION_KINDS = ['create', 'update', 'verify'] as const
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number]

/** Rozet metinleri: kim ne yaptı. */
export const CONTRIBUTION_LABELS: Record<ContributionKind, string> = {
  create: 'Oluşturdu',
  update: 'Düzenledi',
  verify: 'Doğruladı',
}
