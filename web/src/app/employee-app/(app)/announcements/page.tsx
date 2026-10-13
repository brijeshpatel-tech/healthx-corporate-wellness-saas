"use client"

import { keepPreviousData } from "@tanstack/react-query"
import { CheckCheck } from "lucide-react"
import { useState } from "react"
import { AnnouncementRow, PinnedAnnouncementCard } from "@/components/employee/engage/inbox/announcement-row"
import { ANNOUNCEMENT_TYPE, ANNOUNCEMENT_TYPE_ORDER } from "@/components/employee/engage/inbox/meta"
import { InboxEmpty } from "@/components/employee/engage/inbox/states"
import { ChipTabs, EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { announcementsApi, type AnnouncementList, type AnnouncementTypeFilter } from "@/lib/api/employee/announcements"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

/** SCR-M-059 Announcements. */
export default function AnnouncementsPage() {
  const [type, setType] = useState<AnnouncementTypeFilter>("all")
  const [pages, setPages] = useState(1)
  const q = useApiQuery(["employee", "announcements", "list", { type, pages }], () => announcementsApi.list({ type, page: 1, pageSize: PAGE_SIZE * pages }), {
    placeholderData: keepPreviousData,
  })
  const markAll = useApiMutation(announcementsApi.markAllRead, {
    success: (r) => (r.marked ? `${r.marked} announcement${r.marked === 1 ? "" : "s"} marked as read` : "Everything is already read"),
  })

  const changeType = (t: AnnouncementTypeFilter) => {
    setType(t)
    setPages(1)
  }

  const data = q.data
  return (
    <EngagePage
      size="narrow"
      title="Announcements"
      description={data ? `News, wellness tips, challenges and rewards from ${data.companyName}.` : "News, wellness tips, challenges and rewards from your company."}
      actions={
        <Button variant="outline" size="lg" className="rounded-xl" disabled={!data?.unread || markAll.isPending} onClick={() => markAll.mutate()}>
          {markAll.isPending ? <Spinner data-icon="inline-start" /> : <CheckCheck data-icon="inline-start" />}
          Mark all as read
        </Button>
      }
    >
      {q.error && !data ? (
        <LoadError title="Couldn't load announcements." error={q.error} onRetry={() => q.refetch()} />
      ) : !data ? (
        <AnnouncementsSkeleton />
      ) : data.counts.all === 0 ? (
        <InboxEmpty emoji="📣" title="No announcements from your company yet." description="When your HR or wellness team shares news, tips or challenges, you'll find them here." />
      ) : (
        <AnnouncementsContent data={data} type={type} onTypeChange={changeType} loadingMore={q.isFetching && q.isPlaceholderData} onLoadMore={() => setPages((p) => p + 1)} />
      )}
    </EngagePage>
  )
}

function AnnouncementsContent({
  data,
  type,
  onTypeChange,
  loadingMore,
  onLoadMore,
}: {
  data: AnnouncementList
  type: AnnouncementTypeFilter
  onTypeChange: (t: AnnouncementTypeFilter) => void
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const options = [
    { value: "all" as AnnouncementTypeFilter, label: "All", count: data.counts.all },
    ...ANNOUNCEMENT_TYPE_ORDER.filter((t) => data.counts[t] > 0 || t === type).map((t) => {
      const meta = ANNOUNCEMENT_TYPE[t]
      return { value: t as AnnouncementTypeFilter, label: meta.chip, count: data.counts[t], icon: <meta.icon className="size-3.5" aria-hidden /> }
    }),
  ]
  const pinned = data.items.filter((a) => a.pinned)
  const rest = data.items.filter((a) => !a.pinned)

  return (
    <div className={cn("space-y-5 transition-opacity", loadingMore && "opacity-70")}>
      <div className="space-y-2">
        <ChipTabs ariaLabel="Filter by type" value={type} onChange={onTypeChange} options={options} />
        {data.unread ? (
          <p className="px-1 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{data.unread} unread</span> · tap an announcement to read it
          </p>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <InboxEmpty emoji="🗂️" title={`No ${type === "all" ? "" : `${ANNOUNCEMENT_TYPE[type].chip.toLowerCase()} `}announcements yet.`} description="Try another type to see more." action={<Button variant="outline" size="lg" className="rounded-xl" onClick={() => onTypeChange("all")}>Show all announcements</Button>} />
      ) : (
        <>
          {pinned.length ? (
            <section aria-label="Pinned" className="space-y-3">
              {pinned.map((a) => (
                <PinnedAnnouncementCard key={a.id} item={a} />
              ))}
            </section>
          ) : null}
          {rest.length ? (
            <section aria-labelledby="ann-latest" className="space-y-2">
              <h2 id="ann-latest" className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {pinned.length ? "Latest" : type === "all" ? "All announcements" : ANNOUNCEMENT_TYPE[type].chip}
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
                {rest.map((a) => (
                  <AnnouncementRow key={a.id} item={a} />
                ))}
              </ul>
            </section>
          ) : null}
          {data.total > data.items.length ? (
            <div className="flex justify-center">
              <Button variant="outline" size="lg" className="rounded-xl" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? <Spinner data-icon="inline-start" /> : null}
                Load more
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">You&apos;ve seen every announcement.</p>
          )}
        </>
      )}
    </div>
  )
}

function AnnouncementsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading announcements">
      <div className="flex gap-2 overflow-hidden">
        {[16, 28, 24, 24].map((w, i) => (
          <Skeleton key={i} className="h-9 shrink-0 rounded-full" style={{ width: w * 4 }} />
        ))}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-4">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
