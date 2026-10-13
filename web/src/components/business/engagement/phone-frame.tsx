import { cn } from "@/lib/utils"

/** Phone mock used for "as employees will see it" previews. */
export function PhoneFrame({ children, className, label = "Employee app preview" }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <figure className={cn("mx-auto w-full max-w-[300px]", className)} aria-label={label}>
      <div className="rounded-[2.2rem] border-[6px] border-foreground/85 bg-background p-1.5 shadow-xl dark:border-foreground/25">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-muted/40">
          <div className="flex items-center justify-between px-5 pt-2.5 pb-1 text-[10px] font-semibold text-foreground/80">
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-foreground/85 dark:bg-foreground/25" />
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-[2px] border border-current" />
            </span>
          </div>
          <div className="min-h-[360px] px-3 pt-2 pb-5">{children}</div>
          <div className="mx-auto mb-2 h-1 w-24 rounded-full bg-foreground/30" />
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">{label}</figcaption>
    </figure>
  )
}
