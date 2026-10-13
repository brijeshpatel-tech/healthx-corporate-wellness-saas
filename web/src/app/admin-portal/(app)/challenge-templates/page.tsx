"use client"

import { Archive, Copy, EyeOff, MoreHorizontal, Pencil, Plus, Rocket, Trophy } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CHALLENGE_TYPE_META, TEMPLATE_CATEGORY_META, ADMIN } from "@/components/admin/engagement/meta"
import { TemplateCard } from "@/components/admin/engagement/template-card"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { templatesApi, type TemplateQuery } from "@/lib/api/platform/templates"
import { formatNumber } from "@/lib/format"
import type { ChallengeTemplate } from "@/lib/types"

export default function ChallengeTemplatesPage() {
  const router = useRouter()
  const can = useAdminCan()
  const canManage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [type, setType] = useState("all")
  const [status, setStatus] = useState("all")
  const [retiring, setRetiring] = useState<ChallengeTemplate | null>(null)

  const query: TemplateQuery = { search: search || undefined, category: category as TemplateQuery["category"], type: type as TemplateQuery["type"], status: status as TemplateQuery["status"] }
  const list = useApiQuery(["admin", "templates", query], () => templatesApi.list(query), { placeholderData: (prev) => prev })

  const setStatusM = useApiMutation(templatesApi.setStatus, {
    success: (t) => (t.status === "published" ? "Template published." : t.status === "archived" ? "Template retired." : "Template moved to draft."),
  })
  const duplicate = useApiMutation(templatesApi.duplicate, { success: (t) => `Copied as “${t.name}”.`, onSuccess: (t) => router.push(`${ADMIN}/challenge-templates/${t.id}`) })

  const filtered = !!search || category !== "all" || type !== "all" || status !== "all"
  const clear = () => {
    setSearch("")
    setCategory("all")
    setType("all")
    setStatus("all")
  }
  const counts = list.data?.counts

  const actions = (t: ChallengeTemplate) =>
    canManage ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link href={`${ADMIN}/challenge-templates/${t.id}`}>
              <Pencil /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => duplicate.mutate({ id: t.id })}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          {t.status === "published" ? (
            <DropdownMenuItem onClick={() => setStatusM.mutate({ id: t.id, status: "draft" })}>
              <EyeOff /> Unpublish
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setStatusM.mutate({ id: t.id, status: "published" })}>
              <Rocket /> {t.status === "archived" ? "Publish again" : "Publish"}
            </DropdownMenuItem>
          )}
          {t.status !== "archived" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setRetiring(t)}>
                <Archive /> Retire
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  return (
    <PageContainer>
      <PageHeader
        title="Challenge templates"
        description="Ready-made challenges every company can launch in a few clicks. Published templates appear in the Business Portal challenge composer."
        actions={
          canManage ? (
            <Button asChild>
              <Link href={`${ADMIN}/challenge-templates/new`}>
                <Plus data-icon="inline-start" /> Create template
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
        <FilterSelect
          value={category}
          onChange={setCategory}
          allLabel="All categories"
          options={Object.entries(TEMPLATE_CATEGORY_META).map(([value, m]) => ({ value, label: `${m.emoji} ${m.label}` }))}
        />
        <FilterSelect value={type} onChange={setType} allLabel="All types" options={Object.entries(CHALLENGE_TYPE_META).map(([value, m]) => ({ value, label: m.label }))} />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel={`All statuses${counts ? ` (${counts.all})` : ""}`}
          options={[
            { value: "published", label: `Published${counts ? ` (${counts.published})` : ""}` },
            { value: "draft", label: `Draft${counts ? ` (${counts.draft})` : ""}` },
            { value: "archived", label: `Retired${counts ? ` (${counts.archived})` : ""}` },
          ]}
        />
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
        {list.data ? <span className="ml-auto text-sm text-muted-foreground">{formatNumber(list.data.items.length)} shown</span> : null}
      </div>

      {list.error ? (
        <ErrorState error={new Error("Couldn't load templates.")} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : !list.data || list.data.items.length === 0 ? (
        counts?.all === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No templates yet"
            description="Add Step, Hydration, Workout, Meditation and Team challenge templates."
            action={
              canManage ? (
                <Button asChild>
                  <Link href={`${ADMIN}/challenge-templates/new`}>
                    <Plus data-icon="inline-start" /> Create template
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={Trophy}
            title="No templates match these filters"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        )
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${list.isFetching ? "opacity-80" : ""} transition-opacity`}>
          {list.data.items.map((t) => (
            <TemplateCard key={t.id} template={t} actions={actions(t)} onOpen={canManage ? () => router.push(`${ADMIN}/challenge-templates/${t.id}`) : undefined} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!retiring}
        onOpenChange={(o) => !o && setRetiring(null)}
        title={`Retire “${retiring?.name ?? ""}”?`}
        description="Companies will no longer see it when creating challenges. Challenges already running are not affected. You can publish it again later."
        confirmLabel="Retire template"
        destructive
        onConfirm={() => retiring && setStatusM.mutate({ id: retiring.id, status: "archived" })}
      />
    </PageContainer>
  )
}
