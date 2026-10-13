"use client"

import { CalendarOff, CalendarPlus, Lock, MoreHorizontal, Pencil, PartyPopper, Plus, Stethoscope, Trash2, Warehouse } from "lucide-react"
import { useState } from "react"
import { EmployeeCombobox } from "@/components/business/people/employee-picker"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { PersonCell } from "@/components/common/user-avatar"
import { FieldShell } from "@/components/common/form-fields"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { excusedApi, type CompanyExcusedInput, type ExcusedOverview } from "@/lib/api/business/excused"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { localDaysAgo } from "@/lib/mock/series"
import { formatDate, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

type CompanyRow = ExcusedOverview["company"][number]
type IndividualRow = ExcusedOverview["individual"][number]

const today = () => localDaysAgo(0)
const range = (a: string, b: string) => (a === b ? formatDate(a, "EEE d MMM yyyy") : `${formatDate(a, "d MMM")} – ${formatDate(b, "d MMM yyyy")}`)
const when = (a: string, b: string) => (b < today() ? "past" : a > today() ? "upcoming" : "now")

/** #364 — Excused dates: company holidays/shutdowns and private individual sick days. */
export default function ExcusedDatesPage() {
  const [tab, setTab] = useState<"company" | "individual">("company")
  const [companyDialog, setCompanyDialog] = useState<{ open: boolean; item?: CompanyRow | null }>({ open: false })
  const [personDialog, setPersonDialog] = useState<{ open: boolean; item?: IndividualRow | null }>({ open: false })
  const [toDelete, setToDelete] = useState<{ kind: "company"; item: CompanyRow } | { kind: "individual"; item: IndividualRow } | null>(null)
  const [showPast, setShowPast] = useState(false)
  const q = useApiQuery(["business", "excused-dates"], () => excusedApi.list())
  const delCompany = useApiMutation(excusedApi.deleteCompanyDate, { success: "Excused date deleted." })
  const delPerson = useApiMutation(excusedApi.deleteIndividual, { success: "Excused days removed." })

  const company = (q.data?.company ?? []).filter((c) => showPast || when(c.startDate, c.endDate) !== "past")
  const next = (q.data?.company ?? []).find((c) => when(c.startDate, c.endDate) !== "past")

  const companyColumns: Column<CompanyRow>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", c.kind === "holiday" ? "bg-amber-500/14 text-amber-600 dark:text-amber-400" : "bg-slate-500/12 text-slate-600 dark:text-slate-300")}>
            {c.kind === "holiday" ? <PartyPopper className="size-4" /> : <Warehouse className="size-4" />}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.kind === "holiday" ? "Company holiday" : "Office shutdown"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      sortValue: (c) => c.startDate,
      cell: (c) => (
        <div>
          <div className="text-sm">{range(c.startDate, c.endDate)}</div>
          <div className="text-xs text-muted-foreground">{pluralize(c.days, "day")}</div>
        </div>
      ),
    },
    {
      key: "applies",
      header: "Applies to",
      cell: (c) =>
        c.appliesTo === "all" ? (
          <span className="text-sm">Everyone</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {c.targetNames.map((n) => (
              <Badge key={n} variant="secondary">
                {n}
              </Badge>
            ))}
          </div>
        ),
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (c) => <WhenBadge a={c.startDate} b={c.endDate} />, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <RowMenu label={c.name} onEdit={() => setCompanyDialog({ open: true, item: c })} onDelete={() => setToDelete({ kind: "company", item: c })} />
      ),
    },
  ]

  const personColumns: Column<IndividualRow>[] = [
    { key: "who", header: "Employee", sortValue: (r) => r.employeeName, cell: (r) => <PersonCell name={r.employeeName} subtitle={r.departmentName} color={r.avatarColor} /> },
    {
      key: "dates",
      header: "Dates",
      sortValue: (r) => r.startDate,
      cell: (r) => (
        <div>
          <div className="text-sm">{range(r.startDate, r.endDate)}</div>
          <div className="text-xs text-muted-foreground">{pluralize(r.days, "day")}</div>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (r) =>
        r.reason ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Lock className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{r.reason}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not recorded</span>
        ),
      hideOnMobile: true,
      className: "max-w-64",
    },
    { key: "by", header: "Added by", cell: (r) => <span className="text-sm text-muted-foreground">{r.createdBy}</span>, hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (r) => <RowMenu label={r.employeeName} onEdit={() => setPersonDialog({ open: true, item: r })} onDelete={() => setToDelete({ kind: "individual", item: r })} />,
    },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Excused dates"
        description="Mark holidays, office shutdowns and individual sick days so streaks and challenge daily targets don't penalise anyone."
        actions={
          <Button onClick={() => (tab === "company" ? setCompanyDialog({ open: true, item: null }) : setPersonDialog({ open: true, item: null }))}>
            <Plus data-icon="inline-start" /> {tab === "company" ? "Add holiday or shutdown" : "Add sick days"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoTile icon={CalendarOff} title="What excusing does" text="Excused days are skipped for streaks, daily targets and 'active days' challenges. Steps logged on those days still count." />
        <InfoTile icon={CalendarPlus} title="Next company date" text={next ? `${next.name} · ${range(next.startDate, next.endDate)}` : "Nothing scheduled — add your holiday calendar."} />
        <InfoTile icon={Lock} title="Individual days are private" text="Only administrators on this page see them. Colleagues and managers never see sick days or reasons." />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="company" className="px-3">
            Company dates {q.data ? <span className="ml-1 text-xs text-muted-foreground">{q.data.company.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="individual" className="px-3">
            Individual sick days {q.data ? <span className="ml-1 text-xs text-muted-foreground">{q.data.individual.length}</span> : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : tab === "company" ? (
        <DataTable
          columns={companyColumns}
          rows={company}
          getRowId={(c) => c.id}
          loading={q.isLoading}
          emptyTitle={showPast ? "No company dates yet" : "No upcoming company dates"}
          emptyDescription="Add public holidays and office shutdowns so nobody loses a streak."
          emptyAction={
            <Button onClick={() => setCompanyDialog({ open: true, item: null })}>
              <Plus data-icon="inline-start" /> Add holiday or shutdown
            </Button>
          }
          toolbar={
            <Label htmlFor="show-past" className="ml-auto flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Checkbox id="show-past" checked={showPast} onCheckedChange={(v) => setShowPast(v === true)} /> Show past dates
            </Label>
          }
        />
      ) : (
        <DataTable
          columns={personColumns}
          rows={q.data?.individual ?? []}
          getRowId={(r) => r.id}
          loading={q.isLoading}
          clientPageSize={15}
          emptyTitle="No individual excused days"
          emptyDescription="When someone is unwell, excuse their days here so their streak and challenge progress are protected."
          emptyAction={
            <Button onClick={() => setPersonDialog({ open: true, item: null })}>
              <Stethoscope data-icon="inline-start" /> Add sick days
            </Button>
          }
        />
      )}

      <CompanyDateDialog open={companyDialog.open} item={companyDialog.item} onOpenChange={(open) => setCompanyDialog((d) => ({ ...d, open }))} />
      <PersonDialog open={personDialog.open} item={personDialog.item} onOpenChange={(open) => setPersonDialog((d) => ({ ...d, open }))} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={toDelete?.kind === "company" ? `Delete ${toDelete.item.name}?` : `Remove ${toDelete?.item.employeeName ?? ""}'s excused days?`}
        description="Streaks and daily targets will treat these dates as normal days again."
        confirmLabel="Delete"
        onConfirm={() => {
          if (!toDelete) return
          if (toDelete.kind === "company") delCompany.mutate({ id: toDelete.item.id })
          else delPerson.mutate({ id: toDelete.item.id })
          setToDelete(null)
        }}
      />
    </PageContainer>
  )
}

function InfoTile({ icon: Icon, title, text }: { icon: typeof Lock; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

function WhenBadge({ a, b }: { a: string; b: string }) {
  const w = when(a, b)
  return <StatusBadge status={w === "past" ? "closed" : w === "now" ? "active" : "scheduled"} label={w === "past" ? "Past" : w === "now" ? "Today" : "Upcoming"} />
}

function RowMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DateRange({ start, end, onStart, onEnd, errors }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; errors: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FieldShell id="ex-start" label="From" required error={errors.startDate}>
        <Input
          id="ex-start"
          type="date"
          value={start}
          onChange={(e) => {
            onStart(e.target.value)
            if (!end || end < e.target.value) onEnd(e.target.value)
          }}
          className="h-9"
          aria-invalid={!!errors.startDate}
        />
      </FieldShell>
      <FieldShell id="ex-end" label="To" required error={errors.endDate}>
        <Input id="ex-end" type="date" value={end} min={start} onChange={(e) => onEnd(e.target.value)} className="h-9" aria-invalid={!!errors.endDate} />
      </FieldShell>
    </div>
  )
}

function CompanyDateDialog({ open, item, onOpenChange }: { open: boolean; item?: CompanyRow | null; onOpenChange: (o: boolean) => void }) {
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: open })
  const blank: CompanyExcusedInput = { name: "", kind: "holiday", startDate: today(), endDate: today(), appliesTo: "all", targetIds: [] }
  const [draft, setDraft] = useState<CompanyExcusedInput>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(item ? { name: item.name, kind: item.kind, startDate: item.startDate, endDate: item.endDate, appliesTo: item.appliesTo, targetIds: item.targetIds } : blank)
      setErrors({})
    }
  }
  const save = useApiMutation(excusedApi.saveCompanyDate, { success: item ? "Excused date updated." : "Excused date added.", onSuccess: () => onOpenChange(false), onError: (e) => setErrors(e.fieldErrors ?? {}) })
  const options = draft.appliesTo === "departments" ? (lookups.data?.departments ?? []).map((d) => ({ id: d.id, name: d.name })) : (lookups.data?.locations ?? []).map((l) => ({ id: l.id, name: l.name }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit company date" : "Add holiday or shutdown"}</DialogTitle>
          <DialogDescription>A single day or a range of up to 31 days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FieldShell id="ex-name" label="Name" required error={errors.name}>
            <Input id="ex-name" value={draft.name} placeholder="e.g. Diwali" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="h-9" aria-invalid={!!errors.name} />
          </FieldShell>
          <RadioGroup value={draft.kind} onValueChange={(v) => setDraft((d) => ({ ...d, kind: v as CompanyExcusedInput["kind"] }))} className="grid grid-cols-2 gap-2">
            {[
              { v: "holiday", l: "Company holiday", i: PartyPopper },
              { v: "shutdown", l: "Office shutdown", i: Warehouse },
            ].map((o) => (
              <Label key={o.v} htmlFor={`kind-${o.v}`} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                <RadioGroupItem id={`kind-${o.v}`} value={o.v} />
                <o.i className="size-4 text-muted-foreground" /> {o.l}
              </Label>
            ))}
          </RadioGroup>
          <DateRange start={draft.startDate} end={draft.endDate} onStart={(v) => setDraft((d) => ({ ...d, startDate: v }))} onEnd={(v) => setDraft((d) => ({ ...d, endDate: v }))} errors={errors} />
          <FieldShell label="Applies to" error={errors.targetIds}>
            <RadioGroup value={draft.appliesTo} onValueChange={(v) => setDraft((d) => ({ ...d, appliesTo: v as CompanyExcusedInput["appliesTo"], targetIds: [] }))} className="flex flex-wrap gap-4 pt-1">
              {[
                { v: "all", l: "Everyone" },
                { v: "departments", l: "Departments" },
                { v: "locations", l: "Locations" },
              ].map((o) => (
                <Label key={o.v} htmlFor={`ap-${o.v}`} className="flex items-center gap-2 text-sm font-normal">
                  <RadioGroupItem id={`ap-${o.v}`} value={o.v} /> {o.l}
                </Label>
              ))}
            </RadioGroup>
            {draft.appliesTo !== "all" ? (
              <div className="mt-2 grid max-h-44 gap-1.5 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
                {options.map((o) => (
                  <Label key={o.id} htmlFor={`t-${o.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-muted/50">
                    <Checkbox
                      id={`t-${o.id}`}
                      checked={draft.targetIds.includes(o.id)}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, targetIds: v ? [...d.targetIds, o.id] : d.targetIds.filter((x) => x !== o.id) }))}
                    />
                    {o.name}
                  </Label>
                ))}
              </div>
            ) : null}
          </FieldShell>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate({ ...draft, id: item?.id })} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <CalendarPlus data-icon="inline-start" />}
            {item ? "Save changes" : "Add date"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonDialog({ open, item, onOpenChange }: { open: boolean; item?: IndividualRow | null; onOpenChange: (o: boolean) => void }) {
  const people = useApiQuery(["business", "people", "all"], () => organizationApi.people({}), { enabled: open })
  const [employeeId, setEmployeeId] = useState<string | undefined>()
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(today())
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEmployeeId(item?.employeeId)
      setStart(item?.startDate ?? today())
      setEnd(item?.endDate ?? today())
      setReason(item?.reason ?? "")
      setErrors({})
    }
  }
  const save = useApiMutation(excusedApi.saveIndividual, { success: item ? "Excused days updated." : "Excused days added.", onSuccess: () => onOpenChange(false), onError: (e) => setErrors(e.fieldErrors ?? (e.message ? { startDate: e.message } : {})) })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit sick days" : "Add sick days"}</DialogTitle>
          <DialogDescription>Private to administrators. The employee&apos;s streak and challenge targets skip these days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FieldShell label="Employee" required error={errors.employeeId}>
            <EmployeeCombobox
              people={(people.data ?? []).filter((p) => p.status !== "invited").map((p) => ({ ...p, hint: `${p.jobTitle} · ${p.departmentName}` }))}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder={people.isLoading ? "Loading…" : "Search employees…"}
              invalid={!!errors.employeeId}
              disabled={!!item}
            />
          </FieldShell>
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} errors={errors} />
          <FieldShell id="ex-reason" label="Reason (optional)" error={errors.reason} description="Kept private. Don't include medical details.">
            <Textarea id="ex-reason" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sick leave approved by manager" />
          </FieldShell>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate({ id: item?.id, employeeId: employeeId ?? "", startDate: start, endDate: end, reason: reason || undefined })} disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <Stethoscope data-icon="inline-start" />}
            {item ? "Save changes" : "Excuse these days"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
