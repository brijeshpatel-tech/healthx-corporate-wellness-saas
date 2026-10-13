"use client"

/**
 * React Hook Form field helpers. Pair with zod:
 *
 *   const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues })
 *   <TextField control={form.control} name="email" label="Work email" type="email" />
 */
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface BaseProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label?: React.ReactNode
  description?: React.ReactNode
  className?: string
  disabled?: boolean
  required?: boolean
}

/** Label + control + description + error. Usable on its own for non-RHF inputs. */
export function FieldShell({
  id,
  label,
  description,
  error,
  required,
  className,
  children,
}: {
  id?: string
  label?: React.ReactNode
  description?: React.ReactNode
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  type = "text",
  placeholder,
  autoComplete,
  prefix,
  suffix,
}: BaseProps<T> & { type?: string; placeholder?: string; autoComplete?: string; prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  const { field, fieldState } = useController({ control, name })
  const id = `f-${name}`
  return (
    <FieldShell id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <div className="relative">
        {prefix ? <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span> : null}
        <Input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!fieldState.error}
          className={cn("h-9", prefix ? "pl-8" : undefined, suffix ? "pr-14" : undefined)}
          {...field}
          value={field.value ?? ""}
          onChange={(e) => field.onChange(type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        />
        {suffix ? <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span> : null}
      </div>
    </FieldShell>
  )
}

export function TextareaField<T extends FieldValues>({ control, name, label, description, className, disabled, required, placeholder, rows = 4, maxLength }: BaseProps<T> & { placeholder?: string; rows?: number; maxLength?: number }) {
  const { field, fieldState } = useController({ control, name })
  const id = `f-${name}`
  const length = String(field.value ?? "").length
  return (
    <FieldShell
      id={id}
      label={label}
      description={maxLength ? <span className="flex justify-between gap-2"><span>{description}</span><span className="tabular-nums">{length}/{maxLength}</span></span> : description}
      error={fieldState.error?.message}
      required={required}
      className={className}
    >
      <Textarea id={id} rows={rows} placeholder={placeholder} disabled={disabled} maxLength={maxLength} aria-invalid={!!fieldState.error} {...field} value={field.value ?? ""} />
    </FieldShell>
  )
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  disabled,
  required,
  options,
  placeholder = "Select…",
}: BaseProps<T> & { options: { value: string; label: React.ReactNode }[]; placeholder?: string }) {
  const { field, fieldState } = useController({ control, name })
  const id = `f-${name}`
  return (
    <FieldShell id={id} label={label} description={description} error={fieldState.error?.message} required={required} className={className}>
      <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-9 w-full" aria-invalid={!!fieldState.error}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

export function SwitchField<T extends FieldValues>({ control, name, label, description, className, disabled }: BaseProps<T>) {
  const { field } = useController({ control, name })
  const id = `f-${name}`
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border p-4", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={!!field.value} onCheckedChange={field.onChange} disabled={disabled} />
    </div>
  )
}

export function CheckboxField<T extends FieldValues>({ control, name, label, description, className, disabled }: BaseProps<T>) {
  const { field, fieldState } = useController({ control, name })
  const id = `f-${name}`
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox id={id} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={disabled} className="mt-0.5" aria-invalid={!!fieldState.error} />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm leading-snug font-normal">
          {label}
        </Label>
        {fieldState.error ? <p className="text-xs font-medium text-destructive">{fieldState.error.message}</p> : description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  )
}

/** Card-style radio options (great for choosing types, goals, plans). */
export function ChoiceField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  columns = 2,
}: BaseProps<T> & { options: { value: string; label: React.ReactNode; description?: React.ReactNode; icon?: React.ReactNode }[]; columns?: 1 | 2 | 3 | 4 }) {
  const { field, fieldState } = useController({ control, name })
  return (
    <FieldShell label={label} description={description} error={fieldState.error?.message} className={className}>
      <RadioGroup
        value={field.value ?? ""}
        onValueChange={field.onChange}
        className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3", columns === 4 && "grid-cols-2 sm:grid-cols-4")}
      >
        {options.map((o) => {
          const id = `f-${name}-${o.value}`
          const checked = field.value === o.value
          return (
            <Label
              key={o.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50",
                checked && "border-primary bg-primary/5 ring-1 ring-primary/30",
              )}
            >
              <RadioGroupItem id={id} value={o.value} className="mt-0.5" />
              {o.icon ? <span className="text-lg leading-none">{o.icon}</span> : null}
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.description ? <span className="block text-xs font-normal text-muted-foreground">{o.description}</span> : null}
              </span>
            </Label>
          )
        })}
      </RadioGroup>
    </FieldShell>
  )
}
