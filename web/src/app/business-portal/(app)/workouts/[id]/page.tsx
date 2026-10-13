"use client"

import { Archive, ArchiveRestore, Clock, Copy, Dumbbell, EyeOff, Flame, Pencil, Rocket, Star, Trash2, Users } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { CoverTile } from "@/components/business/engagement/cover-picker"
import { LevelBars } from "@/components/business/engagement/workouts/workout-card"
import { useWorkoutActions, WorkoutConfirmDialog, type WorkoutConfirmKind } from "@/components/business/engagement/workouts/workout-actions"
import { capitalize, formatSeconds, LEVEL_META, LOCATION_META } from "@/components/business/engagement/workouts/workout-meta"
import { KeyValueList, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { AccessDenied, ErrorState, PageSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { workoutsApi } from "@/lib/api/business/workouts"
import { useApiQuery } from "@/lib/api/hooks"
import { useCan } from "@/lib/auth/permissions"
import { formatDate, formatNumber } from "@/lib/format"

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const can = useCan()
  const manage = can("content.manage")
  const q = useApiQuery(["business", "workouts", "detail", id], () => workoutsApi.get({ id }), { enabled: manage })
  const [confirm, setConfirm] = useState<WorkoutConfirmKind | null>(null)
  const { run, restore, duplicate, busy } = useWorkoutActions(() => router.push("/business-portal/workouts"))

  if (!manage) return <AccessDenied homeHref="/business-portal/dashboard" message="Company workouts are managed by Company Owners and Wellness Managers." />
  if (q.isLoading)
    return (
      <PageContainer>
        <PageSkeleton kpis={4} />
      </PageContainer>
    )
  if (q.error || !q.data)
    return (
      <PageContainer>
        <PageHeader title="Workout" backHref="/business-portal/workouts" backLabel="Workouts" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </PageContainer>
    )

  const { workout: w, exercises, source } = q.data
  const company = source === "company"
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const LocationIcon = LOCATION_META[w.location].icon

  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/workouts"
        backLabel="Workouts"
        title={w.name}
        badge={
          <>
            <PhaseBadge phase={2} />
            {company ? <StatusBadge status={w.status} /> : <Badge variant="secondary">HealthX library</Badge>}
          </>
        }
        description={`${w.category} · ${LEVEL_META[w.level].label} · ${LOCATION_META[w.location].label}${company ? ` · updated ${formatDate(w.updatedAt)}` : ""}`}
        actions={
          <>
            {company && w.status === "draft" ? (
              <Button onClick={() => setConfirm("publish")} disabled={busy}>
                <Rocket data-icon="inline-start" /> Publish
              </Button>
            ) : null}
            {q.data.canEdit ? (
              <Button asChild variant={w.status === "draft" ? "outline" : "default"}>
                <Link href={`/business-portal/workouts/${w.id}/edit`}>
                  <Pencil data-icon="inline-start" /> Edit
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => duplicate.mutate({ id: w.id })} disabled={busy}>
              <Copy data-icon="inline-start" /> {company ? "Duplicate" : "Copy to company workouts"}
            </Button>
            {company && w.status === "published" ? (
              <Button variant="outline" onClick={() => setConfirm("unpublish")} disabled={busy}>
                <EyeOff data-icon="inline-start" /> Unpublish
              </Button>
            ) : null}
            {company && w.status === "archived" ? (
              <Button variant="outline" onClick={() => restore.mutate({ id: w.id })} disabled={busy}>
                <ArchiveRestore data-icon="inline-start" /> Restore as draft
              </Button>
            ) : null}
            {company && w.status !== "archived" ? (
              <Button variant="ghost" onClick={() => setConfirm("archive")} disabled={busy} className="text-destructive hover:text-destructive">
                <Archive data-icon="inline-start" /> Archive
              </Button>
            ) : null}
            {company && w.status === "draft" && w.completions === 0 ? (
              <Button variant="ghost" size="icon" onClick={() => setConfirm("delete")} disabled={busy} aria-label="Delete draft">
                <Trash2 className="text-destructive" />
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Duration" value={`${w.durationMin} min`} icon={Clock} tone="sky" hint={`${w.exercises.length} exercises`} />
        <StatCard label="Calories" value={formatNumber(w.calories)} icon={Flame} tone="rose" hint="kcal, estimated" />
        <StatCard label="Points" value={`+${formatNumber(w.points)}`} icon={Star} tone="amber" hint="for completing" />
        <StatCard label="Completions" value={formatNumber(w.completions)} icon={Users} tone="emerald" hint={company ? "by your employees" : "across HealthX"} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Exercises" description="In the order employees do them. Rest after the last exercise isn't counted.">
          <ol className="space-y-2">
            {w.exercises.map((s, i) => {
              const ex = byId.get(s.exerciseId)
              return (
                <li key={`${s.exerciseId}-${i}`} className="flex items-start gap-3 rounded-xl border p-3">
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl" aria-hidden>
                    {ex?.mediaEmoji ?? "🏋️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium">{ex?.name ?? "Exercise no longer available"}</p>
                      {ex && ex.status !== "published" ? <StatusBadge status="archived" label="Unpublished by HealthX" /> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{ex?.muscleGroups.map(capitalize).join(", ")}</p>
                    {ex?.instructions[0] ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ex.instructions[0]}</p> : null}
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <p className="font-semibold tabular-nums">{s.reps ? `${s.reps} reps` : formatSeconds(s.durationSec ?? 0)}</p>
                    {i < w.exercises.length - 1 && s.restSec ? <p className="text-xs text-muted-foreground">then {formatSeconds(s.restSec)} rest</p> : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </SectionCard>

        <SectionCard title="Overview" actions={<CoverTile emoji={w.coverEmoji} color={w.coverColor} />}>
          <div className="space-y-4">
            {w.description ? <p className="text-sm text-muted-foreground">{w.description}</p> : null}
            <KeyValueList
              columns={1}
              items={[
                { label: "Category", value: w.category },
                {
                  label: "Level",
                  value: (
                    <span className="inline-flex items-center gap-2">
                      <LevelBars level={w.level} /> {LEVEL_META[w.level].label}
                    </span>
                  ),
                },
                {
                  label: "Where",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <LocationIcon className="size-4 text-muted-foreground" /> {LOCATION_META[w.location].label}
                    </span>
                  ),
                },
                { label: "Equipment", value: w.equipment.length ? w.equipment.map(capitalize).join(", ") : "None needed" },
                { label: "Muscle groups", value: w.muscleGroups.length ? w.muscleGroups.map(capitalize).join(", ") : "—" },
                { label: "Visible in the app", value: company ? (w.status === "published" ? "Yes — in the workout library" : "No") : "Yes, for all HealthX companies" },
              ]}
            />
            {!company ? (
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                <Dumbbell className="mt-0.5 size-3.5 shrink-0" /> HealthX library workouts are maintained by HealthX. Copy it to make a company version you can edit.
              </p>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <WorkoutConfirmDialog
        workout={w}
        kind={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(k) => {
          run(k, w.id)
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
