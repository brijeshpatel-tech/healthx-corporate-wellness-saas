"use client"

import { useParams } from "next/navigation"
import { LoadError } from "@/components/admin/content/bits"
import { TEMPLATE_STATUS_LABEL } from "@/components/admin/content/meta"
import { ProgramTemplateForm } from "@/components/admin/content/program-template-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { programTemplatesApi } from "@/lib/api/platform/programs"
import { formatNumber, formatPercent, pluralize } from "@/lib/format"

/** SCR-P-032 Edit program template. */
export default function EditProgramTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const detail = useApiQuery(["admin", "program-templates", "detail", id], () => programTemplatesApi.get({ id }), { refetchOnWindowFocus: false })
  const t = detail.data

  return (
    <PageContainer className="pb-0">
      <PageHeader
        title={t ? (can("catalog.manage") ? `Edit “${t.name}”` : t.name) : "Program template"}
        badge={
          <>
            <PhaseBadge phase={2} />
            {t ? <StatusBadge status={t.status} label={TEMPLATE_STATUS_LABEL[t.status]} /> : null}
          </>
        }
        description={
          t
            ? `${t.companiesUsing ? `Used by ${pluralize(t.companiesUsing, "company", "companies")}` : "Not used by any company yet"} · ${formatNumber(t.enrolledCount)} enrolled${t.enrolledCount ? ` · ${formatPercent(t.avgCompletion)} avg completion` : ""}. Edits don't change programs companies already copied.`
            : undefined
        }
        backHref="/admin-portal/program-templates"
        backLabel="Program templates"
      />
      {detail.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : detail.error || !t ? (
        <LoadError title="Couldn't load this template." error={detail.error} onRetry={() => detail.refetch()} />
      ) : (
        <ProgramTemplateForm key={t.id} initial={t} />
      )}
    </PageContainer>
  )
}
