"use client"

import { Layers, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { PlanCard } from "@/components/admin/customers/plan-card"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { plansApi, type PlanQuery, type PlanRow, type PlanStatus } from "@/lib/api/platform/plans"
import { formatCurrency, formatNumber } from "@/lib/format"

/** SCR-P-008 Plans. */
export default function PlansPage() {
  const can = useAdminCan()
  const canManage = can("plans.manage")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [confirm, setConfirm] = useState<{ plan: PlanRow; status: PlanStatus } | null>(null)

  const query: PlanQuery = { search: search || undefined, status: status as PlanQuery["status"] }
  const list = useApiQuery(["admin", "plans", query], () => plansApi.list(query), { placeholderData: (prev) => prev })
  const setPlanStatus = useApiMutation(plansApi.update, {
    success: (p) => (p.status === "archived" ? `${p.name} archived` : p.status === "active" ? `${p.name} is active` : `${p.name} moved to draft`),
  })

  const changeStatus = (plan: PlanRow, next: PlanStatus) => {
    if (next === "active") setPlanStatus.mutate({ id: plan.id, status: next })
    else setConfirm({ plan, status: next })
  }

  const plans = list.data ?? []
  const filtered = !!search || status !== "all"
  const totals = { companies: plans.reduce((a, p) => a + p.companiesOnPlan, 0), mrr: plans.reduce((a, p) => a + p.mrr, 0) }

  return (
    <PageContainer>
      <PageHeader
        title="Plans"
        description="SaaS plans companies can subscribe to: included modules, limits and price per active employee."
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/admin-portal/plans/new">
                <Plus data-icon="inline-start" /> Create plan
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search plans…" />
        <FilterSelect
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
        />
        {list.data && plans.length ? (
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {formatNumber(plans.length)} plans · {formatNumber(totals.companies)} companies · {formatCurrency(totals.mrr)} MRR
          </span>
        ) : null}
      </div>

      {list.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[30rem] rounded-xl" />
          ))}
        </div>
      ) : list.error ? (
        <ErrorState error={new Error("Couldn't load plans.")} onRetry={() => list.refetch()} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={filtered ? "No plans match these filters" : "No plans yet."}
          description={filtered ? "Try a different search or status." : "Create a plan to start assigning companies to it."}
          action={
            filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setStatus("all")
                }}
              >
                Clear filters
              </Button>
            ) : canManage ? (
              <Button asChild>
                <Link href="/admin-portal/plans/new">
                  <Plus data-icon="inline-start" /> Create plan
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${list.isFetching ? "opacity-80 transition-opacity" : "transition-opacity"}`}>
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} canManage={canManage} onStatus={changeStatus} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive={confirm?.status === "archived"}
        title={confirm ? (confirm.status === "archived" ? `Archive ${confirm.plan.name}?` : `Move ${confirm.plan.name} to draft?`) : ""}
        description={
          confirm?.status === "archived"
            ? confirm.plan.activeCompanies > 0
              ? `${confirm.plan.activeCompanies} companies are still on this plan. Move them to another plan first — plans with active companies can't be archived.`
              : "It can no longer be assigned to companies. Past invoices are not affected."
            : "Draft plans can't be assigned to new companies until you activate them again. Existing companies keep their subscription."
        }
        confirmLabel={confirm?.status === "archived" ? "Archive plan" : "Move to draft"}
        onConfirm={() => {
          if (confirm) setPlanStatus.mutate({ id: confirm.plan.id, status: confirm.status })
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
