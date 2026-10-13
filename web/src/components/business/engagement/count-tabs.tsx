"use client"

import { cn } from "@/lib/utils"

/** Status tabs with counts — scrolls horizontally on phones. */
export function CountTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  ariaLabel = "Filter by status",
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string; count?: number }[]
  className?: string
  ariaLabel?: string
}) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <div role="tablist" aria-label={ariaLabel} className="inline-flex min-w-max items-center gap-1 rounded-xl bg-muted p-1">
        {items.map((item) => {
          const active = item.value === value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                active && "bg-background text-foreground shadow-sm dark:bg-input/40",
              )}
            >
              {item.label}
              {item.count !== undefined ? (
                <span className={cn("rounded-md px-1.5 py-px text-[11px] tabular-nums", active ? "bg-primary/12 text-primary" : "bg-background/70 dark:bg-background/30")}>{item.count}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
