"use client"

import { AlertTriangle, CheckCheck, CheckCircle2, ClipboardCheck, Coins, History, Plus, SearchX } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ReviewHistoryTable } from "@/components/business/engagement/activity-review/history-table"
import { MissingActivityDialog } from "@/components/business/engagement/activity-review/missing-activity-dialog"
import { CorrectActivityDialog, RejectActivityDialog } from "@/components/business/engagement/activity-review/review-dialogs"
import { ReviewQueue } from "@/components/business/engagement/activity-review/review-queue"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { ConfirmDialog, PrivacyNote, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge } from "@/components/common/status-badge"
import { AccessDenied, EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { activityMeta, activityPhrase, activityReviewApi, type ActivityReviewQuery, type ActivityReviewRow, type ReviewTab } from "@/lib/api/business/activity-review"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatNumber, pluralize } from "@/lib/format"

const TABS: ReviewTab[] = ["manual", "suspicious", "handled"]
const TAB_LABEL: Record<ReviewTab, string> = { manual: "Manual entries", suspicious: "Unusual data", handled: "Handled" }
const OUTCOMES = [
  { value: "all", label: "All outcomes" },
  { value: "approved", label: "Approved / accepted" },
  { value: "adjusted", label: "Corrected" },
  { value: "rejected", label: "Rejected" },
] as const
type Outcome = (typeof OUTCOMES)[number]["value"]

