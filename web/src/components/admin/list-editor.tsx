"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { FieldShell } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { firstErrorMessage } from "./field-error"

/** Ordered list of short texts (rules, instructions…) with add / edit / reorder / remove. */
export function ListEditor({
  value,
  onChange,
  placeholder = "Add an item…",
  addLabel = "Add",
  max = 12,
  maxLength = 200,
  numbered = true,
  invalid,
}: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  addLabel?: string
  max?: number
  maxLength?: number
  numbered?: boolean
  invalid?: boolean
}) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.length >= max) return
    onChange([...value, v])
    setDraft("")
  }
  const move = (i: number, dir: -1 | 1) => {
    const next = [...value]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ol className="space-y-1.5">
          {value.map((item, i) => (
            <li key={i} className="group flex items-center gap-1.5 rounded-lg border bg-card p-1.5 pl-2.5">
              {numbered ? <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}.</span> : null}
              <Input
                value={item}
                maxLength={maxLength}
                onChange={(e) => onChange(value.map((v, idx) => (idx === i ? e.target.value : v)))}
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1 dark:bg-transparent"
                aria-label={`Item ${i + 1}`}
              />
              <div className="flex shrink-0 items-center">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))} aria-label="Remove" className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={value.length >= max ? `Maximum ${max} items` : placeholder}
          disabled={value.length >= max}
          className={cn("h-9", invalid && value.length === 0 && "border-destructive")}
          aria-invalid={invalid}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || value.length >= max} className="h-9">
          <Plus data-icon="inline-start" /> {addLabel}
        </Button>
      </div>
    </div>
  )
}

export function ListEditorField<T extends FieldValues>({
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
} & Omit<React.ComponentProps<typeof ListEditor>, "value" | "onChange" | "invalid">) {
  const { field, fieldState } = useController({ control, name })
  const message = firstErrorMessage(fieldState.error)
  return (
    <FieldShell label={label} description={description} error={message} required={required} className={className}>
      <ListEditor value={(field.value as string[]) ?? []} onChange={field.onChange} invalid={!!message} {...rest} />
    </FieldShell>
  )
}
