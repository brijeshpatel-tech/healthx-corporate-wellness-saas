"use client"

import { ArrowRight, CheckCircle2, Circle, Lock, Rocket, X } from "lucide-react"
import Link from "next/link"
import { ProgressRing } from "@/components/common/charts"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { settingsApi } from "@/lib/api/business/settings"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"

/** #354 — Admin getting-started checklist (Phase 2). Steps tick themselves from real data. */
export function GettingStartedCard() {
  const can = useCan()
  const q = useApiQuery(["business", "getting-started"], () => settingsApi.gettingStarted())
  const dismiss = useApiMutation(settingsApi.dismissGettingStarted, { success: (_r, i) => (i.dismissed ? "Checklist hidden. You can find these steps in Organisation profile." : "Checklist restored.") })
  if (!q.data || q.data.dismissed) return null
  const steps = q.data.steps
  const done = steps.filter((s) => s.done).length
  const allDone = done === steps.length

  return (
    <Card className="gap-0 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-sky-500/[0.05] py-0">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <ProgressRing value={done} max={steps.length} size={56} stroke={6} className="hidden sm:inline-flex">
            <span className="text-xs font-bold tabular-nums">
              {done}/{steps.length}
            </span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Rocket className="size-4 text-primary" />
              <h2 className="font-heading text-base font-semibold">{allDone ? "You're all set!" : "Get started with HealthX"}</h2>
              <PhaseBadge phase={2} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allDone ? "Every setup step is done. Your employees have everything they need." : `${done} of ${steps.length} done — finish these steps so employees get a great first experience.`}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Hide checklist" onClick={() => dismiss.mutate({ dismissed: true })} disabled={dismiss.isPending}>
            <X />
          </Button>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {steps.map((s, i) => {
            const locked = s.ownerOnly && !can("settings.manage")
            const body = (
              <>
                <span className="flex items-center gap-2">
                  {s.done ? <CheckCircle2 className="size-4.5 shrink-0 text-emerald-600" /> : <Circle className="size-4.5 shrink-0 text-muted-foreground/60" />}
                  <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                  {locked && !s.done ? <Lock className="ml-auto size-3.5 text-muted-foreground" /> : !s.done ? <ArrowRight className="ml-auto size-3.5 text-muted-foreground" /> : null}
                </span>
                <span className={cn("mt-1.5 block text-sm font-medium", s.done && "text-muted-foreground line-through decoration-1")}>{s.label}</span>
                <span className="block text-xs text-muted-foreground">{locked && !s.done ? "Ask your Company Owner" : s.description}</span>
              </>
            )
            const cls = cn("block h-full rounded-xl border bg-card/80 p-3 transition-colors", s.done ? "opacity-80" : !locked && "hover:border-primary/40 hover:bg-primary/5")
            return <li key={s.key}>{s.done || locked ? <div className={cls}>{body}</div> : <Link href={s.href} className={cls}>{body}</Link>}</li>
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
