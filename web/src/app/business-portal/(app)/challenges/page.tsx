"use client"

import { LayoutGrid, List, Plus, Sparkles, Trophy } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ChallengeActionsMenu } from "@/components/business/engagement/challenges/challenge-actions"
import { ChallengeCard, ChallengeStatusBadge, timingLabel } from "@/components/business/engagement/challenges/challenge-card"
import { STATUS_LABEL, TYPE_META, formatMetricValue, typeLabel } from "@/components/business/engagement/challenges/challenge-meta"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { challengesApi, type ChallengeQuery, type ChallengeRow } from "@/lib/api/business/challenges"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import type { ChallengeStatus, ChallengeType } from "@/lib/types"

type StatusTab = ChallengeStatus | "all"
const TABS: StatusTab[] = ["active", "scheduled", "draft", "completed", "cancelled", "all"]

function ChallengesPage() {
  const can = useCan()
  const manage = can("challenges.manage")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const initial = params.get("status") as StatusTab | null
  const [status, setStatusState] = useState<StatusTab>(initial && TABS.includes(initial) ? initial : "active")
  const [type, setType] = useState<ChallengeType | "all">("all")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"cards" | "table">("cards")

  const setStatus = (s: StatusTab) => {
    setStatusState(s)
    router.replace(s === "active" ? pathname : `${pathname}?status=${s}`, { scroll: false })
  }

  const query: ChallengeQuery = { status, type, search: search || undefined }
  const list = useApiQuery(["business", "challenges", query], () => challengesApi.list(query), { placeholderData: (prev) => prev })
  const counts = list.data?.counts
  const tabs = TABS.filter((t) => manage || t !== "draft").map((t) => ({ value: t, label: t === "all" ? "All" : STATUS_LABEL[t], count: counts?.[t] }))
  const filtered = !!search || type !== "all"
  const companyEmpty = !filtered && counts?.all === 0

  const columns: Column<ChallengeRow>[] = [
    {
      key: "name",
      header: "Challenge",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={c.coverEmoji} color={c.coverColor} />
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">{typeLabel(c.type, c.teamUnit)}</div>
          </div>
        </div>
      ),
      sortValue: (c) => c.name,
      className: "max-w-72",
    },
    { key: "metric", header: "Target", cell: (c) => <span className="text-sm">{formatMetricValue(c.target, c.metric, c.customMetricLabel)}</span>, hideOnMobile: true },
    {
      key: "dates",
      header: "Dates",
      cell: (c) => (
        <div className="text-sm">
          <div>
            {formatShortDate(c.startDate)} – {formatShortDate(c.endDate)}
          </div>
          <div className="text-xs text-muted-foreground">{timingLabel(c)}</div>
        </div>
      ),
      sortValue: (c) => c.startDate,
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (c) => <ChallengeStatusBadge challenge={c} /> },
    {
      key: "participants",
      header: "Participants",
      align: "right",
      cell: (c) => (
        <div className="text-sm tabular-nums">
          <div>
            <span className="font-medium">{formatNumber(c.participantsCount)}</span>
            <span className="text-muted-foreground"> / {formatNumber(c.eligibleCount)}</span>
          </div>
          <div className="text-xs text-muted-foreground">{formatPercent(c.participationRate)} joined</div>
        </div>
      ),
      sortValue: (c) => c.participationRate,
      hideOnMobile: true,
    },
    {
      key: "progress",
      header: "Avg progress",
      cell: (c) =>
        c.status === "active" || c.status === "completed" ? (
          <div className="flex w-32 items-center gap-2">
            <InlineBar value={c.avgProgress} max={1} color={c.coverColor} />
            <span className="w-9 text-right text-xs tabular-nums">{formatPercent(c.avgProgress)}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      sortValue: (c) => c.avgProgress,
      hideOnMobile: true,
    },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (c) => <ChallengeActionsMenu challenge={c} /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Challenges"
        description={
          manage
            ? "Create and run challenges that get people moving. Progress syncs from employees' phones and wearables."
            : "Challenges open to your team. Figures cover your team's members only."
        }
        badge={!manage ? <Badge variant="secondary">Read-only</Badge> : undefined}
        actions={
          manage ? (
            <Button asChild>
              <Link href="/business-portal/challenges/new">
                <Plus data-icon="inline-start" /> Create challenge
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        <CountTabs value={status} onChange={setStatus} items={tabs} />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search challenges…" />
          <Select value={type} onValueChange={(v) => setType(v as ChallengeType | "all")}>
            <SelectTrigger className="h-9 w-44" aria-label="Challenge type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TYPE_META) as ChallengeType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto hidden text-sm text-muted-foreground sm:inline">{list.data ? `${formatNumber(list.data.items.length)} ${list.data.items.length === 1 ? "challenge" : "challenges"}` : ""}</span>
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as "cards" | "table")} aria-label="Layout" className="ml-auto sm:ml-0">
            <ToggleGroupItem value="cards" aria-label="Cards" className="h-9 px-2.5">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table" className="h-9 px-2.5">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {list.error ? (
        <ErrorState error={new Error(`Couldn't load challenges. ${list.error.message}`)} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : companyEmpty ? (
        <EmptyState
          icon={Trophy}
          title="No challenges yet"
          description={manage ? "Create your first challenge or start from a HealthX template." : "When your company runs a challenge for your team, it shows up here."}
          action={
            manage ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/business-portal/challenges/new">
                    <Sparkles data-icon="inline-start" /> Use a template
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/business-portal/challenges/new?template=blank">
                    <Plus data-icon="inline-start" /> Create from scratch
                  </Link>
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={filtered ? "No challenges match these filters" : `No ${status === "all" ? "" : STATUS_LABEL[status as ChallengeStatus].toLowerCase()} challenges`}
          description={filtered ? "Try a different search or challenge type." : status === "active" ? "Nothing is running right now. Schedule one to keep momentum going." : "Challenges with this status will show up here."}
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setType("all")
                }}
              >
                Clear filters
              </Button>
            ) : manage && (status === "active" || status === "scheduled" || status === "draft") ? (
              <Button asChild>
                <Link href="/business-portal/challenges/new">
                  <Plus data-icon="inline-start" /> Create challenge
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : view === "cards" ? (
        <div className={list.isFetching ? "grid gap-4 opacity-70 transition-opacity sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"}>
          {list.data?.items.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(c) => c.id}
          onRowClick={(c) => router.push(`/business-portal/challenges/${c.id}`)}
          clientPageSize={12}
          className={list.isFetching ? "opacity-80 transition-opacity" : "transition-opacity"}
        />
      )}
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <ChallengesPage />
    </Suspense>
  )
}
