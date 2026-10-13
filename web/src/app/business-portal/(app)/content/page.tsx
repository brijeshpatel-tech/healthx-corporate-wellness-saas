"use client"

import { Newspaper, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ContentActionsMenu, ContentSheet } from "@/components/business/engagement/content/content-actions"
import { CATEGORY_META, CONTENT_CATEGORIES, CONTENT_TYPES, CONTENT_TYPE_META } from "@/components/business/engagement/content/content-meta"
import { CountTabs } from "@/components/business/engagement/count-tabs"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { DataTable, type Column } from "@/components/common/data-table"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { contentApi, type ContentCategory, type ContentQuery, type ContentRow, type ContentSource, type ContentStatus } from "@/lib/api/business/content"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatCompact, formatDate, formatRelative } from "@/lib/format"
import type { ContentType } from "@/lib/types"

export default function ContentLibraryPage() {
  const can = useCan()
  const [source, setSource] = useState<ContentSource>("company")
  const [type, setType] = useState<ContentType | "all">("all")
  const [status, setStatus] = useState<ContentStatus | "all">("all")
  const [category, setCategory] = useState<ContentCategory | "all">("all")
  const [search, setSearch] = useState("")
  const [viewing, setViewing] = useState<ContentRow | null>(null)

  const query: ContentQuery = { source, type, status: source === "company" ? status : "all", category, search: search || undefined }
  const list = useApiQuery(["business", "content", query], () => contentApi.list(query), { placeholderData: (prev) => prev })
  const data = list.data
  const filtered = type !== "all" || category !== "all" || (source === "company" && status !== "all") || !!search
  const noCompanyContent = source === "company" && !!data && data.totals.company === 0
  const clearFilters = () => {
    setType("all")
    setStatus("all")
    setCategory("all")
    setSearch("")
  }
  // Keep the open sheet in sync with fresh data after an action.
  const viewRow = viewing ? (data?.items.find((r) => r.id === viewing.id) ?? viewing) : null

  const columns: Column<ContentRow>[] = [
    {
      key: "title",
      header: "Content",
      sortValue: (r) => r.title,
      className: "max-w-[24rem] whitespace-normal",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={r.coverEmoji} color={r.coverColor} />
          <div className="min-w-0">
            <div className="line-clamp-2 font-medium md:line-clamp-1">{r.title}</div>
            <div className="line-clamp-1 text-xs text-muted-foreground">
              <span className="md:hidden">{CONTENT_TYPE_META[r.type].label} · </span>
              {r.summary}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      hideOnMobile: true,
      sortValue: (r) => r.type,
      cell: (r) => {
        const meta = CONTENT_TYPE_META[r.type]
        return (
          <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
            <meta.icon className="size-4 text-muted-foreground" /> {meta.label}
          </span>
        )
      },
    },
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      sortValue: (r) => r.category,
      cell: (r) => (
        <span className="text-sm whitespace-nowrap">
          {CATEGORY_META[r.category].emoji} {CATEGORY_META[r.category].label}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "updated",
      header: source === "company" ? "Updated" : "Published",
      hideOnMobile: true,
      sortValue: (r) => (source === "company" ? r.updatedAt : r.publishedAt ?? ""),
      cell: (r) => (
        <span className="text-sm whitespace-nowrap text-muted-foreground" title={formatDate(r.updatedAt, "d MMM yyyy, h:mm a")}>
          {source === "company" ? formatRelative(r.updatedAt) : formatDate(r.publishedAt)}
        </span>
      ),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      hideOnMobile: true,
      sortValue: (r) => r.views,
      cell: (r) => <span className="text-sm tabular-nums">{r.status === "draft" ? "—" : formatCompact(r.views)}</span>,
    },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (r) => <ContentActionsMenu row={r} onView={() => setViewing(r)} /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Content library"
        badge={<PhaseBadge phase={2} />}
        description="Wellness articles, videos, tips and links for your employees' wellness feed. HealthX content is shared with every company."
        actions={
          can("content.manage") ? (
            <Button asChild>
              <Link href="/business-portal/content/new">
                <Plus data-icon="inline-start" /> New content
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <CountTabs
          ariaLabel="Content source"
          value={source}
          onChange={(v) => {
            setSource(v)
            setStatus("all")
          }}
          items={[
            { value: "company", label: "Company content", count: data?.totals.company },
            { value: "healthx", label: "HealthX content", count: data?.totals.healthx },
          ]}
        />
        {!noCompanyContent ? (
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search title, summary or tag…" />
            <Select value={type} onValueChange={(v) => setType(v as ContentType | "all")}>
              <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-36" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {CONTENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CONTENT_TYPE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={(v) => setCategory(v as ContentCategory | "all")}>
              <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] sm:w-40" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CONTENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {source === "company" ? (
              <Select value={status} onValueChange={(v) => setStatus(v as ContentStatus | "all")}>
                <SelectTrigger className="h-9 w-full sm:w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses {data ? `(${data.counts.all})` : ""}</SelectItem>
                  <SelectItem value="draft">Draft {data ? `(${data.counts.draft})` : ""}</SelectItem>
                  <SelectItem value="published">Published {data ? `(${data.counts.published})` : ""}</SelectItem>
                  <SelectItem value="archived">Archived {data ? `(${data.counts.archived})` : ""}</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}
      </div>

      {list.error && !data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : noCompanyContent ? (
        <EmptyState
          icon={Newspaper}
          title="No company content yet."
          description="Share your own wellness tips, office news and resources — or browse what HealthX already provides."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {can("content.manage") ? (
                <Button asChild>
                  <Link href="/business-portal/content/new">
                    <Plus data-icon="inline-start" /> New content
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => setSource("healthx")}>
                Browse HealthX content
              </Button>
            </div>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          getRowId={(r) => r.id}
          loading={list.isLoading}
          onRowClick={setViewing}
          clientPageSize={12}
          emptyTitle={filtered ? "Nothing matches these filters" : "No content here yet"}
          emptyDescription={filtered ? "Try another type, category or status, or clear the search." : undefined}
          emptyAction={
            filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
        />
      )}

      <ContentSheet row={viewRow} open={!!viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </PageContainer>
  )
}
