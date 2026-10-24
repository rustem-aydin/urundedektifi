'use client'

import { useId } from 'react'

import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** Sihirbazın küçük, seçilebilir etiketi (mobildeki `Chip` karşılığı). */
export function Chip({
  label,
  selected = false,
  onClick,
  disabled,
  className,
  title,
}: {
  label: string
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center rounded-sm border px-2 py-1 font-mono text-[0.7rem] tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        selected
          ? 'border-stamp/60 bg-stamp/10 text-stamp'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {label}
    </button>
  )
}

/** Etiketli tek satır / çok satır metin alanı. */
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  inputMode,
  type = 'text',
  disabled,
  autoComplete,
  className,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
  type?: 'text' | 'password' | 'email'
  disabled?: boolean
  autoComplete?: string
  className?: string
  hint?: string
}) {
  const id = useId()
  return (
    <Field className={cn('gap-1', className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          inputMode={inputMode}
          type={type}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? <p className="font-mono text-[0.62rem] tracking-[0.12em] text-muted-foreground uppercase">{hint}</p> : null}
    </Field>
  )
}

/** Adım başlığı: mikro etiket + açıklama. */
export function WizardIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[0.65rem] tracking-[0.18em] text-stamp uppercase">{eyebrow}</span>
      <h2 className="font-display text-xl leading-tight">{title}</h2>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  )
}
