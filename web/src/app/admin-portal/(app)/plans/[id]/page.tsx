"use client"

import { useParams } from "next/navigation"
import { PlanForm } from "@/components/admin/customers/plan-form"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { AccessDenied, ErrorState } from "@/components/common/states"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiQuery } from "@/lib/api/hooks"
import { plansApi } from "@/lib/api/platform/plans"
import { formatCurrency, formatNumber } from "@/lib/format"

/** SCR-P-009 Edit plan. */
export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>()
  const can = useAdminCan()
  const q = useApiQuery(["admin", "plans", "detail", id], () => plansApi.get({ id }), { enabled: !!id })

  if (!can("plans.manage")) return <AccessDenied homeHref="/admin-portal/dashboard" message="Only a Super Admin can edit plans." />

  return (
    <PageContainer>
      {q.isLoading ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-8">
              <Skeleton className="h-16" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          ))}
        </div>
      ) : q.error || !q.data ? (
        <>
          <PageHeader backHref="/admin-portal/plans" backLabel="Plans" title="Edit plan" />
          <ErrorState error={q.error ?? new Error("Plan not found")} onRetry={() => q.refetch()} />
        </>
      ) : (
        <>
          <PageHeader
            backHref="/admin-portal/plans"
            backLabel="Plans"
            title={`Edit ${q.data.name}`}
            badge={<StatusBadge status={q.data.status} />}
            description={`${formatNumber(q.data.companiesOnPlan)} companies on this plan · ${formatCurrency(q.data.mrr, q.data.currency)} MRR. New prices apply to new billing periods.`}
          />
          <PlanForm key={q.data.id} plan={q.data} />
        </>
      )}
    </PageContainer>
  )
}
