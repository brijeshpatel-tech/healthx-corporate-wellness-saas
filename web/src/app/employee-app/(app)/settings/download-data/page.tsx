"use client"

import type { LucideIcon } from "lucide-react"
import { Activity, CalendarClock, CheckCircle2, Coins, Download, Droplets, Dumbbell, FileJson, Hourglass, ShieldCheck, UserRound } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { PhaseBadge } from "@/components/common/status-badge"
import { EngagePage, IconTile, LoadError, type Tone } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { privacyApi, type DataExport, type DataExportOverview } from "@/lib/api/employee/privacy"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { formatDate, formatDateTime } from "@/lib/format"

const INCLUDED_UI: Record<string, { icon: LucideIcon; tone: Tone }> = {
  profile: { icon: UserRound, tone: "sky" },
  activity: { icon: Activity, tone: "emerald" },
  water_sleep: { icon: Droplets, tone: "cyan" },
  workouts_habits: { icon: Dumbbell, tone: "violet" },
  points: { icon: Coins, tone: "amber" },
  consents: { icon: ShieldCheck, tone: "teal" },
}

/** SCR-M-077 Download My Data (Phase 2). */
export default function DownloadDataPage() {
  const q = useApiQuery(["employee", "privacy", "data-exports"], () => privacyApi.dataExports(), {
    // Poll while the file is being prepared so the status flips to "Ready" by itself.
    refetchInterval: (query) => (query.state.data?.current?.status === "preparing" ? 2000 : false),
  })
  return (
    <EngagePage
      size="narrow"
      title="Download my data"
      badge={<PhaseBadge phase={2} />}
      description="Get a copy of the personal data HealthX holds about you."
      backHref="/employee-app/settings/privacy"
      backLabel="Privacy & consent"
    >
      {q.error ? (
        <LoadError title="Couldn't load your data requests." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <Content data={q.data} />
      )}
    </EngagePage>
  )
}

function Content({ data }: { data: DataExportOverview }) {
  const current = data.current
  return (
    <>
      <StatusCard current={current} validDays={data.linkValidDays} />

      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div>
          <h2 className="font-heading text-base font-semibold">What&apos;s included</h2>
          <p className="text-sm text-muted-foreground">One file in JSON format — readable by most apps and easy to move to another service.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.included.map((item) => {
            const ui = INCLUDED_UI[item.key] ?? { icon: FileJson, tone: "slate" as Tone }
            return (
              <li key={item.key} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
                <IconTile icon={ui.icon} tone={ui.tone} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
        <ul className="space-y-1.5 border-t pt-4 text-xs text-muted-foreground">
          <li>• Only you can request your data, and you can have one active request at a time.</li>
          <li>• We&apos;ll notify you when the file is ready. The download link is valid for {data.linkValidDays} days.</li>
          <li>• Your company never receives a copy of this file.</li>
        </ul>
      </section>
    </>
  )
}

function StatusCard({ current, validDays }: { current: DataExport | null; validDays: number }) {
  const [downloading, setDownloading] = useState(false)
  const request = useApiMutation(privacyApi.requestDataExport, {
    success: "Request received — we're preparing your file.",
    errorTitle: "Couldn't create your export. Please try again later.",
  })

  const download = async (exp: DataExport) => {
    setDownloading(true)
    try {
      const payload = await privacyApi.downloadDataExport({ id: exp.id })
      downloadText(exp.fileName, JSON.stringify(payload, null, 2), "application/json;charset=utf-8")
      toast.success("Your data is downloading.")
    } catch (err) {
      toast.error("Couldn't download your file", { description: errorMessage(err) })
    } finally {
      setDownloading(false)
    }
  }

  if (current?.status === "preparing") {
    return (
      <section className="space-y-4 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-transparent p-5" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-sm">
            <Hourglass className="size-5 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold">Preparing your file…</p>
            <p className="text-sm text-muted-foreground">Requested {formatDateTime(current.requestedAt)}. We&apos;ll notify you when it&apos;s ready — you can leave this screen.</p>
          </div>
        </div>
        <Progress value={Math.round(current.progress * 100)} className="h-2 [&>div]:bg-sky-500" aria-label="Export progress" />
      </section>
    )
  }

  if (current?.status === "ready") {
    return (
      <section className="space-y-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/12 to-transparent p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold">Your data is ready to download.</p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="size-4 shrink-0" /> Link expires on {formatDateTime(current.expiresAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <FileJson className="size-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{current.fileName}</p>
            <p className="text-xs text-muted-foreground">JSON · prepared {formatDate(current.readyAt)}</p>
          </div>
        </div>
        <Button className="h-11 w-full rounded-xl sm:w-auto" onClick={() => void download(current)} disabled={downloading}>
          {downloading ? <Spinner /> : <Download data-icon="inline-start" />}
          Download
        </Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-5 sm:flex-row sm:items-center">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
        <FileJson className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-base font-semibold">{current?.status === "expired" ? "Your last download link has expired" : "Request a copy of your data"}</p>
        <p className="text-sm text-muted-foreground">
          {current?.status === "expired"
            ? `It expired on ${formatDate(current.expiresAt)}. Request a new copy any time.`
            : `It usually takes a few minutes. The link stays valid for ${validDays} days.`}
        </p>
      </div>
      <Button className="h-11 w-full rounded-xl sm:w-auto" onClick={() => request.mutate()} disabled={request.isPending}>
        {request.isPending ? <Spinner /> : <Download data-icon="inline-start" />}
        Request my data
      </Button>
    </section>
  )
}
