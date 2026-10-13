"use client"

import { Building2, Coins, Flame, Lock } from "lucide-react"
import Link from "next/link"
import type { RewardCard as RewardCardData } from "@/lib/api/employee/rewards"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Big emoji "product image" on a soft gradient. */
export function RewardImage({ emoji, color, className, size = "md" }: { emoji: string; color: string; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", size === "sm" ? "size-12 rounded-xl text-2xl" : size === "lg" ? "aspect-[4/3] w-full rounded-3xl text-8xl" : "aspect-[4/3] w-full text-6xl", className)}
      style={{ background: `radial-gradient(circle at 30% 20%, ${color}55, transparent 60%), linear-gradient(145deg, ${color}2e, ${color}12)` }}
      aria-hidden
    >
      <span className="drop-shadow-md transition-transform duration-300 group-hover:scale-110">{emoji}</span>
    </div>
  )
}

export function RewardCard({ r }: { r: RewardCardData }) {
  const affordable = r.needMore === 0
  return (
    <Link href={`/employee-app/rewards/${r.id}`} className="group block focus-visible:outline-none">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-all group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
        <div className="relative">
          <RewardImage emoji={r.emoji} color={r.color} />
          <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
            {r.companyReward ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-card/90 px-2 text-[10px] font-semibold text-foreground shadow-xs backdrop-blur">
                <Building2 className="size-3" /> Company reward
              </span>
            ) : null}
            {r.lowStock ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-rose-500 px-2 text-[10px] font-semibold text-white shadow-xs">
                <Flame className="size-3" /> Only {r.stock} left
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">{r.categoryName}</p>
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold">{r.name}</h3>
          <div className="mt-auto space-y-1.5 pt-1">
            <p className="inline-flex items-center gap-1 font-heading text-base font-extrabold text-amber-600 tabular-nums dark:text-amber-400">
              <Coins className="size-4" />
              {formatNumber(r.pointsCost)}
            </p>
            {affordable ? (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">You can redeem this</p>
            ) : (
              <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> You need {formatNumber(r.needMore)} more points
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
