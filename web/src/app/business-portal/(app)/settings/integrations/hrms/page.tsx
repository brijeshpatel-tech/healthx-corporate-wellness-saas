"use client"

import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Copy, FileSpreadsheet, KeyRound, Pause, Play, PlugZap, RefreshCw, Save, Server, Webhook, XCircle } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { DataTable, type Column } from "@/components/common/data-table"
import { FieldShell } from "@/components/common/form-fields"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  HRMS_FIELDS,
  HRMS_SYSTEMS,
  integrationsApi,
  REQUIRED_HRMS_FIELDS,
  type HrmsConfig,
  type HrmsField,
  type HrmsMethod,
  type HrmsRun,
  type HrmsSaveInput,
} from "@/lib/api/business/integrations"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime, formatRelative, titleCase } from "@/lib/format"
import { cn } from "@/lib/utils"

const STEPS = ["Method", "Connection", "Field mapping", "Schedule & leavers", "Test & activate"] as const
const METHODS: { value: HrmsMethod; label: string; description: string; icon: typeof Server }[] = [
  { value: "api", label: "REST API", description: "HealthX pulls changes from your HRMS API.", icon: PlugZap },
  { value: "csv", label: "Scheduled CSV", description: "Upload an export on a schedule.", icon: FileSpreadsheet },
  { value: "sftp", label: "SFTP", description: "We pick up files from your SFTP server.", icon: Server },
  { value: "webhook", label: "Webhook", description: "Your HRMS pushes joiner/leaver events.", icon: Webhook },
]
const FIELD_LABEL: Record<HrmsField, string> = {
  employeeId: "Employee ID",
  email: "Work email",
  firstName: "First name",
  lastName: "Last name",
  department: "Department",
  team: "Team",
  manager: "Manager (email)",
  jobTitle: "Job title",
  status: "Employment status",
}
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

type Draft = HrmsSaveInput & { api: NonNullable<HrmsSaveInput["api"]>; sftp: NonNullable<HrmsSaveInput["sftp"]> }

const toDraft = (c: HrmsConfig): Draft => ({
  system: c.system,
  method: c.method,
  api: { baseUrl: c.api.baseUrl, clientId: c.api.clientId, clientSecret: "" },
  sftp: { host: c.sftp.host, port: c.sftp.port, username: c.sftp.username, path: c.sftp.path, password: "" },
  schedule: c.schedule,
  mapping: c.mapping,
  leaverHandling: c.leaverHandling,
  syncDepartments: c.syncDepartments,
})

/** SCR-B-037 — HRMS integration setup (Phase 2). */
export default function HrmsSetupPage() {
  const q = useApiQuery(["business", "hrms"], () => integrationsApi.hrms())
  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/settings/integrations"
        backLabel="Integrations"
        title="HR system sync"
        badge={<PhaseBadge phase={2} />}
        description="Keep employees, departments, managers and leavers in step with your HRMS."
        actions={q.data ? <StatusBadge status={q.data.config.status === "not_configured" ? "disconnected" : q.data.config.status} label={titleCase(q.data.config.status.replace("not_configured", "not set up"))} /> : null}
      />
      {q.isLoading ? <PageSkeleton kpis={0} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Setup config={q.data!.config} runs={q.data!.runs} />}
    </PageContainer>
  )
}

