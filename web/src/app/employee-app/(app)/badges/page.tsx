"use client"

import { Award, CheckCircle2, Coins, Droplets, Flame, ListChecks, Lock, Sparkles, UsersRound } from "lucide-react"
import { useState } from "react"
import { ProgressRing } from "@/components/common/charts"
import { EmptyState } from "@/components/common/states"
import { CelebrationDialog, Medallion } from "@/components/employee/engage/celebration"
import { EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { ResponsiveSheet } from "@/components/employee/engage/sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { gamificationApi, type BadgesResult, type BadgeView, type StreakView } from "@/lib/api/employee/gamification"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate } from "@/lib/format"
import type { BadgeRarity } from "@/lib/types"
import { cn } from "@/lib/utils"

const RARITY: Record<BadgeRarity, { label: string; className: string }> = {
  common: { label: "Common", className: "bg-slate-500/12 text-slate-700 dark:text-slate-300" },
  rare: { label: "Rare", className: "bg-sky-500/12 text-sky-700 dark:text-sky-300" },
  epic: { label: "Epic", className: "bg-violet-500/12 text-violet-700 dark:text-violet-300" },
  legendary: { label: "Legendary", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
}

const STREAK_META: Record<StreakView["key"], { icon: typeof Flame; gradient: string; emoji: string }> = {
  activity: { icon: Flame, gradient: "from-orange-500 to-rose-500", emoji: "🔥" },
  hydration: { icon: Droplets, gradient: "from-cyan-500 to-sky-600", emoji: "💧" },
  habits: { icon: ListChecks, gradient: "from-emerald-500 to-teal-600", emoji: "✅" },
}

/** SCR-M-050 Badges & Achievements (+ SCR-M-051 unlock celebration). */
export default function BadgesPage() {
  const q = useApiQuery(["employee", "badges"], () => gamificationApi.badges())
  return (
    <EngagePage title="Badges & achievements" description="Unlock badges by staying active, hydrated and consistent.">
      {q.error ? (
        <LoadError title="Couldn't load badges." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <>
          <Skeleton className="h-40 rounded-3xl" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        </>
      ) : (
        <Badges data={q.data} />
      )}
    </EngagePage>
  )
}

function Badges({ data }: { data: BadgesResult }) {
  const [tab, setTab] = useState<"earned" | "locked">(data.earned ? "earned" : "locked")
  const [selected, setSelected] = useState<BadgeView | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const seen = useApiMutation(gamificationApi.markBadgeSeen)
  const earned = data.badges.filter((b) => b.earned).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
  const locked = data.badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)
  const celebrate = data.celebrate && data.celebrate.id !== dismissed ? data.celebrate : null
  const pointsFromBadges = earned.reduce((a, b) => a + b.points, 0)

  const closeCelebration = () => {
    if (!data.celebrate) return
    setDismissed(data.celebrate.id)
    seen.mutate({ id: data.celebrate.id })
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-400 p-5 text-white shadow-lg shadow-fuchsia-500/20 sm:p-6">
        <div className="bg-grid absolute inset-0 opacity-10" />
        <div className="relative flex items-center gap-5">
          <ProgressRing value={data.earned} max={data.total} size={112} stroke={11} color="white" trackColor="rgba(255,255,255,0.25)">
            <span className="font-heading text-3xl font-extrabold tabular-nums">{data.earned}</span>
            <span className="text-[11px] text-white/80">of {data.total}</span>
          </ProgressRing>
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-white/85">Badges unlocked</p>
            <p className="font-heading text-2xl leading-tight font-extrabold">{data.earned ? `${earned[0]!.icon} Latest: ${earned[0]!.name}` : "Your first badge awaits"}</p>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">
              <Coins className="size-4" /> {pointsFromBadges} bonus points earned
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Streaks</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {data.streaks.map((s) => {
            const meta = STREAK_META[s.key]
            return (
              <div key={s.key} className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-3 text-white shadow-sm sm:p-4", meta.gradient)} title={s.hint}>
                <span className="absolute -right-2 -bottom-3 text-5xl opacity-25 select-none" aria-hidden>
                  {meta.emoji}
                </span>
                <meta.icon className="size-5" />
                <p className="mt-2 font-heading text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {s.current}
                  <span className="ml-0.5 text-xs font-semibold opacity-85">days</span>
                </p>
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="text-[11px] opacity-85">Best {s.best}</p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <Segmented
          ariaLabel="Badges"
          value={tab}
          onChange={setTab}
          options={[
            { value: "earned", label: "Earned", count: earned.length },
            { value: "locked", label: "Locked", count: locked.length },
          ]}
        />
        {tab === "earned" ? (
          earned.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {earned.map((b) => (
                <BadgeTile key={b.id} b={b} onClick={() => setSelected(b)} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Award} title="Complete your first workout to earn your first badge." description="Locked badges show what to do next." action={<Button onClick={() => setTab("locked")}>See locked badges</Button>} />
          )
        ) : locked.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {locked.map((b) => (
              <BadgeTile key={b.id} b={b} onClick={() => setSelected(b)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Sparkles} title="You've unlocked every badge!" description="Legendary. New badges will appear here when they're added." />
        )}
      </div>

      <ResponsiveSheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title={selected?.name ?? "Badge"} description={selected?.description}>
        {selected ? <BadgeDetail b={selected} /> : null}
      </ResponsiveSheet>

      {celebrate ? (
        <CelebrationDialog
          open
          onOpenChange={(o) => !o && closeCelebration()}
          emoji={celebrate.icon}
          color={celebrate.color}
          eyebrow="Badge unlocked"
          title={`You unlocked ${celebrate.name}!`}
          description={celebrate.description}
          points={celebrate.points}
        >
          <Button size="lg" className="h-11 rounded-xl px-6" onClick={closeCelebration}>
            View badges
          </Button>
          <Button size="lg" variant="outline" className="h-11 rounded-xl px-6" onClick={closeCelebration}>
            Close
          </Button>
        </CelebrationDialog>
      ) : null}
    </>
  )
}

function BadgeTile({ b, onClick }: { b: BadgeView; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-4 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="relative">
        <Medallion emoji={b.icon} color={b.color} size="md" locked={!b.earned} />
        {!b.earned ? (
          <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm">
            <Lock className="size-3" />
          </span>
        ) : b.unseen ? (
          <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 text-[10px] leading-4 font-bold text-white">NEW</span>
        ) : null}
      </div>
      <div className="w-full min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold">{b.name}</p>
        {b.earned ? (
          <p className="text-xs text-muted-foreground">Earned {formatDate(b.earnedAt, "d MMM yyyy")}</p>
        ) : (
          <p className="line-clamp-2 text-xs text-muted-foreground">{b.criteria}</p>
        )}
      </div>
      {!b.earned ? (
        <div className="w-full space-y-1">
          <Progress value={b.progress * 100} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground tabular-nums">{b.progressLabel}</p>
        </div>
      ) : (
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", RARITY[b.rarity].className)}>{RARITY[b.rarity].label}</span>
      )}
    </button>
  )
}

function BadgeDetail({ b }: { b: BadgeView }) {
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      <Medallion emoji={b.icon} color={b.color} size="xl" locked={!b.earned} />
      <div className="flex flex-wrap justify-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", RARITY[b.rarity].className)}>{RARITY[b.rarity].label}</span>
        {b.points ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Coins className="size-3.5" /> +{b.points} points
          </span>
        ) : null}
      </div>
      <Card className="w-full gap-0 py-0 text-left">
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">How to earn it</p>
            <p className="text-sm font-semibold">{b.criteria}</p>
          </div>
          {b.earned ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" /> Earned on {formatDate(b.earnedAt, "d MMMM yyyy")}
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your progress</span>
                <span className="font-semibold tabular-nums">{Math.round(b.progress * 100)}%</span>
              </div>
              <Progress value={b.progress * 100} className="h-2.5" />
              <p className="text-xs text-muted-foreground tabular-nums">{b.progressLabel}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UsersRound className="size-3.5" /> Unlocked by {formatCompact(b.earnedByCount)} HealthX members
      </p>
    </div>
  )
}
