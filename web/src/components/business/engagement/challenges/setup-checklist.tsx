"use client"

import { CheckCircle2, Circle, CircleAlert } from "lucide-react"
import { PhaseBadge } from "@/components/common/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ChecklistItem {
  id: string
  label: string
  /** done = configured; missing = required but not set; optional = nice to have and not set. */
  state: "done" | "missing" | "optional"
  hint?: string
  /** Section element id to scroll to. */
  target: string
}

/** Challenge setup checklist (#367, Phase 2): highlights what's missing before launch. */
export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const required = items.filter((i) => i.state !== "optional")
  const done = items.filter((i) => i.state === "done").length
  const missing = items.filter((i) => i.state === "missing").length
  const pct = Math.round((done / Math.max(1, items.length)) * 100)
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 font-heading text-sm">
          <span>Setup checklist</span>
          <PhaseBadge phase={2} />
        </CardTitle>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", missing ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{items.length}
          </span>
        </div>
        <p className={cn("mt-1 text-xs", missing ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {missing ? `${missing} required ${missing === 1 ? "item needs" : "items need"} attention before you publish.` : required.length ? "Ready to launch." : ""}
        </p>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="space-y-0.5">
          {items.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => document.getElementById(i.target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60", i.state === "missing" && "bg-amber-500/[0.07]")}
              >
                {i.state === "done" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : i.state === "missing" ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                )}
                <span className="min-w-0">
                  <span className={cn("block", i.state === "done" && "text-muted-foreground")}>{i.label}</span>
                  {i.hint && i.state !== "done" ? <span className="block text-xs text-muted-foreground">{i.hint}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
