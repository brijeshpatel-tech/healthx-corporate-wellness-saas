"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * Form section: title + description on the left (desktop), fields on the right in a card.
 *   <FormSection title="Company details" description="Shown to employees in the app.">…fields…</FormSection>
 */
export function FormSection({
  title,
  description,
  children,
  className,
  contentClassName,
  aside,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
  /** Extra content under the description (tips, preview…). */
  aside?: React.ReactNode
}) {
  return (
    <section className={cn("grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-8", className)}>
      <div className="space-y-1.5">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {aside ? <div className="pt-2">{aside}</div> : null}
      </div>
      <Card className="py-0">
        <CardContent className={cn("grid gap-4 p-4 sm:grid-cols-2 sm:p-6", contentClassName)}>{children}</CardContent>
      </Card>
    </section>
  )
}

/** Sticky action bar at the bottom of long forms. */
export function FormActions({ children, hint, className }: { children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">{hint}</div>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  )
}
