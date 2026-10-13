// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Employee app — notification centre (SCR-M-061). Own notifications only. */
import type { AppNotification } from "@/lib/types"
import { daysAgo, toLocalDate } from "@/lib/mock/series"
import { endpoint, notFound, type MockContext } from "../core"

export type NotificationGroup = "today" | "yesterday" | "earlier"

/** A notification plus the day group it falls in (computed when fetched). */
export interface NotificationItem extends AppNotification {
  group: NotificationGroup
}

type Ctx = MockContext<"employee">

// Deleted notifications are kept briefly so "Undo" can restore them (soft delete on the backend).
const TRASH_KEY = "emp-notifications-trash"
const TRASH_LIMIT = 30

function trashOf(ctx: Ctx) {
  const all = ctx.extra<Record<string, AppNotification[]>>(TRASH_KEY, () => ({}))
  const id = ctx.me().employeeId
  if (!all[id]) all[id] = []
  return all[id]
}

export const notificationsApi = {
  list: endpoint<{ unreadOnly?: boolean } | void, NotificationItem[], "employee">("employee", "GET", "/me/notifications", (input, ctx) => {
    const today = toLocalDate(new Date())
    const yesterday = toLocalDate(daysAgo(1))
    const items = [...ctx.me().notifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n): NotificationItem => {
        const day = toLocalDate(new Date(n.createdAt))
        return { ...n, group: day >= today ? "today" : day === yesterday ? "yesterday" : "earlier" }
      })
    return input && input.unreadOnly ? items.filter((n) => !n.read) : items
  }),

  unreadCount: endpoint<void, { count: number }, "employee">("employee", "GET", "/me/notifications/unread-count", (_i, ctx) => ({
    count: ctx.me().notifications.filter((n) => !n.read).length,
  })),

  markRead: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/me/notifications/:id/read", ({ id }, ctx) => {
    const n = ctx.me().notifications.find((x) => x.id === id)
    if (!n) throw notFound("Notification")
    n.read = true
    ctx.save()
    return { ok: true }
  }),

  markAllRead: endpoint<void, { ok: true }, "employee">("employee", "POST", "/me/notifications/read-all", (_i, ctx) => {
    ctx.me().notifications.forEach((n) => (n.read = true))
    ctx.save()
    return { ok: true }
  }),

  remove: endpoint<{ id: string }, { ok: true }, "employee">("employee", "DELETE", "/me/notifications/:id", ({ id }, ctx) => {
    const me = ctx.me()
    const removed = me.notifications.find((n) => n.id === id)
    me.notifications = me.notifications.filter((n) => n.id !== id)
    if (removed) {
      const trash = trashOf(ctx)
      trash.unshift(removed)
      trash.splice(TRASH_LIMIT)
    }
    ctx.save()
    return { ok: true }
  }),

  /** Undo a delete. Idempotent: restoring a notification that is still there is a no-op. */
  restore: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/me/notifications/:id/restore", ({ id }, ctx) => {
    const me = ctx.me()
    if (me.notifications.some((n) => n.id === id)) return { ok: true }
    const trash = trashOf(ctx)
    const idx = trash.findIndex((n) => n.id === id)
    if (idx < 0) throw notFound("Notification")
    const [item] = trash.splice(idx, 1)
    me.notifications.push(item!)
    me.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    ctx.save()
    return { ok: true }
  }),

  /** Bulk delete every notification that has been read. */
  clearRead: endpoint<void, { removed: number }, "employee">("employee", "POST", "/me/notifications/clear-read", (_i, ctx) => {
    const me = ctx.me()
    const read = me.notifications.filter((n) => n.read)
    me.notifications = me.notifications.filter((n) => !n.read)
    ctx.save()
    return { removed: read.length }
  }),
}
