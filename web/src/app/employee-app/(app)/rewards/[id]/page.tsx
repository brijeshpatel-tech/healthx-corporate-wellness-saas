"use client"

import { ArrowLeft, Boxes, Building2, ChevronLeft, ChevronRight, Coins, FileText, Mail, PackageCheck, ShieldAlert, ShoppingBag, Truck, UserRound } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useRef, useState } from "react"
import { EmptyState } from "@/components/common/states"
import { EngagePage, IconTile, LoadError } from "@/components/employee/engage/page"
import { RewardImage } from "@/components/employee/engage/reward-ui"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { rewardsApi, type RewardDetail } from "@/lib/api/employee/rewards"
import { useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-055 Reward Detail. */
export default function RewardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "reward", id], () => rewardsApi.detail({ id }))
  return (
    <EngagePage>
      <Link href="/employee-app/rewards" className="-mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Rewards
      </Link>
      {q.error ? (
        q.error.status === 404 ? (
          <EmptyState
            icon={ShoppingBag}
            title="This reward is no longer available."
            description="It may have been removed from your company's catalogue."
            action={
              <Button asChild>
                <Link href="/employee-app/rewards">Browse rewards</Link>
              </Button>
            }
          />
        ) : (
          <LoadError title="Couldn't load this reward." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        </div>
      ) : (
        <Detail r={q.data} />
      )}
    </EngagePage>
  )
}

const DELIVERY_ICON = { digital_voucher: Mail, physical: Truck, experience: Mail, donation: PackageCheck, company_perk: UserRound } as const

function Gallery({ r }: { r: RewardDetail }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const slides = [
    { key: "main", node: <RewardImage emoji={r.emoji} color={r.color} size="lg" className="rounded-none" /> },
    {
      key: "pattern",
      node: (
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}99)` }}>
          <div className="bg-grid absolute inset-0 opacity-20" />
          <span className="relative text-8xl drop-shadow-lg">{r.emoji}</span>
          <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">{r.categoryName}</span>
        </div>
      ),
    },
    {
      key: "closeup",
      node: (
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted">
          <span className="text-[11rem] leading-none opacity-90">{r.emoji}</span>
        </div>
      ),
    },
  ]
  const go = (i: number) => {
    const n = (i + slides.length) % slides.length
    setIndex(n)
    track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: "smooth" })
  }
  return (
    <div className="relative overflow-hidden rounded-3xl border shadow-sm">
      <div
        ref={track}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget
          const i = Math.round(el.scrollLeft / el.clientWidth)
          if (i !== index) setIndex(i)
        }}
      >
        {slides.map((s) => (
          <div key={s.key} className="w-full shrink-0 snap-center">
            {s.node}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => go(index - 1)} className="absolute top-1/2 left-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 shadow sm:flex" aria-label="Previous image">
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" onClick={() => go(index + 1)} className="absolute top-1/2 right-2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 shadow sm:flex" aria-label="Next image">
        <ChevronRight className="size-5" />
      </button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <button key={s.key} type="button" onClick={() => go(i)} className={cn("h-1.5 rounded-full bg-white/70 shadow transition-all", i === index ? "w-5 bg-white" : "w-1.5")} aria-label={`Image ${i + 1}`} />
        ))}
      </div>
    </div>
  )
}

function Detail({ r }: { r: RewardDetail }) {
  const DeliveryIcon = DELIVERY_ICON[r.delivery]
  const cta = r.canRedeem ? (
    <Button asChild size="lg" className="h-12 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/25">
      <Link href={`/employee-app/rewards/${r.id}/redeem`}>Redeem for {formatNumber(r.pointsCost)} pts</Link>
    </Button>
  ) : (
    <Button size="lg" className="h-12 w-full rounded-xl text-base" disabled>
      Redeem
    </Button>
  )

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Gallery r={r} />

        <div className="flex min-w-0 flex-col gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-muted-foreground">{r.categoryName}</span>
              {r.companyReward ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 font-semibold text-sky-700 dark:text-sky-300">
                  <Building2 className="size-3" /> Company reward
                </span>
              ) : null}
              {r.provider ? <span className="text-muted-foreground">· by {r.provider}</span> : null}
            </div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{r.name}</h1>
            <p className="inline-flex items-center gap-1.5 font-heading text-2xl font-extrabold text-amber-600 tabular-nums dark:text-amber-400">
              <Coins className="size-6" /> {formatNumber(r.pointsCost)} <span className="text-base font-semibold text-muted-foreground">points</span>
            </p>
          </div>

          <p className="text-[15px] leading-relaxed text-muted-foreground">{r.description}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border p-3">
              <IconTile icon={DeliveryIcon} tone="sky" size="sm" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Delivery</p>
                <p className="text-sm font-semibold">{r.deliveryLabel}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border p-3">
              <IconTile icon={Boxes} tone={r.outOfStock ? "rose" : r.lowStock ? "amber" : "emerald"} size="sm" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Availability</p>
                <p className="text-sm font-semibold">{r.outOfStock ? "Out of stock" : r.stock === null ? "In stock" : r.lowStock ? `Only ${r.stock} left` : `${formatNumber(r.stock)} in stock`}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.perEmployeeLimit ? `Limit ${r.perEmployeeLimit} per person · you've redeemed ${r.myRedemptions}` : "No per-person limit"}
                </p>
              </div>
            </div>
          </div>

          <Card className="gap-0 py-0">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your balance</span>
                <span className="font-semibold tabular-nums">{formatNumber(r.balance)} pts</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reward cost</span>
                <span className="font-semibold tabular-nums">−{formatNumber(r.pointsCost)} pts</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="font-medium">Balance after redemption</span>
                <span className={cn("font-heading text-lg font-extrabold tabular-nums", r.balanceAfter < 0 && "text-destructive")}>{formatNumber(r.balanceAfter)} pts</span>
              </div>
              {r.blockedReason ? (
                <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="size-4 shrink-0" /> {r.blockedReason}
                </p>
              ) : r.approvalRequired ? (
                <p className="text-xs text-muted-foreground">Your company approves redemptions before they&apos;re fulfilled. Points are refunded if an order is rejected.</p>
              ) : null}
              <div className="hidden md:block">{cta}</div>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible defaultValue="terms" className="rounded-2xl border px-4">
            <AccordionItem value="terms" className="border-b-0">
              <AccordionTrigger className="text-sm font-semibold">
                <span className="inline-flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" /> Terms & conditions
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                <p>{r.terms}</p>
                <p className="mt-2">Points are deducted when you place the order and refunded automatically if it&apos;s cancelled or rejected.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="sticky bottom-[4.75rem] z-20 -mx-1 md:hidden">
        <div className="flex items-center gap-3 rounded-2xl border bg-background/95 p-2.5 shadow-xl backdrop-blur">
          <div className="shrink-0 pl-1.5">
            <p className="text-[11px] text-muted-foreground">Cost</p>
            <p className="font-heading font-extrabold text-amber-600 tabular-nums dark:text-amber-400">{formatNumber(r.pointsCost)}</p>
          </div>
          <div className="flex-1">{cta}</div>
        </div>
      </div>
    </>
  )
}
