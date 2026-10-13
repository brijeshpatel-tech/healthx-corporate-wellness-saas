import { cn } from "@/lib/utils"

/** Friendly, illustrated empty state for inbox-style lists. */
export function InboxEmpty({ emoji, title, description, action, className }: { emoji: string; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-3xl" aria-hidden>
        {emoji}
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-heading text-base font-semibold">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
