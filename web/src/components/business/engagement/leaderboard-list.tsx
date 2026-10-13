"use client"

import { ArrowDown, ArrowUp, CheckCircle2, Crown, Minus } from "lucide-react"
import { UserAvatar } from "@/components/common/user-avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { LeaderboardEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

export type RankedEntry = LeaderboardEntry & { completed?: boolean; progress?: number; highlight?: boolean; hiddenReason?: string }

/** Up/down arrow with the number of places moved since the previous period. */
export function RankMovement({ rank, previousRank, className }: { rank: number; previousRank?: number; className?: string }) {
  if (previousRank === undefined) return <span className={cn("inline-flex w-9 justify-center text-[10px] font-semibold text-sky-600 dark:text-sky-400", className)}>NEW</span>
  const diff = previousRank - rank
  if (diff === 0)
    return (
      <span className={cn("inline-flex w-9 items-center justify-center text-muted-foreground", className)} aria-label="No change">
        <Minus className="size-3.5" />
      </span>
    )
  const up = diff > 0
  return (
    <span
      className={cn("inline-flex w-9 items-center justify-center gap-0.5 text-xs font-semibold tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400", className)}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(diff)} places`}
    >
      {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {Math.abs(diff)}
    </span>
  )
}

const groupInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

const MEDAL = ["bg-amber-400/20 text-amber-700 dark:text-amber-300", "bg-slate-400/20 text-slate-600 dark:text-slate-300", "bg-orange-400/20 text-orange-700 dark:text-orange-300"]

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", rank <= 3 ? MEDAL[rank - 1] : "bg-muted text-muted-foreground")}>{rank}</span>
  )
}

/** Ranked rows: rank, movement, avatar, name, value (and optional progress bar). */
export function LeaderboardList({
  entries,
  formatValue,
  showProgress,
  barColor = "var(--primary)",
  maxValue,
  avatars = true,
  className,
}: {
  entries: RankedEntry[]
  formatValue: (value: number) => string
  showProgress?: boolean
  barColor?: string
  /** When set, a relative bar is drawn against this value. */
  maxValue?: number
  avatars?: boolean
  className?: string
}) {
  return (
    <div className={cn("@container", className)}>
      <ol className="divide-y">
        {entries.map((e) => {
          const pct = showProgress ? Math.round((e.progress ?? 0) * 100) : maxValue ? Math.round((e.value / maxValue) * 100) : null
          return (
            <li key={e.id} className={cn("flex items-center gap-2.5 py-2.5 @md:gap-3", (e.isMe || e.highlight) && "-mx-2 rounded-lg bg-primary/6 px-2")}>
              <RankBadge rank={e.rank} />
              <RankMovement rank={e.rank} previousRank={e.previousRank} className="hidden @md:inline-flex" />
              {avatars ? <UserAvatar name={e.name} color={e.avatarColor} size="sm" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{e.name}</span>
                  {e.isMe ? <span className="shrink-0 rounded bg-primary/12 px-1 text-[10px] font-semibold text-primary">YOU</span> : null}
                  {e.highlight && !e.isMe ? <span className="shrink-0 rounded bg-primary/12 px-1 text-[10px] font-semibold text-primary">YOUR TEAM</span> : null}
                  {e.rank === 1 ? <Crown className="size-3.5 shrink-0 text-amber-500" aria-label="Leader" /> : null}
                  {e.completed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-label="Completed" />
                      </TooltipTrigger>
                      <TooltipContent>Reached the target</TooltipContent>
                    </Tooltip>
                  ) : null}
                  {e.subtitle ? <span className="hidden truncate text-xs text-muted-foreground @md:inline">· {e.subtitle}</span> : null}
                </div>
                {e.subtitle || pct !== null ? (
                  <div className="mt-1 flex items-center gap-2">
                    {pct !== null ? (
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted @md:w-40">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }} />
                      </div>
                    ) : null}
                    {e.subtitle ? <span className="truncate text-xs text-muted-foreground @md:hidden">{e.subtitle}</span> : null}
                    {pct !== null && showProgress ? <span className="hidden text-xs text-muted-foreground tabular-nums @md:inline">{pct}%</span> : null}
                  </div>
                ) : null}
              </div>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-right text-sm font-semibold tabular-nums">{e.hiddenReason ?? formatValue(e.value)}</span>
                <RankMovement rank={e.rank} previousRank={e.previousRank} className="h-4 w-auto justify-end text-[11px] @md:hidden [&_svg]:size-3" />
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Top-3 podium (2nd, 1st, 3rd). */
export function Podium({ entries, formatValue, avatars = true }: { entries: RankedEntry[]; formatValue: (value: number) => string; avatars?: boolean }) {
  const top = [entries[1], entries[0], entries[2]]
  const heights = ["h-20", "h-28", "h-14"]
  const places = [2, 1, 3]
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {top.map((e, i) =>
        e ? (
          <div key={e.id} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <div className="relative">
              {places[i] === 1 ? <Crown className="absolute -top-4 left-1/2 size-5 -translate-x-1/2 text-amber-500" /> : null}
              {avatars ? (
                <UserAvatar name={e.name} color={e.avatarColor} size={places[i] === 1 ? "lg" : "md"} className={cn("ring-4", places[i] === 1 ? "ring-amber-400/40" : places[i] === 2 ? "ring-slate-400/30" : "ring-orange-400/30")} />
              ) : (
                <span className={cn("flex items-center justify-center rounded-full font-heading font-bold text-white", places[i] === 1 ? "size-14 text-lg" : "size-10")} style={{ backgroundColor: e.avatarColor }}>
                  {groupInitials(e.name)}
                </span>
              )}
            </div>
            <div className="w-full min-w-0">
              <p className="truncate text-sm font-semibold">{e.name}</p>
              <p className="text-xs font-medium text-muted-foreground tabular-nums">{formatValue(e.value)}</p>
            </div>
            <div className={cn("flex w-full items-start justify-center rounded-t-xl pt-2 font-heading text-lg font-bold", heights[i], MEDAL[places[i]! - 1])}>{places[i]}</div>
          </div>
        ) : (
          <div key={i} />
        ),
      )}
    </div>
  )
}
