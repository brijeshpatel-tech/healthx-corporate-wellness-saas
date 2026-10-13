"use client"

import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { LoadError, ResultCount } from "@/components/admin/content/bits"
import { CONTENT_TYPE_ICON } from "@/components/admin/content/content-preview"
import { CONTENT_CATEGORY_LABEL, CONTENT_CATEGORY_OPTIONS, CONTENT_STATUS_OPTIONS, CONTENT_TYPE_LABEL, CONTENT_TYPE_OPTIONS, contentStatusLabel } from "@/components/admin/content/meta"
import { CoverTile } from "@/components/admin/cover"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { contentApi, type ContentCategory, type ContentQuery } from "@/lib/api/platform/content"
import { formatDate, formatNumber } from "@/lib/format"
import type { ContentItem, ContentType } from "@/lib/types"

/** SCR-P-031 Global content library (Phase 2). */
export default function ContentLibraryPage() {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [type, setType] = useState<ContentType | "all">("all")
  const [category, setCategory] = useState<ContentCategory | "all">("all")
  const [status, setStatus] = useState<ContentItem["status"] | "all">("all")
  const [confirm, setConfirm] = useState<{ kind: "delete" | "unpublish"; item: ContentItem } | null>(null)

  const query: ContentQuery = { search: search || undefined, type, category, status }
  const list = useApiQuery(["admin", "content", query], () => contentApi.list(query), { placeholderData: (prev) => prev })
  const publish = useApiMutation(contentApi.update, { success: "Content published.", errorTitle: "Couldn't publish content" })
  const unpublish = useApiMutation(contentApi.update, { success: "Content unpublished. It no longer appears in the feed." })
  const remove = useApiMutation(contentApi.remove, { success: (r) => `“${r.title}” deleted.` })

  const libraryEmpty = list.data?.counts.all === 0
  const filtered = !!search || type !== "all" || category !== "all" || status !== "all"

  const columns: Column<ContentItem>[] = [
    {
      key: "title",
      header: "Title",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <CoverTile emoji={c.coverEmoji} color={c.coverColor} />
          <div className="min-w-0">
            <div className="truncate font-medium">{c.title}</div>
            <div className="truncate text-xs text-muted-foreground">{c.summary}</div>
          </div>
        </div>
      ),
      sortValue: (c) => c.title,
      className: "max-w-80",
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => {
        const Icon = CONTENT_TYPE_ICON[c.type]
        return (
          <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
            <Icon className="size-4 text-muted-foreground" /> {CONTENT_TYPE_LABEL[c.type]}
          </span>
        )
      },
      sortValue: (c) => c.type,
      hideOnMobile: true,
    },
    { key: "category", header: "Category", cell: (c) => <span className="text-sm whitespace-nowrap">{CONTENT_CATEGORY_LABEL[c.category]}</span>, sortValue: (c) => c.category, hideOnMobile: true },
    {
      key: "author",
      header: "Author",
      cell: (c) => (
        <div className="text-sm whitespace-nowrap">
          <div>{c.author}</div>
          <div className="text-xs text-muted-foreground">{c.readMinutes} min</div>
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "views", header: "Views", cell: (c) => <span className="text-sm tabular-nums">{formatNumber(c.views)}</span>, sortValue: (c) => c.views, align: "right", hideOnMobile: true },
    { key: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} label={contentStatusLabel(c.status)} />, sortValue: (c) => c.status },
    { key: "published", header: "Published", cell: (c) => <span className="text-sm whitespace-nowrap text-muted-foreground">{c.publishedAt ? formatDate(c.publishedAt) : "—"}</span>, sortValue: (c) => c.publishedAt ?? "", hideOnMobile: true },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/admin-portal/content/${c.id}`}>
                  {manage ? <Pencil /> : <Eye />} {manage ? "Edit" : "View"}
                </Link>
              </DropdownMenuItem>
              {manage ? (
                <>
                  {c.status === "published" ? (
                    <DropdownMenuItem onClick={() => setConfirm({ kind: "unpublish", item: c })}>
                      <EyeOff /> Unpublish
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => publish.mutate({ id: c.id, status: "published" })}>
                      <Send /> Publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm({ kind: "delete", item: c })}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const newButton = manage ? (
    <Button asChild>
      <Link href="/admin-portal/content/new">
        <Plus data-icon="inline-start" /> New content
      </Link>
    </Button>
  ) : null

  return (
    <PageContainer>
      <PageHeader
        title="Content library"
        badge={<PhaseBadge phase={2} />}
        description="Tips, articles, videos and links available to every company's wellness feed. Companies can add their own content on top."
        actions={newButton}
      />

      {list.error ? (
        <LoadError title="Couldn't load content." error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(c) => c.id}
          loading={list.isLoading}
          onRowClick={(c) => router.push(`/admin-portal/content/${c.id}`)}
          clientPageSize={15}
          emptyTitle={libraryEmpty ? "No content yet." : "No content matches these filters"}
          emptyDescription={libraryEmpty ? "Publish the first article, tip or video for every company's feed." : "Try a different search or clear the filters."}
          emptyAction={
            libraryEmpty ? (
              newButton
            ) : filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setType("all")
                  setCategory("all")
                  setStatus("all")
                }}
              >
                Clear filters
              </Button>
            ) : null
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search title, author or tag…" />
              <FilterSelect value={type} onChange={(v) => setType(v as ContentType | "all")} allLabel="All types" options={CONTENT_TYPE_OPTIONS} />
              <FilterSelect value={category} onChange={(v) => setCategory(v as ContentCategory | "all")} allLabel="All categories" options={CONTENT_CATEGORY_OPTIONS} className="sm:w-44" />
              <FilterSelect value={status} onChange={(v) => setStatus(v as ContentItem["status"] | "all")} allLabel="All statuses" options={CONTENT_STATUS_OPTIONS} />
              <ResultCount count={list.data?.total} noun={["item", "items"]} />
            </>
          }
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.kind === "delete"}
        title={confirm?.kind === "delete" ? `Delete “${confirm.item.title}”?` : `Unpublish “${confirm?.item.title ?? ""}”?`}
        description={
          confirm?.kind === "delete"
            ? "It will be removed from every company's feed and the library. This can't be undone."
            : "It will disappear from every company's feed straight away. You can publish it again later."
        }
        confirmLabel={confirm?.kind === "delete" ? "Delete content" : "Unpublish"}
        onConfirm={() => {
          if (confirm?.kind === "delete") remove.mutate({ id: confirm.item.id })
          else if (confirm) unpublish.mutate({ id: confirm.item.id, status: "archived" })
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
