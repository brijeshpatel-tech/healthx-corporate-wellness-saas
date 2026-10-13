"use client"

import { Archive, Building2, CheckCircle2, FilePen, Headset, MoreHorizontal, Pencil, Users } from "lucide-react"
import Link from "next/link"
import { ModuleBadges } from "@/components/admin/module-picker"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SUPPORT_LEVEL_SHORT, type PlanRow, type PlanStatus } from "@/lib/api/platform/plans"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export const employeeRange = (p: Pick<PlanRow, "minEmployees" | "maxEmployees">) =>
  p.maxEmployees === null ? `${formatNumber(p.minEmployees)}+ employees` : `${formatNumber(p.minEmployees)}–${formatNumber(p.maxEmployees)} employees`

/** SCR-P-008 plan card. */
export function PlanCard({ plan, canManage, onStatus }: { plan: PlanRow; canManage: boolean; onStatus: (plan: PlanRow, status: PlanStatus) => void }) {
  return (
    <Card className={cn("gap-0 py-0", plan.status === "archived" && "opacity-75")}>
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading truncate text-lg font-semibold">{plan.name}</h2>
              <StatusBadge status={plan.status} />
            </div>
            <div className="font-mono text-xs text-muted-foreground">{plan.code}</div>
          </div>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${plan.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/admin-portal/plans/${plan.id}`}>
                    <Pencil /> Edit plan
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {plan.status !== "active" ? (
                  <DropdownMenuItem onClick={() => onStatus(plan, "active")}>
                    <CheckCircle2 /> Activate
                  </DropdownMenuItem>
                ) : null}
                {plan.status === "active" ? (
                  <DropdownMenuItem onClick={() => onStatus(plan, "draft")}>
                    <FilePen /> Move to draft
                  </DropdownMenuItem>
                ) : null}
                {plan.status !== "archived" ? (
                  <DropdownMenuItem variant="destructive" onClick={() => onStatus(plan, "archived")}>
                    <Archive /> Archive
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">{plan.description}</p>

        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">{formatCurrency(plan.pricePerEmployee, plan.currency)}</span>
            <span className="text-sm text-muted-foreground">/ active employee / month</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Billed {plan.billingCycle === "annual" ? "annually" : "monthly"} · {plan.currency}</div>
        </div>

        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {employeeRange(plan)}
          </li>
          <li className="flex items-center gap-2">
            <Headset className="size-4 text-muted-foreground" />
            {SUPPORT_LEVEL_SHORT[plan.supportLevel]} support
          </li>
        </ul>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">{plan.modules.length} modules included</div>
          <ModuleBadges modules={plan.modules} max={6} />
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-3 border-t bg-muted/30 p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5" /> Companies on plan
          </div>
          <div className="font-heading text-lg font-semibold tabular-nums">{formatNumber(plan.companiesOnPlan)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">MRR on plan</div>
          <div className="font-heading text-lg font-semibold tabular-nums">{formatCurrency(plan.mrr, plan.currency)}</div>
        </div>
        {canManage ? (
          <Button asChild variant="outline" className="col-span-2">
            <Link href={`/admin-portal/plans/${plan.id}`}>
              <Pencil data-icon="inline-start" /> Edit plan
            </Link>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}
