"use client"

import { Archive, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { ConfirmDialog } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation } from "@/lib/api/hooks"
import { workoutsApi, type WorkoutRow } from "@/lib/api/platform/workouts"
import { formatNumber, pluralize } from "@/lib/format"

/** Row / card menu: edit, publish / unpublish, duplicate, delete (archive when it has completions). */
export function WorkoutActionsMenu({ workout: w, align = "end" }: { workout: WorkoutRow; align?: "start" | "end" }) {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const [confirm, setConfirm] = useState<"delete" | "unpublish" | null>(null)

  const publish = useApiMutation(workoutsApi.update, { success: "Workout published." })
  const unpublish = useApiMutation(workoutsApi.update, { success: "Workout unpublished. It no longer appears in the app." })
  const duplicate = useApiMutation(workoutsApi.duplicate, { success: (c) => `Copied as “${c.name}” (draft).` })
  const remove = useApiMutation(workoutsApi.remove, {
    success: (r) => (r.archived ? `“${r.name}” has completions, so it was archived instead of deleted.` : `“${r.name}” deleted.`),
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${w.name}`} onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={`/admin-portal/workouts/${w.id}`}>
              {manage ? <Pencil /> : <Eye />} {manage ? "Edit" : "View"}
            </Link>
          </DropdownMenuItem>
          {manage ? (
            <>
              {w.status === "published" ? (
                <DropdownMenuItem onClick={() => setConfirm("unpublish")}>
                  <EyeOff /> Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => publish.mutate({ id: w.id, status: "published" })} disabled={w.exercisesCount === 0}>
                  <Send /> {w.status === "archived" ? "Restore & publish" : "Publish"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => duplicate.mutate({ id: w.id })}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")} disabled={w.status === "archived" && w.completions > 0}>
                {w.completions > 0 ? <Archive /> : <Trash2 />} {w.completions > 0 ? "Archive" : "Delete"}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title={w.completions > 0 ? `Archive “${w.name}”?` : `Delete “${w.name}”?`}
        description={
          w.completions > 0
            ? `This workout has been completed ${pluralize(w.completions, "time")}, so it will be archived instead of deleted. It disappears from the app, but employees keep their history and points.`
            : "The workout will be removed permanently. This can't be undone."
        }
        confirmLabel={w.completions > 0 ? "Archive workout" : "Delete workout"}
        onConfirm={() => {
          remove.mutate({ id: w.id })
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Unpublish “${w.name}”?`}
        description={`It will be hidden from the Employee App straight away (${formatNumber(w.completions)} past completions are kept). You can publish it again at any time.`}
        confirmLabel="Unpublish"
        onConfirm={() => {
          unpublish.mutate({ id: w.id, status: "draft" })
          setConfirm(null)
        }}
      />
    </>
  )
}
