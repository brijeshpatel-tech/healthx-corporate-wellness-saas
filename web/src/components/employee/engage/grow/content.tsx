"use client"

import { Bookmark, BookmarkCheck, Clock, Lightbulb, Link2, Newspaper, Play } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL, feedApi, type ContentCard } from "@/lib/api/employee/feed"
import { useApiMutation } from "@/lib/api/hooks"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

export const TYPE_ICON = { article: Newspaper, video: Play, tip: Lightbulb, link: Link2 } as const

/** Bookmark state with an optimistic flip while the request runs. */
export function useSaveToggle(id: string, saved: boolean) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const settle = () => setOptimistic(null)
  const save = useApiMutation(feedApi.save, { success: "Saved", invalidate: [["employee", "feed"], ["employee", "content"]], onSuccess: settle, onError: settle })
  const unsave = useApiMutation(feedApi.unsave, { success: "Removed from saved", invalidate: [["employee", "feed"], ["employee", "content"]], onSuccess: settle, onError: settle })
  const value = optimistic ?? saved
  const toggle = () => {
    if (save.isPending || unsave.isPending) return
    setOptimistic(!value)
    if (value) unsave.mutate({ id })
    else save.mutate({ id })
  }
  return { saved: value, toggle, pending: save.isPending || unsave.isPending }
}

/** Round bookmark button — sits above stretched card links (z-10). */
export function SaveButton({ id, saved, variant = "default", className }: { id: string; saved: boolean; variant?: "default" | "onColor" | "labelled"; className?: string }) {
  const s = useSaveToggle(id, saved)
  const Icon = s.saved ? BookmarkCheck : Bookmark
  if (variant === "labelled") {
    return (
      <Button type="button" variant={s.saved ? "secondary" : "outline"} onClick={s.toggle} aria-pressed={s.saved} className={cn("h-10 rounded-xl px-4", className)}>
        <Icon data-icon="inline-start" className={cn(s.saved && "fill-current text-primary")} />
        {s.saved ? "Saved" : "Save"}
      </Button>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        s.toggle()
      }}
      aria-pressed={s.saved}
      aria-label={s.saved ? "Remove from saved" : "Save for later"}
      title={s.saved ? "Remove from saved" : "Save for later"}
      className={cn(
        "relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        variant === "onColor" ? "bg-white/20 text-white backdrop-blur hover:bg-white/30" : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
        s.saved && variant !== "onColor" && "bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary",
        className,
      )}
    >
      <Icon className={cn("size-[18px]", s.saved && "fill-current")} />
    </button>
  )
}

/** Gradient cover band with the content emoji (used on cards and the viewer). */
export function ContentCover({ item, className, size = "md", children }: { item: Pick<ContentCard, "coverColor" | "coverEmoji" | "type">; className?: string; size?: "sm" | "md" | "lg"; children?: React.ReactNode }) {
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden text-white", size === "sm" ? "h-24" : size === "lg" ? "h-44 sm:h-56" : "h-32", className)}
      style={{ background: `radial-gradient(120% 90% at 85% 10%, ${item.coverColor}55, transparent 60%), linear-gradient(135deg, ${item.coverColor}, ${item.coverColor}bb)` }}
    >
      <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
      <span className={cn("drop-shadow-md select-none", size === "lg" ? "text-7xl sm:text-8xl" : size === "sm" ? "text-4xl" : "text-5xl")} aria-hidden>
        {item.coverEmoji}
      </span>
      {item.type === "video" ? (
        <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
          <Play className="size-3 fill-current" /> Video
        </span>
      ) : null}
      {children}
    </div>
  )
}

/** Category pill on top of a cover. */
export function CategoryPill({ category, onColor, className }: { category: ContentCard["category"]; onColor?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold",
        onColor ? "bg-white/90 text-slate-900 shadow-xs" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {CONTENT_CATEGORY_LABEL[category]}
    </span>
  )
}

export function contentHref(id: string, from?: "saved" | "explore") {
  return `/employee-app/feed/${id}${from ? `?from=${from}` : ""}`
}

function metaLine(item: ContentCard) {
  const unit = item.type === "video" ? "min video" : item.type === "tip" ? "min tip" : "min read"
  return `${item.readMinutes} ${unit}`
}

/** Grid card: cover, category, title, summary, meta and bookmark. */
export function ContentTile({ item, from, className }: { item: ContentCard; from?: "saved" | "explore"; className?: string }) {
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-md", className)}>
      <ContentCover item={item}>
        <CategoryPill category={item.category} onColor className="absolute top-3 left-3" />
      </ContentCover>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-heading leading-snug font-bold">
          <Link href={contentHref(item.id, from)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">
              {metaLine(item)} · {item.fromCompany ? (item.companyName ?? "Your company") : item.author}
            </span>
          </p>
          <SaveButton id={item.id} saved={item.saved} />
        </div>
      </div>
    </article>
  )
}

/** Compact row for the Saved list and "related" sections. */
export function ContentRow({ item, from, showSave = true }: { item: ContentCard; from?: "saved" | "explore"; showSave?: boolean }) {
  const Icon = TYPE_ICON[item.type]
  return (
    <div className="relative flex items-center gap-3 p-3 transition-colors hover:bg-muted/40 sm:p-4">
      <span
        className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-3xl text-white shadow-xs"
        style={{ background: `linear-gradient(135deg, ${item.coverColor}, ${item.coverColor}b3)` }}
        aria-hidden
      >
        {item.coverEmoji}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" /> {CONTENT_TYPE_LABEL[item.type]} · {CONTENT_CATEGORY_LABEL[item.category]}
        </p>
        <Link href={contentHref(item.id, from)} className="line-clamp-2 text-sm leading-snug font-semibold after:absolute after:inset-0 focus-visible:outline-none">
          {item.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {metaLine(item)}
          {item.publishedAt ? ` · ${formatRelative(item.publishedAt)}` : ""}
        </p>
      </div>
      {showSave ? <SaveButton id={item.id} saved={item.saved} /> : null}
    </div>
  )
}
