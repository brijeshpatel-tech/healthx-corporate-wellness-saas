"use client"

import { ExternalLink, FileText, Heart, Lightbulb, Link2, PlayCircle, type LucideIcon } from "lucide-react"
import type { ContentItem, ContentType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL } from "./meta"

export const CONTENT_TYPE_ICON: Record<ContentType, LucideIcon> = { article: FileText, video: PlayCircle, tip: Lightbulb, link: Link2 }

/** Feed card + opened view, roughly as employees see global content in the app's wellness feed. */
export function ContentPreview({
  title,
  summary,
  body,
  type,
  category,
  coverEmoji,
  coverColor,
  author,
  readMinutes,
  url,
  tags,
  className,
}: {
  title: string
  summary: string
  body: string
  type: ContentType
  category: ContentItem["category"]
  coverEmoji: string
  coverColor: string
  author: string
  readMinutes: number | ""
  url: string
  tags: string[]
  className?: string
}) {
  const Icon = CONTENT_TYPE_ICON[type]
  const meta = type === "video" ? `${readMinutes || "–"} min video` : type === "link" ? "External link" : `${readMinutes || "–"} min read`
  let host = ""
  try {
    host = url ? new URL(url).host : ""
  } catch {
    host = ""
  }
  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative flex h-32 items-center justify-center" style={{ background: `linear-gradient(135deg, ${coverColor}, ${coverColor}a6)` }}>
          <span className="text-6xl leading-none drop-shadow" aria-hidden>
            {coverEmoji || "❔"}
          </span>
          {type === "video" ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                <PlayCircle className="size-7" />
              </span>
            </span>
          ) : null}
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <Icon className="size-3" /> {CONTENT_TYPE_LABEL[type]}
          </span>
        </div>
        <div className="space-y-1.5 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">{CONTENT_CATEGORY_LABEL[category]}</p>
          <h3 className="line-clamp-2 font-heading text-base leading-snug font-semibold">{title || "Content title"}</h3>
          <p className="line-clamp-3 text-sm text-muted-foreground">{summary || "A short summary appears here in the feed."}</p>
          <div className="flex items-center justify-between pt-1.5 text-xs text-muted-foreground">
            <span className="truncate">
              {author || "Author"} · {meta}
            </span>
            <Heart className="size-4 shrink-0" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Opened in the app</p>
        {type === "video" || type === "link" ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            {type === "video" ? <PlayCircle className="size-4 text-primary" /> : <ExternalLink className="size-4 text-primary" />}
            <span className="min-w-0 truncate">{host || (type === "video" ? "Video URL" : "Link URL")}</span>
          </div>
        ) : null}
        <p className="line-clamp-[10] text-sm whitespace-pre-line text-foreground/90">{body || (type === "video" || type === "link" ? "Optional notes shown under the media." : "The body text appears here.")}</p>
        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                #{t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
