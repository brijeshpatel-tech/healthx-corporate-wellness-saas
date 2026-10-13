"use client"

import { Plus, X } from "lucide-react"
import { useState } from "react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { cn } from "@/lib/utils"
import { firstErrorMessage } from "./field-error"

/**
 * Chips input: type and press Enter / comma to add; click a suggestion to add it.
 * `normalize` lets callers lower-case or trim values (e.g. email domains).
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
  suggestions = [],
  normalize = (v: string) => v.trim(),
  max = 20,
  invalid,
  id,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  suggestions?: readonly string[]
  normalize?: (value: string) => string
  max?: number
  invalid?: boolean
  id?: string
}) {
  const [draft, setDraft] = useState("")
  const add = (raw: string) => {
    const v = normalize(raw)
    if (!v || value.includes(v) || value.length >= max) return
    onChange([...value, v])
  }
  const commit = () => {
    draft.split(",").forEach((part) => add(part))
    setDraft("")
  }
  const remaining = suggestions.filter((s) => !value.includes(s))
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary pr-1 pl-2 text-xs font-medium text-secondary-foreground">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove ${tag}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commit()
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => draft.trim() && commit()}
          placeholder={value.length ? "" : placeholder}
          className="h-6 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-invalid={invalid}
        />
      </div>
      {remaining.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {remaining.slice(0, 14).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
              <Plus className="size-3" /> {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function TagInputField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...rest
}: {
  control: Control<T>
  name: FieldPath<T>
  label?: React.ReactNode
  description?: React.ReactNode
  required?: boolean
  className?: string
} & Omit<React.ComponentProps<typeof TagInput>, "value" | "onChange" | "invalid" | "id">) {
  const { field, fieldState } = useController({ control, name })
  const message = firstErrorMessage(fieldState.error)
  return (
    <FieldShell id={`f-${name}`} label={label} description={description} error={message} required={required} className={className}>
      <TagInput id={`f-${name}`} value={(field.value as string[]) ?? []} onChange={field.onChange} invalid={!!message} {...rest} />
    </FieldShell>
  )
}
