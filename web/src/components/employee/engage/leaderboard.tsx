"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Crown, EyeOff, Minus, UserRound, UsersRound } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/common/user-avatar"
import { formatNumber } from "@/lib/format"
import type { LeaderboardEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Leaderboard row as returned by the employee services. */
export interface RankEntry extends LeaderboardEntry {
  /** Name hidden by the company's anonymous mode or the person's opt-out. */
  masked?: boolean
  /** A group (department / team) rather than a person. */
  group?: boolean
}

const PODIUM = {
  1: { ring: "#f59e0b", block: "from-amber-400 to-amber-500", height: "h-24 sm:h-28", label: "1st" },
  2: { ring: "#94a3b8", block: "from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600", height: "h-16 sm:h-20", label: "2nd" },
  3: { ring: "#c2774a", block: "from-orange-300 to-orange-400 dark:from-orange-700 dark:to-orange-800", height: "h-12 sm:h-14", label: "3rd" },
} as const

function EntryAvatar({ entry, size = "md", className }: { entry: RankEntry; size?: "sm" | "md" | "lg"; className?: string }) {
  if (entry.group)
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full text-white", size === "lg" ? "size-14" : size === "md" ? "size-10" : "size-8", className)} style={{ backgroundColor: entry.avatarColor }}>
        <UsersRound className={size === "lg" ? "size-6" : "size-4"} />
      </span>
    )
  if (entry.masked && !entry.isMe)
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground", size === "lg" ? "size-14" : size === "md" ? "size-10" : "size-8", className)}>
        <UserRound className={size === "lg" ? "size-6" : "size-4"} />
      </span>
    )
  return <UserAvatar name={entry.name} color={entry.avatarColor} size={size} className={className} />
}

