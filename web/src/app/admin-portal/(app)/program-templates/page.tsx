"use client"

import { CalendarRange, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { LoadError, ResultCount } from "@/components/admin/content/bits"
import { TEMPLATE_STATUS_OPTIONS } from "@/components/admin/content/meta"
import { ProgramTemplateCard } from "@/components/admin/content/program-template-card"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { programTemplatesApi, type ProgramTemplateQuery, type TemplateStatus } from "@/lib/api/platform/programs"

/** SCR-P-032 Program templates (Phase 2). */
export default function ProgramTemplatesPage() {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<TemplateStatus | "all">("all")
  const query: ProgramTemplateQuery = { search: search || undefined, status }
  const list = useApiQuery(["admin", "program-templates", query], () => programTemplatesApi.list(query), { placeholderData: (prev) => prev })
  const rows = list.data?.items ?? []
  const libraryEmpty = list.data?.counts.all === 0

  const createButton = manage ? (
    <Button asChild>
      <Link href="/admin-portal/program-templates/new">
        <Plus data-icon="inline-start" /> Create template
      </Link>
    </Button>
  ) : null

  return (
    <PageContainer>
      <PageHeader
        title="Program templates"
        badge={<PhaseBadge phase={2} />}
        description="Ready-made, multi-week wellness programs (e.g. 30-Day Healthy Lifestyle) that companies can copy and run for their employees."
        actions={createButton}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search templates…" />
        <FilterSelect value={status} onChange={(v) => setStatus(v as TemplateStatus | "all")} allLabel="All statuses" options={TEMPLATE_STATUS_OPTIONS} />
        <ResultCount count={list.data?.total} noun={["template", "templates"]} />
      </div>

      {list.error ? (
        <LoadError title="Couldn't load templates." error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={libraryEmpty ? "No templates yet." : "No templates match these filters"}
          description={libraryEmpty ? "Create a multi-week program template that companies can copy." : "Try a different search or status."}
          action={
            libraryEmpty ? (
              createButton
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("all")
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className={list.isFetching ? "grid gap-4 opacity-80 transition-opacity sm:grid-cols-2 xl:grid-cols-3" : "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3"}>
          {rows.map((t) => (
            <ProgramTemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
