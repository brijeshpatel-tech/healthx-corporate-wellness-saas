"use client"

import { ArrowRight, CheckCircle2, Hash, Link2, MessageSquareShare, Plug, RefreshCw, Send, Settings2, ShieldCheck, Unplug, Users, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { integrationsApi, MESSAGE_TYPES, type HrmsConfig, type HrmsRun, type MessagingIntegration } from "@/lib/api/business/integrations"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const HRMS_STATUS: Record<HrmsConfig["status"], { label: string; status: string }> = {
  not_configured: { label: "Not set up", status: "disconnected" },
  draft: { label: "Draft — not active", status: "draft" },
  active: { label: "Syncing", status: "active" },
  paused: { label: "Paused", status: "paused" },
  error: { label: "Error", status: "error" },
}
const METHOD_LABEL = { api: "REST API", csv: "Scheduled CSV", sftp: "SFTP", webhook: "Webhook" } as const

/** SCR-B-036 — Integrations (Phase 2). */
export default function IntegrationsPage() {
  const q = useApiQuery(["business", "integrations"], () => integrationsApi.overview())
  return (
    <PageContainer>
      <PageHeader title="Integrations" badge={<PhaseBadge phase={2} />} description="Keep people data in sync with your HR system and share wellness moments in Slack or Microsoft Teams." />
      {q.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          {!q.data!.messaging.some((m) => m.status === "connected") && q.data!.hrms.config.status === "not_configured" ? (
            <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">No integrations connected. Start with your HR system so new joiners and leavers are handled automatically.</div>
          ) : null}
          <HrmsCard config={q.data!.hrms.config} lastRun={q.data!.hrms.lastRun} />
          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-base font-semibold">Messaging</h2>
              <p className="text-sm text-muted-foreground">Posts only include people who allowed sharing. No health data is ever posted.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {q.data!.messaging.map((m) => (
                <MessagingCard key={m.id} integration={m} />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-semibold">Single sign-on</h2>
              <PhaseBadge phase={3} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {q.data!.sso.map((s) => (
                <Card key={s.id} className="gap-0 bg-muted/30 py-0">
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <ShieldCheck className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{s.name}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  )
}

function HrmsCard({ config, lastRun }: { config: HrmsConfig; lastRun?: HrmsRun }) {
  const sync = useApiMutation(integrationsApi.syncHrms, { success: (r) => `Sync completed: ${r.added} added, ${r.updated} updated, ${r.deactivated} deactivated.` })
  const s = HRMS_STATUS[config.status]
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" /> HR system (HRMS)
        </span>
      }
      description="Synchronise employees, departments, managers and employment status."
      actions={<StatusBadge status={s.status} label={s.label} />}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="System" value={config.status === "not_configured" ? "—" : config.system} />
          <Fact label="Method" value={config.status === "not_configured" ? "—" : METHOD_LABEL[config.method]} />
          <Fact label="Last sync" value={config.lastSyncAt ? formatRelative(config.lastSyncAt) : "Never"} />
          <Fact label="Next sync" value={config.status === "active" ? (config.nextSyncAt ? formatDateTime(config.nextSyncAt) : "On each event") : "—"} />
        </div>
        <div className="flex flex-wrap gap-2">
          {config.status === "active" ? (
            <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />}
              Sync now
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/business-portal/settings/integrations/hrms">
              {config.status === "not_configured" ? <Plug data-icon="inline-start" /> : <Settings2 data-icon="inline-start" />}
              {config.status === "not_configured" ? "Set up" : "Configure"}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
      {lastRun ? (
        <div className={cn("mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5 text-sm", lastRun.status === "failed" ? "border-destructive/30 bg-destructive/5" : lastRun.status === "partial" ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/30")}>
          {lastRun.status === "failed" ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className={cn("size-4", lastRun.status === "partial" ? "text-amber-600" : "text-emerald-600")} />}
          <span className="font-medium">Last run {formatRelative(lastRun.startedAt)}</span>
          <span className="text-muted-foreground">
            {lastRun.added} added · {lastRun.updated} updated · {lastRun.deactivated} deactivated
          </span>
          {lastRun.errors.length ? <span className="text-amber-700 dark:text-amber-400">{lastRun.errors[0]!.message}</span> : null}
        </div>
      ) : null}
    </SectionCard>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

const BRAND: Record<MessagingIntegration["provider"], { color: string; mark: string }> = {
  slack: { color: "#4A154B", mark: "S" },
  microsoft_teams: { color: "#5B5FC7", mark: "T" },
}

function MessagingCard({ integration: i }: { integration: MessagingIntegration }) {
  const [configOpen, setConfigOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const connect = useApiMutation(integrationsApi.connect, { success: (r) => `${r.name} connected — choose a channel to start posting.`, onSuccess: () => setConfigOpen(true) })
  const test = useApiMutation(integrationsApi.sendTest, { success: (r) => r.message, invalidate: false })
  const disconnect = useApiMutation(integrationsApi.disconnect, { success: `${i.name} disconnected.` })
  const connected = i.status === "connected"
  const b = BRAND[i.provider]
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-extrabold text-white" style={{ backgroundColor: b.color }}>
            {b.mark}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{i.name}</p>
              <StatusBadge status={i.status === "error" ? "error" : connected ? (i.enabled ? "active" : "connected") : "disconnected"} label={connected ? (i.enabled ? "Posting" : "Connected · off") : undefined} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>
          </div>
        </div>
        {i.lastError ? <p className="rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">{i.lastError}</p> : null}
        {connected ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" />
              {i.channel ? <span className="font-medium">{i.channel}</span> : <span className="text-amber-700 dark:text-amber-400">No channel chosen</span>}
              {i.workspace ? <span className="text-muted-foreground">· {i.workspace}</span> : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {i.messageTypes.map((t) => (
                <Badge key={t} variant="secondary">
                  {MESSAGE_TYPES.find((m) => m.value === t)?.label ?? t}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Connected {i.connectedAt ? formatRelative(i.connectedAt) : ""}
              {i.lastMessageAt ? ` · last post ${formatRelative(i.lastMessageAt)}` : ""}
            </p>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button size="sm" onClick={() => setConfigOpen(true)}>
                <Settings2 data-icon="inline-start" /> Configure
              </Button>
              <Button size="sm" variant="outline" onClick={() => test.mutate({ id: i.id })} disabled={test.isPending || !i.channel}>
                {test.isPending ? <Spinner /> : <Send data-icon="inline-start" />} Test message
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDisconnectOpen(true)}>
                <Unplug data-icon="inline-start" /> Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => connect.mutate({ provider: i.provider })} disabled={connect.isPending}>
              {connect.isPending ? <Spinner /> : <Link2 data-icon="inline-start" />}
              {i.status === "error" ? "Reconnect" : `Connect ${i.name}`}
            </Button>
          )}
        </div>
      </CardContent>
      <MessagingDialog integration={i} open={configOpen} onOpenChange={setConfigOpen} />
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        destructive
        title={`Disconnect ${i.name}?`}
        description="HealthX will stop posting to your channel. You can reconnect at any time."
        confirmLabel="Disconnect"
        onConfirm={() => disconnect.mutate({ id: i.id })}
      />
    </Card>
  )
}

function MessagingDialog({ integration: i, open, onOpenChange }: { integration: MessagingIntegration; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [channel, setChannel] = useState(i.channel ?? "")
  const [types, setTypes] = useState<string[]>(i.messageTypes)
  const [enabled, setEnabled] = useState(i.enabled)
  const [error, setError] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setChannel(i.channel ?? "")
      setTypes(i.messageTypes)
      setEnabled(i.enabled || !i.channel)
      setError({})
    }
  }
  const save = useApiMutation(integrationsApi.update, { success: `${i.name} settings saved.`, onSuccess: () => onOpenChange(false), onError: (e) => setError(e.fieldErrors ?? { form: e.message }) })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <MessageSquareShare className="size-4" /> {i.name} posts
          </DialogTitle>
          <DialogDescription>Choose where HealthX posts and what it shares.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel" className="text-sm font-medium">
              Channel<span className="text-destructive">*</span>
            </Label>
            <Input id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder={i.provider === "slack" ? "#wellness" : "Wellness"} className="h-9" aria-invalid={!!error.channel} />
            {error.channel ? <p className="text-xs font-medium text-destructive">{error.channel}</p> : <p className="text-xs text-muted-foreground">Invite the HealthX app to this channel first.</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Message types</Label>
            {MESSAGE_TYPES.map((m) => (
              <Label key={m.value} htmlFor={`mt-${m.value}`} className="flex items-center gap-2.5 text-sm font-normal">
                <Checkbox id={`mt-${m.value}`} checked={types.includes(m.value)} onCheckedChange={(v) => setTypes((t) => (v ? [...t, m.value] : t.filter((x) => x !== m.value)))} />
                {m.label}
              </Label>
            ))}
            {error.messageTypes ? <p className="text-xs font-medium text-destructive">{error.messageTypes}</p> : null}
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label htmlFor="enabled" className="text-sm font-medium">
                Posting enabled
              </Label>
              <p className="text-xs text-muted-foreground">Turn off to pause posts without disconnecting.</p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {error.form ? <p className="text-xs font-medium text-destructive">{error.form}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate({ id: i.id, channel, messageTypes: types, enabled })} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
