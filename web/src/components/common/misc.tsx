"use client"

import { Search, ShieldCheck, X } from "lucide-react"
import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Search box with debounce (300 ms) and clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  debounce = 300,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  debounce?: number
}) {
  const [local, setLocal] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setLocal(value)
  }
  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => onChange(local), debounce)
    return () => clearTimeout(t)
  }, [local, value, onChange, debounce])
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder={placeholder} className="h-9 pr-8 pl-8" />
      {local ? (
        <button
          type="button"
          onClick={() => {
            setLocal("")
            onChange("")
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/** Confirmation dialog for destructive or important actions. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && buttonVariants({ variant: "destructive" }), destructive && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Card with a header row (title, description, actions). */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={cn("gap-4", className)}>
      {title || actions ? (
        <CardHeader>
          {title ? <CardTitle className="font-heading text-base">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
          {actions ? <CardAction className="flex items-center gap-2">{actions}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}

/** Label/value pairs for detail pages. */
export function KeyValueList({ items, columns = 2, className }: { items: { label: string; value: React.ReactNode }[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-1">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-medium break-words">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Reminder shown wherever company admins see wellness numbers. */
export function PrivacyNote({ minGroupSize = 5, className, children }: { minGroupSize?: number; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p>
        {children ?? (
          <>
            Privacy first: you only see combined figures. Groups smaller than {minGroupSize} people are hidden, and no one at your company can see an individual&apos;s health data.
          </>
        )}
      </p>
    </div>
  )
}

/** Thin horizontal bar used for inline comparisons in tables and lists. */
export function InlineBar({ value, max, color = "var(--primary)", className }: { value: number; max: number; color?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}
