"use client"

import { ArrowRight, Gift, Package, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CatalogueTable } from "@/components/business/engagement/rewards/catalogue-table"
import { CompanyRewardsTable } from "@/components/business/engagement/rewards/company-rewards-table"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rewardsApi } from "@/lib/api/business/rewards"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { pluralize } from "@/lib/format"

type Tab = "company" | "catalogue"

function RewardsPage() {
  const can = useCan()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab: Tab = params.get("tab") === "catalogue" ? "catalogue" : "company"
  const setTab = (t: Tab) => router.replace(t === "company" ? pathname : `${pathname}?tab=${t}`, { scroll: false })

  // Tab counts (cheap query shared by both tabs).
  const counts = useApiQuery(["business", "rewards", { scope: "company" }], () => rewardsApi.list({ scope: "company" }))

  return (
    <PageContainer>
      <PageHeader
        title="Rewards"
        description="Manage your company rewards and choose which HealthX catalogue rewards your employees can redeem."
        actions={
          <>
            {can("orders.view") ? (
              <Button asChild variant="outline">
                <Link href="/business-portal/orders">
                  <Package data-icon="inline-start" /> Orders
                </Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/business-portal/rewards/new">
                <Plus data-icon="inline-start" /> Add reward
              </Link>
            </Button>
          </>
        }
      />

      {counts.data && counts.data.counts.pendingOrders > 0 && can("orders.manage") ? (
        <Link
          href="/business-portal/orders?status=pending_approval"
          className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/14 text-amber-600 dark:text-amber-400">
              <Gift className="size-4.5" />
            </span>
            <span className="text-sm">
              <span className="font-semibold">{pluralize(counts.data.counts.pendingOrders, "reward order")}</span> waiting for your approval
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList className="h-9">
          <TabsTrigger value="company" className="px-3">
            Company rewards
            {counts.data ? <span className="ml-1 rounded-md bg-background/70 px-1.5 text-[11px] tabular-nums dark:bg-background/30">{counts.data.counts.company}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="catalogue" className="px-3">
            HealthX catalogue
            {counts.data ? <span className="ml-1 rounded-md bg-background/70 px-1.5 text-[11px] tabular-nums dark:bg-background/30">{counts.data.counts.catalogue}</span> : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanyRewardsTable />
        </TabsContent>
        <TabsContent value="catalogue">
          <CatalogueTable />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <RewardsPage />
    </Suspense>
  )
}
