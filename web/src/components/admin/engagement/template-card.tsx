"use client"

import { Coins, Timer, TrendingUp } from "lucide-react"
import { StatusBadge } from "@/components/common/status-badge"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatNumber, formatRelative, pluralize } from "@/lib/format"
import type { ChallengeMetric, ChallengeTemplate, ChallengeType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CHALLENGE_TYPE_META, METRIC_META, TEMPLATE_CATEGORY_META, dailyHint, formatTarget } from "./meta"

export interface TemplateLike {
  name: string
  description: string
  category: ChallengeTemplate["category"]
  type: ChallengeType
  metric: ChallengeMetric
  target: number
  durationDays: number
  points: number
  coverEmoji: string
  coverColor: string
  rules: string[]
}

/** Coloured banner with the cover emoji and category pill (same look as the Business Portal template picker). */
export function TemplateBanner({ emoji, color, category, className }: { emoji: string; color: string; category: ChallengeTemplate["category"]; className?: string }) {
  return (
    <div className={cn("flex h-20 items-center justify-between px-4", className)} style={{ background: `linear-gradient(135deg, ${color}, ${color}b3)` }}>
      <span className="text-4xl drop-shadow-sm">{emoji || "🏆"}</span>
      <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-medium text-white">{TEMPLATE_CATEGORY_META[category]?.label ?? category}</span>
    </div>
  )
}

/** Grid card on the templates list. */
export function TemplateCard({ template: t, actions, onOpen }: { template: ChallengeTemplate; actions?: React.ReactNode; onOpen?: () => void }) {
  const TypeIcon = CHALLENGE_TYPE_META[t.type].icon
  return (
    <div className={cn("group flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md", t.status === "archived" && "opacity-75")}>
      <button type="button" onClick={onOpen} disabled={!onOpen} className="text-left focus-visible:outline-none disabled:cursor-default" aria-label={`Open ${t.name}`}>
        <TemplateBanner emoji={t.coverEmoji} color={t.coverColor} category={t.category} />
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <button type="button" onClick={onOpen} disabled={!onOpen} className="block max-w-full text-left focus-visible:underline focus-visible:outline-none disabled:cursor-default">
            <h3 className="truncate font-heading font-semibold group-hover:text-primary">{t.name}</h3>
          </button>
          <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1">
            <TypeIcon className="size-3" /> {CHALLENGE_TYPE_META[t.type].label}
          </Badge>
          <Badge variant="outline">
            {METRIC_META[t.metric].emoji} {formatTarget(t.target, t.metric, true)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Timer className="size-3.5" /> {pluralize(t.durationDays, "day")}
          </span>
          <span className="inline-flex items-center gap-1">
            <Coins className="size-3.5" /> {formatNumber(t.points)} pts
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-default items-center gap-1">
                <TrendingUp className="size-3.5" /> Used {formatNumber(t.usageCount)}×
              </span>
            </TooltipTrigger>
            <TooltipContent>Challenges companies have launched from this template</TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <StatusBadge status={t.status} label={t.status === "archived" ? "Retired" : undefined} />
          <span className="truncate text-xs text-muted-foreground">Updated {formatRelative(t.updatedAt)}</span>
          <div className="ml-auto flex items-center gap-1">{actions}</div>
        </div>
      </div>
    </div>
  )
}

/** Live preview: how companies see the template in the Business Portal. */
/** Form values can be "" while a number input is empty. */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function TemplatePreview({ value }: { value: TemplateLike }) {
  const type = CHALLENGE_TYPE_META[value.type]
  const TypeIcon = type?.icon
  const target = num(value.target)
  const days = num(value.durationDays)
  const points = num(value.points)
  const hint = target && days ? dailyHint(target, days, value.metric) : undefined
  const rules = value.rules.filter((r) => r.trim())
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <TemplateBanner emoji={value.coverEmoji} color={value.coverColor} category={value.category} className="h-24" />
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h3 className={cn("font-heading text-lg font-semibold break-words", !value.name.trim() && "text-muted-foreground")}>{value.name.trim() || "Template name"}</h3>
          <p className={cn("text-sm break-words", value.description.trim() ? "text-muted-foreground" : "text-muted-foreground/60 italic")}>{value.description.trim() || "A short description companies will see."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {type ? (
            <Badge variant="secondary" className="gap-1">
              {TypeIcon ? <TypeIcon className="size-3" /> : null} {type.label}
            </Badge>
          ) : null}
          <Badge variant="outline">
            {METRIC_META[value.metric]?.emoji} {target && target > 0 ? formatTarget(target, value.metric) : "Set a target"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted/60 p-2">
            <div className="font-heading text-lg font-bold tabular-nums">{days && days > 0 ? formatNumber(days) : "—"}</div>
            <div className="text-[11px] text-muted-foreground">days</div>
          </div>
          <div className="rounded-lg bg-muted/60 p-2">
            <div className="font-heading text-lg font-bold tabular-nums">{points !== null ? formatNumber(points) : "—"}</div>
            <div className="text-[11px] text-muted-foreground">points on completion</div>
          </div>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">Target works out to {hint}.</p> : null}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rules</p>
          {rules.length ? (
            <ol className="list-decimal space-y-1 pl-4 text-sm">
              {rules.slice(0, 5).map((r, i) => (
                <li key={i} className="break-words">
                  {r}
                </li>
              ))}
              {rules.length > 5 ? <li className="list-none text-xs text-muted-foreground">+{rules.length - 5} more</li> : null}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic">Add at least one rule.</p>
          )}
        </div>
      </div>
    </div>
  )
}