function ActivityReviewPage() {
  const session = useSession("business")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initial = params.get("tab") as ReviewTab | null
  const [tab, setTabState] = useState<ReviewTab>(initial && TABS.includes(initial) ? initial : "manual")
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")
  const [outcome, setOutcome] = useState<Outcome>("all")
  const [selected, setSelected] = useState<string[]>([])
  const [rejecting, setRejecting] = useState<ActivityReviewRow | null>(null)
  const [correcting, setCorrecting] = useState<ActivityReviewRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)

  const allowed = session?.role === "company_owner" || session?.role === "hr_admin" || session?.role === "wellness_manager"
  const query: ActivityReviewQuery = { tab, search: search || undefined, type: type === "all" ? undefined : type, outcome: tab === "handled" ? outcome : undefined }
  const list = useApiQuery(["business", "activity-review", query], () => activityReviewApi.list(query), { placeholderData: (prev) => prev, enabled: allowed })

  const approve = useApiMutation(activityReviewApi.approve, {
    success: (r) =>
      `${r.kind === "manual" ? "Approved" : "Accepted"}: ${activityPhrase(r.type, r.value, r.unit)}${r.points > 0 ? ` — ${formatNumber(r.points)} points awarded` : ""}.`,
    onSuccess: (r) => setSelected((ids) => ids.filter((id) => id !== r.id)),
  })
  const bulkApprove = useApiMutation(activityReviewApi.bulkApprove, {
    success: (r) => `${pluralize(r.approved, "entry", "entries")} approved — ${formatNumber(r.points)} points awarded.`,
    onSuccess: () => setSelected([]),
  })

  if (session && !allowed) return <AccessDenied homeHref="/business-portal/dashboard" message="Activity review is for Company Owners, HR Admins and Wellness Managers." />

  const setTab = (t: ReviewTab) => {
    setTabState(t)
    setType("all")
    setSelected([])
    router.replace(t === "manual" ? pathname : `${pathname}?tab=${t}`, { scroll: false })
  }
  const clearFilters = () => {
    setSearch("")
    setType("all")
    setOutcome("all")
  }

  const data = list.data
  const rows = data?.items ?? []
  const kpis = data?.kpis
  const filtered = !!search || type !== "all" || (tab === "handled" && outcome !== "all")
  const visibleSelected = selected.filter((id) => rows.some((r) => r.id === id))
  const selectedPoints = rows.filter((r) => visibleSelected.includes(r.id)).reduce((a, r) => a + r.points, 0)

  const tabs = TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: data?.counts[t] }))

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={search} onChange={setSearch} placeholder={tab === "handled" ? "Search name, reviewer or reason…" : "Search employee or note…"} />
      <Select value={type} onValueChange={setType}>
        <SelectTrigger className="h-9 w-40" aria-label="Activity type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All activities</SelectItem>
          {(data?.types ?? []).map((t) => (
            <SelectItem key={t} value={t}>
              {activityMeta(t).emoji} {activityMeta(t).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {tab === "handled" ? (
        <Select value={outcome} onValueChange={(v) => setOutcome(v as Outcome)}>
          <SelectTrigger className="h-9 w-44" aria-label="Outcome">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTCOMES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {filtered ? (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : null}
      <span className="ml-auto hidden text-sm text-muted-foreground sm:inline">
        {data ? pluralize(rows.length, tab === "handled" ? "record" : "waiting item", tab === "handled" ? "records" : "waiting items") : ""}
      </span>
    </div>
  )

  const queueEmpty = filtered ? (
    <EmptyState icon={SearchX} title="Nothing matches these filters" description="Try a different name or activity type." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
  ) : (
    <EmptyState
      icon={CheckCircle2}
      title="All caught up"
      description={
        tab === "manual"
          ? "No manual entries are waiting for approval. New ones appear here as soon as employees log them."
          : "No unusual records are waiting. Records that break the plausibility limits (for example more than 40,000 steps in a day) appear here."
      }
      action={
        <Button variant="outline" onClick={() => setTab("handled")}>
          <History data-icon="inline-start" /> View handled records
        </Button>
      }
    />
  )

  return (
    <PageContainer>
      <PageHeader
        title="Activity review"
        description="Approve manually entered activities and check unusual data before points are awarded. Correct a record when it's wrong."
        actions={
          <Button variant="outline" onClick={() => setMissingOpen(true)}>
            <Plus data-icon="inline-start" /> Record missing activity
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Manual entries waiting" value={formatNumber(kpis?.pendingManual)} icon={ClipboardCheck} tone="amber" loading={list.isLoading} hint={kpis?.overdue ? `${formatNumber(kpis.overdue)} waiting over 3 days` : "Points held until approved"} />
        <StatCard
          label="Unusual records waiting"
          value={formatNumber(kpis?.pendingSuspicious)}
          icon={AlertTriangle}
          tone="rose"
          loading={list.isLoading}
          hint={
            <span className="inline-flex items-center gap-1.5">
              Flagged automatically <PhaseBadge phase={2} />
            </span>
          }
        />
        <StatCard label="Approved this week" value={formatNumber(kpis?.approvedThisWeek)} icon={CheckCircle2} tone="emerald" loading={list.isLoading} hint="Approved, accepted or corrected since Monday" />
        <StatCard label="Points awarded via review" value={formatNumber(kpis?.pointsAwarded)} icon={Coins} tone="violet" loading={list.isLoading} hint={kpis ? `${formatNumber(kpis.pointsAwardedMonth)} this month` : undefined} />
      </div>

      <PrivacyNote>
        Only manually entered or automatically flagged records are shown here, so they can be checked before points are awarded. You see the employee&apos;s name and the record itself — nothing else about
        anyone&apos;s health data.
      </PrivacyNote>

      <div className="flex flex-col gap-3">
        <CountTabs value={tab} onChange={setTab} items={tabs} ariaLabel="Review queues" />
        {tab === "suspicious" ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PhaseBadge phase={2} /> Synced records outside normal limits are held here. Accept them, adjust the value, or reject them.
          </p>
        ) : null}
        {filters}
      </div>

      {tab === "manual" && visibleSelected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-semibold">{pluralize(visibleSelected.length, "entry", "entries")} selected</span>
          <span className="text-muted-foreground">· {formatNumber(selectedPoints)} points</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)} disabled={bulkApprove.isPending}>
              {bulkApprove.isPending ? <Spinner /> : <CheckCheck data-icon="inline-start" />}
              Approve selected
            </Button>
          </div>
        </div>
      ) : null}

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : tab === "handled" ? (
        <ReviewHistoryTable
          rows={rows}
          loading={list.isLoading}
          emptyTitle={filtered ? "No records match these filters" : "Nothing handled yet"}
          emptyDescription={filtered ? "Try a different search, activity or outcome." : "Approved, corrected and rejected records will be listed here with who handled them and why."}
          emptyAction={
            filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        />
      ) : (
        <ReviewQueue
          rows={rows}
          loading={list.isLoading}
          kind={tab}
          selectable={tab === "manual"}
          selectedIds={visibleSelected}
          onSelectedIdsChange={setSelected}
          approvingId={approve.isPending ? (approve.variables?.id ?? null) : null}
          onApprove={(r) => approve.mutate({ id: r.id })}
          onCorrect={setCorrecting}
          onReject={setRejecting}
          empty={queueEmpty}
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        />
      )}

      <RejectActivityDialog row={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
      <CorrectActivityDialog row={correcting} onOpenChange={(o) => !o && setCorrecting(null)} />
      <MissingActivityDialog open={missingOpen} onOpenChange={setMissingOpen} />
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Approve ${pluralize(visibleSelected.length, "entry", "entries")}?`}
        description={`${formatNumber(selectedPoints)} points will be awarded and each employee is notified. Approved entries can't be un-approved.`}
        confirmLabel="Approve all"
        onConfirm={() => {
          bulkApprove.mutate({ ids: visibleSelected })
          setBulkOpen(false)
        }}
      />
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <ActivityReviewPage />
    </Suspense>
  )
}