function Setup({ config, runs }: { config: HrmsConfig; runs: HrmsRun[] }) {
  const [step, setStep] = useState(config.status === "not_configured" ? 0 : 4)
  const [draft, setDraft] = useState<Draft>(toDraft(config))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState<string | null>(null)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [source, setSource] = useState(config)
  if (source !== config) {
    setSource(config)
    setDraft(toDraft(config))
  }

  const save = useApiMutation(integrationsApi.saveHrms, { success: "HRMS settings saved.", onSuccess: () => setErrors({}), onError: (e) => setErrors(e.fieldErrors ?? {}) })
  const test = useApiMutation(integrationsApi.testHrms, { success: (r) => r.message })
  const activate = useApiMutation(integrationsApi.activateHrms, { success: "HRMS sync is active." })
  const pause = useApiMutation(integrationsApi.pauseHrms, { success: "HRMS sync paused." })
  const sync = useApiMutation(integrationsApi.syncHrms, { success: (r) => `Sync completed: ${r.added} added, ${r.updated} updated, ${r.deactivated} deactivated.` })
  const rotate = useApiMutation(integrationsApi.rotateWebhookSecret, { onSuccess: (r) => setSecret(r.secret) })

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const err = (k: string) => errors[k]

  /** Light client-side checks per step; the server validates everything on save. */
  const validateStep = (i: number) => {
    const e: Record<string, string> = {}
    if (i === 1 && draft.method === "api") {
      if (!/^https:\/\/\S+\.\S+/.test(draft.api.baseUrl)) e["api.baseUrl"] = "Enter the HTTPS API address"
      if (!draft.api.clientId.trim()) e["api.clientId"] = "Enter the client ID"
      if (!draft.api.clientSecret && !config.api.clientSecretSet) e["api.clientSecret"] = "Enter the client secret"
    }
    if (i === 1 && draft.method === "sftp") {
      if (!draft.sftp.host.trim()) e["sftp.host"] = "Enter the SFTP host"
      if (!draft.sftp.username.trim()) e["sftp.username"] = "Enter the username"
      if (!draft.sftp.password && !config.sftp.passwordSet) e["sftp.password"] = "Enter the password"
      if (!draft.sftp.path.trim()) e["sftp.path"] = "Enter the folder path"
    }
    if (i === 2) for (const f of REQUIRED_HRMS_FIELDS) if (!draft.mapping[f]?.trim()) e[`mapping.${f}`] = "This mapping is mandatory"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const payload = (): HrmsSaveInput => ({
    system: draft.system,
    method: draft.method,
    api: draft.method === "api" ? { ...draft.api, clientSecret: draft.api.clientSecret || undefined } : undefined,
    sftp: draft.method === "sftp" ? { ...draft.sftp, password: draft.sftp.password || undefined } : undefined,
    schedule: draft.schedule,
    mapping: draft.mapping,
    leaverHandling: draft.leaverHandling,
    syncDepartments: draft.syncDepartments,
  })

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.message(text)
    }
  }

  const dirty = JSON.stringify(toDraft(config)) !== JSON.stringify(draft)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Set-up steps">
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1">
            {STEPS.map((label, i) => (
              <li key={label} className="shrink-0">
                <button
                  type="button"
                  onClick={() => (i <= step || validateStep(step) ? setStep(i) : undefined)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted", i === step && "bg-primary/10 font-semibold text-primary hover:bg-primary/10")}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs", i < step && "border-primary bg-primary text-primary-foreground", i === step && "border-primary")}>
                    {i < step ? <CheckCircle2 className="size-3.5" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <SectionCard title={STEPS[step]}>
          {step === 0 ? (
            <div className="space-y-5">
              <FieldShell label="Your HR system" required error={err("system")}>
                <Select value={draft.system} onValueChange={(v) => set({ system: v })}>
                  <SelectTrigger className="h-9 w-full sm:w-72">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {HRMS_SYSTEMS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldShell>
              <FieldShell label="How should HealthX receive updates?">
                <RadioGroup value={draft.method} onValueChange={(v) => set({ method: v as HrmsMethod })} className="grid gap-2 sm:grid-cols-2">
                  {METHODS.map((m) => (
                    <Label key={m.value} htmlFor={`m-${m.value}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem id={`m-${m.value}`} value={m.value} className="mt-0.5" />
                      <m.icon className="size-5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block text-sm font-medium">{m.label}</span>
                        <span className="block text-xs text-muted-foreground">{m.description}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </FieldShell>
              {draft.method !== config.method && config.status === "active" ? (
                <Alert>
                  <AlertTriangle />
                  <AlertDescription>Changing the method puts the sync back into draft until you test and activate it again.</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              {draft.method === "api" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput label="API base URL" required className="sm:col-span-2" value={draft.api.baseUrl} placeholder="https://api.yourhrms.com/v1" error={err("api.baseUrl")} onChange={(v) => set({ api: { ...draft.api, baseUrl: v } })} />
                  <TextInput label="Client ID" required value={draft.api.clientId} error={err("api.clientId")} onChange={(v) => set({ api: { ...draft.api, clientId: v } })} />
                  <TextInput
                    label="Client secret"
                    required
                    type="password"
                    value={draft.api.clientSecret ?? ""}
                    placeholder={config.api.clientSecretSet ? "•••••••• (saved — leave blank to keep)" : ""}
                    error={err("api.clientSecret")}
                    onChange={(v) => set({ api: { ...draft.api, clientSecret: v } })}
                  />
                  <p className="text-xs text-muted-foreground sm:col-span-2">Credentials are encrypted and never shown again after saving. Use a read-only API user.</p>
                </div>
              ) : null}
              {draft.method === "sftp" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextInput label="Host" required className="sm:col-span-2" value={draft.sftp.host} placeholder="sftp.yourcompany.com" error={err("sftp.host")} onChange={(v) => set({ sftp: { ...draft.sftp, host: v } })} />
                  <TextInput label="Port" type="number" value={String(draft.sftp.port)} onChange={(v) => set({ sftp: { ...draft.sftp, port: Number(v) || 22 } })} />
                  <TextInput label="Username" required value={draft.sftp.username} error={err("sftp.username")} onChange={(v) => set({ sftp: { ...draft.sftp, username: v } })} />
                  <TextInput label="Password" required type="password" value={draft.sftp.password ?? ""} placeholder={config.sftp.passwordSet ? "•••••••• (saved)" : ""} error={err("sftp.password")} onChange={(v) => set({ sftp: { ...draft.sftp, password: v } })} />
                  <TextInput label="Folder path" required value={draft.sftp.path} error={err("sftp.path")} onChange={(v) => set({ sftp: { ...draft.sftp, path: v } })} />
                </div>
              ) : null}
              {draft.method === "csv" ? (
                <div className="space-y-3 text-sm">
                  <p>Export a CSV from {draft.system || "your HRMS"} on the schedule you set in step 4 and upload it on the Import employees page, or email it to your unique address below.</p>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">
                    <span className="min-w-0 flex-1 truncate">hrms+{config.webhook.url.split("/").pop()}@import.healthx.life</span>
                    <Button size="icon-xs" variant="ghost" aria-label="Copy address" onClick={() => copy(`hrms+${config.webhook.url.split("/").pop()}@import.healthx.life`, "Address")}>
                      <Copy />
                    </Button>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/business-portal/employees/import">
                      <FileSpreadsheet data-icon="inline-start" /> Open Import employees
                    </Link>
                  </Button>
                </div>
              ) : null}
              {draft.method === "webhook" ? (
                <div className="space-y-4">
                  <FieldShell label="Webhook URL" description="Configure your HRMS to POST joiner, mover and leaver events here.">
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">
                      <span className="min-w-0 flex-1 truncate">{config.webhook.url}</span>
                      <Button size="icon-xs" variant="ghost" aria-label="Copy URL" onClick={() => copy(config.webhook.url, "Webhook URL")}>
                        <Copy />
                      </Button>
                    </div>
                  </FieldShell>
                  <FieldShell label="Signing secret" description={config.webhook.rotatedAt ? `Last rotated ${formatRelative(config.webhook.rotatedAt)}. Events with a wrong signature are rejected.` : undefined}>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">{config.webhook.secretHint}</code>
                      <Button size="sm" variant="outline" onClick={() => setRotateOpen(true)}>
                        <KeyRound data-icon="inline-start" /> Generate new secret
                      </Button>
                    </div>
                  </FieldShell>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Tell us which column or field in {draft.system || "your HRMS"} holds each value. Employee ID and work email are mandatory. Health data is never imported.</p>
              <div className="divide-y rounded-xl border">
                {HRMS_FIELDS.map((f) => (
                  <div key={f} className="grid items-center gap-2 px-3 py-2.5 sm:grid-cols-[180px_1fr]">
                    <Label htmlFor={`map-${f}`} className="text-sm font-medium">
                      {FIELD_LABEL[f]}
                      {REQUIRED_HRMS_FIELDS.includes(f) ? <span className="text-destructive">*</span> : null}
                    </Label>
                    <div>
                      <Input id={`map-${f}`} value={draft.mapping[f]} onChange={(e) => set({ mapping: { ...draft.mapping, [f]: e.target.value } })} className="h-8 font-mono text-xs" placeholder="source_field" aria-invalid={!!err(`mapping.${f}`)} />
                      {err(`mapping.${f}`) ? <p className="mt-1 text-xs font-medium text-destructive">{err(`mapping.${f}`)}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              {draft.method === "webhook" ? (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Webhooks sync in real time — no schedule needed. You can still run a full sync manually.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <FieldShell label="Frequency">
                    <Select value={draft.schedule.frequency} onValueChange={(v) => set({ schedule: { ...draft.schedule, frequency: v as Draft["schedule"]["frequency"] } })}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Every hour</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldShell>
                  {draft.schedule.frequency === "weekly" ? (
                    <FieldShell label="Day">
                      <Select value={draft.schedule.day} onValueChange={(v) => set({ schedule: { ...draft.schedule, day: v as Draft["schedule"]["day"] } })}>
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {titleCase(d)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldShell>
                  ) : null}
                  {draft.schedule.frequency !== "hourly" ? <TextInput label="Time (IST)" type="time" value={draft.schedule.time} onChange={(v) => set({ schedule: { ...draft.schedule, time: v } })} /> : null}
                </div>
              )}
              <FieldShell label="When someone leaves in the HRMS">
                <RadioGroup value={draft.leaverHandling} onValueChange={(v) => set({ leaverHandling: v as Draft["leaverHandling"] })} className="gap-2">
                  {[
                    { v: "deactivate", l: "Deactivate straight away", d: "They lose access at the next sync." },
                    { v: "deactivate_after_7_days", l: "Deactivate after 7 days", d: "Time to redeem remaining points. Recommended." },
                    { v: "flag_only", l: "Flag for review only", d: "An admin deactivates them manually." },
                  ].map((o) => (
                    <Label key={o.v} htmlFor={`lv-${o.v}`} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                      <RadioGroupItem id={`lv-${o.v}`} value={o.v} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">{o.l}</span>
                        <span className="block text-xs text-muted-foreground">{o.d}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </FieldShell>
              <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
                <div>
                  <Label htmlFor="sync-depts" className="text-sm font-medium">
                    Create missing departments and teams
                  </Label>
                  <p className="text-xs text-muted-foreground">Otherwise rows with unknown departments are skipped and reported.</p>
                </div>
                <Switch id="sync-depts" checked={draft.syncDepartments} onCheckedChange={(v) => set({ syncDepartments: v })} />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              {dirty ? (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>You have unsaved changes</AlertTitle>
                  <AlertDescription>Save them before testing the connection.</AlertDescription>
                </Alert>
              ) : null}
              {config.lastTest ? (
                <div className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", config.lastTest.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5")}>
                  {config.lastTest.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />}
                  <div>
                    <p className="font-medium">{config.lastTest.ok ? "Connection test passed" : "Connection test failed"}</p>
                    <p className="text-muted-foreground">{config.lastTest.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(config.lastTest.at)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Run a connection test to check credentials and mandatory fields before activating.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || dirty || config.status === "not_configured"}>
                  {test.isPending ? <Spinner /> : <PlugZap data-icon="inline-start" />} Test connection
                </Button>
                {config.status === "active" ? (
                  <>
                    <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
                      {sync.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />} Run sync now
                    </Button>
                    <Button variant="ghost" onClick={() => setPauseOpen(true)}>
                      <Pause data-icon="inline-start" /> Pause
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => activate.mutate()} disabled={activate.isPending || !config.lastTest?.ok || dirty}>
                    {activate.isPending ? <Spinner /> : <Play data-icon="inline-start" />} Activate sync
                  </Button>
                )}
              </div>
              {config.status === "active" && config.nextSyncAt ? <p className="text-xs text-muted-foreground">Next scheduled sync: {formatDateTime(config.nextSyncAt)}</p> : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft data-icon="inline-start" /> Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate(payload())}>
                {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />} Save
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => validateStep(step) && setStep((s) => s + 1)}>
                  Next <ArrowRight data-icon="inline-end" />
                </Button>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>

      <SyncHistory runs={runs} />

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Generate a new signing secret?"
        description="The current secret stops working immediately. Update it in your HRMS straight away or events will be rejected."
        confirmLabel="Generate secret"
        destructive
        onConfirm={() => rotate.mutate()}
      />
      <ConfirmDialog open={pauseOpen} onOpenChange={setPauseOpen} title="Pause HRMS sync?" description="Changes in your HRMS won't reach HealthX until you resume." confirmLabel="Pause sync" onConfirm={() => pause.mutate()} />
      <Dialog open={!!secret} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your new signing secret</DialogTitle>
            <DialogDescription>Copy it now — for security we won&apos;t show it again.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs break-all">
            <span className="flex-1">{secret}</span>
            <Button size="icon-xs" variant="ghost" aria-label="Copy secret" onClick={() => secret && copy(secret, "Secret")}>
              <Copy />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>I&apos;ve copied it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TextInput({ label, value, onChange, error, required, type = "text", placeholder, className }: { label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; type?: string; placeholder?: string; className?: string }) {
  const id = `hrms-${label.replace(/\W+/g, "-").toLowerCase()}`
  return (
    <FieldShell id={id} label={label} required={required} error={error} className={className}>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9" aria-invalid={!!error} autoComplete="off" />
    </FieldShell>
  )
}

function SyncHistory({ runs }: { runs: HrmsRun[] }) {
  const [open, setOpen] = useState<HrmsRun | null>(null)
  const columns: Column<HrmsRun>[] = [
    { key: "started", header: "Started", cell: (r) => <span className="text-sm">{formatDateTime(r.startedAt)}</span> },
    { key: "trigger", header: "Trigger", cell: (r) => <span className="text-sm text-muted-foreground">{titleCase(r.trigger)}</span>, hideOnMobile: true },
    { key: "status", header: "Result", cell: (r) => <StatusBadge status={r.status === "success" ? "completed" : r.status === "partial" ? "warning" : "failed"} label={r.status === "partial" ? "With warnings" : undefined} /> },
    { key: "added", header: "Added", align: "right", cell: (r) => <span className="tabular-nums">{r.added}</span> },
    { key: "updated", header: "Updated", align: "right", cell: (r) => <span className="tabular-nums">{r.updated}</span>, hideOnMobile: true },
    { key: "deactivated", header: "Deactivated", align: "right", cell: (r) => <span className="tabular-nums">{r.deactivated}</span>, hideOnMobile: true },
    {
      key: "errors",
      header: "Errors",
      align: "right",
      cell: (r) =>
        r.errors.length ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>
            {r.errors.length} {r.errors.length === 1 ? "error" : "errors"}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        ),
    },
  ]
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold">Sync history</h2>
      <DataTable columns={columns} rows={runs} getRowId={(r) => r.id} clientPageSize={8} emptyTitle="No syncs yet." emptyDescription="Runs appear here once the sync is active." />
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync errors</DialogTitle>
            <DialogDescription>{open ? formatDateTime(open.startedAt) : ""}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {open?.errors.map((e, i) => (
              <li key={i} className="rounded-lg border px-3 py-2">
                {e.row ? <span className="mr-2 font-mono text-xs text-muted-foreground">Row {e.row}</span> : null}
                {e.message}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  )
}
