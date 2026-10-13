"use client"

import { ArrowDown, ArrowUp, BookOpen, Copy, EyeOff, FileText, LifeBuoy, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { FilterSelect } from "@/components/admin/filter-select"
import { ArticleEditor, HelpBody } from "@/components/admin/help/article-editor"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { StatusBadge } from "@/components/common/status-badge"
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { HELP_CATEGORIES, helpApi, helpArticleLink, type HelpArticle, type HelpQuery } from "@/lib/api/platform/help"
import { formatNumber, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function HelpCentrePage() {
  const can = useAdminCan()
  const canManage = can("help.manage")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState<HelpQuery["status"]>("all")
  const [editor, setEditor] = useState<{ article: HelpArticle | null; category?: string } | null>(null)
  const [toDelete, setToDelete] = useState<HelpArticle | null>(null)

  const all = useApiQuery(["admin", "help", "all"], () => helpApi.list({}))
  const query: HelpQuery = { search: search || undefined, category, status }
  const list = useApiQuery(["admin", "help", query], () => helpApi.list(query), { placeholderData: (prev) => prev })

  const setStatusMut = useApiMutation(helpApi.setStatus, { success: (a) => (a.status === "published" ? "Article published — it's live in the app." : "Article unpublished.") })
  const move = useApiMutation(helpApi.move, {})
  const remove = useApiMutation(helpApi.remove, { success: "Article deleted." })

  const articles = list.data ?? []
  const categories = [...new Set([...HELP_CATEGORIES, ...(all.data ?? []).map((a) => a.category)])]
  const grouped = categories.map((c) => ({ category: c, items: articles.filter((a) => a.category === c) })).filter((g) => g.items.length > 0)
  const total = all.data?.length ?? 0
  const published = all.data?.filter((a) => a.status === "published").length ?? 0
  const filtered = !!search || category !== "all" || status !== "all"

  const copyLink = async (a: HelpArticle) => {
    const url = `${window.location.origin}${helpArticleLink(a.id)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied", { description: url })
    } catch {
      toast.error("Couldn't copy the link", { description: url })
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Help centre"
        description="FAQs and troubleshooting guides employees see in the app's Help centre — fewer tickets for HR and the HealthX team."
        actions={
          <>
            {can("support.manage") ? (
              <Button asChild variant="outline">
                <Link href="/admin-portal/support">
                  <LifeBuoy data-icon="inline-start" /> Support tickets
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <Button onClick={() => setEditor({ article: null, category: category !== "all" ? category : undefined })}>
                <Plus data-icon="inline-start" /> New article
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard className="h-full" label="Published articles" value={all.isLoading ? "—" : formatNumber(published)} icon={BookOpen} tone="emerald" hint="visible in the employee app" loading={all.isLoading} />
        <StatCard className="h-full" label="Drafts" value={formatNumber(total - published)} icon={FileText} tone="slate" hint="only HealthX staff see these" loading={all.isLoading} />
        <StatCard className="h-full" label="Categories" value={formatNumber(new Set((all.data ?? []).map((a) => a.category)).size)} icon={LifeBuoy} tone="sky" hint="shown as sections in the app" loading={all.isLoading} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search questions and answers…" />
        <FilterSelect value={category} onChange={setCategory} allLabel="All categories" options={categories.map((c) => ({ value: c, label: c }))} className="sm:w-44" />
        <FilterSelect
          value={status ?? "all"}
          onChange={(v) => setStatus(v as HelpQuery["status"])}
          allLabel="All statuses"
          options={[
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ]}
          className="sm:w-36"
        />
        <span className="text-sm text-muted-foreground sm:ml-auto">{list.data ? `${formatNumber(list.data.length)} articles` : ""}</span>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <TableSkeleton rows={6} columns={3} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filtered ? "No articles match these filters" : "No help articles yet"}
          description={filtered ? "Try a different search or clear the filters." : "Add FAQs and troubleshooting guides, e.g. missing steps or connecting Apple Health."}
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setCategory("all")
                  setStatus("all")
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button onClick={() => setEditor({ article: null })}>
                <Plus data-icon="inline-start" /> New article
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", list.isFetching && "opacity-80")}>
          {grouped.map((g) => {
            const siblings = (all.data ?? []).filter((a) => a.category === g.category).sort((a, b) => a.order - b.order)
            return (
              <section key={g.category} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
                    {g.category}
                    <Badge variant="secondary" className="tabular-nums">
                      {g.items.length}
                    </Badge>
                  </h2>
                  {canManage ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditor({ article: null, category: g.category })}>
                      <Plus data-icon="inline-start" /> Add
                    </Button>
                  ) : null}
                </div>
                <Card className="gap-0 divide-y overflow-hidden py-0">
                  {g.items.map((a) => {
                    const idx = siblings.findIndex((s) => s.id === a.id)
                    return (
                      <Collapsible key={a.id}>
                        <div className="flex items-start gap-3 px-4 py-3">
                          <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{a.order}.</span>
                          <CollapsibleTrigger className="group min-w-0 flex-1 text-left">
                            <span className="block text-sm font-medium group-hover:underline">{a.title}</span>
                            <span className="line-clamp-1 text-xs text-muted-foreground">{a.body.replace(/\s+/g, " ")}</span>
                          </CollapsibleTrigger>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden text-xs text-muted-foreground md:inline">{formatRelative(a.updatedAt)}</span>
                            <StatusBadge status={a.status} />
                            {canManage ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`}>
                                    <MoreHorizontal />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => setEditor({ article: a })}>
                                    <Pencil /> Edit
                                  </DropdownMenuItem>
                                  {a.status === "published" ? (
                                    <DropdownMenuItem onClick={() => setStatusMut.mutate({ id: a.id, status: "draft" })}>
                                      <EyeOff /> Unpublish
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => setStatusMut.mutate({ id: a.id, status: "published" })}>
                                      <Send /> Publish
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => copyLink(a)} disabled={a.status !== "published"}>
                                    <Copy /> Copy link to share
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => move.mutate({ id: a.id, direction: "up" })} disabled={idx <= 0 || move.isPending}>
                                    <ArrowUp /> Move up
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => move.mutate({ id: a.id, direction: "down" })} disabled={idx === -1 || idx >= siblings.length - 1 || move.isPending}>
                                    <ArrowDown /> Move down
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(a)}>
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : a.status === "published" ? (
                              <Button variant="ghost" size="icon-sm" aria-label="Copy link" onClick={() => copyLink(a)}>
                                <Copy />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="border-t bg-muted/30 px-4 py-3 pl-12 text-muted-foreground">
                            <HelpBody body={a.body} />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </Card>
              </section>
            )
          })}
        </div>
      )}

      <ArticleEditor open={!!editor} onOpenChange={(o) => !o && setEditor(null)} article={editor?.article ?? null} defaultCategory={editor?.category} categories={categories} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title="Delete this article?"
        description={`“${toDelete?.title}” will be removed from the app's Help centre. Shared links to it will stop working. Unpublish instead if you may need it again.`}
        confirmLabel="Delete article"
        onConfirm={() => {
          if (toDelete) remove.mutate({ id: toDelete.id })
          setToDelete(null)
        }}
      />
    </PageContainer>
  )
}
