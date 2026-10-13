import { Bookmark, ChevronRight, Clock, Play } from "lucide-react"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import type { ContentCategory } from "@/lib/api/business/content"
import type { ContentType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CATEGORY_META, CONTENT_TYPE_META } from "./content-meta"

export interface ContentPreviewData {
  title: string
  summary: string
  body: string
  type: ContentType
  category: ContentCategory
  coverEmoji: string
  coverColor: string
  url?: string
  readMinutes: number
  author?: string
}

/** Feed card + opened view, as employees see it in the app (wellness feed). */
export function ContentPreview({ data, className, companyName }: { data: ContentPreviewData; className?: string; companyName?: string }) {
  const type = CONTENT_TYPE_META[data.type] ?? CONTENT_TYPE_META.article
  const cat = CATEGORY_META[data.category] ?? CATEGORY_META.general
  const title = data.title.trim() || "Your content title"
  const summary = data.summary.trim() || "A one-line summary shown on the feed card."
  const minutes = Number.isFinite(data.readMinutes) && data.readMinutes > 0 ? data.readMinutes : 1
  return (
    <PhoneFrame className={className} label="Employee App preview">
      <div className="space-y-4">
        <section aria-label="Feed card preview" className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Wellness feed</p>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="relative flex h-24 items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, ${data.coverColor}, ${data.coverColor}b3)` }}>
              <span className="drop-shadow-sm" aria-hidden>
                {data.coverEmoji}
              </span>
              {data.type === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm">
                    <Play className="size-4 fill-current" />
                  </span>
                </span>
              ) : null}
              <span className="absolute top-2 left-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                {cat.emoji} {cat.label}
              </span>
            </div>
            <div className="space-y-1 p-3">
              <p className={cn("line-clamp-2 text-sm leading-snug font-semibold", !data.title.trim() && "text-muted-foreground")}>{title}</p>
              <p className={cn("line-clamp-2 text-[11px] text-muted-foreground", !data.summary.trim() && "italic")}>{summary}</p>
              <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                <type.icon className="size-3" /> {type.label}
                <span aria-hidden>·</span>
                <Clock className="size-3" /> {minutes} min
                <Bookmark className="ml-auto size-3.5" />
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Opened view preview" className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">When opened</p>
          <div className="space-y-2 rounded-2xl border bg-card p-3 shadow-sm">
            <p className="text-sm leading-snug font-semibold">{title}</p>
            <p className="text-[10px] text-muted-foreground">
              {data.author ? `${data.author} · ` : ""}
              {companyName ?? "Your company"}
            </p>
            {data.body.trim() ? <p className="line-clamp-6 text-[11px] leading-relaxed whitespace-pre-line text-foreground/85">{data.body.trim()}</p> : null}
            {data.type === "video" || data.type === "link" || data.url?.trim() ? (
              <span className={cn("inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold", data.url?.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {data.type === "video" ? "Watch video" : data.type === "link" ? "Open link" : "Read more"}
                <ChevronRight className="size-3" />
              </span>
            ) : null}
          </div>
        </section>
      </div>
    </PhoneFrame>
  )
}
