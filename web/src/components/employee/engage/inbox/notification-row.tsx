"use client"

import { ChevronRight, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { IconTile } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import type { NotificationItem } from "@/lib/api/employee/notifications"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { NOTIFICATION_TYPE } from "./meta"

/** Width of the revealed Delete action. */
const REVEAL = 88
/** Movement before we decide whether the gesture is a horizontal swipe or a vertical scroll. */
const SLOP = 8

interface DragState {
  pointerId: number
  startX: number
  startY: number
  base: number
  axis: "x" | "y" | null
  moved: boolean
}

/**
 * Notification row. Touch: swipe left to reveal Delete, or swipe past ~45% to delete straight away.
 * Mouse / keyboard: a delete button appears on hover or focus (and the Delete key works).
 */
export function NotificationRow({ item, onOpen, onDelete }: { item: NotificationItem; onOpen: (item: NotificationItem) => void; onDelete: (item: NotificationItem) => void }) {
  const meta = NOTIFICATION_TYPE[item.type] ?? NOTIFICATION_TYPE.system
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const drag = useRef<DragState | null>(null)
  /** Ignore the click the browser may fire right after a swipe ends. */
  const suppressClickUntil = useRef(0)
  const rowRef = useRef<HTMLLIElement>(null)

  const remove = () => {
    if (leaving) return
    const width = rowRef.current?.offsetWidth ?? 400
    setLeaving(true)
    setDragging(false)
    setOffset(-width)
    window.setTimeout(() => onDelete(item), 280)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" || leaving) return
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, base: offset, axis: null, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y"
      if (d.axis === "y") {
        drag.current = null
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    d.moved = true
    const width = rowRef.current?.offsetWidth ?? 400
    // Left only; a little resistance when dragging right of the resting position.
    const next = d.base + dx
    setOffset(next > 0 ? Math.min(12, next / 4) : Math.max(-width, next))
  }

  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current
    if (d?.pointerId !== e.pointerId) return
    drag.current = null
    if (d.axis !== "x") return
    setDragging(false)
    if (d.moved) suppressClickUntil.current = e.timeStamp + 400
    const width = rowRef.current?.offsetWidth ?? 400
    if (!cancelled && offset <= -Math.min(width * 0.45, 220)) remove()
    else if (!cancelled && offset <= -REVEAL / 2) setOffset(-REVEAL)
    else setOffset(0)
  }

  const onClick = (e: React.MouseEvent) => {
    if (e.timeStamp < suppressClickUntil.current) return
    if (offset !== 0) {
      setOffset(0)
      return
    }
    onOpen(item)
  }

  const revealed = offset <= -REVEAL / 2

  return (
    <li
      ref={rowRef}
      className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", leaving ? "grid-rows-[0fr] opacity-0 delay-150" : "grid-rows-[1fr]")}
      aria-hidden={leaving || undefined}
    >
      <div className="relative min-h-0 overflow-hidden">
        {/* Action revealed behind the row while swiping (only rendered when the row is moved) */}
        {offset < 0 || dragging || leaving ? (
          <div className="absolute inset-0 flex items-stretch justify-end bg-destructive" aria-hidden={!revealed}>
            <button
              type="button"
              tabIndex={revealed ? 0 : -1}
              onClick={remove}
              className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-white"
              style={{ width: Math.max(REVEAL, -offset) }}
            >
              <Trash2 className="size-5" />
              Delete
            </button>
          </div>
        ) : null}

        <div
          className="group relative touch-pan-y bg-card select-none"
          style={{ transform: `translate3d(${offset}px,0,0)`, transition: dragging ? "none" : "transform 220ms cubic-bezier(.2,.8,.2,1)" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
        >
          <button
            type="button"
            onClick={onClick}
            onKeyDown={(e) => {
              if (e.key === "Delete") {
                e.preventDefault()
                remove()
              }
            }}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset sm:px-5",
              !item.read && "bg-primary/[0.05] dark:bg-primary/[0.08]",
            )}
            aria-label={`${item.read ? "" : "Unread. "}${meta.label}: ${item.title}. ${item.body}`}
          >
            <IconTile icon={meta.icon} tone={meta.tone} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className={cn("line-clamp-2 text-sm leading-snug", item.read ? "font-medium text-foreground/85" : "font-bold")}>{item.title}</span>
              <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.body}</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium">{meta.label}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{formatRelative(item.createdAt)}</span>
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2 pt-1 transition-opacity pointer-fine:group-focus-within:opacity-0 pointer-fine:group-hover:opacity-0">
              {!item.read ? <span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/15" aria-hidden /> : <span className="size-2.5" aria-hidden />}
              {item.href ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
            </span>
          </button>

          {/* Desktop: delete on hover / focus */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={remove}
            aria-label={`Delete notification: ${item.title}`}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 pointer-coarse:hidden sm:right-3.5"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  )
}
