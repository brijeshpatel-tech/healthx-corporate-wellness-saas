import { ChevronRight, Mail, Pin } from "lucide-react"
import { PhoneFrame } from "@/components/business/engagement/phone-frame"
import type { AnnouncementType, Channel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { TYPE_META } from "./announcement-meta"

/** Live "as employees will see it" preview: push banner + in-app card (+ email note). */
export function AnnouncementPreview({
  title,
  body,
  type,
  channels,
  link,
  pinned,
  companyName = "Your company",
  timeLabel = "now",
  className,
}: {
  title: string
  body: string
  type: AnnouncementType
  channels: Channel[]
  link?: { label?: string; href?: string } | null
  pinned?: boolean
  companyName?: string
  timeLabel?: string
  className?: string
}) {
  const meta = TYPE_META[type] ?? TYPE_META.general
  const shownTitle = title.trim() || "Your announcement title"
  const shownBody = body.trim() || "Your message appears here. Keep it short and friendly — say what's happening and what people should do next."
  const push = channels.includes("push")
  const inApp = channels.includes("in_app")
  const email = channels.includes("email")

  return (
    <PhoneFrame className={className} label="Employee App preview">
      <div className="space-y-4">
        <section aria-label="Push notification preview" className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Push notification</p>
          <div className={cn("rounded-2xl border bg-card/95 p-2.5 shadow-sm backdrop-blur", !push && "opacity-45")}>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded-[5px] bg-primary text-[9px] font-bold text-primary-foreground">H</span>
              <span className="font-medium tracking-wide uppercase">HealthX</span>
              <span className="ml-auto">{timeLabel}</span>
            </div>
            <p className={cn("mt-1.5 line-clamp-1 text-xs font-semibold", !title.trim() && "text-muted-foreground")}>{shownTitle}</p>
            <p className={cn("line-clamp-2 text-[11px] leading-snug text-muted-foreground", !body.trim() && "italic")}>{shownBody}</p>
          </div>
          {!push ? <p className="px-1 text-[10px] text-muted-foreground">Push is off for this announcement.</p> : null}
        </section>

        <section aria-label="In-app preview" className="space-y-1.5">
          <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">In the app · Announcements</p>
          <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", !inApp && "opacity-45", pinned && inApp && "ring-1 ring-primary/40")}>
            <div className="space-y-2 p-3">
              <div className="flex items-center gap-1.5">
                <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-medium", meta.className)}>
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.employeeLabel}
                </span>
                {pinned ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                    <Pin className="size-3" /> Pinned
                  </span>
                ) : null}
                <span className="ml-auto size-1.5 rounded-full bg-primary" aria-label="Unread" />
              </div>
              <p className={cn("text-sm leading-snug font-semibold", !title.trim() && "text-muted-foreground")}>{shownTitle}</p>
              <p className={cn("line-clamp-6 text-xs leading-relaxed whitespace-pre-line text-muted-foreground", !body.trim() && "italic")}>{shownBody}</p>
              {link?.label?.trim() ? (
                <span className="mt-1 inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">
                  {link.label.trim()}
                  <ChevronRight className="size-3" />
                </span>
              ) : null}
            </div>
            <div className="border-t bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
              From {companyName} · {timeLabel === "now" ? "Just now" : timeLabel}
            </div>
          </div>
          {!inApp ? <p className="px-1 text-[10px] text-muted-foreground">In-app is off — it won&apos;t appear in the app.</p> : null}
        </section>

        {email ? (
          <p className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
            <Mail className="size-3" /> Also sent by email to work addresses.
          </p>
        ) : null}
      </div>
    </PhoneFrame>
  )
}
