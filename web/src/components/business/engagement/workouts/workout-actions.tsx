"use client"

import { Archive, ArchiveRestore, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Rocket, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { workoutsApi, type WorkoutRow } from "@/lib/api/business/workouts"
import { useApiMutation } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatNumber } from "@/lib/format"

export type WorkoutConfirmKind = "publish" | "unpublish" | "archive" | "delete"

/** Publish / unpublish / archive / restore / duplicate / delete for one workout (shared by list and detail). */
export function useWorkoutActions(onDeleted?: () => void) {
  const router = useRouter()
  const publish = useApiMutation(workoutsApi.publish, { success: (w) => `“${w.name}” is live — employees can find it in the app.` })
  const unpublish = useApiMutation(workoutsApi.unpublish, { success: (w) => `“${w.name}” moved to drafts — employees no longer see it.` })
  const archive = useApiMutation(workoutsApi.archive, { success: (w) => `“${w.name}” archived.` })
  const restore = useApiMutation(workoutsApi.restore, { success: (w) => `“${w.name}” restored as a draft.` })
  const remove = useApiMutation(workoutsApi.remove, { success: "Draft deleted", onSuccess: () => onDeleted?.() })
  const duplicate = useApiMutation(workoutsApi.duplicate, {
    success: (w) => `Copied to your company workouts as “${w.name}”.`,
    onSuccess: (w) => router.push(`/business-portal/workouts/${w.id}/edit`),
  })
  const run = (kind: WorkoutConfirmKind, id: string) => {
    if (kind === "publish") publish.mutate({ id })
    if (kind === "unpublish") unpublish.mutate({ id })
    if (kind === "archive") archive.mutate({ id })
    if (kind === "delete") remove.mutate({ id })
  }
  const busy = publish.isPending || unpublish.isPending || archive.isPending || restore.isPending || remove.isPending || duplicate.isPending
  return { run, restore, duplicate, busy }
}

export function WorkoutConfirmDialog({ workout, kind, onClose, onConfirm }: { workout: Pick<WorkoutRow, "name" | "completions">; kind: WorkoutConfirmKind | null; onClose: () => void; onConfirm: (kind: WorkoutConfirmKind) => void }) {
  const copy: Record<WorkoutConfirmKind, { title: string; description: string; label: string; destructive: boolean }> = {
    publish: { title: `Publish “${workout.name}”?`, description: "Everyone in your company will be able to find and start it in the Workouts tab of the app.", label: "Publish", destructive: false },
    unpublish: {
      title: `Unpublish “${workout.name}”?`,
      description: "It moves back to drafts and disappears from the app. Employees who already completed it keep it in their history and points.",
      label: "Unpublish",
      destructive: true,
    },
    archive: {
      title: `Archive “${workout.name}”?`,
      description: `It's hidden from the app and from your list of active workouts.${workout.completions ? ` ${formatNumber(workout.completions)} completions stay in employees' history.` : ""} You can restore it later.`,
      label: "Archive",
      destructive: true,
    },
    delete: { title: `Delete “${workout.name}”?`, description: "This draft is removed permanently. Nobody has seen it yet.", label: "Delete draft", destructive: true },
  }
  const c = kind ? copy[kind] : null
  return (
    <ConfirmDialog
      open={!!kind}
      onOpenChange={(o) => !o && onClose()}
      title={c?.title ?? ""}
      description={c?.description}
      confirmLabel={c?.label}
      destructive={c?.destructive}
      onConfirm={() => kind && onConfirm(kind)}
    />
  )
}

/** Row/card "…" menu. HealthX library workouts can only be viewed or copied. */
export function WorkoutActionsMenu({ workout, align = "end" }: { workout: WorkoutRow; align?: "start" | "end" }) {
  const can = useCan()
  const manage = can("content.manage")
  const [confirm, setConfirm] = useState<WorkoutConfirmKind | null>(null)
  const { run, restore, duplicate } = useWorkoutActions()
  const company = workout.source === "company"

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${workout.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-56">
          <DropdownMenuItem asChild>
            <Link href={`/business-portal/workouts/${workout.id}`}>
              <Eye /> View details
            </Link>
          </DropdownMenuItem>
          {manage && company && workout.status !== "archived" ? (
            <DropdownMenuItem asChild>
              <Link href={`/business-portal/workouts/${workout.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          ) : null}
          {manage && company && workout.status === "draft" ? (
            <DropdownMenuItem onClick={() => setConfirm("publish")}>
              <Rocket /> Publish
            </DropdownMenuItem>
          ) : null}
          {manage ? (
            <DropdownMenuItem onClick={() => duplicate.mutate({ id: workout.id })}>
              <Copy /> {company ? "Duplicate" : "Copy to company workouts"}
            </DropdownMenuItem>
          ) : null}
          {manage && company && workout.status === "archived" ? (
            <DropdownMenuItem onClick={() => restore.mutate({ id: workout.id })}>
              <ArchiveRestore /> Restore as draft
            </DropdownMenuItem>
          ) : null}
          {manage && company && workout.status !== "archived" ? <DropdownMenuSeparator /> : null}
          {manage && company && workout.status === "published" ? (
            <DropdownMenuItem onClick={() => setConfirm("unpublish")}>
              <EyeOff /> Unpublish
            </DropdownMenuItem>
          ) : null}
          {manage && company && workout.status !== "archived" ? (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm("archive")}>
              <Archive /> Archive
            </DropdownMenuItem>
          ) : null}
          {manage && company && workout.status === "draft" && workout.completions === 0 ? (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
              <Trash2 /> Delete draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <WorkoutConfirmDialog
        workout={workout}
        kind={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(k) => {
          run(k, workout.id)
          setConfirm(null)
        }}
      />
    </div>
  )
}
