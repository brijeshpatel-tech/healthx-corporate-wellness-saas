import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Title row at the top of every page: title, description, actions, optional back link. */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel = "Back",
  badge,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  badge?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {backHref ? (
          <Button asChild variant="link" size="sm" className="-ml-1 h-auto px-1 text-muted-foreground hover:text-foreground">
            <Link href={backHref}>
              <ArrowLeft data-icon="inline-start" />
              {backLabel}
            </Link>
          </Button>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Standard page body spacing. */
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex w-full flex-col gap-6 p-4 sm:p-6 lg:p-8", className)}>{children}</div>
}
