"use client"

import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { useState } from "react"
import { Podium, RankList } from "@/components/employee/engage/leaderboard"
import { LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { teamApi, type TeamPeriod } from "@/lib/api/employee/team"
import { useApiQuery } from "@/lib/api/hooks"
import type { LeaderboardNameDisplay } from "@/lib/types"
import { PERIOD_LABEL } from "./team-overview"

const NAME_MODE_LABEL: Record<LeaderboardNameDisplay, string> = {
  full_name: "Full names are shown",
  first_name_initial: "Names are shown as first name + initial",
  anonymous: "Names are hidden (anonymous mode)",
}

/** Number of rows shown before "Open team leaderboard". */
const PREVIEW = 8

/** Team member leaderboard (steps) — podium + ranked list, company name-privacy applied. */
export function TeamLeaderboard({ period, teamId }: { period: TeamPeriod; teamId?: string }) {
  const [open, setOpen] = useState(false)
  const q = useApiQuery(["employee", "team", "leaderboard", { period, teamId }], () => teamApi.leaderboard({ period, teamId }))
  const data = q.data
  const entries = data ? (open ? data.entries : data.entries.slice(0, PREVIEW)) : []

  return (
    <section id="team-leaderboard" className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div>
        <h2 className="font-heading text-base font-semibold">Team leaderboard</h2>
        <p className="text-xs text-muted-foreground">Steps {PERIOD_LABEL[period]} · the same leaderboard your team sees</p>
      </div>

      {q.error ? (
        <LoadError title="Couldn't load the team leaderboard." error={q.error} onRetry={() => q.refetch()} className="py-8" />
      ) : !data ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-3 items-end gap-3">
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : data.entries.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">No steps synced {PERIOD_LABEL[period]} yet — the leaderboard fills up as your team moves.</p>
      ) : (
        <>
          <Podium entries={data.entries} unit="steps" className="px-1 pt-6" />
          <RankList entries={entries} me={data.me} unit="steps" skipTop={3} />
          {data.entries.length > PREVIEW ? (
            <Button variant="outline" size="lg" className="w-full rounded-xl" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              {open ? (
                <>
                  Show top {PREVIEW} <ChevronUp data-icon="inline-end" />
                </>
              ) : (
                <>
                  Open team leaderboard ({data.entries.length}) <ChevronDown data-icon="inline-end" />
                </>
              )}
            </Button>
          ) : null}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              {NAME_MODE_LABEL[data.nameDisplay]} as set by your company. People who opted out of leaderboards appear without their name.
              {data.noActivity ? ` ${data.noActivity} member${data.noActivity === 1 ? "" : "s"} with no steps ${PERIOD_LABEL[period]} ${data.noActivity === 1 ? "isn't" : "aren't"} listed.` : ""}
            </span>
          </p>
        </>
      )}
    </section>
  )
}
