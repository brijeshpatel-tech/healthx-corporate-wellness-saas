"use client"

import { useParams } from "next/navigation"
import { ADMIN } from "@/components/admin/engagement/meta"
import { TemplateForm } from "@/components/admin/engagement/template-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { PageSkeleton, QueryState } from "@/components/common/states"
import { useApiQuery } from "@/lib/api/hooks"
import { templatesApi } from "@/lib/api/platform/templates"
import { formatNumber, formatRelative } from "@/lib/format"

export default function EditChallengeTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["admin", "template", id], () => templatesApi.get({ id }), { refetchOnWindowFocus: false })

  return (
    <PageContainer>
      <QueryState query={q} loading={<PageSkeleton kpis={0} />}>
        {(t) => (
          <>
            <PageHeader
              title={t.name}
              description={`Used ${formatNumber(t.usageCount)}× by companies · updated ${formatRelative(t.updatedAt)}`}
              backHref={`${ADMIN}/challenge-templates`}
              backLabel="Challenge templates"
              badge={<StatusBadge status={t.status} label={t.status === "archived" ? "Retired" : undefined} />}
            />
            <TemplateForm key={`${t.id}-${t.updatedAt}`} template={t} />
          </>
        )}
      </QueryState>
    </PageContainer>
  )
}
