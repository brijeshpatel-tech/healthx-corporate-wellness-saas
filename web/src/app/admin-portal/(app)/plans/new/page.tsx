"use client"

import { PlanForm } from "@/components/admin/customers/plan-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { AccessDenied } from "@/components/common/states"

/** SCR-P-009 Create plan. */
export default function NewPlanPage() {
  const can = useAdminCan()
  if (!can("plans.manage")) return <AccessDenied homeHref="/admin-portal/dashboard" message="Only a Super Admin can create plans." />
  return (
    <PageContainer>
      <PageHeader backHref="/admin-portal/plans" backLabel="Plans" title="Create plan" description="Define the modules, limits and price per active employee. You can save it as a draft first." />
      <PlanForm />
    </PageContainer>
  )
}
