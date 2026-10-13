"use client"

import { CalendarDays, Coins, Gift, MapPin, Users } from "lucide-react"
import { formatDate, pluralize } from "@/lib/format"
import type { ChallengeMetric, ChallengeType } from "@/lib/types"
import { formatMetricValue, METRIC_META, typeLabel } from "./challenge-meta"

export interface ChallengePreviewData {
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  type: ChallengeType
  teamUnit?: "department" | "team"
  metric: ChallengeMetric
  customMetricLabel?: string
  target: number
  startDate: string
  endDate: string
  points: number
  reward?: { name: string; imageEmoji: string } | null
  rules: string[]
  durationDays: number
  warmupStartDate?: string
  prizes?: { place: 1 | 2 | 3; label: string }[]
  journey?: { name: string; totalKm: number } | null
}

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" } as const

/** The challenge card as employees will see it in the app. */
export function ChallengePreview({ data }: { data: ChallengePreviewData }) {
  const target = data.target > 0 ? formatMetricValue(data.target, data.metric, data.customMetricLabel) : "Set a target"
  const perDay = data.target > 0 && data.durationDays > 0 ? data.target / data.durationDays : 0
  const goalLine =
    data.type === "collaborative"
      ? "Together, everyone adds to one shared goal."
      : data.type === "team"
        ? `Your ${data.teamUnit === "team" ? "team" : "department"} competes on average per member.`
        : data.type === "leaderboard"
          ? "Highest total wins. Rankings update daily."
          : perDay > 0
            ? `That's ${METRIC_META[data.metric].dailyHint?.(perDay) ?? ""}.`
            : ""
  return (
    <div className="space-y-3 text-[13px]">
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/5">
        <div className="relative flex h-28 items-center justify-center" style={{ background: `linear-gradient(135deg, ${data.coverColor}, ${data.coverColor}b3)` }}>
          <span className="text-5xl drop-shadow">{data.coverEmoji || "🏆"}</span>
          <span className="absolute top-2 left-2 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-medium text-white">{typeLabel(data.type, data.teamUnit)}</span>
        </div>
        <div className="space-y-3 p-3">
          <div>
            <p className="font-heading text-base leading-tight font-bold break-words">{data.name || "Challenge name"}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays className="size-3" />
              {data.startDate ? `${data.startDate <= formatDate(new Date(), "yyyy-MM-dd") ? "Started" : "Starts"} ${formatDate(data.startDate, "EEE d MMM")}` : "Pick dates"}
              {data.durationDays > 0 ? ` · ${pluralize(data.durationDays, "day")}` : ""}
            </p>
          </div>
          {data.description ? <p className="line-clamp-3 text-[12px] leading-snug text-muted-foreground">{data.description}</p> : null}
          <div className="rounded-xl bg-muted/60 p-2.5">
            <p className="text-[11px] text-muted-foreground">{data.type === "collaborative" ? "Company goal" : "Your goal"}</p>
            <p className="font-semibold">{target}</p>
            {goalLine ? <p className="mt-0.5 text-[11px] text-muted-foreground">{goalLine}</p> : null}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full w-[4%] rounded-full" style={{ backgroundColor: data.coverColor }} />
            </div>
          </div>
          {data.warmupStartDate ? (
            <p className="rounded-lg bg-teal-500/10 px-2.5 py-1.5 text-[11px] text-teal-800 dark:text-teal-200">Warm-up from {formatDate(data.warmupStartDate, "EEE d MMM")} — join early and connect your tracker.</p>
          ) : null}
          {data.journey ? (
            <p className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px]">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">
                {data.journey.name || "Walking journey"} · {data.journey.totalKm} km
              </span>
            </p>
          ) : null}
          {data.prizes?.length ? (
            <div className="space-y-1">
              {data.prizes.map((p) => (
                <p key={p.place} className="flex items-center gap-1.5 text-[11px]">
                  <span>{MEDALS[p.place]}</span>
                  <span className="truncate">{p.label}</span>
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {data.points > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                <Coins className="size-3" /> +{data.points} pts
              </span>
            ) : null}
            {data.reward ? (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
                <Gift className="size-3 shrink-0" /> <span className="truncate">{data.reward.imageEmoji} {data.reward.name}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <Users className="size-3" /> Join to take part
            </span>
          </div>
          <div className="flex h-9 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: data.coverColor }}>
            Join challenge
          </div>
        </div>
      </div>
      {data.rules.filter(Boolean).length > 0 ? (
        <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-foreground/5">
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Rules</p>
          <ul className="space-y-1">
            {data.rules
              .filter(Boolean)
              .slice(0, 3)
              .map((r, i) => (
                <li key={i} className="flex gap-1.5 text-[12px] leading-snug">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="break-words">{r}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
