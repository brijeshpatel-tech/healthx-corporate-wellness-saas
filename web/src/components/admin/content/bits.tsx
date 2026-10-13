"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { FitnessLevel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LEVEL_BARS, LEVEL_LABEL } from "./meta"

/** Error state with the screen's own wording ("Couldn't load workouts.") and a Retry button. */
export function LoadError({ title, error, onRetry, className }: { title: string; error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <Empty className={cn("border border-dashed border-destructive/30 bg-destructive/5 py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{errorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Try again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

/** "Beginner" with a 3-step signal meter. */
export function LevelBadge({ level, className }: { level: FitnessLevel; className?: string }) {
  const bars = LEVEL_BARS[level]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className)}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cn("w-1 rounded-full", b === 1 ? "h-1.5" : b === 2 ? "h-2.5" : "h-3.5", b <= bars ? "bg-primary" : "bg-muted-foreground/25")} />
        ))}
      </span>
      {LEVEL_LABEL[level]}
    </span>
  )
}

/** Simple emoji grid with a custom-emoji box (no colour). */
export function EmojiPicker({ value, onChange, emojis, invalid }: { value: string; onChange: (v: string) => void; emojis: readonly string[]; invalid?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={cn("flex size-9 items-center justify-center rounded-lg border text-lg transition-colors hover:bg-muted", value === e && "border-primary bg-primary/10 ring-1 ring-primary/40")}
          aria-label={`Use ${e}`}
          aria-pressed={value === e}
        >
          {e}
        </button>
      ))}
      <Input
        value={value}
        onChange={(ev) => onChange(ev.target.value.slice(0, 4))}
        className={cn("h-9 w-20 text-center text-lg", invalid && "border-destructive")}
        aria-label="Custom emoji"
        placeholder="🙂"
        aria-invalid={invalid}
      />
    </div>
  )
}

export function EmojiPickerField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  emojis,
  className,
  required,
}: {
  control: Control<T>
  name: FieldPath<T>
  label?: React.ReactNode
  description?: React.ReactNode
  emojis: readonly string[]
  className?: string
  required?: boolean
}) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FieldShell label={label} description={description} error={fieldState.error?.message} className={className} required={required}>
      <EmojiPicker value={(field.value as string) ?? ""} onChange={field.onChange} emojis={emojis} invalid={!!fieldState.error} />
    </FieldShell>
  )
}

/** Small "N items" counter shown at the end of a filter row. */
export function ResultCount({ count, noun, className }: { count: number | undefined; noun: [string, string]; className?: string }) {
  if (count === undefined) return null
  return (
    <span className={cn("text-sm text-muted-foreground tabular-nums sm:ml-auto", className)}>
      {formatNumber(count)} {count === 1 ? noun[0] : noun[1]}
    </span>
  )
}
