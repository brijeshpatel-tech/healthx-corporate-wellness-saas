"use client"

import { CheckCircle2, CircleMinus, ExternalLink, TriangleAlert, XCircle } from "lucide-react"
import { Sparkline } from "@/components/common/charts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { HealthStatus, ServiceHealth } from "@/lib/api/platform/health"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS: Record<HealthStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  operational: { label: "Operational", icon: CheckCircle2, className: "text-emerald-700 dark:text-emerald-400" },
  degraded: { label: "Degraded", icon: TriangleAlert, className: "text-amber-700 dark:text-amber-400" },
  outage: { label: "Outage", icon: XCircle, className: "text-rose-700 dark:text-rose-400" },
  disabled: { label: "Disabled", icon: CircleMinus, className: "text-muted-foreground" },
}

/** Status shown as icon + label (never colour alone). */
export function HealthStatusLabel({ status, className }: { status: HealthStatus; className?: string }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap", s.className, className)}>
      <Icon className="size-4" />
      {s.label}
    </span>
  )
}

export function ServiceTile({ service: s }: { service: ServiceHealth }) {
  return (
    <Card className={cn("gap-0 py-0", s.status === "degraded" && "ring-1 ring-amber-500/40", s.status === "outage" && "ring-1 ring-rose-500/40")}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium">{s.name}</div>
            <div className="truncate text-xs text-muted-foreground" title={s.description}>
              {s.description}
            </div>
          </div>
          <HealthStatusLabel status={s.status} />
        </div>
        <div className="flex items-end justify-between gap-3">
          <dl className="grid grid-cols-2 gap-x-4 text-xs whitespace-nowrap">
            <dt className="text-muted-foreground">30d uptime</dt>
            <dt className="text-muted-foreground">Latency</dt>
            <dd className="font-heading text-base font-semibold tabular-nums">{formatNumber(s.uptime30d, 2)}%</dd>
            <dd className="font-heading text-base font-semibold tabular-nums">{formatNumber(s.latencyMs)} ms</dd>
          </dl>
          <div className="w-20 min-w-0 shrink" title="Latency, last 24 hours">
            <Sparkline values={s.latency24h} height={32} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** External monitoring link — disabled in demo mode with an explanation. */
export function MonitoringLink({ label, url, size = "default" }: { label: string; url: string; size?: "default" | "sm" | "xs" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-lg" aria-label={`Open in ${label} (not available in demo)`}>
          <Button variant="outline" size={size} disabled data-url={url} className="pointer-events-none">
            {label} <ExternalLink data-icon="inline-end" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Monitoring tools aren&apos;t connected in this demo.</TooltipContent>
    </Tooltip>
  )
}