/** Top-3 podium (2nd · 1st · 3rd). */
export function Podium({ entries, unit, valueFormatter = (v) => formatNumber(v), className }: { entries: RankEntry[]; unit?: string; valueFormatter?: (v: number) => string; className?: string }) {
  const top = [entries.find((e) => e.rank === 2), entries.find((e) => e.rank === 1), entries.find((e) => e.rank === 3)]
  if (!top[1]) return null
  return (
    <div className={cn("grid grid-cols-3 items-end gap-2 sm:gap-4", className)}>
      {top.map((entry, i) => {
        if (!entry) return <div key={i} />
        const style = PODIUM[entry.rank as 1 | 2 | 3]
        return (
          <div key={entry.id} className="flex min-w-0 flex-col items-center gap-2 text-center">
            <div className="relative">
              {entry.rank === 1 ? <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 fill-amber-400 text-amber-500" aria-hidden /> : null}
              <span className="block rounded-full p-0.5" style={{ boxShadow: `0 0 0 3px ${style.ring}` }}>
                <EntryAvatar entry={entry} size={entry.rank === 1 ? "lg" : "md"} />
              </span>
            </div>
            <div className="w-full min-w-0">
              <p className={cn("truncate text-sm font-semibold", entry.isMe && "text-primary")}>{entry.isMe ? "You" : entry.name}</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">
                {valueFormatter(entry.value)}
                {unit ? ` ${unit}` : ""}
              </p>
            </div>
            <div className={cn("flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b pt-2 font-heading text-lg font-extrabold text-white shadow-inner", style.block, style.height)}>{entry.rank}</div>
          </div>
        )
      })}
    </div>
  )
}

function Movement({ entry }: { entry: RankEntry }) {
  if (entry.previousRank === undefined) return null
  const diff = entry.previousRank - entry.rank
  if (diff === 0) return <Minus className="size-3 text-muted-foreground" aria-label="No change" />
  return diff > 0 ? (
    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400" aria-label={`Up ${diff}`}>
      <ArrowUp className="size-3" />
      {diff}
    </span>
  ) : (
    <span className="inline-flex items-center text-[11px] font-semibold text-rose-600 dark:text-rose-400" aria-label={`Down ${-diff}`}>
      <ArrowDown className="size-3" />
      {-diff}
    </span>
  )
}

/** One ranked row with a bar relative to the leader. */
export function RankRow({
  entry,
  max,
  unit,
  valueFormatter = (v) => formatNumber(v),
  pinned,
  className,
}: {
  entry: RankEntry
  max: number
  unit?: string
  valueFormatter?: (v: number) => string
  pinned?: boolean
  className?: string
}) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (entry.value / max) * 100)) : 0
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 sm:px-4",
        entry.isMe && "bg-primary/8 ring-1 ring-primary/25 ring-inset",
        pinned && "rounded-2xl border border-primary/30 bg-card shadow-lg shadow-primary/10 ring-0",
        className,
      )}
    >
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span className={cn("font-heading text-sm font-bold tabular-nums", entry.rank <= 3 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>#{entry.rank}</span>
        <Movement entry={entry} />
      </div>
      <EntryAvatar entry={entry} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm font-medium", entry.masked && !entry.isMe && "text-muted-foreground")}>{entry.name}</span>
          {entry.isMe ? <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] leading-4 font-bold text-primary-foreground uppercase">You</span> : null}
          {entry.masked && entry.isMe ? <EyeOff className="size-3 shrink-0 text-muted-foreground" aria-label="Hidden from others" /> : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", entry.isMe ? "bg-primary" : "bg-primary/45")} style={{ width: `${pct}%` }} />
        </div>
        {entry.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{entry.subtitle}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{valueFormatter(entry.value)}</p>
        {unit ? <p className="text-[11px] text-muted-foreground">{unit}</p> : null}
      </div>
    </div>
  )
}

const NAME_MODE_TEXT: Record<"full_name" | "first_name_initial" | "anonymous", string> = {
  full_name: "Colleagues are shown by full name",
  first_name_initial: "Colleagues are shown by first name and last initial",
  anonymous: "Colleagues are anonymous — only you see your own name",
}

/** Footnote explaining the company's leaderboard privacy setting. */
export function NameDisplayNote({ mode, optedOut, className }: { mode: "full_name" | "first_name_initial" | "anonymous"; optedOut?: boolean; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 px-1 text-xs text-muted-foreground", className)}>
      <EyeOff className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {NAME_MODE_TEXT[mode]} (your company&apos;s setting).{" "}
        {optedOut ? "You've hidden yourself from leaderboards — others see you as “Anonymous”." : "You can appear as “Anonymous” — change it in Privacy & consent."}
      </span>
    </p>
  )
}

/**
 * Ranked list with the viewer's row pinned at the bottom when it isn't visible
 * (spec: "my row pinned and highlighted").
 */
export function RankList({
  entries,
  me,
  unit,
  valueFormatter,
  skipTop = 0,
  className,
}: {
  entries: RankEntry[]
  me?: RankEntry | null
  unit?: string
  valueFormatter?: (v: number) => string
  /** Hide the first N rows (already shown on the podium). */
  skipTop?: number
  className?: string
}) {
  const max = entries[0]?.value ?? me?.value ?? 0
  const rows = entries.slice(skipTop)
  const meVisible = !me || entries.some((e) => e.isMe)
  return (
    <div className={cn("space-y-3", className)}>
      {rows.length ? (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
          {rows.map((e) => (
            <RankRow key={e.id} entry={e} max={max} unit={unit} valueFormatter={valueFormatter} />
          ))}
        </div>
      ) : null}
      {!meVisible && me ? (
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <RankRow entry={me} max={max} unit={unit} valueFormatter={valueFormatter} pinned />
        </div>
      ) : null}
    </div>
  )
}

/** #348 — show a rank-change alert once (the service also adds it to the notification centre). */
export function useRankAlertToast(alert: string | null | undefined) {
  const qc = useQueryClient()
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!alert || shown.current === alert) return
    shown.current = alert
    toast(alert, { description: "Rank-change alert · saved in your notifications" })
    void qc.invalidateQueries({ queryKey: ["employee", "notifications"] })
  }, [alert, qc])
}
