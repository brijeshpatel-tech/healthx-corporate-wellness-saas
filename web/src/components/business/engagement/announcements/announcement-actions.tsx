"use client"

import { Ban, Copy, Eye, MoreHorizontal, Pencil, Pin, PinOff, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { announcementsApi, type AnnouncementRow } from "@/lib/api/business/announcements"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { formatSchedule } from "./announcement-meta"

type Confirm = "send" | "cancel" | "delete" | null

/** Mutations + confirmations for one announcement, shared by the list rows and the detail page. */
export function useAnnouncementActions(row: AnnouncementRow, opts: { onDeleted?: () => void } = {}) {
  const router = useRouter()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const send = useApiMutation(announcementsApi.send, { success: (a) => `Announcement sent to ${formatNumber(a.stats.recipients)} employees.` })
  const cancel = useApiMutation(announcementsApi.cancel, { success: "Scheduled send cancelled — it's a draft again." })
  const remove = useApiMutation(announcementsApi.remove, { success: "Draft deleted", onSuccess: () => opts.onDeleted?.() })
  const pin = useApiMutation(announcementsApi.setPinned, { success: (a) => (a.pinned ? "Pinned to the top" : "Unpinned") })
  const duplicate = useApiMutation(announcementsApi.duplicate, {
    success: "Copy created as a draft",
    onSuccess: (a) => router.push(`/business-portal/announcements/${a.id}/edit`),
  })
  const pending = send.isPending || cancel.isPending || remove.isPending || pin.isPending || duplicate.isPending

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "send"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Send this announcement now?"
        description={
          <>
            “{row.title}” goes to <strong>{row.audienceLabel.toLowerCase() === "everyone" ? "everyone in your company" : row.audienceLabel}</strong> straight away
            {row.status === "scheduled" && row.scheduledAt ? ` instead of ${formatSchedule(row.scheduledAt)}` : ""}. Sent announcements can&apos;t be edited.
          </>
        }
        confirmLabel="Send now"
        onConfirm={() => {
          send.mutate({ id: row.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Cancel the scheduled send?"
        description={`“${row.title}” won't be sent ${row.scheduledAt ? `on ${formatSchedule(row.scheduledAt)}` : ""}. It moves back to drafts so you can edit or reschedule it.`}
        confirmLabel="Cancel send"
        cancelLabel="Keep scheduled"
        onConfirm={() => {
          cancel.mutate({ id: row.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Delete this draft?"
        description={`“${row.title}” will be removed permanently. This can't be undone.`}
        confirmLabel="Delete draft"
        onConfirm={() => {
          remove.mutate({ id: row.id })
          setConfirm(null)
        }}
      />
    </>
  )

  return {
    pending,
    dialogs,
    ask: setConfirm,
    togglePin: () => pin.mutate({ id: row.id, pinned: !row.pinned }),
    duplicate: () => duplicate.mutate({ id: row.id }),
  }
}

/** "…" menu for an announcement row or card. */
export function AnnouncementActionsMenu({ row, showView = true, onDeleted }: { row: AnnouncementRow; showView?: boolean; onDeleted?: () => void }) {
  const actions = useAnnouncementActions(row, { onDeleted })
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.title}`} disabled={actions.pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/announcements/${row.id}`}>
                <Eye /> View
              </Link>
            </DropdownMenuItem>
          ) : null}
          {row.canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/announcements/${row.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {row.canSend ? (
            <DropdownMenuItem onClick={() => actions.ask("send")}>
              <Send /> Send now
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={actions.duplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={actions.togglePin}>
            {row.pinned ? (
              <>
                <PinOff /> Unpin
              </>
            ) : (
              <>
                <Pin /> Pin to top
              </>
            )}
          </DropdownMenuItem>
          {row.canCancel || row.canDelete ? <DropdownMenuSeparator /> : null}
          {row.canCancel ? (
            <DropdownMenuItem variant="destructive" onClick={() => actions.ask("cancel")}>
              <Ban /> Cancel scheduled send
            </DropdownMenuItem>
          ) : null}
          {row.canDelete ? (
            <DropdownMenuItem variant="destructive" onClick={() => actions.ask("delete")}>
              <Trash2 /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.dialogs}
    </div>
  )
}
