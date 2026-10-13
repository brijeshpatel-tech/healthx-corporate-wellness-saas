"use client"

import { CompanyForm } from "@/components/admin/companies/company-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { AccessDenied, PageSkeleton, QueryState } from "@/components/common/states"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { companiesApi } from "@/lib/api/platform/companies"
import { useApiQuery } from "@/lib/api/hooks"

/** SCR-P-005 Create company. */
export default function NewCompanyPage() {
  const can = useAdminCan()
  const lookups = useApiQuery(["admin", "companies", "lookups"], () => companiesApi.lookups())
  if (!can("companies.manage")) return <AccessDenied homeHref="/admin-portal/companies" message="Only Super Admins can create companies." />
  return (
    <PageContainer>
      <PageHeader
        backHref="/admin-portal/companies"
        backLabel="Companies"
        title="Create company"
        description="Set up an isolated workspace, assign a plan and invite the Company Owner."
      />
      <QueryState query={lookups} loading={<PageSkeleton kpis={0} />}>
        {(data) => <CompanyForm lookups={data} />}
      </QueryState>
    </PageContainer>
  )
}
