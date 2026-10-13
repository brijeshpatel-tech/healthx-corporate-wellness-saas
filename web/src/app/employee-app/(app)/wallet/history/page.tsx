"use client"

import { isToday, isYesterday, parseISO } from "date-fns"
import { CalendarRange, ReceiptText } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { EmptyState } from "@/components/common/states"
import { ChipTabs, EngagePage, LoadError } from "@/components/employee/engage/page"
import { ResponsiveSheet } from "@/components/employee/engage/sheet"
import { TxDetail, TxRow } from "@/components/employee/engage/wallet-ui"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { gamificationApi, type TxFilter, type TxRange, type TxView } from "@/lib/api/employee/gamification"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const PAGE = 20

function dayLabel(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return formatDate(d, "EEEE, d MMM yyyy")
}

/** SCR-M-053 Points History — filters, infinite scroll, row detail. */
export default function PointsHistoryPage() {
  const [type, setType] = useState<TxFilter>("all")
  const [range, setRange] = useState<TxRange>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<TxView | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const dateError = range === "custom" && from && to && from > to ? "Start date must be before the end date" : null

  const q = useApiQuery(
    ["employee", "wallet", "transactions", type, range, from, to, limit],
    () => gamificationApi.transactions({ type, range, from: from || undefined, to: to || undefined, page: 1, pageSize: limit }),
    { placeholderData: (prev) => prev, enabled: !dateError },
  )
  const items = q.data?.items ?? []
  const hasMore = !!q.data && q.data.total > items.length
  const fetching = q.isFetching

  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !fetching) setLimit((l) => l + PAGE)
    }, { rootMargin: "240px" })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, fetching])

  const resetPaging = () => setLimit(PAGE)

  // Group by local day (newest first)
  const groups: { label: string; items: TxView[] }[] = []
  for (const t of items) {
    const label = dayLabel(t.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(t)
    else groups.push({ label, items: [t] })
  }

  return (
    <EngagePage title="Points history" description="Everything you've earned and spent, newest first." backHref="/employee-app/wallet" backLabel="Wallet" size="narrow">
      <div className="flex flex-col gap-3">
        <ChipTabs<TxFilter>
          ariaLabel="Transaction type"
          value={type}
          onChange={(v) => {
            setType(v)
            resetPaging()
          }}
          options={[
            { value: "all", label: "All" },
            { value: "earned", label: "Earned" },
            { value: "spent", label: "Spent" },
          ]}
        />
        <div className="flex flex-wrap items-end gap-2">
          <Select
            value={range}
            onValueChange={(v) => {
              setRange(v as TxRange)
              resetPaging()
            }}
          >
            <SelectTrigger className="h-10 w-44 rounded-xl" aria-label="Date range">
              <CalendarRange className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom dates…</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" ? (
            <>
              <Input type="date" value={from} onChange={(e) => {
                  setFrom(e.target.value)
                  resetPaging()
                }} className="h-10 w-40 rounded-xl" aria-label="From date" aria-invalid={!!dateError} />
              <Input type="date" value={to} onChange={(e) => {
                  setTo(e.target.value)
                  resetPaging()
                }} className="h-10 w-40 rounded-xl" aria-label="To date" aria-invalid={!!dateError} />
            </>
          ) : null}
        </div>
        {dateError ? <p className="text-xs font-medium text-destructive">{dateError}</p> : null}
      </div>

      {q.data ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-3.5">
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="font-heading text-xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">+{formatNumber(q.data.totals.earned)}</p>
          </div>
          <div className="rounded-2xl border bg-card p-3.5">
            <p className="text-xs text-muted-foreground">Spent on rewards</p>
            <p className="font-heading text-xl font-bold tabular-nums">−{formatNumber(q.data.totals.spent)}</p>
          </div>
        </div>
      ) : null}

      {q.error && !q.data ? (
        <LoadError title="Couldn't load history." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No transactions in this period." description="Try a different filter or date range." />
      ) : (
        <div className={cn("space-y-4", fetching && limit === PAGE && "opacity-70 transition-opacity")}>
          {groups.map((g) => (
            <section key={g.label} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h2>
              <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
                {g.items.map((t) => (
                  <TxRow key={t.id} t={t} onClick={() => setSelected(t)} />
                ))}
              </div>
            </section>
          ))}
          <div ref={sentinel} className="flex h-12 items-center justify-center text-xs text-muted-foreground">
            {hasMore ? <Spinner className="size-5" /> : `That's everything · ${formatNumber(q.data.total)} transactions`}
          </div>
        </div>
      )}

      <ResponsiveSheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title="Transaction">
        {selected ? <TxDetail t={selected} /> : null}
      </ResponsiveSheet>
    </EngagePage>
  )
}
