"use client"

import { Check, Eye, EyeOff, X } from "lucide-react"
import { useState } from "react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { z } from "zod"
import { FieldShell } from "@/components/common/form-fields"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Admin password policy (FRM-05): min 10 characters incl. letters, numbers and a symbol. */
export const PASSWORD_RULES = [
  { key: "length", label: "At least 10 characters", test: (p: string) => p.length >= 10 },
  { key: "letter", label: "A letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { key: "number", label: "A number", test: (p: string) => /\d/.test(p) },
  { key: "symbol", label: "A symbol (e.g. ! @ # $)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const

export const adminPasswordSchema = z
  .string()
  .min(1, "Enter a password")
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), "Use at least 10 characters with letters, numbers and a symbol")

function strength(p: string) {
  if (!p) return 0
  let score = PASSWORD_RULES.filter((r) => r.test(p)).length
  if (p.length >= 14) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  return Math.min(4, Math.max(1, score - 2))
}

const LEVELS = [
  { label: "", color: "bg-muted" },
  { label: "Weak", color: "bg-rose-500" },
  { label: "Fair", color: "bg-amber-500" },
  { label: "Good", color: "bg-sky-500" },
  { label: "Strong", color: "bg-emerald-500" },
]

/** Four-segment strength meter plus the policy checklist. */
export function PasswordStrength({ value, className }: { value: string; className?: string }) {
  const level = strength(value)
  const meetsPolicy = PASSWORD_RULES.every((r) => r.test(value))
  const shown = meetsPolicy ? Math.max(level, 3) : Math.min(level, 2)
  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-colors", value && i <= shown ? LEVELS[shown]!.color : "bg-muted")} />
          ))}
        </div>
        <span className="w-12 text-right text-xs font-medium text-muted-foreground">{value ? LEVELS[shown]!.label : ""}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(value)
          return (
            <li key={r.key} className={cn("flex items-center gap-1.5 text-xs", ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {ok ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0 opacity-60" />}
              {r.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Password input with show/hide toggle (React Hook Form). */
export function PasswordField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  autoComplete = "new-password",
  showStrength,
  className,
  required,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: React.ReactNode
  description?: React.ReactNode
  autoComplete?: string
  showStrength?: boolean
  className?: string
  required?: boolean
}) {
  const { field, fieldState } = useController({ control, name })
  const [visible, setVisible] = useState(false)
  const id = `f-${name}`
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <FieldShell id={id} label={label} description={description} error={fieldState.error?.message} required={required}>
        <div className="relative">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={!!fieldState.error}
            className="h-9 pr-10"
            {...field}
            value={field.value ?? ""}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </FieldShell>
      {showStrength ? <PasswordStrength value={String(field.value ?? "")} /> : null}
    </div>
  )
}
