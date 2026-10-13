"use client"

import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { LevelBadge, LoadError, ResultCount } from "@/components/admin/content/bits"
import { ExerciseSheet } from "@/components/admin/content/exercise-sheet"
import { MediaThumb } from "@/components/admin/content/media-input"
import { LEVEL_OPTIONS, formatSeconds } from "@/components/admin/content/meta"
import { FilterSelect } from "@/components/admin/filter-select"
import { useAdminCan } from "@/components/admin/use-admin-can"
import { DataTable, type Column } from "@/components/common/data-table"
import { ConfirmDialog, SearchInput } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { exercisesApi, type ExerciseQuery, type ExerciseRow } from "@/lib/api/platform/exercises"
import { pluralize } from "@/lib/format"
import type { Exercise, FitnessLevel } from "@/lib/types"

/** SCR-P-018 Exercise library & editor. */
export default function ExercisesPage() {
  const can = useAdminCan()
  const manage = can("catalog.manage")
  const [search, setSearch] = useState("")
  const [muscleGroup, setMuscleGroup] = useState("all")
  const [level, setLevel] = useState<FitnessLevel | "all">("all")
  const [status, setStatus] = useState<Exercise["status"] | "all">("all")
  const [editor, setEditor] = useState<{ open: boolean; exercise: ExerciseRow | null }>({ open: false, exercise: null })
  const [toDelete, setToDelete] = useState<ExerciseRow | null>(null)

  const query: ExerciseQuery = { search: search || undefined, muscleGroup, level, status }
  const list = useApiQuery(["admin", "exercises", query], () => exercisesApi.list(query), { placeholderData: (prev) => prev })
  const remove = useApiMutation(exercisesApi.remove, { success: "Exercise deleted.", errorTitle: "Couldn't delete exercise" })

  const libraryEmpty = list.data?.counts.all === 0
  const filtered = !!search || muscleGroup !== "all" || level !== "all" || status !== "all"
  const openEditor = (exercise: ExerciseRow | null) => setEditor({ open: true, exercise })
  const askDelete = (e: ExerciseRow) => {
    // Used in published workouts → the API refuses; show its message straight away.
    if (e.usedInPublished > 0) remove.mutate({ id: e.id })
    else setToDelete(e)
  }

  const columns: Column<ExerciseRow>[] = [
    {
      key: "name",
      header: "Exercise",
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-3">
          <MediaThumb imageUrl={e.image?.url} emoji={e.mediaEmoji} hasVideo={!!e.video} />
          <div className="min-w-0">
            <div className="truncate font-medium">{e.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {[e.video ? "Video" : null, e.image ? "Image" : null, pluralize(e.instructions.length, "step")].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
      ),
      sortValue: (e) => e.name,
      className: "max-w-64",
    },
    {
      key: "muscles",
      header: "Muscle groups",
      cell: (e) => (
        <div className="flex max-w-56 flex-wrap gap-1">
          {e.muscleGroups.map((m) => (
            <span key={m} className="rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground capitalize">
              {m}
            </span>
          ))}
        </div>
      ),
      hideOnMobile: true,
    },
    { key: "equipment", header: "Equipment", cell: (e) => <span className="text-sm text-muted-foreground capitalize">{e.equipment.length ? e.equipment.join(", ") : "None"}</span>, hideOnMobile: true },
    { key: "level", header: "Level", cell: (e) => <LevelBadge level={e.level} />, sortValue: (e) => ["beginner", "intermediate", "advanced"].indexOf(e.level), hideOnMobile: true },
    {
      key: "default",
      header: "Default",
      cell: (e) => (
        <div className="text-sm whitespace-nowrap tabular-nums">
          {formatSeconds(e.defaultDurationSec)}
          {e.defaultReps ? <span className="text-muted-foreground"> / {e.defaultReps} reps</span> : null}
        </div>
      ),
      sortValue: (e) => e.defaultDurationSec,
      hideOnMobile: true,
    },
    {
      key: "used",
      header: "Used in",
      cell: (e) => (
        <span className="text-sm whitespace-nowrap">
          {e.usedIn ? pluralize(e.usedIn, "workout") : <span className="text-muted-foreground">Not used</span>}
        </span>
      ),
      sortValue: (e) => e.usedIn,
      hideOnMobile: true,
    },
    { key: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} />, sortValue: (e) => e.status },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => openEditor(e)}>
                {manage ? <Pencil /> : <Eye />} {manage ? "Edit" : "View"}
              </DropdownMenuItem>
              {manage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => askDelete(e)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const addButton = manage ? (
    <Button onClick={() => openEditor(null)}>
      <Plus data-icon="inline-start" /> Add exercise
    </Button>
  ) : null

  return (
    <PageContainer>
      <PageHeader title="Exercise library" description="Individual exercises with instructions and media, used to build workouts. Only published exercises appear in the workout builder." actions={addButton} />

      {list.error ? (
        <LoadError title="Couldn't load exercises." error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          getRowId={(e) => e.id}
          loading={list.isLoading}
          onRowClick={(e) => openEditor(e)}
          clientPageSize={15}
          emptyTitle={libraryEmpty ? "No exercises yet." : "No exercises match these filters"}
          emptyDescription={libraryEmpty ? "Add the first exercise to start building workouts." : "Try a different search or clear the filters."}
          emptyAction={
            libraryEmpty ? (
              addButton
            ) : filtered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("")
                  setMuscleGroup("all")
                  setLevel("all")
                  setStatus("all")
                }}
              >
                Clear filters
              </Button>
            ) : null
          }
          className={list.isFetching && !list.isLoading ? "opacity-80 transition-opacity" : "transition-opacity"}
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Search exercises…" />
              <FilterSelect value={muscleGroup} onChange={setMuscleGroup} allLabel="All muscle groups" options={(list.data?.muscleGroups ?? []).map((m) => ({ value: m, label: m[0]!.toUpperCase() + m.slice(1) }))} className="sm:w-44" />
              <FilterSelect value={level} onChange={(v) => setLevel(v as FitnessLevel | "all")} allLabel="All levels" options={LEVEL_OPTIONS} />
              <FilterSelect value={status} onChange={(v) => setStatus(v as Exercise["status"] | "all")} allLabel="All statuses" options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }]} />
              <ResultCount count={list.data?.total} noun={["exercise", "exercises"]} />
            </>
          }
        />
      )}

      <ExerciseSheet
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        exercise={editor.exercise}
        muscleGroups={list.data?.muscleGroups ?? []}
        equipment={list.data?.equipment ?? []}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={`Delete “${toDelete?.name ?? ""}”?`}
        description={
          toDelete && toDelete.usedIn > 0
            ? `It will also be removed from ${pluralize(toDelete.usedIn, "unpublished workout")}. This can't be undone.`
            : "The exercise will be removed from the library. This can't be undone."
        }
        confirmLabel="Delete exercise"
        onConfirm={() => {
          if (toDelete) remove.mutate({ id: toDelete.id })
          setToDelete(null)
        }}
      />
    </PageContainer>
  )
}
