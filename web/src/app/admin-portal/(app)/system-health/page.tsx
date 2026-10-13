"use client"

import { CheckCircle2, RefreshCw, TriangleAlert, XCircle } from "lucide-react"
import { HealthStatusLabel, MonitoringLink, ServiceTile } from "@/components/admin/platform/health-status"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useApiQuery } from "@/lib/api/hooks"
import { healthApi, type QueueHealth, type RecentError } from "@/lib/api/platform/health"
import { formatNumber, formatPercent, formatRelative, formatTime, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

const waitLabel = (sec: number) => (sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${formatNumber(sec / 3600, 1)} h`)

/** SCR-P-029 System health (Phase 2). */
export default function SystemHealthPage() {
  const health = useApiQuery(["admin", "system-health"], () => healthApi.get(), { refetchInterval: 60_000 })
  const data = health.data
  const issues = data ? data.integrations.filter((i) => i.status === "degraded" || i.status === "outage").length + data.queues.filter((q) => q.status !== "operational").length : 0

  const queueColumns: Column<QueueHealth>[] = [
    {
      key: "name",
      header: "Queue",
      cell: (q) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{q.name}</div>
          <div className="text-xs text-muted-foreground">{pluralize(q.workers, "worker")}</div>
        </div>
      ),
    },
    { key: "depth", header: "Waiting", align: "right", cell: (q) => <span className="tabular-nums">{formatNumber(q.depth)}</span> },
    { key: "rate", header: "Per min", align: "right", cell: (q) => <span className="tabular-nums">{formatNumber(q.processingPerMin)}</span>, hideOnMobile: true },
    { key: "oldest", header: "Oldest", align: "right", cell: (q) => <span className="tabular-nums whitespace-nowrap">{waitLabel(q.oldestWaitSec)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", align: "right", cell: (q) => <HealthStatusLabel status={q.status} /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="System health"
        badge={<PhaseBadge phase={2} />}
        description="Status of services, background queues and integrations, plus recent errors from the monitoring tools."
        actions={
          <>
            {data ? <span className="text-xs text-muted-foreground">Last checked {formatTime(data.checkedAt)}</span> : null}
            <Button variant="outline" onClick={() => health.refetch()} disabled={health.isFetching}>
              <RefreshCw data-icon="inline-start" className={cn(health.isFetching && "animate-spin")} />
              Refresh
            </Button>
          </>
        }
      />

      {health.isLoading ? (
        <PageSkeleton kpis={4} />
      ) : health.error || !data ? (
        <ErrorState error={new Error("Health data unavailable. The monitoring service didn't respond — try again in a moment.")} onRetry={() => health.refetch()} />
      ) : (
        <div className={cn("flex flex-col gap-6 transition-opacity", health.isFetching && "opacity-80")}>
          <Alert
            className={cn(
              data.overall === "operational" && "border-emerald-500/30 bg-emerald-500/8 text-emerald-900 dark:text-emerald-200",
              data.overall === "degraded" && "border-amber-500/40 bg-amber-500/8 text-amber-900 dark:text-amber-200",
              data.overall === "outage" && "border-rose-500/40 bg-rose-500/8 text-rose-900 dark:text-rose-200",
            )}
          >
            {data.overall === "operational" ? <CheckCircle2 /> : data.overall === "degraded" ? <TriangleAlert /> : <XCircle />}
            <AlertTitle>{data.summary}</AlertTitle>
            <AlertDescription className="text-current/80">
              {issues ? `${issues} ${issues === 1 ? "integration or queue needs" : "integrations or queues need"} attention — see below.` : "No open incidents. Integrations and queues are healthy."}
            </AlertDescription>
          </Alert>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-semibold">Services</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.services.map((s) => (
                <ServiceTile key={s.id} service={s} />
              ))}
            </div>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <SectionCard title="Integrations" description="Health-data sources, messaging apps and HR systems.">
              <ul className="-my-2 divide-y">
                {data.integrations.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{i.name}</span>
                        <span className="text-xs text-muted-foreground">{i.kind}</span>
                        {i.phase ? <PhaseBadge phase={2} /> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(i.connected)} {i.connectedLabel}
                        {i.successRate !== null ? ` · ${formatPercent(i.successRate, 1)} sync success` : ""}
                        {i.lastSyncAt ? ` · last sync ${formatRelative(i.lastSyncAt)}` : ""}
                      </div>
                      {i.note ? <div className={cn("text-xs", i.status === "degraded" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{i.note}</div> : null}
                    </div>
                    <HealthStatusLabel status={i.status} />
                  </li>
                ))}
              </ul>
            </SectionCard>

            <DataTable columns={queueColumns} rows={data.queues} getRowId={(q) => q.id} dense toolbar={<span className="text-sm font-semibold">Job queues</span>} />
          </div>

          <SectionCard
            title="Recent errors"
            description="Grouped issues from the last 7 days (Sentry / CloudWatch)."
            actions={
              <div className="hidden flex-wrap gap-2 sm:flex">
                {data.monitoring.map((m) => (
                  <MonitoringLink key={m.label} label={m.label} url={m.url} size="sm" />
                ))}
              </div>
            }
          >
            {data.errors.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No errors reported recently.</p>
            ) : (
              <ul className="-my-2 divide-y">
                {data.errors.map((e) => (
                  <ErrorRow key={e.id} error={e} />
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2 sm:hidden">
              {data.monitoring.map((m) => (
                <MonitoringLink key={m.label} label={m.label} url={m.url} size="sm" />
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  )
}

function ErrorRow({ error: e }: { error: RecentError }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:gap-4">
      <StatusBadge status={e.level === "fatal" ? "critical" : e.level} label={e.level === "fatal" ? "Fatal" : e.level === "error" ? "Error" : "Warning"} className="w-fit" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs leading-relaxed break-words">{e.message}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {e.service} · first seen {formatRelative(e.firstSeen)}
          {e.usersAffected ? ` · ${pluralize(e.usersAffected, "user")} affected` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-4 text-xs sm:flex-col sm:items-end sm:gap-0.5">
        <span className="font-semibold tabular-nums">{pluralize(e.count, "event")}</span>
        <span className="text-muted-foreground">Last seen {formatRelative(e.lastSeen)}</span>
      </div>
    </li>
  )
}
