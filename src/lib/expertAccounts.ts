import crypto from 'node:crypto'

import { APIError, type Payload, type PayloadRequest } from 'payload'

import { slugify } from '@/lib/slugify'
import type { User } from '@/payload-types'

/**
 * Uzman ↔ personel hesabı eşleşmesi (ADR 0030).
 *
 * Kural: her `experts` kaydının tam olarak bir `users` hesabı vardır ve o hesap
 * başka bir uzmana bağlanamaz. Hesap `experts` kaydından **otomatik** açılır;
 * e-posta uzmanın adından türetilir (`boykot_dedektifi@expert.local`), şifre
 * rastgele üretilir ve panelden admin tarafından belirlenir.
 *
 * Alan adı bilerek teslim edilemez bir alan (`.local`): girdiler gerçek bir
 * posta kutusuna düşmez, böylece "şifremi unuttum" postası üçüncü şahsa gitmez.
 */
export const EXPERT_EMAIL_DOMAIN = 'expert.local'

/**
 * Uzman kaydından hesap açan ve rolü uzmana çeken tek yol; `Users` hook'ları
 * bu bağlamda "uzman kaydına bağlı olma" ön koşulunu atlar.
 */
export const EXPERT_ACCOUNT_CONTEXT = { skipExpertAccountGuard: true }

/** İlişki alanı sayı ya da `{ id }` olarak gelebilir; her ikisini de kimliğe çevirir. */
export function relationshipId(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value && typeof value === 'object' && 'id' in value) {
    const raw = (value as { id: unknown }).id
    const id = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(id) ? id : null
  }
  return null
}

/** `Boykot Dedektifi` → `boykot_dedektifi` (Türkçe karakterler ASCII'ye çevrilir). */
export function expertEmailLocalPart(name: string): string {
  const local = slugify(name).replace(/-/g, '_')
  if (!local) {
    throw new APIError('Uzman adından e-posta adresi üretilemedi.', 400)
  }
  return local
}

/** Aynı ad iki kez kullanılırsa `local-2`, `local-3`… sırayla denenir. */
export async function availableExpertEmail(
  payload: Payload,
  name: string,
  req?: PayloadRequest,
): Promise<string> {
  const local = expertEmailLocalPart(name)
  for (let attempt = 1; attempt <= 999; attempt += 1) {
    const email =
      attempt === 1 ? `${local}@${EXPERT_EMAIL_DOMAIN}` : `${local}-${attempt}@${EXPERT_EMAIL_DOMAIN}`
    const taken = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      ...(req ? { req } : {}),
    })
    if (taken.docs.length === 0) return email
  }
  throw new APIError('Bu uzman adı için boş e-posta bulunamadı.', 400)
}

/**
 * Rastgele geçici şifre. Değer hiçbir yerde saklanmaz ve kullanıcıya gösterilmez;
 * admin panelden gerçek şifreyi belirler (ADR 0030 §2).
 */
export function generateExpertPassword(): string {
  return crypto.randomBytes(24).toString('base64url')
}

/** Uzman için panel hesabı açar; hesap kimliğini döner. */
export async function createExpertAccount(
  payload: Payload,
  name: string,
  req?: PayloadRequest,
): Promise<number> {
  const email = await availableExpertEmail(payload, name, req)
  const account = await payload.create({
    collection: 'users',
    data: {
      name,
      email,
      password: generateExpertPassword(),
      role: 'expert',
    },
    depth: 0,
    overrideAccess: true,
    context: EXPERT_ACCOUNT_CONTEXT,
    ...(req ? { req } : {}),
  })
  return Number(account.id)
}

/**
 * Bağlanan hesap panele girebilsin diye rolü `uzman`a çeker.
 * admin/editör hesapları rollerini korur (yetki kaybı olmasın).
 */
export async function ensureExpertAccountRole(
  payload: Payload,
  userId: number,
  req?: PayloadRequest,
): Promise<void> {
  const account = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
    ...(req ? { req } : {}),
  })
  const role = (account as User | null)?.role
  if (!role || role === 'expert' || role === 'admin' || role === 'editor') return
  await payload.update({
    collection: 'users',
    id: userId,
    data: { role: 'expert' },
    depth: 0,
    overrideAccess: true,
    context: EXPERT_ACCOUNT_CONTEXT,
    ...(req ? { req } : {}),
  })
}
