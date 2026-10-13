"use client"

import { ArrowLeft, CircleCheck, Clock, ExternalLink, Eye, FileX, Lightbulb, Link2, Share2 } from "lucide-react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CategoryPill, ContentCover, ContentRow, SaveButton, TYPE_ICON } from "@/components/employee/engage/grow/content"
import { VideoPlayer } from "@/components/employee/engage/grow/video-player"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { ApiError } from "@/lib/api/core"
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL, feedApi, type ContentBlock, type ContentDetail } from "@/lib/api/employee/feed"
import { useApiQuery } from "@/lib/api/hooks"
import { formatCompact, formatDate } from "@/lib/format"

/** SCR-M-063 Content Viewer — article, video, tip or link. Published content only. Phase 2. */
export default function ContentViewerPage() {
  return (
    <Suspense fallback={<ViewerSkeleton />}>
      <Viewer />
    </Suspense>
  )
}

function Viewer() {
  const { id } = useParams<{ id: string }>()
  const from = useSearchParams().get("from")
  const back = from === "saved" ? { href: "/employee-app/feed?tab=saved", label: "Saved" } : from === "explore" ? { href: "/employee-app/feed?tab=explore", label: "Explore" } : { href: "/employee-app/feed", label: "Wellness feed" }
  const q = useApiQuery(["employee", "content", id], () => feedApi.content({ id }), { retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2 })

  return (
    <EngagePage size="narrow">
      <BackLink href={back.href} label={back.label} />
      {q.error ? (
        q.error.status === 404 ? (
          <EmptyState
            icon={FileX}
            title="This content is unavailable."
            description="It may have been removed or isn't published yet."
            action={
              <Button asChild className="h-10 rounded-xl">
                <Link href="/employee-app/feed">Back to your feed</Link>
              </Button>
            }
          />
        ) : (
          <LoadError title="This content is unavailable." error={q.error} onRetry={() => q.refetch()} />
        )
      ) : !q.data ? (
        <ViewerBodySkeleton />
      ) : (
        <ContentView item={q.data} />
      )}
    </EngagePage>
  )
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="link" size="sm" className="-mb-2 -ml-1 h-auto self-start px-1 text-muted-foreground hover:text-foreground">
      <Link href={href}>
        <ArrowLeft data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  )
}

async function shareContent(item: ContentDetail) {
  const url = `${window.location.origin}/employee-app/feed/${item.id}`
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: item.title, text: item.summary, url })
      return
    } catch (err) {
      if ((err as Error).name === "AbortError") return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Link copied", { description: "Paste it anywhere to share." })
  } catch {
    toast.error("Couldn't copy the link", { description: url })
  }
}

function ContentView({ item }: { item: ContentDetail }) {
  const TypeIcon = TYPE_ICON[item.type]
  const captions = item.blocks.flatMap((b) => (b.type === "list" ? [b.intro ?? "", ...b.items] : b.text.split(/(?<=[.!?])\s+/))).filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      {item.type === "video" ? (
        <VideoPlayer title={item.title} emoji={item.coverEmoji} color={item.coverColor} durationSec={item.durationSec ?? item.readMinutes * 60} url={item.url} captions={captions} />
      ) : (
        <ContentCover item={item} size={item.type === "tip" ? "md" : "lg"} className="rounded-3xl shadow-sm">
          <CategoryPill category={item.category} onColor className="absolute top-4 left-4" />
        </ContentCover>
      )}

      <header className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span className="inline-flex items-center gap-1.5">
            <TypeIcon className="size-3.5" /> {CONTENT_TYPE_LABEL[item.type]} · {CONTENT_CATEGORY_LABEL[item.category]}
          </span>
          <PhaseBadge phase={2} />
        </p>
        <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <UserAvatar name={item.fromCompany ? (item.companyName ?? item.author) : item.author} color={item.coverColor} className="size-7 text-[11px]" />
            {item.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {item.readMinutes} min {item.type === "video" ? "watch" : "read"}
          </span>
          {item.publishedAt ? <span>{formatDate(item.publishedAt)}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {formatCompact(item.views)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <SaveButton id={item.id} saved={item.saved} variant="labelled" />
          <Button variant="outline" onClick={() => shareContent(item)} className="h-10 rounded-xl px-4">
            <Share2 data-icon="inline-start" /> Share link
          </Button>
        </div>
      </header>

      {item.type === "tip" ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4 sm:p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-700 uppercase dark:text-amber-300">
            <Lightbulb className="size-3.5" /> Quick tip
          </p>
          <Blocks blocks={item.blocks} />
        </div>
      ) : (
        <>
          {item.type === "video" ? <h2 className="font-heading text-lg font-bold">About this video</h2> : null}
          <Blocks blocks={item.blocks} />
        </>
      )}

      {item.type === "link" ? (
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600 dark:text-sky-400">
            <Link2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{item.url ? safeHost(item.url) : "Link unavailable"}</p>
            <p className="text-xs text-muted-foreground">{item.url ? "Opens in a new tab." : "This link isn't available right now."}</p>
          </div>
          {item.url ? (
            <Button asChild className="h-10 rounded-xl px-4">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Open link <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {item.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      ) : null}

      {item.fromCompany ? (
        <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground">Shared by {item.companyName ?? "your company"} for everyone at work.</p>
      ) : (
        <p className="text-xs text-muted-foreground">General wellness information from HealthX — not medical advice. Speak to a doctor about any health concerns.</p>
      )}

      {item.related.length ? (
        <section className="space-y-2 pt-2">
          <h2 className="px-1 font-heading text-lg font-bold">More like this</h2>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
            {item.related.map((r) => (
              <ContentRow key={r.id} item={r} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function safeHost(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function Blocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) =>
        b.type === "list" ? (
          <div key={i} className="space-y-2.5">
            {b.intro ? <p className="text-[15px] leading-7 text-foreground/85">{b.intro}</p> : null}
            <ul className="space-y-2">
              {b.items.map((it) => (
                <li key={it} className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3.5 py-2.5 text-[15px]">
                  <CircleCheck className="mt-0.5 size-[18px] shrink-0 text-primary" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p key={i} className={b.type === "lead" ? "text-lg leading-relaxed font-medium text-foreground" : "text-[15px] leading-7 text-foreground/85"}>
            {b.text}
          </p>
        ),
      )}
    </div>
  )
}

function ViewerBodySkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-48 rounded-3xl sm:h-56" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-4/5" />
      <Skeleton className="h-4 w-60" />
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

function ViewerSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-5 w-28" />
      <ViewerBodySkeleton />
    </div>
  )
}
