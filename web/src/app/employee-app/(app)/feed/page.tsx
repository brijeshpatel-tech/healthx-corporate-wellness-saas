"use client"

import { Bookmark, Compass, RefreshCw, Sparkles } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { toast } from "sonner"
import { SearchInput } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ContentRow, ContentTile } from "@/components/employee/engage/grow/content"
import { AchievementFeedCard, AnnouncementFeedCard, ArticleFeedCard, ChallengeFeedCard, TipFeedCard, WorkoutFeedCard } from "@/components/employee/engage/grow/feed-cards"
import { PullToRefresh } from "@/components/employee/engage/grow/pull-to-refresh"
import { CardListSkeleton, ChipTabs, EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { CONTENT_CATEGORY_LABEL, feedApi, type ContentCategory, type FeedCard, type WellnessFeed } from "@/lib/api/employee/feed"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type Tab = "for-you" | "explore" | "saved"
const TABS: Tab[] = ["for-you", "explore", "saved"]

/** SCR-M-062 Wellness Feed (+ Explore library and Saved list). Phase 2. */
export default function WellnessFeedPage() {
  return (
    <Suspense fallback={<FeedFrameSkeleton />}>
      <FeedScreen />
    </Suspense>
  )
}

function FeedScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const raw = params.get("tab")
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "for-you"
  const setTab = (t: Tab) => router.replace(t === "for-you" ? "/employee-app/feed" : `/employee-app/feed?tab=${t}`, { scroll: false })

  const feed = useApiQuery(["employee", "feed", "for-you"], () => feedApi.feed())
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    const res = await feed.refetch()
    setRefreshing(false)
    if (res.error) toast.error("Couldn't load your feed.", { description: res.error.message })
    else toast.success("Your feed is up to date")
  }

  return (
    <EngagePage
      title="Wellness feed"
      badge={<PhaseBadge phase={2} />}
      description="Tips, workouts, challenges and reads picked for you — refreshed every day."
      actions={
        tab === "for-you" ? (
          <Button variant="outline" onClick={refresh} disabled={refreshing || feed.isLoading} className="h-10 rounded-xl px-3.5">
            <RefreshCw data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            Refresh
          </Button>
        ) : null
      }
    >
      <Segmented<Tab>
        ariaLabel="Feed sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "for-you", label: "For you" },
          { value: "explore", label: "Explore" },
          { value: "saved", label: "Saved", count: feed.data?.savedCount },
        ]}
      />

      {tab === "for-you" ? (
        <PullToRefresh onRefresh={refresh} refreshing={refreshing}>
          {feed.error ? (
            <LoadError title="Couldn't load your feed." error={feed.error} onRetry={() => feed.refetch()} />
          ) : !feed.data ? (
            <ForYouSkeleton />
          ) : (
            <ForYou data={feed.data} onExplore={() => setTab("explore")} />
          )}
        </PullToRefresh>
      ) : tab === "explore" ? (
        <Explore />
      ) : (
        <Saved onExplore={() => setTab("explore")} />
      )}
    </EngagePage>
  )
}

// ─── For you ────────────────────────────────────────────────────────────

function FeedCardView({ card }: { card: FeedCard }) {
  switch (card.kind) {
    case "tip":
      return <TipFeedCard item={card.content} className="md:col-span-2" />
    case "workout":
      return <WorkoutFeedCard workout={card.workout} />
    case "challenge":
      return <ChallengeFeedCard challenge={card.challenge} />
    case "announcement":
      return <AnnouncementFeedCard announcement={card.announcement} />
    case "article":
      return <ArticleFeedCard item={card.content} />
    case "achievement":
      return <AchievementFeedCard achievement={card.achievement} />
  }
}

function ForYou({ data, onExplore }: { data: WellnessFeed; onExplore: () => void }) {
  if (!data.cards.length) {
    return <EmptyState icon={Sparkles} title="Your feed is being prepared – check back tomorrow." description="We're picking tips, workouts and reads that match your goals." />
  }
  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{formatDate(data.date, "EEEE, d MMMM")}</span>
        <span aria-hidden>·</span>
        <span>
          Picked for your goal: <span className="font-semibold text-primary">{data.goalLabel}</span>
        </span>
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {data.cards.map((card) => (
          <FeedCardView key={card.id} card={card} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-semibold">You&apos;re all caught up</p>
        <p className="text-xs text-muted-foreground">Fresh picks arrive tomorrow. Want more to read?</p>
        <Button variant="outline" onClick={onExplore} className="mt-1 h-10 rounded-xl">
          <Compass data-icon="inline-start" /> Explore the library
        </Button>
      </div>
    </div>
  )
}

// ─── Explore ────────────────────────────────────────────────────────────

const CATEGORIES: (ContentCategory | "all")[] = ["all", "movement", "nutrition", "sleep", "mindfulness", "hydration", "general"]

function Explore() {
  const [category, setCategory] = useState<ContentCategory | "all">("all")
  const [search, setSearch] = useState("")
  const q = useApiQuery(["employee", "feed", "library", category, search], () => feedApi.library({ category, q: search || undefined }))
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipTabs<ContentCategory | "all">
          ariaLabel="Categories"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: c === "all" ? "All" : CONTENT_CATEGORY_LABEL[c] }))}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search articles and videos…" className="lg:w-72" />
      </div>
      {q.error ? (
        <LoadError title="Couldn't load the library." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <CardListSkeleton count={6} className="lg:grid-cols-3" itemClassName="h-72" />
      ) : q.data.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing matches your filters."
          description="Try another category or search term."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setCategory("all")
                setSearch("")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((item) => (
            <ContentTile key={item.id} item={item} from="explore" />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Saved ──────────────────────────────────────────────────────────────

function Saved({ onExplore }: { onExplore: () => void }) {
  const q = useApiQuery(["employee", "feed", "saved"], () => feedApi.saved())
  if (q.error) return <LoadError title="Couldn't load your saved items." error={q.error} onRetry={() => q.refetch()} />
  if (!q.data)
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    )
  if (!q.data.length)
    return (
      <EmptyState
        icon={Bookmark}
        title="Nothing saved yet."
        description="Tap the bookmark on any article, video or tip to keep it here for later."
        action={
          <Button onClick={onExplore} className="h-10 rounded-xl">
            <Compass data-icon="inline-start" /> Explore content
          </Button>
        }
      />
    )
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {q.data.length} saved {q.data.length === 1 ? "item" : "items"}
      </p>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
        {q.data.map((item) => (
          <ContentRow key={item.id} item={item} from="saved" />
        ))}
      </div>
    </div>
  )
}

// ─── Skeletons ──────────────────────────────────────────────────────────

function ForYouSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl md:col-span-2" />
        <Skeleton className="h-60 rounded-2xl" />
        <Skeleton className="h-60 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  )
}

function FeedFrameSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 sm:p-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-11 w-full rounded-xl sm:w-96" />
      <ForYouSkeleton />
    </div>
  )
}
