"use client"

import { ArchiveRestore, Lock } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useContentActions } from "@/components/business/engagement/content/content-actions"
import { ContentForm, valuesFromContent } from "@/components/business/engagement/content/content-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState, PageSkeleton, QueryState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { contentApi, type ContentRow } from "@/lib/api/business/content"
import { useApiQuery } from "@/lib/api/hooks"

export default function EditContentPage() {
  const { id } = useParams<{ id: string }>()
  const detail = useApiQuery(["business", "content", "detail", id], () => contentApi.get({ id }), { refetchOnWindowFocus: false })

  return (
    <PageContainer>
      <PageHeader
        title="Edit content"
        badge={
          <>
            <PhaseBadge phase={2} />
            {detail.data ? <StatusBadge status={detail.data.status} /> : null}
          </>
        }
        description={detail.data?.title}
        backHref="/business-portal/content"
        backLabel="Content library"
      />
      <QueryState query={detail} loading={<PageSkeleton kpis={0} />}>
        {(c) => (c.canEdit ? <ContentForm key={c.id} item={c} initial={valuesFromContent(c)} /> : <NotEditable item={c} />)}
      </QueryState>
    </PageContainer>
  )
}

function NotEditable({ item }: { item: ContentRow }) {
  const actions = useContentActions(item)
  const global = item.source === "healthx"
  return (
    <EmptyState
      icon={Lock}
      title={global ? "HealthX content is read-only" : "Archived content can't be edited"}
      description={global ? "It's managed by the HealthX team and shared with every company. You can view it in the library." : "Unarchive it first — it goes back to Published — then make your changes."}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/business-portal/content">Back to library</Link>
          </Button>
          {item.canUnarchive ? (
            <Button onClick={actions.unarchive} disabled={actions.pending}>
              <ArchiveRestore data-icon="inline-start" /> Unarchive
            </Button>
          ) : null}
        </div>
      }
    />
  )
}
