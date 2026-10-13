"use client"

import { useParams } from "next/navigation"
import { LoadError } from "@/components/admin/content/bits"
import { ContentForm } from "@/components/admin/content/content-form"
import { contentStatusLabel } from "@/components/admin/content/meta"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { contentApi } from "@/lib/api/platform/content"
import { formatDate, formatNumber } from "@/lib/format"

/** SCR-P-031 Edit global content. */
export default function EditContentPage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const item = useApiQuery(["admin", "content", "detail", id], () => contentApi.get({ id }), { refetchOnWindowFocus: false })
  const c = item.data

  return (
    <PageContainer className="pb-0">
      <PageHeader
        title={c ? (can("catalog.manage") ? "Edit content" : c.title) : "Content"}
        badge={
          <>
            <PhaseBadge phase={2} />
            {c ? <StatusBadge status={c.status} label={contentStatusLabel(c.status)} /> : null}
          </>
        }
        description={c ? (c.publishedAt ? `Published ${formatDate(c.publishedAt)} · ${formatNumber(c.views)} views` : "Not published yet") : undefined}
        backHref="/admin-portal/content"
        backLabel="Content library"
      />
      {item.isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="hidden h-96 rounded-2xl lg:block" />
        </div>
      ) : item.error || !c ? (
        <LoadError title="Couldn't load content." error={item.error} onRetry={() => item.refetch()} />
      ) : (
        <ContentForm key={c.id} initial={c} />
      )}
    </PageContainer>
  )
}
