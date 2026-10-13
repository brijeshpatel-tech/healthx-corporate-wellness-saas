"use client"

import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileUp, RefreshCw, Upload, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { DataTable, type Column } from "@/components/common/data-table"
import { SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  employeeImportTemplate,
  employeesApi,
  IMPORT_COLUMNS,
  REQUIRED_IMPORT_COLUMNS,
  type DuplicateMode,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportUpdateRow,
} from "@/lib/api/business/employees"
import { organizationApi } from "@/lib/api/business/organization"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { downloadText, parseCsv } from "@/lib/download"
import { formatDateTime, formatNumber, pluralize } from "@/lib/format"
import type { ImportJob } from "@/lib/types"
import { cn } from "@/lib/utils"

const MAX_BYTES = 5 * 1024 * 1024
type Step = "upload" | "review" | "done"
type Job = ImportJob & { updatedRows?: number }

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** SCR-B-009 — Import employees from CSV with a validation preview. */
export default function ImportEmployeesPage() {
  const session = useSession("business")
  const [step, setStep] = useState<Step>("upload")
  const [fileName, setFileName] = useState("")
  const [fileError, setFileError] = useState<string | null>(null)
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip")
  const [sendInvites, setSendInvites] = useState(true)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<Job | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rowsRef = useRef<{ rows: Record<string, string>[]; columns: string[] } | null>(null)

  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const jobs = useApiQuery(["business", "import-jobs"], () => employeesApi.importJobs())

  const previewMutation = useApiMutation(employeesApi.previewImport, {
    invalidate: false,
    onSuccess: (p) => {
      setPreview(p)
      setStep("review")
    },
    onError: (err) => setFileError(err.message),
    errorTitle: "Couldn't read this file",
  })
  const importMutation = useApiMutation(employeesApi.importCsv, {
    success: (job) => `${formatNumber(job.createdRows)} employees imported${job.skippedRows ? `, ${formatNumber(job.skippedRows)} rows need attention` : ""}.`,
    onSuccess: (job) => {
      setResult(job)
      setStep("done")
    },
  })
  const errorReport = useApiMutation(employeesApi.importErrors, { invalidate: false, onSuccess: (r) => downloadText(r.fileName, r.csv) })

  const domain = session?.user.email.split("@")[1] ?? "company.com"
  const downloadTemplate = () => {
    const teams = lookups.data?.teams ?? []
    const sample = teams.slice(0, 3).map((t) => ({ department: t.departmentName, team: t.name, domain }))
    downloadText("healthx-employee-import-template.csv", employeeImportTemplate(sample.length ? sample : [{ department: "Engineering", team: "Platform", domain }]))
  }

  const handleFile = async (file: File | undefined) => {
    setFileError(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name) || file.size > MAX_BYTES) {
      setFileError("File must be a .csv under 5 MB.")
      return
    }
    setParsing(true)
    try {
      const text = (await file.text()).replace(/^﻿/, "")
      const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? ""
      // Parse the header with a dummy row so quoted column names are handled like the data.
      const columns = Object.keys(parseCsv(`${firstLine}\nx`)[0] ?? {})
      const rows = parseCsv(text)
      rowsRef.current = { rows, columns }
      setFileName(file.name)
      previewMutation.mutate({ rows, columns, duplicateMode })
    } catch (e) {
      setFileError(errorMessage(e))
    } finally {
      setParsing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const rerunPreview = (mode: DuplicateMode) => {
    setDuplicateMode(mode)
    if (rowsRef.current && step === "review") previewMutation.mutate({ ...rowsRef.current, duplicateMode: mode })
  }

  const downloadPreviewErrors = () => {
    if (!preview) return
    const csv = ["Row,Email,Reason", ...preview.errors.map((e) => [String(e.row), e.email ?? "", e.message].map(esc).join(","))].join("\n")
    downloadText(`${fileName.replace(/\.csv$/i, "")}-errors.csv`, csv)
  }

  const reset = () => {
    setStep("upload")
    setPreview(null)
    setResult(null)
    setFileName("")
    setFileError(null)
    rowsRef.current = null
  }

  const busy = parsing || previewMutation.isPending

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/employees"
        backLabel="Employees"
        title="Import employees"
        description="Invite many people at once from a CSV file. We check every row before anything is imported."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download data-icon="inline-start" /> Download template
          </Button>
        }
      />

      <Stepper step={step} />

      {step === "upload" ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <SectionCard className="lg:col-span-3" title="Upload your file" description="CSV only, up to 5 MB or 10,000 rows. The first row must contain column names.">
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  void handleFile(e.dataTransfer.files[0])
                }}
                disabled={busy}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
                  fileError && "border-destructive/50",
                )}
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">{busy ? <Spinner className="size-5" /> : <FileUp className="size-6" />}</span>
                <span className="space-y-1">
                  <span className="block text-sm font-semibold">{busy ? "Checking your file…" : "Drag and drop your CSV here"}</span>
                  <span className="block text-xs text-muted-foreground">or click to browse your computer</span>
                </span>
              </button>
              <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} aria-label="Choose CSV file" />
              {fileError ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>We couldn&apos;t use this file</AlertTitle>
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">If someone already exists</Label>
                  <RadioGroup value={duplicateMode} onValueChange={(v) => setDuplicateMode(v as DuplicateMode)} className="gap-2">
                    {[
                      { v: "skip", l: "Skip them", d: "Leave existing employees unchanged." },
                      { v: "update", l: "Update their details", d: "Name, job title, ID and team from the file." },
                    ].map((o) => (
                      <Label key={o.v} htmlFor={`dup-${o.v}`} className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                        <RadioGroupItem id={`dup-${o.v}`} value={o.v} className="mt-0.5" />
                        <span>
                          <span className="block text-sm font-medium">{o.l}</span>
                          <span className="block text-xs text-muted-foreground">{o.d}</span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="flex items-start justify-between gap-4 self-start rounded-xl border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="send-invites" className="text-sm font-medium">
                      Send invitations after import
                    </Label>
                    <p className="text-xs text-muted-foreground">Turn off to add people now and invite them later.</p>
                  </div>
                  <Switch id="send-invites" checked={sendInvites} onCheckedChange={setSendInvites} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="lg:col-span-2" title="Columns" description="Use the template so names match exactly.">
            <ul className="space-y-2.5 text-sm">
              {IMPORT_COLUMNS.map((c) => (
                <li key={c} className="flex items-center justify-between gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c}</code>
                  {(REQUIRED_IMPORT_COLUMNS as readonly string[]).includes(c) ? <Badge variant="secondary">Required</Badge> : <span className="text-xs text-muted-foreground">Optional</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">department</span> and <span className="font-medium text-foreground">team</span> must match names you already have
                {lookups.data ? ` (${pluralize(lookups.data.departments.length, "department")}, ${pluralize(lookups.data.teams.length, "team")})` : ""}.
              </p>
              <p>Emails must use your company domain (@{domain}). Don&apos;t include health information.</p>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {step === "review" && preview ? (
        <ReviewStep
          preview={preview}
          fileName={fileName}
          duplicateMode={duplicateMode}
          onDuplicateModeChange={rerunPreview}
          sendInvites={sendInvites}
          refreshing={previewMutation.isPending}
          importing={importMutation.isPending}
          onBack={reset}
          onDownloadErrors={downloadPreviewErrors}
          onConfirm={() =>
            importMutation.mutate({
              fileName,
              employees: preview.valid,
              updates: preview.updates,
              skipped: preview.errors.map(({ row, message }) => ({ row, message })),
              sendInvites,
            })
          }
        />
      ) : null}

      {step === "done" && result ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </span>
            <div className="space-y-1">
              <h2 className="font-heading text-xl font-bold">Import complete</h2>
              <p className="text-sm text-muted-foreground">
                {formatNumber(result.createdRows)} employees imported{result.updatedRows ? `, ${formatNumber(result.updatedRows)} updated` : ""}
                {result.skippedRows ? `, ${formatNumber(result.skippedRows)} rows need attention` : ""}.{" "}
                {sendInvites && result.createdRows ? "Invitations are on their way." : ""}
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-3 gap-3">
              <ResultTile label="Imported" value={result.createdRows} tone="text-emerald-600 dark:text-emerald-400" />
              <ResultTile label="Updated" value={result.updatedRows ?? 0} tone="text-sky-600 dark:text-sky-400" />
              <ResultTile label="Skipped" value={result.skippedRows} tone="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {result.skippedRows ? (
                <Button variant="outline" onClick={() => errorReport.mutate({ id: result.id })} disabled={errorReport.isPending}>
                  <Download data-icon="inline-start" /> Download error report
                </Button>
              ) : null}
              <Button variant="outline" onClick={reset}>
                <Upload data-icon="inline-start" /> Import another file
              </Button>
              <Button asChild>
                <Link href="/business-portal/employees">
                  <Users data-icon="inline-start" /> View employees
                </Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <ImportHistory jobs={jobs.data ?? []} loading={jobs.isLoading} error={jobs.error} onRetry={() => jobs.refetch()} onDownload={(id) => errorReport.mutate({ id })} />
    </PageContainer>
  )
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { key: "upload", label: "Upload file" },
    { key: "review", label: "Check rows" },
    { key: "done", label: "Results" },
  ] as const
  const index = steps.findIndex((s) => s.key === step)
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              i < index && "border-primary bg-primary text-primary-foreground",
              i === index && "border-primary text-primary ring-4 ring-primary/15",
              i > index && "text-muted-foreground",
            )}
          >
            {i < index ? <CheckCircle2 className="size-4" /> : i + 1}
          </span>
          <span className={cn("hidden font-medium sm:inline", i > index && "text-muted-foreground")}>{s.label}</span>
          {i < steps.length - 1 ? <span className={cn("h-px flex-1", i < index ? "bg-primary" : "bg-border")} /> : null}
        </li>
      ))}
    </ol>
  )
}

function ResultTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className={cn("font-heading text-2xl font-bold tabular-nums", tone)}>{formatNumber(value)}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function ReviewStep({
  preview,
  fileName,
  duplicateMode,
  onDuplicateModeChange,
  sendInvites,
  refreshing,
  importing,
  onBack,
  onDownloadErrors,
  onConfirm,
}: {
  preview: ImportPreview
  fileName: string
  duplicateMode: DuplicateMode
  onDuplicateModeChange: (m: DuplicateMode) => void
  sendInvites: boolean
  refreshing: boolean
  importing: boolean
  onBack: () => void
  onDownloadErrors: () => void
  onConfirm: () => void
}) {
  const [tab, setTab] = useState<"valid" | "updates" | "errors">(preview.valid.length ? "valid" : preview.errors.length ? "errors" : "updates")
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const deptName = (id: string) => lookups.data?.departments.find((d) => d.id === id)?.name ?? "—"
  const teamName = (id: string) => lookups.data?.teams.find((t) => t.id === id)?.name ?? "—"
  const total = preview.valid.length + preview.updates.length

  const validColumns: Column<ImportPreviewRow>[] = [
    { key: "row", header: "Row", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.row}</span>, className: "w-14" },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{`${r.firstName} ${r.lastName}`}</span> },
    { key: "email", header: "Email", cell: (r) => <span className="text-sm text-muted-foreground">{r.email}</span>, hideOnMobile: true },
    { key: "team", header: "Department / team", cell: (r) => <span className="text-sm">{`${deptName(r.departmentId)} · ${teamName(r.teamId)}`}</span>, hideOnMobile: true },
    { key: "title", header: "Job title", cell: (r) => <span className="text-sm text-muted-foreground">{r.jobTitle || "—"}</span>, hideOnMobile: true },
  ]
  const updateColumns: Column<ImportUpdateRow>[] = [
    { key: "row", header: "Row", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.row}</span>, className: "w-14" },
    { key: "name", header: "Employee", cell: (r) => <div className="min-w-0"><div className="truncate font-medium">{r.name}</div><div className="truncate text-xs text-muted-foreground">{r.email}</div></div> },
    { key: "changes", header: "Changes", cell: (r) => <span className="text-sm">{r.summary}</span> },
  ]
  const errorColumns: Column<ImportPreview["errors"][number]>[] = [
    { key: "row", header: "Row", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.row}</span>, className: "w-14", sortValue: (r) => r.row },
    { key: "email", header: "Email", cell: (r) => <span className="text-sm text-muted-foreground">{r.email ?? "—"}</span>, hideOnMobile: true },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-sm font-medium text-destructive">{r.message}</span> },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <FileSpreadsheet className="size-4 text-primary" />
        <span className="font-medium">{fileName}</span>
        <span className="text-muted-foreground">· {pluralize(preview.totalRows, "row")}</span>
        {refreshing ? <Spinner className="ml-1" /> : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onBack}>
          <RefreshCw data-icon="inline-start" /> Choose another file
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Rows in file" value={formatNumber(preview.totalRows)} icon={FileSpreadsheet} tone="slate" />
        <StatCard label="Ready to import" value={formatNumber(preview.valid.length)} icon={UserPlus} tone="emerald" hint={sendInvites ? "will get an invitation" : "invitations not sent"} />
        <StatCard label="Will be updated" value={formatNumber(preview.updates.length)} icon={RefreshCw} tone="sky" hint={duplicateMode === "skip" ? "duplicates are skipped" : "existing employees"} />
        <StatCard label="Need attention" value={formatNumber(preview.errors.length)} icon={AlertTriangle} tone="amber" hint="won't be imported" />
      </div>

      <SectionCard
        title="Check rows"
        description="Fix errors in your file and upload it again, or import the valid rows now."
        actions={
          <Tabs value={duplicateMode} onValueChange={(v) => onDuplicateModeChange(v as DuplicateMode)}>
            <TabsList>
              <TabsTrigger value="skip">Skip existing</TabsTrigger>
              <TabsTrigger value="update">Update existing</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-3">
          <TabsList>
            <TabsTrigger value="valid">Ready ({formatNumber(preview.valid.length)})</TabsTrigger>
            <TabsTrigger value="updates">Updates ({formatNumber(preview.updates.length)})</TabsTrigger>
            <TabsTrigger value="errors">Errors ({formatNumber(preview.errors.length)})</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "valid" ? (
          <DataTable columns={validColumns} rows={preview.valid} getRowId={(r) => String(r.row)} clientPageSize={8} dense emptyTitle="No new employees in this file" className="shadow-none" />
        ) : tab === "updates" ? (
          <DataTable
            columns={updateColumns}
            rows={preview.updates}
            getRowId={(r) => String(r.row)}
            clientPageSize={8}
            dense
            emptyTitle={duplicateMode === "skip" ? "Existing employees are skipped" : "No changes for existing employees"}
            emptyDescription={duplicateMode === "skip" ? "Switch to 'Update existing' to apply changes from the file." : undefined}
            className="shadow-none"
          />
        ) : (
          <DataTable columns={errorColumns} rows={preview.errors} getRowId={(r) => String(r.row)} clientPageSize={8} dense emptyTitle="No errors — every row looks good" className="shadow-none" />
        )}
      </SectionCard>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" /> Cancel
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {preview.errors.length ? (
            <Button variant="outline" onClick={onDownloadErrors}>
              <Download data-icon="inline-start" /> Download error report
            </Button>
          ) : null}
          <Button onClick={onConfirm} disabled={importing || refreshing || total === 0}>
            {importing ? <Spinner /> : <CheckCircle2 data-icon="inline-start" />}
            {total === 0 ? "Nothing to import" : `Confirm import (${formatNumber(total)})`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ImportHistory({ jobs, loading, error, onRetry, onDownload }: { jobs: Job[]; loading: boolean; error: unknown; onRetry: () => void; onDownload: (id: string) => void }) {
  const columns: Column<Job>[] = [
    {
      key: "file",
      header: "File",
      cell: (j) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium">{j.fileName}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatDateTime(j.createdAt)} · {j.createdBy}
            </div>
          </div>
        </div>
      ),
    },
    { key: "rows", header: "Rows", align: "right", cell: (j) => <span className="tabular-nums">{formatNumber(j.totalRows)}</span>, hideOnMobile: true },
    { key: "created", header: "Imported", align: "right", cell: (j) => <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">{formatNumber(j.createdRows)}</span> },
    { key: "updated", header: "Updated", align: "right", cell: (j) => <span className="tabular-nums">{formatNumber(j.updatedRows ?? 0)}</span>, hideOnMobile: true },
    { key: "skipped", header: "Skipped", align: "right", cell: (j) => <span className={cn("tabular-nums", j.skippedRows && "font-medium text-amber-700 dark:text-amber-400")}>{formatNumber(j.skippedRows)}</span>, hideOnMobile: true },
    { key: "status", header: "Status", cell: (j) => <StatusBadge status={j.status} />, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (j) =>
        j.errors.length ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onDownload(j.id)
              toast.message("Downloading error report", { description: j.fileName })
            }}
          >
            <Download data-icon="inline-start" /> Errors
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No errors</span>
        ),
    },
  ]
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold">Import history</h2>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            Couldn&apos;t load past imports.
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable columns={columns} rows={jobs} getRowId={(j) => j.id} loading={loading} clientPageSize={5} emptyTitle="No imports yet" emptyDescription="Files you import will be listed here with their results." />
      )}
    </section>
  )
}
