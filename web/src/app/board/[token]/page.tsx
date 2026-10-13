"use client"

import { Crown, MonitorOff, RefreshCw } from "lucide-react"
import { useParams } from "next/navigation"
import { leaderboardFormatter } from "@/components/business/engagement/leaderboards/format"
import { RankMovement } from "@/components/business/engagement/leaderboard-list"
import { UserAvatar } from "@/components/common/user-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { publicBoardApi, type PublicBoard } from "@/lib/api/business/boards"
import { ApiError } from "@/lib/api/core"
import { useApiQuery } from "@/lib/api/hooks"
import { formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const NAME_LABEL = { full_name: "Full names", first_name_initial: "First name + initial", anonymous: "Anonymous" } as const
const PODIUM = [
  { idx: 1, place: 2, height: "h-28 sm:h-36", tone: "from-slate-300/40 to-slate-300/10 text-slate-600 dark:text-slate-300" },
  { idx: 0, place: 1, height: "h-36 sm:h-48", tone: "from-amber-300/50 to-amber-300/10 text-amber-700 dark:text-amber-300" },
  { idx: 2, place: 3, height: "h-24 sm:h-28", tone: "from-orange-300/40 to-orange-300/10 text-orange-700 dark:text-orange-300" },
]

/** Public / TV leaderboard (#351) — no sign-in, read-only, refreshes every 30 seconds. */
export default function PublicBoardPage() {
  const { token } = useParams<{ token: string }>()
  const q = useApiQuery(["public-board", token], () => publicBoardApi.get({ token }), { refetchInterval: 30_000, refetchIntervalInBackground: true, retry: false })

  if (q.isLoading) {
    return (
      <main className="min-h-screen bg-background p-6 sm:p-10">
        <Skeleton className="h-12 w-80" />
        <div className="mt-10 grid grid-cols-3 items-end gap-6">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </main>
    )
  }

  if (q.error || !q.data) {
    const gone = q.error instanceof ApiError && q.error.status === 404
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <MonitorOff className="size-6" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-bold">{gone ? "This board is no longer available" : "Couldn't load leaderboard"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{gone ? "The link was revoked or doesn't exist. Ask your HR or wellness team for a new one." : "Check the connection — the screen will retry automatically."}</p>
        </div>
      </main>
    )
  }

  return <Board data={q.data} refreshing={q.isFetching} />
}

function Board({ data, refreshing }: { data: PublicBoard; refreshing: boolean }) {
  const b = data.board
  const fmt = leaderboardFormatter(b)
  const people = b.kind === "people"
  const top = b.entries.slice(0, 3)
  const rest = b.entries.slice(3)
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background px-4 py-6 sm:px-10 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl font-heading text-lg font-bold text-white shadow-sm sm:size-14" style={{ backgroundColor: data.primaryColor }}>
            {data.logoInitials}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{data.companyName}</p>
            <h1 className="truncate font-heading text-2xl font-bold tracking-tight sm:text-4xl">{data.title}</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {b.title} · {b.periodLabel} · {b.kind === "groups" ? `average ${b.unit} per person` : b.unit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Live · updated {formatTime(data.updatedAt)}
          {refreshing ? <RefreshCw className="size-3.5 animate-spin" /> : null}
        </div>
      </header>

      {b.entries.length === 0 ? (
        <div className="flex min-h-[50vh] items-center justify-center text-center">
          <div>
            <p className="font-heading text-2xl font-bold">No rankings yet for this period.</p>
            <p className="mt-2 text-muted-foreground">They&apos;ll appear here as soon as people log activity.</p>
          </div>
        </div>
      ) : (
        <>
          {top.length >= 3 ? (
            <section aria-label="Top three" className="mx-auto mt-10 grid max-w-4xl grid-cols-3 items-end gap-3 sm:gap-8">
              {PODIUM.map(({ idx, place, height, tone }) => {
                const e = top[idx]!
                return (
                  <div key={e.id} className="flex min-w-0 flex-col items-center gap-3 text-center">
                    <div className="relative">
                      {place === 1 ? <Crown className="absolute -top-7 left-1/2 size-7 -translate-x-1/2 text-amber-500" /> : null}
                      {people ? (
                        <UserAvatar name={e.name} color={e.avatarColor} size={place === 1 ? "xl" : "lg"} className="ring-4 ring-background" />
                      ) : (
                        <span className={cn("flex items-center justify-center rounded-full font-heading font-bold text-white ring-4 ring-background", place === 1 ? "size-20 text-2xl" : "size-14 text-lg")} style={{ backgroundColor: e.avatarColor }}>
                          {e.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="w-full min-w-0">
                      <p className="truncate font-heading text-base font-bold sm:text-2xl">{e.name}</p>
                      {e.subtitle ? <p className="truncate text-xs text-muted-foreground sm:text-sm">{e.subtitle}</p> : null}
                      <p className="mt-1 font-heading text-lg font-bold tabular-nums sm:text-3xl">{fmt(e.value)}</p>
                    </div>
                    <div className={cn("flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-3 font-heading text-3xl font-black sm:text-5xl", height, tone)}>{place}</div>
                  </div>
                )
              })}
            </section>
          ) : null}

          <section aria-label="Rankings" className={cn("mx-auto mt-8 grid max-w-6xl gap-x-8 gap-y-2 lg:grid-cols-2", top.length < 3 && "mt-10")}>
            {(top.length >= 3 ? rest : b.entries).map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card/80 px-4 py-3 shadow-sm backdrop-blur">
                <span className="w-8 text-center font-heading text-xl font-bold text-muted-foreground tabular-nums">{e.rank}</span>
                <RankMovement rank={e.rank} previousRank={e.previousRank} />
                {people ? <UserAvatar name={e.name} color={e.avatarColor} size="md" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold sm:text-lg">{e.name}</p>
                  {e.subtitle ? <p className="truncate text-xs text-muted-foreground sm:text-sm">{e.subtitle}</p> : null}
                </div>
                <span className="shrink-0 font-heading text-lg font-bold tabular-nums sm:text-xl">{fmt(e.value)}</span>
              </div>
            ))}
          </section>
        </>
      )}

      <footer className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Names: {NAME_LABEL[data.nameDisplay]} · people who opted out appear as “Anonymous colleague”
          {b.hiddenGroups ? ` · groups under ${b.minGroupSize} people are hidden` : ""}
        </span>
        <span className="font-medium">
          Powered by Health<span className="text-primary">X</span>
        </span>
      </footer>
    </main>
  )
}
