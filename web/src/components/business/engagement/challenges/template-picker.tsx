"use client"

import { ArrowRight, Coins, PencilLine, Sparkles, Timer } from "lucide-react"
import { SectionCard } from "@/components/common/misc"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber, pluralize, titleCase } from "@/lib/format"
import type { ChallengeTemplate } from "@/lib/types"
import { formatMetricValue, typeLabel } from "./challenge-meta"

/** Step 1 of the challenge composer: start from a HealthX template or from scratch. */
export function ChallengeTemplatePicker({ templates, loading, onPick }: { templates: ChallengeTemplate[]; loading?: boolean; onPick: (template: ChallengeTemplate | null) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => onPick(null)}
        className="group flex items-center gap-4 rounded-xl border border-dashed bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PencilLine className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-semibold">Start from scratch</span>
          <span className="block text-sm text-muted-foreground">Pick your own type, metric, target and dates.</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> HealthX templates
          </span>
        }
        description="Proven challenges with ready-made targets and rules. You can change everything on the next step."
      >
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No templates are published right now — start from scratch instead.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t)}
                className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex h-16 items-center justify-between px-4" style={{ background: `linear-gradient(135deg, ${t.coverColor}, ${t.coverColor}b3)` }}>
                  <span className="text-3xl drop-shadow-sm">{t.coverEmoji}</span>
                  <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white">{titleCase(t.category)}</span>
                </span>
                <span className="flex flex-1 flex-col gap-2 p-3.5">
                  <span className="font-semibold">{t.name}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{t.description}</span>
                  <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="secondary">{typeLabel(t.type)}</Badge>
                    <Badge variant="outline">{formatMetricValue(t.target, t.metric, undefined, true)}</Badge>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5" /> {pluralize(t.durationDays, "day")}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Coins className="size-3.5" /> {formatNumber(t.points)} pts
                    </span>
                    <span className="ml-auto">Used {formatNumber(t.usageCount)}×</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
