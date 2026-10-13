"use client"

import { Archive, Eye, Megaphone, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { programsApi, type ProgramRow } from "@/lib/api/business/programs"
import { useApiMutation } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDate, formatNumber } from "@/lib/format"

type Confirm = "publish" | "archive" | "delete" | null

/** Mutations + confirmations for one program (list rows and the detail page share them). */
export function useProgramActions(p: ProgramRow, opts: { onDeleted?: () => void } = {}) {
  const [confirm, setConfirm] = useState<Confirm>(null)
  const publish = useApiMutation(programsApi.publish, { success: (r) => r.message })
  const archive = useApiMutation(programsApi.archive, { success: "Program archived" })
  const remove = useApiMutation(programsApi.remove, { success: "Draft deleted", onSuccess: () => opts.onDeleted?.() })
  const pending = publish.isPending || archive.isPending || remove.isPending
  const live = p.status === "active" || p.status === "scheduled"

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Publish “${p.name}”?`}
        description={
          p.startDate
            ? `${formatNumber(p.eligibleCount)} employees are notified and can enrol. It ${p.daysToStart && p.daysToStart > 0 ? `starts ${formatDate(p.startDate, "EEE d MMM")}` : "starts today"}. After it starts, the dates, weeks and audience can't change.`
            : "Employees in the audience are notified and can enrol."
        }
        confirmLabel="Publish"
        onConfirm={() => {
          publish.mutate({ id: p.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={`Archive “${p.name}”?`}
        description={
          live
            ? `It's ${p.status === "active" ? "running" : "scheduled"} — ${formatNumber(p.enrolledCount)} enrolled employees will no longer see it and progress stops. This can't be undone.`
            : "It moves to Archived. Its results stay available on the program page. This can't be undone."
        }
        confirmLabel="Archive program"
        onConfirm={() => {
          archive.mutate({ id: p.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Delete this draft?"
        description={`“${p.name}” will be removed permanently. This can't be undone.`}
        confirmLabel="Delete draft"
        onConfirm={() => {
          remove.mutate({ id: p.id })
          setConfirm(null)
        }}
      />
    </>
  )
  return { pending, dialogs, ask: setConfirm }
}

/** Row "…" menu for a program. */
export function ProgramActionsMenu({ program: p, showView = true }: { program: ProgramRow; showView?: boolean }) {
  const can = useCan()
  const actions = useProgramActions(p)
  const manage = can("programs.manage")
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`} disabled={actions.pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/programs/${p.id}`}>
                <Eye /> View details
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && p.canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/programs/${p.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && p.canPublish ? (
            <DropdownMenuItem onClick={() => actions.ask("publish")}>
              <Rocket /> Publish
            </DropdownMenuItem>
          ) : null}
          {can("announcements.manage") && (p.status === "active" || p.status === "scheduled") ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/announcements/new?programId=${p.id}`}>
                <Megaphone /> Send announcement
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && (p.canArchive || p.canDelete) ? <DropdownMenuSeparator /> : null}
          {manage && p.canArchive ? (
            <DropdownMenuItem variant="destructive" onClick={() => actions.ask("archive")}>
              <Archive /> Archive
            </DropdownMenuItem>
          ) : null}
          {manage && p.canDelete ? (
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
