"use client"

import { Eye, FileText, Megaphone, Pin, Plus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AnnouncementActionsMenu } from "@/components/business/engagement/announcements/announcement-actions"
import { ChannelIcons, ReachCell, TypeChip, TypeIcon, announcementDateLabel as dateLabel } from "@/components/business/engagement/announcements/announcement-bits"
import { ANNOUNCEMENT_TYPES, TYPE_META } from "@/components/business/engagement/announcements/announcement-meta"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { announcementsApi, type AnnouncementQuery, type AnnouncementRow, type AnnouncementStatus } from "@/lib/api/business/announcements"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDateTime, formatPercent } from "@/lib/format"
import type { AnnouncementType } from "@/lib/types"

type StatusTab = AnnouncementStatus | "all"

export default function AnnouncementsPage() {
  const router = useRouter()
  const can = useCan()
  const [status, setStatus] = useState<StatusTab>("all")
  const [type, setType] = useState<AnnouncementType | "all">("all")
  const [search, setSearch] = useState("")

  const query: AnnouncementQuery = { status, type, search: search || undefined }
  const list = useApiQuery(["business", "announcements", query], () => announcementsApi.list(query), { placeholderData: (prev) => prev })
  const data = list.data
  const filtered = status !== "all" || type !== "all" || !!search
  const pinned = (data?.items ?? []).filter((a) => a.pinned)
  const rest = (data?.items ?? []).filter((a) => !a.pinned)
  const nothingAtAll = !!data && data.counts.all === 0 && !filtered

  const columns: Column<AnnouncementRow>[] = [
    {
      key: "title",
      header: "Announcement",
      className: "max-w-[22rem] whitespace-normal",
      cell: (r) => (
        <div className="flex min-w-0 items-start gap-3">
          <TypeIcon type={r.type} />
          <div className="min-w-0">
            <div className="line-clamp-2 font-medium md:line-clamp-1">{r.title}</div>
            <div className="line-clamp-1 text-xs text-muted-foreground">
              {TYPE_META[r.type].label} · {r.author}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{dateLabel(r)}</div>
          </div>
        </div>
      ),
    },
    {
      key: "audience",
      header: "Audience",
      hideOnMobile: true,
      cell: (r) => (
        <span className="inline-flex max-w-44 items-center gap-1.5 text-sm">
          <Users className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{r.audienceLabel}</span>
        </span>
      ),
    },
    { key: "channels", header: "Channels", hideOnMobile: true, cell: (r) => <ChannelIcons channels={r.channels} /> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "date",
      header: "Send date",
      hideOnMobile: true,
      sortValue: (r) => r.sentAt ?? r.scheduledAt ?? r.updatedAt,
      cell: (r) => <span className="text-sm whitespace-nowrap text-muted-foreground">{dateLabel(r)}</span>,
    },
    {
      key: "reach",
      header: (
        <span className="inline-flex items-center gap-1.5">
          Reach <PhaseBadge phase={2} />
        </span>
      ),
      hideOnMobile: true,
      className: "w-48",
      cell: (r) => <ReachCell row={r} />,
    },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (r) => <AnnouncementActionsMenu row={r} /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description="Share company news, wellness tips and challenge updates by push, in-app and email."
        actions={
          can("announcements.manage") ? (
            <Button asChild>
              <Link href="/business-portal/announcements/new">
                <Plus data-icon="inline-start" /> New announcement
              </Link>
            </Button>
          ) : null
        }
      />

      {list.error && !data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : nothingAtAll ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet."
          description="Tell employees about challenges, rewards, events and wellness tips. They'll see it in the HealthX app."
          action={
            <Button asChild>
              <Link href="/business-portal/announcements/new">
                <Plus data-icon="inline-start" /> New announcement
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <CountTabs
              value={status}
              onChange={setStatus}
              items={[
                { value: "all", label: "All", count: data?.counts.all },
                { value: "sent", label: "Sent", count: data?.counts.sent },
                { value: "scheduled", label: "Scheduled", count: data?.counts.scheduled },
                { value: "draft", label: "Draft", count: data?.counts.draft },
              ]}
            />
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
              <Select value={type} onValueChange={(v) => setType(v as AnnouncementType | "all")}>
                <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ANNOUNCEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].emoji} {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchInput value={search} onChange={setSearch} placeholder="Search title, message or author…" />
            </div>
          </div>

          {list.isLoading ? (
            <Skeleton className="h-36 rounded-xl" />
          ) : pinned.length > 0 ? (
            <section aria-label="Pinned announcements" className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <Pin className="size-4 text-primary" /> Pinned
              </h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {pinned.map((a) => (
                  <PinnedCard key={a.id} row={a} />
                ))}
              </div>
            </section>
          ) : null}

          {list.isLoading || rest.length > 0 || pinned.length === 0 ? (
            <DataTable
              columns={columns}
              rows={rest}
              getRowId={(r) => r.id}
              loading={list.isLoading}
              onRowClick={(r) => router.push(`/business-portal/announcements/${r.id}`)}
              clientPageSize={10}
              emptyTitle="No announcements match these filters"
              emptyDescription="Try another status or type, or clear the search."
              emptyAction={
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("all")
                    setType("all")
                    setSearch("")
                  }}
                >
                  Clear filters
                </Button>
              }
              className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
            />
          ) : null}
        </>
      )}
    </PageContainer>
  )
}

function PinnedCard({ row }: { row: AnnouncementRow }) {
  return (
    <Card className="relative gap-0 border-primary/30 bg-primary/[0.04] py-0 transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <TypeChip type={row.type} />
          <StatusBadge status={row.status} />
          <div className="relative z-10 ml-auto -mr-2">
            <AnnouncementActionsMenu row={row} />
          </div>
        </div>
        <div className="min-w-0">
          <Link href={`/business-portal/announcements/${row.id}`} className="line-clamp-1 font-heading font-semibold after:absolute after:inset-0 hover:underline">
            {row.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {row.audienceLabel}
          </span>
          <span title={row.sentAt ? formatDateTime(row.sentAt) : undefined}>{dateLabel(row)}</span>
          {row.status === "sent" ? (
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-foreground">
              <Eye className="size-3.5 text-muted-foreground" /> {formatPercent(row.openRate)} opened
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1">
              <FileText className="size-3.5" /> {row.channels.length} {row.channels.length === 1 ? "channel" : "channels"}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
