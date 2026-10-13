"use client"

import { CheckCheck, Settings2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/common/misc"
import { NotificationRow } from "@/components/employee/engage/inbox/notification-row"
import { InboxEmpty } from "@/components/employee/engage/inbox/states"
import { ChipTabs, EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { notificationsApi, type NotificationGroup, type NotificationItem } from "@/lib/api/employee/notifications"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"

type Filter = "all" | "unread"

const GROUPS: { key: NotificationGroup; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "earlier", label: "Earlier" },
]

/** SCR-M-061 Notification Centre. */
export default function NotificationsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("all")
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const pendingDeletes = useRef(new Map<string, Promise<unknown>>())
  const q = useApiQuery(["employee", "notifications", "list"], () => notificationsApi.list())

  const unhide = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  const markRead = useApiMutation(notificationsApi.markRead)
  const markAll = useApiMutation(notificationsApi.markAllRead, { success: "All notifications marked as read" })
  const remove = useApiMutation(notificationsApi.remove, { errorTitle: "Couldn't delete the notification", onError: (_e, input) => unhide(input.id) })
  const restore = useApiMutation(notificationsApi.restore, { errorTitle: "Couldn't restore the notification", onSuccess: (_o, input) => unhide(input.id) })
  const clearRead = useApiMutation(notificationsApi.clearRead, {
    success: (r) => (r.removed ? `${r.removed} read notification${r.removed === 1 ? "" : "s"} cleared` : "No read notifications to clear"),
  })

  const items = useMemo(() => (q.data ?? []).filter((n) => !hidden.has(n.id)), [q.data, hidden])
  const unread = items.filter((n) => !n.read).length
  const readCount = items.length - unread
  const shown = filter === "unread" ? items.filter((n) => !n.read) : items

  const open = (n: NotificationItem) => {
    if (!n.read) markRead.mutate({ id: n.id })
    if (n.href) router.push(n.href)
  }

  const del = (n: NotificationItem) => {
    setHidden((prev) => new Set(prev).add(n.id))
    const pending = remove.mutateAsync({ id: n.id }).catch(() => undefined)
    pendingDeletes.current.set(n.id, pending)
    toast("Notification deleted", {
      description: n.title,
      action: {
        label: "Undo",
        onClick: async () => {
          await pendingDeletes.current.get(n.id)
          pendingDeletes.current.delete(n.id)
          restore.mutate({ id: n.id })
        },
      },
    })
  }

  return (
    <EngagePage
      size="narrow"
      title="Notifications"
      description="Reminders, challenge updates, rewards and company news."
      actions={
        <>
          <Button variant="outline" size="lg" className="rounded-xl" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            {markAll.isPending ? <Spinner data-icon="inline-start" /> : <CheckCheck data-icon="inline-start" />}
            Mark all as read
          </Button>
          <Button asChild variant="outline" size="icon-lg" className="rounded-xl" aria-label="Notification settings">
            <Link href="/employee-app/settings/notifications">
              <Settings2 />
            </Link>
          </Button>
        </>
      }
    >
      {q.error ? (
        <LoadError title="Couldn't load notifications." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <NotificationsSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <ChipTabs<Filter>
              ariaLabel="Filter notifications"
              value={filter}
              onChange={setFilter}
              className="mx-0 px-0 pb-0"
              options={[
                { value: "all", label: "All", count: items.length },
                { value: "unread", label: "Unread", count: unread },
              ]}
            />
            {readCount > 0 ? (
              <ConfirmDialog
                title="Clear read notifications?"
                description={`This deletes ${readCount} notification${readCount === 1 ? "" : "s"} you've already read. Unread notifications stay.`}
                confirmLabel="Clear read"
                destructive
                onConfirm={() => clearRead.mutate()}
                trigger={
                  <Button variant="ghost" size="lg" className="shrink-0 rounded-xl text-muted-foreground" disabled={clearRead.isPending}>
                    {clearRead.isPending ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
                    Clear read
                  </Button>
                }
              />
            ) : null}
          </div>

          {shown.length === 0 ? (
            <InboxEmpty
              emoji="🎉"
              title="You're all caught up."
              description={filter === "unread" && items.length ? "No unread notifications. Nice work!" : "New reminders, challenge updates and announcements will show up here."}
              action={
                filter === "unread" && items.length ? (
                  <Button variant="outline" size="lg" className="rounded-xl" onClick={() => setFilter("all")}>
                    Show all notifications
                  </Button>
                ) : (
                  <Button asChild variant="outline" size="lg" className="rounded-xl">
                    <Link href="/employee-app/announcements">See company announcements</Link>
                  </Button>
                )
              }
            />
          ) : (
            <div className="space-y-5">
              {GROUPS.map((g) => {
                const rows = shown.filter((n) => n.group === g.key)
                if (!rows.length) return null
                return (
                  <section key={g.key} aria-labelledby={`ntf-${g.key}`} className="space-y-2">
                    <h2 id={`ntf-${g.key}`} className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {g.label}
                    </h2>
                    <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
                      {rows.map((n) => (
                        <NotificationRow key={n.id} item={n} onOpen={open} onDelete={del} />
                      ))}
                    </ul>
                  </section>
                )
              })}
              <p className="hidden text-center text-xs text-muted-foreground pointer-coarse:block">Swipe left on a notification to delete it.</p>
            </div>
          )}
        </>
      )}
    </EngagePage>
  )
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading notifications">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      {[3, 2].map((count, s) => (
        <div key={s} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
