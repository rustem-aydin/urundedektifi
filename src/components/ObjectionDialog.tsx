'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  OBJECTION_LIMITS,
  OBJECTION_TYPES,
  type ObjectionType,
} from '@/lib/objections'

export type ObjectionVerdict = { expert: string; rules: string[] }

type FieldErrors = Record<string, string>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NONE = 'none'

/**
 * Ürün dosyasındaki uzman görüşlerine itiraz formu.
 *
 * Erişilebilirlik Radix diyaloğundan gelir (`role="dialog"`, `aria-modal`,
 * başlık bağlantısı, Esc ile kapanma, odak tuzağı). İlk odak ad alanına
 * taşınır; gönderim sırasında düğme kilitlenir; sunucunun alan bazlı hataları
 * ilgili alanın altında gösterilir.
 */
export function ObjectionDialog({
  barcode,
  productName,
  verdicts,
}: {
  barcode: string
  productName: string
  verdicts: ObjectionVerdict[]
}) {
  const ids = {
    name: useId(),
    email: useId(),
    type: useId(),
    verdict: useId(),
    message: useId(),
    consent: useId(),
    website: useId(),
  }
  const nameRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<ObjectionType>('gorus_dayanak')
  const [verdictKey, setVerdictKey] = useState(NONE)
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')

  const verdictOptions = verdicts.flatMap((verdict) =>
    verdict.rules.map((rule) => ({
      key: `${verdict.expert}::${rule}`,
      expert: verdict.expert,
      rule,
      label: `${verdict.expert} — ${rule}`,
    })),
  )
  const selectedVerdict = verdictOptions.find((option) => option.key === verdictKey)

  function reset() {
    setName('')
    setEmail('')
    setType('gorus_dayanak')
    setVerdictKey(NONE)
    setMessage('')
    setConsent(false)
    setWebsite('')
    setErrors({})
  }

  function clientErrors(): FieldErrors {
    const next: FieldErrors = {}
    const trimmedName = name.trim()
    if (trimmedName.length < OBJECTION_LIMITS.nameMin || trimmedName.length > OBJECTION_LIMITS.nameMax) {
      next.name = `Ad soyad ${OBJECTION_LIMITS.nameMin}–${OBJECTION_LIMITS.nameMax} karakter olmalı.`
    }
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Geçerli bir e-posta adresi gir.'
    const trimmedMessage = message.trim()
    if (
      trimmedMessage.length < OBJECTION_LIMITS.messageMin ||
      trimmedMessage.length > OBJECTION_LIMITS.messageMax
    ) {
      next.message = `Mesaj ${OBJECTION_LIMITS.messageMin}–${OBJECTION_LIMITS.messageMax} karakter olmalı.`
    }
    if (!consent) next.consent = 'Devam etmek için gizlilik metnini onayla.'
    return next
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return

    const nextErrors = clientErrors()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setPending(true)
    setErrors({})
    try {
      const response = await fetch('/api/objections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          type,
          productBarcode: barcode,
          productName,
          expertName: selectedVerdict?.expert ?? '',
          ruleName: selectedVerdict?.rule ?? '',
          pageUrl: typeof window === 'undefined' ? '' : window.location.href,
          message: message.trim(),
          website,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; errors?: FieldErrors; error?: string }
        | null

      if (!response.ok) {
        if (response.status === 429) {
          const text =
            body?.error ?? 'Aynı adresten saatte en fazla 5 itiraz gönderilebilir.'
          setErrors({ form: text })
          toast.error(text)
        } else if (body?.errors) {
          setErrors(body.errors)
        } else {
          const text = body?.error ?? 'İtiraz gönderilemedi. Lütfen tekrar dene.'
          setErrors({ form: text })
        }
        return
      }

      setOpen(false)
      reset()
      toast.success('Talebin kaydedildi.')
    } catch {
      setErrors({ form: 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.' })
    } finally {
      setPending(false)
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`${ids[key as keyof typeof ids]}-error`} className="text-xs text-stamp">
        {errors[key]}
      </p>
    ) : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return
        setOpen(next)
        if (!next) setErrors({})
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-fit">
          İtiraz et
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        aria-modal="true"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          nameRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Görüşe itiraz</DialogTitle>
          <DialogDescription>
            {productName} dosyasındaki bir görüşe veya ürün verisine itiraz et. Talebin kaydedilir
            ve inceleme için iletilir.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.name}>Ad soyad</Label>
            <Input
              id={ids.name}
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              minLength={OBJECTION_LIMITS.nameMin}
              maxLength={OBJECTION_LIMITS.nameMax}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              required
            />
            {fieldError('name')}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.email}>E-posta</Label>
            <Input
              id={ids.email}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${ids.email}-error` : undefined}
              required
            />
            {fieldError('email')}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={ids.type}>İtiraz türü</Label>
            <Select value={type} onValueChange={(value) => setType(value as ObjectionType)}>
              <SelectTrigger id={ids.type} className="w-full" aria-invalid={Boolean(errors.type)}>
                <SelectValue placeholder="Tür seç" />
              </SelectTrigger>
              <SelectContent>
                {OBJECTION_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError('type')}
          </div>

          {verdictOptions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.verdict}>İlgili görüş (varsa)</Label>
              <Select value={verdictKey} onValueChange={setVerdictKey}>
                <SelectTrigger id={ids.verdict} className="w-full">
                  <SelectValue placeholder="Görüş seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Genel / belirtmek istemiyorum</SelectItem>
                  {verdictOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={ids.message}>Mesaj</Label>
              <span className="font-mono text-[0.65rem] text-faded">
                {message.length}/{OBJECTION_LIMITS.messageMax}
              </span>
            </div>
            <Textarea
              id={ids.message}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              minLength={OBJECTION_LIMITS.messageMin}
              maxLength={OBJECTION_LIMITS.messageMax}
              placeholder="Hangi görüşe, hangi dayanağa ve neden itiraz ediyorsun? Belge, kaynak veya düzeltme önerisi ekleyebilirsin."
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? `${ids.message}-error` : undefined}
              required
            />
            {fieldError('message')}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <input
                id={ids.consent}
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? `${ids.consent}-error` : undefined}
                required
              />
              <Label htmlFor={ids.consent} className="items-start font-normal leading-relaxed">
                <span>
                  Ad ve e-posta bilgilerimin bu itirazı incelemek için işlenmesini kabul ediyorum.{' '}
                  <Link href="/gizlilik" className="underline underline-offset-4" target="_blank">
                    Gizlilik metni
                  </Link>
                </span>
              </Label>
            </div>
            {fieldError('consent')}
          </div>

          {/* Honeypot: botlar doldurur; kullanıcıya görünmez, gerçek odaklanma dışıdır. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={ids.website}>Web sitesi</label>
            <input
              id={ids.website}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {errors.form ? (
            <p role="alert" className="text-sm text-stamp">
              {errors.form}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Gönderiliyor…' : 'İtirazı gönder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
