"use client"

import { ArrowLeft, ArrowRight, Check, Pin } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { UserAvatar } from "@/components/common/user-avatar"
import { AnnouncementRow, AnnouncementTypePill } from "@/components/employee/engage/inbox/announcement-row"
import { ANNOUNCEMENT_TYPE } from "@/components/employee/engage/inbox/meta"
import { InboxEmpty } from "@/components/employee/engage/inbox/states"
import { EmojiCover, EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { announcementsApi, type AnnouncementDetail } from "@/lib/api/employee/announcements"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDateTime, formatRelative, formatShortDate } from "@/lib/format"

const BACK = "/employee-app/announcements"

/** SCR-M-060 Announcement Detail. */
export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>()
  const q = useApiQuery(["employee", "announcements", "detail", id], () => announcementsApi.get({ id }), {
    retry: (count, error) => error.status !== 404 && error.status !== 403 && count < 2,
  })
  const { mutate: markRead } = useApiMutation(announcementsApi.markRead)

  // Opening the announcement marks it as read (once per id).
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (!q.data || q.data.read || marked.current === q.data.id) return
    marked.current = q.data.id
    markRead({ id: q.data.id })
  }, [q.data, markRead])

  return (
    <EngagePage size="narrow">
      <div>
        <Button asChild variant="ghost" size="lg" className="-ml-2.5 rounded-xl text-muted-foreground hover:text-foreground">
          <Link href={BACK}>
            <ArrowLeft data-icon="inline-start" />
            Announcements
          </Link>
        </Button>
      </div>
      {q.error && (q.error.status === 404 || q.error.status === 403) ? (
        <InboxEmpty
          emoji="📭"
          title="This announcement is no longer available."
          description="It may have been withdrawn, or it wasn't sent to you."
          action={
            <Button asChild size="lg" className="rounded-xl">
              <Link href={BACK}>
                <ArrowLeft data-icon="inline-start" />
                Back to announcements
              </Link>
            </Button>
          }
        />
      ) : q.error ? (
        <LoadError title="Couldn't load this announcement." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <DetailSkeleton />
      ) : (
        <Detail data={q.data} />
      )}
    </EngagePage>
  )
}

function Detail({ data }: { data: AnnouncementDetail }) {
  const meta = ANNOUNCEMENT_TYPE[data.type]
  const cover = data.challenge ? { emoji: data.challenge.emoji, color: data.challenge.color } : { emoji: meta.emoji, color: meta.color }
  const paragraphs = data.body.split(/\n{2,}/).filter(Boolean)

  return (
    <>
      <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div
          className="relative flex h-40 items-center justify-center overflow-hidden sm:h-52"
          style={{ background: `radial-gradient(90% 120% at 15% 0%, rgba(255,255,255,0.28), transparent 60%), linear-gradient(135deg, ${cover.color}, ${cover.color}b3)` }}
          aria-hidden
        >
          <div className="bg-grid absolute inset-0 opacity-15" />
          <span className="absolute -top-14 -right-10 size-48 rounded-full bg-white/12" />
          <span className="absolute -bottom-16 -left-8 size-40 rounded-full bg-white/10" />
          <span className="relative flex size-24 items-center justify-center rounded-3xl bg-white/20 text-6xl shadow-lg backdrop-blur-sm sm:size-28 sm:text-7xl">{cover.emoji}</span>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AnnouncementTypePill type={data.type} full />
              {data.pinned ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
                  <Pin className="size-3" aria-hidden /> Pinned
                </span>
              ) : null}
              <time dateTime={data.sentAt} className="text-xs text-muted-foreground" title={formatDateTime(data.sentAt)}>
                {formatDateTime(data.sentAt)}
              </time>
            </div>
            <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">{data.title}</h1>
            <div className="flex items-center gap-3">
              <UserAvatar name={data.author} color={data.authorColor} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {data.author}
                  {data.authorTitle ? <span className="font-normal text-muted-foreground"> · {data.authorTitle}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  On behalf of {data.companyName} · {formatRelative(data.sentAt)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-5 text-[15px] leading-relaxed text-foreground/90">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>

          {data.challenge ? (
            <Link href={`/employee-app/challenges/${data.challenge.id}`} className="group flex items-center gap-3 rounded-2xl border bg-muted/30 p-3 transition-colors hover:bg-muted/60">
              <EmojiCover emoji={data.challenge.emoji} color={data.challenge.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{data.challenge.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {data.challenge.status === "scheduled" ? `Starts ${formatShortDate(data.challenge.startDate)}` : data.challenge.status === "completed" ? `Ended ${formatShortDate(data.challenge.endDate)}` : `Ends ${formatShortDate(data.challenge.endDate)}`} · +{data.challenge.points} pts
                </p>
              </div>
              {data.challenge.joined ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Check className="size-3" /> Joined
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Not joined</span>
              )}
            </Link>
          ) : null}

          {data.cta ? (
            <Button asChild size="lg" className="h-12 w-full rounded-xl text-base sm:w-auto sm:px-6">
              <Link href={data.cta.href}>
                {data.cta.label}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : null}
        </div>
      </article>

      {data.more.length ? (
        <section aria-labelledby="ann-more" className="space-y-2">
          <h2 id="ann-more" className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            More from {data.companyName}
          </h2>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
            {data.more.map((a) => (
              <AnnouncementRow key={a.id} item={a} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function DetailSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card" aria-busy="true" aria-label="Loading announcement">
      <Skeleton className="h-40 rounded-none sm:h-52" />
      <div className="space-y-4 p-5 sm:p-7">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-8 w-4/5" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-12 w-44 rounded-xl" />
      </div>
    </div>
  )
}
