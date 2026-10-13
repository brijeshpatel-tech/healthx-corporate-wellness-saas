"use client"

import { ChevronRight, Pin } from "lucide-react"
import Link from "next/link"
import { IconTile } from "@/components/employee/engage/page"
import type { AnnouncementListItem } from "@/lib/api/employee/announcements"
import { formatRelative } from "@/lib/format"
import type { AnnouncementType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ANNOUNCEMENT_TYPE, TONE_PILL } from "./meta"

export const announcementHref = (id: string) => `/employee-app/announcements/${id}`

/** Small tinted pill with the announcement type. */
export function AnnouncementTypePill({ type, full, className }: { type: AnnouncementType; full?: boolean; className?: string }) {
  const meta = ANNOUNCEMENT_TYPE[type]
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold", TONE_PILL[meta.tone], className)}>
      <meta.icon className="size-3" aria-hidden />
      {full ? meta.label : meta.label.replace(" announcement", "")}
    </span>
  )
}

/** One announcement in a list: type icon, title (bold + dot when unread), excerpt, sender and time. */
export function AnnouncementRow({ item }: { item: AnnouncementListItem }) {
  const meta = ANNOUNCEMENT_TYPE[item.type]
  return (
    <li>
      <Link
        href={announcementHref(item.id)}
        className={cn(
          "group flex items-start gap-3 px-4 py-4 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60 sm:px-5",
          !item.read && "bg-primary/[0.04] dark:bg-primary/[0.07]",
        )}
      >
        <IconTile icon={meta.icon} tone={meta.tone} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AnnouncementTypePill type={item.type} />
            {item.pinned ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                <Pin className="size-3" aria-hidden /> Pinned
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{formatRelative(item.sentAt)}</span>
          </div>
          <p className={cn("mt-1.5 flex items-start gap-2 text-[15px] leading-snug", item.read ? "font-medium text-foreground/85" : "font-bold")}>
            {!item.read ? <span className="mt-[7px] size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
            <span className="line-clamp-2">{item.title}</span>
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.excerpt}</p>
          <p className="mt-2 text-xs text-muted-foreground">From {item.author}</p>
        </div>
        <ChevronRight className="mt-3 hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
      </Link>
    </li>
  )
}

/** Featured gradient card for pinned announcements. */
export function PinnedAnnouncementCard({ item }: { item: AnnouncementListItem }) {
  const meta = ANNOUNCEMENT_TYPE[item.type]
  return (
    <Link
      href={announcementHref(item.id)}
      className="group relative block overflow-hidden rounded-2xl p-4 text-white shadow-lg transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
      style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}c0 55%, ${meta.color}99)`, boxShadow: `0 12px 30px -14px ${meta.color}` }}
    >
      <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
      <span className="absolute -top-10 -right-8 size-36 rounded-full bg-white/12" aria-hidden />
      <div className="relative flex items-start gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm" aria-hidden>
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
            <Pin className="size-3.5" aria-hidden /> Pinned · {meta.label}
          </p>
          <p className="text-base leading-snug font-bold sm:text-lg">{item.title}</p>
          <p className="line-clamp-2 text-sm text-white/90">{item.excerpt}</p>
          <p className="pt-1 text-xs text-white/80">
            {item.author} · {formatRelative(item.sentAt)}
          </p>
        </div>
        {!item.read ? <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-900 uppercase">New</span> : null}
      </div>
    </Link>
  )
}
