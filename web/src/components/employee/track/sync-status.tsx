"use client"

/** "Sync now" button + sync status (#346): connected, syncing, failed (retry), stale (>24 h), not connected. */
import { AlertTriangle, ChevronRight, RefreshCw, Watch } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { activityApi, type SyncStatus } from "@/lib/api/employee/activity"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber, formatRelative, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const CONNECT_HREF = "/employee-app/settings/connected-apps"

const lastSyncText = (iso?: string) => {
  if (!iso) return "Never synced"
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return `Last synced ${today ? formatTime(iso) : formatRelative(iso)}`
}

export function SyncStatusBar({ status, variant = "full", className }: { status: SyncStatus; variant?: "full" | "compact"; className?: string }) {
  const sync = useApiMutation(activityApi.sync, {
    errorTitle: "We couldn't sync your steps",
    onSuccess: (r) => {
      toast.success("Steps updated", { description: r.newSteps ? `+${formatNumber(r.newSteps)} steps from ${r.provider?.label ?? "your health app"}` : "You're up to date." })
      if (r.bonusPoints) toast.success(`Personal goal reached! +${r.bonusPoints} points 🎉`)
    },
  })
  const compact = variant === "compact"

  if (!status.connected)
    return (
      <Link
        href={CONNECT_HREF}
        className={cn("flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/8 transition-colors hover:bg-sky-500/12", compact ? "px-3 py-2" : "p-3", className)}
      >
        <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white", compact ? "size-7" : "size-9")}>
          <Watch className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Connect Apple Health / Health Connect</p>
          {!compact ? <p className="text-xs text-muted-foreground">Sync steps automatically — or log an activity by hand.</p> : null}
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    )

  const failed = sync.isError && !sync.isPending
  const stale = status.stale && !sync.isSuccess
  const lastSync = sync.data?.lastSyncAt ?? status.lastSyncAt

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-xl",
        compact ? "px-3 py-1.5" : "px-3 py-2",
        failed ? "border border-destructive/30 bg-destructive/5" : stale ? "border border-amber-500/30 bg-amber-500/8" : "bg-muted/40",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className={cn("flex min-w-0 items-center gap-1.5 text-xs", failed ? "text-destructive" : stale ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground")}>
        {failed || stale ? <AlertTriangle className="size-3.5 shrink-0" /> : <Watch className="size-3.5 shrink-0" />}
        <span className="truncate">
          {sync.isPending
            ? `Syncing with ${status.provider?.label}…`
            : failed
              ? `We couldn't sync your steps. ${lastSyncText(lastSync)}.`
              : stale
                ? `${status.provider?.label} · ${lastSyncText(lastSync)} — steps may be out of date`
                : `${status.provider?.label} · ${lastSyncText(lastSync)}`}
        </span>
      </p>
      <Button size="sm" variant={failed || stale ? "outline" : "ghost"} className="h-8 shrink-0" onClick={() => sync.mutate()} disabled={sync.isPending}>
        {sync.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
        {failed ? "Retry" : "Sync now"}
      </Button>
    </div>
  )
}
