import Link from "next/link"
import { cn } from "@/lib/utils"

/** Company logo tile (initials on brand colour) + name + optional subtitle. */
export function CompanyCell({
  name,
  initials,
  color,
  subtitle,
  href,
  className,
}: {
  name: string
  /** Makes the name a link (e.g. to the company detail page). */
  href?: string
  initials: string
  color: string
  subtitle?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ backgroundColor: color }} aria-hidden>
        {initials}
      </span>
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="block truncate font-medium hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {name}
          </Link>
        ) : (
          <div className="truncate font-medium">{name}</div>
        )}
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
    </div>
  )
}
