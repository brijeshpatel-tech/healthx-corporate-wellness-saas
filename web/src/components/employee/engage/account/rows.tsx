"use client"

import type { LucideIcon } from "lucide-react"
import { Check } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { IconTile, type Tone } from "../page"

/** Settings row with an icon tile, text and a switch. The whole text area toggles the switch. */
export function SwitchRow({
  id,
  icon,
  tone = "slate",
  title,
  description,
  meta,
  badge,
  checked,
  onCheckedChange,
  disabled,
  pending,
}: {
  id: string
  icon?: LucideIcon
  tone?: Tone
  title: React.ReactNode
  description?: React.ReactNode
  /** Small line under the description (version, timestamp…). */
  meta?: React.ReactNode
  badge?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  pending?: boolean
}) {
  return (
    <div className={cn("flex min-h-16 items-center gap-3 px-4 py-3.5", disabled && "opacity-60")}>
      {icon ? <IconTile icon={icon} tone={tone} size="sm" className="self-start" /> : null}
      <label htmlFor={id} className={cn("min-w-0 flex-1", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <span>{title}</span>
          {badge}
        </span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        {meta ? <span className="mt-1 block text-[11px] text-muted-foreground/80">{meta}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-busy={pending} className="shrink-0" />
    </div>
  )
}

export interface ChipOption<T extends string> {
  value: T
  label: React.ReactNode
  emoji?: string
  disabled?: boolean
  hint?: React.ReactNode
}

/** Big, tappable chips for single or multi choice (preferences, reasons…). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple,
  ariaLabel,
  invalid,
  className,
}: {
  options: ChipOption<T>[]
  value: T | T[]
  onChange: (value: T | T[]) => void
  multiple?: boolean
  ariaLabel?: string
  invalid?: boolean
  className?: string
}) {
  const selected = new Set(Array.isArray(value) ? value : [value])
  const toggle = (v: T) => {
    if (!multiple) return onChange(v)
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange(options.map((o) => o.value).filter((o) => next.has(o)))
  }
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={ariaLabel} aria-invalid={invalid || undefined} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = selected.has(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => toggle(o.value)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30" : "bg-card text-foreground hover:bg-muted",
              invalid && !active && "border-destructive/50",
              o.disabled && "cursor-not-allowed opacity-55 hover:bg-card",
            )}
          >
            {o.emoji ? <span className="text-base leading-none" aria-hidden>{o.emoji}</span> : null}
            <span>{o.label}</span>
            {o.hint ? <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{o.hint}</span> : null}
            {active ? <Check className="size-4" aria-hidden /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Card section used on account forms: title, optional description/badge, content. */
export function FormSection({
  title,
  description,
  badge,
  icon,
  tone = "emerald",
  children,
  className,
  id,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="flex items-start gap-3">
        {icon ? <IconTile icon={icon} tone={tone} size="sm" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-semibold">
            {title}
            {badge}
          </h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

/** Save / Cancel row at the end of a form — full-width buttons on phones. */
export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end [&>*]:h-11 [&>*]:rounded-xl [&>*]:px-5 sm:[&>*]:min-w-32", className)}>{children}</div>
}
