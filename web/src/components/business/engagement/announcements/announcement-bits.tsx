"use client"

import { InlineBar } from "@/components/common/misc"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AnnouncementRow } from "@/lib/api/business/announcements"
import { formatNumber, formatPercent, formatRelative } from "@/lib/format"
import type { AnnouncementType, Channel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CHANNEL_META, COMPOSER_CHANNELS, TYPE_META, formatSchedule } from "./announcement-meta"

/** "Sent 2 days ago" / "For Mon 6 Oct, 09:00" / "Edited 5 min ago". */
export function announcementDateLabel(r: Pick<AnnouncementRow, "status" | "sentAt" | "scheduledAt" | "scheduleCancelledAt" | "updatedAt">) {
  if (r.status === "sent") return `Sent ${formatRelative(r.sentAt)}`
  if (r.status === "scheduled") return `For ${formatSchedule(r.scheduledAt)}`
  if (r.scheduleCancelledAt) return `Schedule cancelled ${formatRelative(r.scheduleCancelledAt)}`
  return `Edited ${formatRelative(r.updatedAt)}`
}

export function TypeIcon({ type, className }: { type: AnnouncementType; className?: string }) {
  const meta = TYPE_META[type] ?? TYPE_META.general
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.className, className)} aria-hidden>
      <meta.icon className="size-4" />
    </span>
  )
}

export function TypeChip({ type, className }: { type: AnnouncementType; className?: string }) {
  const meta = TYPE_META[type] ?? TYPE_META.general
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap", meta.className, className)}>
      <meta.icon className="size-3.5" /> {meta.label}
    </span>
  )
}

/** Push / In-app icons — selected channels highlighted (email shown only on older announcements that used it). */
export function ChannelIcons({ channels, className }: { channels: Channel[]; className?: string }) {
  const shown: Channel[] = channels.includes("email") ? [...COMPOSER_CHANNELS, "email"] : COMPOSER_CHANNELS
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {shown.map((c) => {
        const meta = CHANNEL_META[c]
        const on = channels.includes(c)
        return (
          <Tooltip key={c}>
            <TooltipTrigger asChild>
              <span
                className={cn("flex size-7 items-center justify-center rounded-lg border", on ? "border-primary/25 bg-primary/8 text-primary" : "border-dashed text-muted-foreground/40")}
                role="img"
                aria-label={`${meta.label}: ${on ? "on" : "off"}`}
              >
                <meta.icon className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{on ? meta.label : `${meta.label} (off)`}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/** Opened / delivered with an open-rate bar (sent announcements only). */
export function ReachCell({ row }: { row: AnnouncementRow }) {
  if (row.status !== "sent") return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="min-w-36 space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{formatNumber(row.stats.opened)}</span> / {formatNumber(row.stats.delivered)} opened
        </span>
        <span className="font-semibold tabular-nums">{formatPercent(row.openRate)}</span>
      </div>
      <InlineBar value={row.openRate ?? 0} max={1} className="h-1.5" />
      <div className="text-[11px] text-muted-foreground tabular-nums">{formatNumber(row.stats.recipients)} recipients</div>
    </div>
  )
}
