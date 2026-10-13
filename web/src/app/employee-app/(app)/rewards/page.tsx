"use client"

import { Coins, Gift, Package, SearchX, Wallet } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { SearchInput } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { ChipTabs, EngagePage, LoadError } from "@/components/employee/engage/page"
import { RewardCard } from "@/components/employee/engage/reward-ui"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { rewardsApi } from "@/lib/api/employee/rewards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-054 Rewards Catalogue. */
export default function RewardsPage() {
  return (
    <Suspense fallback={<EngagePage title="Rewards"><Skeleton className="h-96 rounded-3xl" /></EngagePage>}>
      <Rewards />
    </Suspense>
  )
}

function Rewards() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const category = params.get("category") ?? "all"
  const affordable = params.get("affordable") === "1"
  const search = params.get("q") ?? ""
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (v === null || v === "") next.delete(k)
    else next.set(k, v)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const q = useApiQuery(["employee", "rewards", category, affordable, search], () => rewardsApi.catalogue({ categoryId: category, affordable, search }), { placeholderData: (prev) => prev })
  const d = q.data

  return (
    <EngagePage
      size="wide"
      title="Rewards"
      description="Redeem your points for vouchers, gear, experiences and company perks."
      actions={
        <Button asChild variant="outline" size="lg" className="rounded-xl">
          <Link href="/employee-app/orders">
            <Package data-icon="inline-start" /> My orders
          </Link>
        </Button>
      }
    >
      <Link href="/employee-app/wallet" className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 p-4 text-white shadow-lg shadow-orange-500/20 sm:p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Coins className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/85">Your balance</p>
          <p className="font-heading text-2xl font-extrabold tabular-nums sm:text-3xl">{d ? formatNumber(d.balance) : "—"} <span className="text-base font-semibold text-white/85">points</span></p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold sm:inline-flex">
          <Wallet className="size-4" /> Wallet
        </span>
      </Link>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={(v) => set("q", v)} placeholder="Search rewards…" className="sm:w-80 [&_input]:h-10 [&_input]:rounded-xl" />
          <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2">
            <Switch id="affordable" checked={affordable} onCheckedChange={(v) => set("affordable", v ? "1" : null)} />
            <Label htmlFor="affordable" className="text-sm font-medium">
              Affordable only
            </Label>
          </div>
        </div>
        <ChipTabs
          ariaLabel="Category"
          value={category}
          onChange={(v) => set("category", v === "all" ? null : v)}
          options={[{ value: "all", label: "All", icon: <Gift className="size-4" /> }, ...(d?.categories ?? []).map((c) => ({ value: c.id, label: c.name, icon: <span>{c.icon}</span>, count: c.count }))]}
        />
      </div>

      {q.error && !d ? (
        <LoadError title="Couldn't load rewards." error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : d.totalVisible === 0 ? (
        <EmptyState icon={Gift} title="No rewards available yet. Your company will add rewards soon." />
      ) : d.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={affordable ? "Nothing you can afford here yet" : "No rewards match your search"}
          description={affordable ? "Keep earning points — or turn off 'Affordable only' to see everything." : "Try another word or category."}
          action={
            <Button variant="outline" onClick={() => router.replace(pathname, { scroll: false })}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4", q.isFetching && "opacity-70 transition-opacity")}>
          {d.items.map((r) => (
            <RewardCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </EngagePage>
  )
}
