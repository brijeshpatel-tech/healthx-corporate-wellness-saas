"use client"

import { MailWarning, UserCheck, UserPlus, UserRoundX, Users } from "lucide-react"
import { TrendChart } from "@/components/common/charts"
import { DataTable, type Column } from "@/components/common/data-table"
import { InlineBar, SectionCard } from "@/components/common/misc"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState, ErrorState } from "@/components/common/states"
import { analyticsApi, type AdoptionData } from "@/lib/api/business/analytics"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatPercent, formatShortDate } from "@/lib/format"
import { Hidden, NotEnoughData, TabSkeleton, type TabFilters } from "./shared"

type Row = AdoptionData["byDepartment"][number]

/** SCR-B-023 — Adoption: invited → registered → active. */
export function AdoptionTab({ filters }: { filters: TabFilters }) {
  const q = useApiQuery(["business", "analytics", "adoption", filters], () => analyticsApi.adoption(filters), { placeholderData: (p) => p })
  if (q.isLoading) return <TabSkeleton tiles={4} />
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data!
  if (d.suppressed) return <NotEnoughData min={d.minGroupSize} scope={d.scopeLabel} />
  if (d.funnel.invited === 0) return <EmptyState icon={Users} title="Not enough data yet." description="Adoption appears once you've invited employees." />

  const stages = [
    { label: "Invited", value: d.funnel.invited, note: "Everyone with an account or invitation" },
    { label: "Registered", value: d.funnel.registered, note: `${formatPercent(d.rates.registration)} of invited` },
    { label: "Active", value: d.funnel.active, note: `${formatPercent(d.rates.activation)} of registered — activity or sign-in in the period` },
  ]
  const columns: Column<Row>[] = [
    { key: "name", header: "Department", sortValue: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "employees", header: "Employees", align: "right", sortValue: (r) => r.employees, cell: (r) => <span className="tabular-nums">{formatNumber(r.employees)}</span> },
    { key: "pending", header: "Not joined", align: "right", sortValue: (r) => r.pending, cell: (r) => <span className="tabular-nums text-muted-foreground">{formatNumber(r.pending)}</span>, hideOnMobile: true },
    { key: "registered", header: "Registered", align: "right", sortValue: (r) => r.registered, cell: (r) => <span className="tabular-nums">{formatNumber(r.registered)}</span>, hideOnMobile: true },
    { key: "active", header: "Active", align: "right", sortValue: (r) => r.active, cell: (r) => <span className="tabular-nums">{formatNumber(r.active)}</span>, hideOnMobile: true },
    {
      key: "regRate",
      header: "Registration",
      sortValue: (r) => r.registrationRate ?? -1,
      cell: (r) =>
        r.registrationRate === null ? (
          <Hidden min={d.minGroupSize} />
        ) : (
          <div className="flex w-36 items-center gap-2">
            <InlineBar value={r.registrationRate} max={1} />
            <span className="w-10 text-right text-sm tabular-nums">{formatPercent(r.registrationRate)}</span>
          </div>
        ),
    },
    {
      key: "actRate",
      header: "Active of registered",
      sortValue: (r) => r.activationRate ?? -1,
      cell: (r) => (r.activationRate === null ? <Hidden min={d.minGroupSize} /> : <span className="text-sm font-medium tabular-nums">{formatPercent(r.activationRate)}</span>),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered" value={formatNumber(d.funnel.registered)} icon={UserPlus} tone="sky" hint={`${formatPercent(d.rates.registration)} of invited · ${formatNumber(d.newRegistrations)} new in period`} />
        <StatCard label="Active" value={formatNumber(d.funnel.active)} icon={UserCheck} tone="emerald" hint={`${formatPercent(d.rates.activation)} of registered · activity or sign-in in period`} />
        <StatCard label="Inactive" value={formatNumber(d.funnel.inactive)} icon={UserRoundX} tone="slate" hint={`${formatPercent(d.rates.inactive)} of registered · no activity for 21+ days`} />
        <StatCard label="Invitations not accepted" value={formatNumber(d.funnel.pending)} icon={MailWarning} tone="amber" hint={`${formatNumber(d.funnel.deactivated)} deactivated (excluded)`} href="/business-portal/employees?status=invited" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard className="lg:col-span-2" title="Adoption funnel" description="From invitation to regular use.">
          <ol className="space-y-4">
            {stages.map((s, i) => {
              const pct = d.funnel.invited ? s.value / d.funnel.invited : 0
              return (
                <li key={s.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {s.label} <span className="font-normal text-muted-foreground">· {formatPercent(pct)}</span>
                    </span>
                    <span className="font-heading text-lg font-bold tabular-nums">{formatNumber(s.value)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: `color-mix(in oklch, var(--primary) ${55 + i * 22}%, var(--muted))` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.note}</p>
                </li>
              )
            })}
          </ol>
        </SectionCard>
        <SectionCard className="lg:col-span-3" title="Registered and active employees" description="Registered is cumulative; active is employees with a wellness activity or sign-in that day.">
          <TrendChart
            data={d.trend}
            series={[
              { key: "registered", label: "Registered" },
              { key: "active", label: "Active" },
            ]}
            variant="line"
            xFormatter={(v) => formatShortDate(v)}
            height={260}
          />
        </SectionCard>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-base font-semibold">By department</h3>
          <p className="text-sm text-muted-foreground">Departments with fewer than {d.minGroupSize} people show no rates.</p>
        </div>
        <DataTable columns={columns} rows={d.byDepartment} getRowId={(r) => r.id} emptyTitle="No departments yet." />
      </section>
    </div>
  )
}
