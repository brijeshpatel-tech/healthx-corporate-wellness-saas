"use client"

import type { LucideIcon } from "lucide-react"
import { Activity, AlertCircle, Check, Eye, HeartPulse, Link2, Mountain, RefreshCw, ShieldCheck, Unlink, Watch, Zap } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog, PrivacyNote } from "@/components/common/misc"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { privacyApi, type ConnectionRow, type ConnectionsOverview } from "@/lib/api/employee/privacy"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatRelative } from "@/lib/format"
import type { HealthProvider } from "@/lib/types"
import { cn } from "@/lib/utils"

const LOGO: Record<HealthProvider, { icon: LucideIcon; gradient: string }> = {
  apple_health: { icon: HeartPulse, gradient: "from-rose-500 to-pink-500" },
  health_connect: { icon: Activity, gradient: "from-sky-500 to-emerald-500" },
  fitbit: { icon: Watch, gradient: "from-teal-400 to-cyan-600" },
  garmin: { icon: Mountain, gradient: "from-slate-500 to-slate-800" },
}

/** Fitbit and Garmin connect through the provider's own sign-in (OAuth). */
const OAUTH: Partial<Record<HealthProvider, string>> = { fitbit: "Fitbit", garmin: "Garmin Connect" }

const STATUS: Record<ConnectionRow["status"], { status: string; label: string; tone?: "gray" | "amber" }> = {
  not_connected: { status: "inactive", label: "Not connected", tone: "gray" },
  connected: { status: "connected", label: "Connected" },
  error: { status: "error", label: "Sync error" },
  disconnected: { status: "disconnected", label: "Disconnected", tone: "amber" },
}

/** SCR-M-076 Connected Apps & Devices. */
export default function ConnectedAppsPage() {
  const q = useApiQuery(["employee", "privacy", "connections"], () => privacyApi.connections())
  return (
    <EngagePage size="narrow" title="Connected apps & devices" description="Sync steps, workouts and sleep automatically — no manual logging." backHref="/employee-app/settings" backLabel="Settings">
      {q.error ? (
        <LoadError title="Couldn't load your connected apps." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <Connections data={q.data} />
      )}
    </EngagePage>
  )
}

function Connections({ data }: { data: ConnectionsOverview }) {
  const [connecting, setConnecting] = useState<ConnectionRow | null>(null)
  const [disconnecting, setDisconnecting] = useState<ConnectionRow | null>(null)

  const connect = useApiMutation(privacyApi.connect, {
    errorTitle: "Couldn't connect",
    onSuccess: (row) => {
      setConnecting(null)
      toast.success("Connected", { description: `We'll sync your ${row.name} data automatically.` })
    },
  })
  const sync = useApiMutation(privacyApi.sync, { success: (row) => `${row.name} synced just now.`, errorTitle: "Sync failed – tap to reconnect." })
  const disconnect = useApiMutation(privacyApi.disconnect, { success: "Disconnected – we've stopped syncing.", errorTitle: "Couldn't disconnect" })

  const phones = data.rows.filter((r) => !r.phase)
  const wearables = data.rows.filter((r) => r.phase)

  return (
    <>
      {!data.anyConnected ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 text-white shadow-md shadow-sky-500/20">
            <Link2 className="size-7" />
          </span>
          <div className="space-y-1">
            <p className="font-heading text-base font-semibold">No apps connected</p>
            <p className="max-w-sm text-sm text-muted-foreground">No apps connected. Connect Apple Health / Health Connect to track steps automatically.</p>
          </div>
        </div>
      ) : null}

      <section className="space-y-3" aria-label="Phone health apps">
        {phones.map((row) => (
          <ConnectionCard
            key={row.provider}
            row={row}
            syncing={sync.isPending && sync.variables?.provider === row.provider}
            reconnecting={connect.isPending && connect.variables?.provider === row.provider}
            onConnect={() => setConnecting(row)}
            onReconnect={() => connect.mutate({ provider: row.provider })}
            onSync={() => sync.mutate({ provider: row.provider })}
            onDisconnect={() => setDisconnecting(row)}
          />
        ))}
      </section>

      {wearables.length ? (
        <section className="space-y-3" aria-label="Wearable accounts">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Wearable accounts <PhaseBadge phase={2} />
          </h2>
          {wearables.map((row) => (
            <ConnectionCard
              key={row.provider}
              row={row}
              syncing={sync.isPending && sync.variables?.provider === row.provider}
              reconnecting={connect.isPending && connect.variables?.provider === row.provider}
              onConnect={() => setConnecting(row)}
              onReconnect={() => connect.mutate({ provider: row.provider })}
              onSync={() => sync.mutate({ provider: row.provider })}
              onDisconnect={() => setDisconnecting(row)}
            />
          ))}
        </section>
      ) : null}

      <PrivacyNote minGroupSize={data.minGroupSize}>
        HR and your manager never see data from your connected apps. Your company only sees combined figures for groups of {data.minGroupSize} or more people. HealthX only reads data — it never writes to your health apps.
      </PrivacyNote>

      {connecting ? (
        <ConnectDialog
          row={connecting}
          wearableConsent={data.wearableConsent}
          minGroupSize={data.minGroupSize}
          pending={connect.isPending}
          onCancel={() => setConnecting(null)}
          onConfirm={() => connect.mutate({ provider: connecting.provider })}
        />
      ) : null}

      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={`Disconnect ${disconnecting?.name ?? ""}?`}
        description="We'll stop syncing straight away. Steps and workouts that already synced stay in your history, but new activity won't count toward your goals, challenges or points until you reconnect."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => disconnecting && disconnect.mutate({ provider: disconnecting.provider })}
      />
    </>
  )
}

