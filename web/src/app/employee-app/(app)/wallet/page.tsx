"use client"

import { ArrowRight, Coins, Gift, History, Info, Package, Sparkles, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { BarsChart } from "@/components/common/charts"
import { EmptyState } from "@/components/common/states"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { ResponsiveSheet } from "@/components/employee/engage/sheet"
import { TxDetail, TxRow } from "@/components/employee/engage/wallet-ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { gamificationApi, type TxView, type WalletSummary } from "@/lib/api/employee/gamification"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"

/** SCR-M-052 Points Wallet. */
export default function WalletPage() {
  const q = useApiQuery(["employee", "wallet"], () => gamificationApi.wallet())
  return (
    <EngagePage title="Points wallet" description="Earn points for healthy habits and spend them on rewards.">
      {q.error ? (
        <LoadError title="Couldn't load your wallet." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <>
          <Skeleton className="h-52 rounded-3xl" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </>
      ) : (
        <Wallet w={q.data} />
      )}
    </EngagePage>
  )
}

function Wallet({ w }: { w: WalletSummary }) {
  const [selected, setSelected] = useState<TxView | null>(null)
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-5 text-white shadow-lg shadow-orange-500/25 sm:p-7">
        <div className="bg-grid absolute inset-0 opacity-10" />
        <Coins className="absolute -top-6 -right-6 size-40 text-white/10" aria-hidden />
        <div className="relative space-y-5">
          <div>
            <p className="text-sm font-medium text-white/85">Available points</p>
            <p className="font-heading text-5xl font-extrabold tracking-tight tabular-nums">{formatNumber(w.available)}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/90">
              <TrendingUp className="size-4" /> +{formatNumber(w.earnedThisMonth)} earned this month
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">Lifetime points</p>
              <p className="font-heading text-xl font-bold tabular-nums">{formatNumber(w.lifetime)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">Redeemed</p>
              <p className="font-heading text-xl font-bold tabular-nums">{formatNumber(w.redeemed)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="h-11 rounded-xl bg-white text-orange-600 hover:bg-white/90">
              <Link href="/employee-app/rewards">
                <Gift data-icon="inline-start" /> Browse rewards
              </Link>
            </Button>
            <Button asChild size="lg" className="h-11 rounded-xl bg-white/15 text-white hover:bg-white/25">
              <Link href="/employee-app/orders">
                <Package data-icon="inline-start" /> My orders
                {w.openOrders ? <span className="ml-1 rounded-full bg-white px-1.5 text-xs font-bold text-orange-600">{w.openOrders}</span> : null}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {w.nextReward ? (
        <Link href={`/employee-app/rewards/${w.nextReward.id}`} className="group">
          <Card className="gap-0 py-0 transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${w.nextReward.color}22` }}>
                {w.nextReward.emoji}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm">
                  <span className="font-semibold">{formatNumber(w.nextReward.needMore)} more points</span> <span className="text-muted-foreground">for {w.nextReward.name}</span>
                </p>
                <Progress value={(w.available / w.nextReward.pointsCost) * 100} className="h-2 [&>div]:bg-amber-500" />
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold">Points earned per week</h2>
              <span className="text-xs text-muted-foreground">Last 8 weeks</span>
            </div>
            <BarsChart data={w.weekly} categoryKey="week" series={[{ key: "earned", label: "Points earned" }]} height={220} />
            <div className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Available = lifetime {formatNumber(w.lifetime)} − redeemed {formatNumber(w.redeemed)}
                {w.adjustments ? ` ${w.adjustments > 0 ? "+" : "−"} adjustments ${formatNumber(Math.abs(w.adjustments))}` : ""} = <span className="font-semibold text-foreground">{formatNumber(w.available)}</span>.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 pb-2 sm:px-5">
              <h2 className="font-heading text-base font-semibold">Recent activity</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link href="/employee-app/wallet/history">
                  <History data-icon="inline-start" /> See all
                </Link>
              </Button>
            </div>
            {w.recent.length ? (
              <div className="divide-y">
                {w.recent.map((t) => (
                  <TxRow key={t.id} t={t} onClick={() => setSelected(t)} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Sparkles} title="Earn points by logging activity, workouts and challenges." className="m-4 py-10" />
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsiveSheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title="Transaction">
        {selected ? <TxDetail t={selected} /> : null}
      </ResponsiveSheet>
    </>
  )
}
