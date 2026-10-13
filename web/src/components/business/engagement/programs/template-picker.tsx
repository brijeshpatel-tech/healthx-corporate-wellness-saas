"use client"

import { ArrowRight, FilePlus2, Users } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProgramTemplate } from "@/lib/api/business/programs"
import { formatCompact, formatPercent, pluralize } from "@/lib/format"
import { PROGRAM_METRIC_META } from "./program-meta"

/** Step zero of SCR-B-031: start from a HealthX template or from scratch. */
export function TemplatePicker({ templates, loading }: { templates: ProgramTemplate[]; loading?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)
        : templates.map((t) => (
            <Card key={t.id} className="group relative gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/20">
              <div className="flex h-24 items-end justify-between px-4 pb-3" style={{ background: `linear-gradient(135deg, ${t.coverColor}, ${t.coverColor}b3)` }}>
                <span className="text-4xl leading-none drop-shadow-sm" aria-hidden>
                  {t.coverEmoji}
                </span>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">HealthX template</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <Link href={`/business-portal/programs/new?template=${t.id}`} className="font-heading font-semibold after:absolute after:inset-0 hover:underline">
                    {t.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                </div>
                <ol className="space-y-1.5 text-xs">
                  {t.weeks.map((w) => (
                    <li key={w.week} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 font-medium text-muted-foreground">Week {w.week}</span>
                      <span className="min-w-0 flex-1 truncate">{w.title}</span>
                      <span className="shrink-0" aria-hidden>
                        {[...new Set(w.goals.map((g) => PROGRAM_METRIC_META[g.metric]?.emoji ?? "•"))].join(" ")}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    {pluralize(t.durationWeeks, "week")} · {pluralize(t.goalCount, "goal")}
                  </span>
                  {t.enrolledCount ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> {formatCompact(t.enrolledCount)} enrolled · {formatPercent(t.completionRate)} finish
                    </span>
                  ) : null}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Use this template <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Card>
          ))}
      <Link
        href="/business-portal/programs/new?template=blank"
        className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FilePlus2 className="size-5" />
        </span>
        <span className="font-heading font-semibold">Start from scratch</span>
        <span className="max-w-60 text-sm text-muted-foreground">Build your own weeks and goals — one week with one goal is enough to start.</span>
      </Link>
    </div>
  )
}
