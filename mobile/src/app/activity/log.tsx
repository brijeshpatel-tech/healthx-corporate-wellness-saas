/**
 * SCR-M-024 Log Activity (manual entry). Opens as a modal.
 * Manual entries are labelled "Manual" and wait for company approval before earning points (#365).
 * ?id=… edits an existing manual entry.
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { Clock, X } from "lucide-react-native"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { Button, Chip, ConfirmDialog, ErrorState, IconButton, Notice, Screen, SkeletonList, Text, TextField } from "@/components/ui"
import { ACTIVITY_META } from "@/features/activity/activity-meta"
import { ACTIVITY_TYPES, activityApi, type ManualActivityInput } from "@/lib/api/employee/activity"
import { ApiError } from "@/lib/api/core"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { toast } from "@/lib/toast"
import type { ActivitySession, ActivityType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const DISTANCE_TYPES: ActivityType[] = ["walking", "running", "cycling", "swimming"]
const DURATIONS = [15, 30, 45, 60]
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const schema = z
  .object({
    type: z.string().min(1, "Choose an activity type"),
    date: z.string(),
    startTime: z.string().regex(HHMM, "Enter a time like 07:30"),
    durationMin: z.string().refine((v) => Number(v) >= 1 && Number(v) <= 600, "Enter a duration between 1 and 600 minutes"),
    distanceKm: z.string().refine((v) => !v.trim() || (Number(v.replace(",", ".")) >= 0.1 && Number(v.replace(",", ".")) <= 300), "Enter a distance between 0.1 and 300 km"),
    notes: z.string().max(200, "Keep notes under 200 characters"),
  })
  .refine((v) => new Date(`${v.date}T${v.startTime}:00`).getTime() <= Date.now(), { path: ["startTime"], message: "Date and time can't be in the future" })
type Values = z.infer<typeof schema>

const maskTime = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

function defaultsFor(session?: ActivitySession): Values {
  if (session) {
    const start = new Date(session.startedAt)
    return {
      type: session.type,
      date: toLocalDate(start),
      startTime: `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      durationMin: String(session.durationMin),
      distanceKm: session.distanceKm ? String(session.distanceKm) : "",
      notes: session.notes ?? "",
    }
  }
  const start = new Date(Date.now() - 30 * 60_000)
  return { type: "", date: toLocalDate(start), startTime: `${String(start.getHours()).padStart(2, "0")}:${String(Math.floor(start.getMinutes() / 5) * 5).padStart(2, "0")}`, durationMin: "30", distanceKm: "", notes: "" }
}

function LogForm({ session }: { session?: ActivitySession }) {
  const { colors } = useTheme()
  const qc = useQueryClient()
  const [overlap, setOverlap] = useState<{ message: string; values: Values } | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaultsFor(session) })
  const type = useWatch({ control: form.control, name: "type" }) as ActivityType | ""
  const [days] = useState(() => {
    const now = Date.now()
    return Array.from({ length: 8 }, (_, i) => toLocalDate(new Date(now - i * DAY_MS)))
  })

  const save = async (v: Values, allowOverlap = false) => {
    const input: ManualActivityInput = {
      type: v.type as ActivityType,
      date: v.date,
      startTime: v.startTime,
      durationMin: Number(v.durationMin),
      distanceKm: DISTANCE_TYPES.includes(v.type as ActivityType) && v.distanceKm.trim() ? Number(v.distanceKm.replace(",", ".")) : null,
      notes: v.notes.trim() || undefined,
      allowOverlap,
    }
    try {
      if (session) {
        await activityApi.update({ ...input, id: session.id })
        toast.success("Activity updated", { description: "Sent for approval again." })
      } else {
        const res = await activityApi.create(input)
        toast.success("Activity saved", {
          description: res.review.points ? `Pending approval · +${res.review.points} points once approved` : "Pending approval by your company",
        })
      }
      haptic.success()
      await qc.invalidateQueries()
      router.back()
    } catch (err) {
      haptic.error()
      if (err instanceof ApiError && err.code === "activity_overlap") {
        setOverlap({ message: err.message, values: v })
        return
      }
      if (!applyApiErrors(form.setError, err)) toast.error("Couldn't save the activity", { description: errorMessage(err) })
    }
  }

  const submit = form.handleSubmit((v) => save(v))

  return (
    <Screen
      title={session ? "Edit activity" : "Log activity"}
      back={() => router.back()}
      right={<IconButton icon={X} variant="ghost" accessibilityLabel="Cancel" onPress={() => router.back()} />}
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="outline" block style={styles.flex} onPress={() => router.back()} />
          <Button title="Save" block style={styles.flex} loading={form.formState.isSubmitting} onPress={submit} testID="save-activity" />
        </View>
      }
    >
      <Controller
        control={form.control}
        name="type"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <Text variant="subtitle">Activity</Text>
            <View style={styles.grid}>
              {ACTIVITY_TYPES.map((t) => {
                const active = field.value === t
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={ACTIVITY_META[t].label}
                    onPress={() => {
                      haptic.select()
                      field.onChange(t)
                    }}
                    style={[styles.typeTile, { borderColor: active ? colors.primary : fieldState.error ? colors.destructive : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
                    testID={`type-${t}`}
                  >
                    <Text variant="title">{ACTIVITY_META[t].emoji}</Text>
                    <Text variant="label" tone={active ? "primary" : "default"}>
                      {ACTIVITY_META[t].label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {fieldState.error ? (
              <Text variant="caption" tone="destructive">
                {fieldState.error.message}
              </Text>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="date"
        render={({ field }) => (
          <View style={styles.group}>
            <Text variant="label">Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {days.map((d, i) => (
                <Chip key={d} size="sm" label={i === 0 ? "Today" : i === 1 ? "Yesterday" : formatDate(d, "EEE d")} selected={field.value === d} onPress={() => field.onChange(d)} />
              ))}
            </ScrollView>
          </View>
        )}
      />

      <View style={styles.row}>
        <Controller
          control={form.control}
          name="startTime"
          render={({ field, fieldState }) => (
            <TextField label="Start time" icon={Clock} value={field.value} onChangeText={(t) => field.onChange(maskTime(t))} onBlur={field.onBlur} keyboardType="number-pad" placeholder="07:30" maxLength={5} error={fieldState.error?.message} containerStyle={styles.flex} />
          )}
        />
        <FormTextField control={form.control} name="durationMin" label="Duration" right="min" keyboardType="number-pad" maxLength={3} containerStyle={styles.flex} testID="duration" />
      </View>
      <Controller
        control={form.control}
        name="durationMin"
        render={({ field }) => (
          <View style={styles.chipsWrap}>
            {DURATIONS.map((m) => (
              <Chip key={m} size="sm" label={`${m} min`} selected={field.value === String(m)} onPress={() => field.onChange(String(m))} />
            ))}
          </View>
        )}
      />

      {type && DISTANCE_TYPES.includes(type) ? <FormTextField control={form.control} name="distanceKm" label="Distance (optional)" right="km" keyboardType="decimal-pad" placeholder="e.g. 3.5" /> : null}
      <FormTextField control={form.control} name="notes" label="Notes (optional)" placeholder="How did it go?" multiline maxLength={200} />

      <Notice tone="info" title="Manual entry">
        This activity will be labelled “Manual”. Your company checks manual entries before they earn points or count in challenges.
      </Notice>

      <ConfirmDialog
        open={!!overlap}
        title="Overlapping activity"
        message={`${overlap?.message ?? ""} Save it anyway?`}
        confirmLabel="Save anyway"
        onCancel={() => setOverlap(null)}
        onConfirm={() => {
          const v = overlap!.values
          setOverlap(null)
          save(v, true)
        }}
      />
    </Screen>
  )
}

export default function LogActivityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const q = useApiQuery(["employee", "activity", "entry", id], () => activityApi.get({ id: id! }), { enabled: !!id })
  if (!id || q.data) return <LogForm session={q.data} />
  return (
    <Screen title="Edit activity" back={() => router.back()}>
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <SkeletonList count={4} height={60} header={false} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeTile: { width: "31.5%", flexGrow: 1, minHeight: 84, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10 },
  chips: { gap: 8, paddingRight: 16 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -6 },
  row: { flexDirection: "row", gap: 10 },
  footer: { flexDirection: "row", gap: 10 },
})