function ProviderLogo({ provider }: { provider: HealthProvider }) {
  const logo = LOGO[provider]
  return (
    <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm", logo.gradient)}>
      <logo.icon className="size-6" />
    </span>
  )
}

function ConnectionCard({
  row,
  syncing,
  reconnecting,
  onConnect,
  onReconnect,
  onSync,
  onDisconnect,
}: {
  row: ConnectionRow
  syncing: boolean
  reconnecting: boolean
  onConnect: () => void
  onReconnect: () => void
  onSync: () => void
  onDisconnect: () => void
}) {
  const s = STATUS[row.status]
  return (
    <article className={cn("space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5", row.status === "connected" && "border-emerald-500/30", row.status === "error" && "border-destructive/40")}>
      <div className="flex items-start gap-3">
        <ProviderLogo provider={row.provider} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              {row.name}
              {row.phase ? <PhaseBadge phase={row.phase} /> : null}
            </h2>
            <StatusBadge status={s.status} label={s.label} tone={s.tone} />
          </div>
          <p className="text-sm text-muted-foreground">{row.platform}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {row.dataTypes.map((t) => (
          <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {t}
          </span>
        ))}
      </div>

      {row.status === "error" ? (
        <button type="button" onClick={onReconnect} className="flex w-full items-center gap-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-left text-sm font-medium text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          Sync failed – tap to reconnect.
        </button>
      ) : null}

      {row.status === "connected" || row.status === "error" || row.status === "disconnected" ? (
        <p className="text-xs text-muted-foreground">
          {row.status === "disconnected"
            ? `Disconnected ${formatRelative(row.disconnectedAt)}${row.lastSyncAt ? ` · Last synced ${formatDate(row.lastSyncAt)}` : ""}`
            : `Last synced ${formatRelative(row.lastSyncAt)}${row.connectedAt ? ` · Connected since ${formatDate(row.connectedAt)}` : ""}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{row.description}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end [&>button]:h-11 [&>button]:rounded-xl">
        {row.status === "connected" ? (
          <>
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDisconnect} disabled={syncing}>
              <Unlink data-icon="inline-start" />
              Disconnect
            </Button>
            <Button variant="outline" onClick={onSync} disabled={syncing}>
              {syncing ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
              Sync now
            </Button>
          </>
        ) : row.status === "error" ? (
          <>
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDisconnect} disabled={reconnecting}>
              <Unlink data-icon="inline-start" />
              Disconnect
            </Button>
            <Button onClick={onReconnect} disabled={reconnecting}>
              {reconnecting ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
              Reconnect
            </Button>
          </>
        ) : (
          <Button onClick={onConnect}>
            <Link2 data-icon="inline-start" />
            {row.status === "disconnected" ? "Reconnect" : "Connect"}
          </Button>
        )}
      </div>
    </article>
  )
}

function ConnectDialog({
  row,
  wearableConsent,
  minGroupSize,
  pending,
  onCancel,
  onConfirm,
}: {
  row: ConnectionRow
  wearableConsent: boolean
  minGroupSize: number
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <ProviderLogo provider={row.provider} />
          <DialogTitle className="font-heading text-lg">Connect {row.name}</DialogTitle>
          <DialogDescription>
            {OAUTH[row.provider] ? `You'll sign in to ${OAUTH[row.provider]} to give HealthX read-only access. ` : ""}Here&apos;s exactly what HealthX will do with your data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-semibold">We&apos;ll ask to read</p>
            <ul className="grid grid-cols-2 gap-2">
              {row.dataTypes.map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs font-medium">
                  <Check className="size-3.5 text-primary" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <Reason icon={Zap} title="Why">
            To count your activity toward your goals, challenges and points automatically.
          </Reason>
          <Reason icon={Eye} title="Who can see it">
            Only you. HR and your manager never see your individual data — just combined figures for groups of {minGroupSize}+.
          </Reason>
          <Reason icon={ShieldCheck} title="Your control">
            HealthX only reads data, never writes it. Disconnect any time from this screen.
          </Reason>
          {!wearableConsent ? (
            <p className="rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-xs text-sky-900 dark:text-sky-200">
              Connecting also turns on the &ldquo;Health app &amp; wearable connection&rdquo; consent. You can change it in Privacy &amp; consent.
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={onCancel} disabled={pending}>
            Not now
          </Button>
          <Button className="h-11 rounded-xl" onClick={onConfirm} disabled={pending}>
            {pending ? <Spinner /> : null}
            {OAUTH[row.provider] ? `Continue to ${row.name}` : "Allow & connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Reason({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
