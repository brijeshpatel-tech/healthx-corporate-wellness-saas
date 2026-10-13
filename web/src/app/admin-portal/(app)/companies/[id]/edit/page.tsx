"use client"

import { useParams } from "next/navigation"
import { CompanyForm } from "@/components/admin/companies/company-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { AccessDenied, ErrorState, PageSkeleton } from "@/components/common/states"
import { companiesApi } from "@/lib/api/platform/companies"
import { useApiQuery } from "@/lib/api/hooks"

/** SCR-P-005 Edit company. */
export default function EditCompanyPage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const lookups = useApiQuery(["admin", "companies", "lookups"], () => companiesApi.lookups())
  const detail = useApiQuery(["admin", "companies", "detail", id], () => companiesApi.get({ id }))
  if (!can("companies.manage")) return <AccessDenied homeHref={`/admin-portal/companies/${id}`} message="Only Super Admins can edit companies." />
  const error = lookups.error ?? detail.error
  return (
    <PageContainer>
      <PageHeader
        backHref={`/admin-portal/companies/${id}`}
        backLabel={detail.data?.company.name ?? "Company"}
        title={detail.data ? `Edit ${detail.data.company.name}` : "Edit company"}
        description="Update the profile, domains, plan, modules, owner and branding. Every change is audit-logged."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => (lookups.error ? lookups.refetch() : detail.refetch())} />
      ) : !lookups.data || !detail.data ? (
        <PageSkeleton kpis={0} />
      ) : (
        <CompanyForm key={detail.data.company.id} lookups={lookups.data} detail={detail.data} />
      )}
    </PageContainer>
  )
}
