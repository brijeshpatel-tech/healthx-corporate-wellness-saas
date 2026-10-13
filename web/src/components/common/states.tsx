"use client"

import type { LucideIcon } from "lucide-react"
import { AlertTriangle, Inbox, RefreshCw, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { errorMessage } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={cn("border border-dashed bg-card/50 py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <Empty className={cn("border border-dashed border-destructive/30 bg-destructive/5 py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyTitle>Couldn&apos;t load this</EmptyTitle>
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

export function AccessDenied({ homeHref, message }: { homeHref: string; message?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon={ShieldAlert}
        title="You don't have access to this page"
        description={message ?? "Your role doesn't include this area. If you think this is a mistake, contact your administrator."}
        action={
          <Button asChild>
            <Link href={homeHref}>Go to dashboard</Link>
          </Button>
        }
        className="max-w-lg"
      />
    </div>
  )
}

/** Generic page skeleton: header + KPI row + two panels. */
export function PageSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {kpis > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card className="py-0">
      <CardContent className="divide-y p-0">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((__, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "w-48" : "w-24 flex-1")} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Renders loading / error / data for a React Query result.
 *   <QueryState query={q} loading={<TableSkeleton />}>{(data) => <Table data={data} />}</QueryState>
 */
export function QueryState<T>({
  query,
  loading,
  children,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown }
  loading?: React.ReactNode
  children: (data: T) => React.ReactNode
}) {
  if (query.isLoading) return <>{loading ?? <PageSkeleton />}</>
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data === undefined) return null
  return <>{children(query.data)}</>
}
