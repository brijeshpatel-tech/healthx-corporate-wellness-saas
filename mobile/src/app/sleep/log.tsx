/**
 * SCR-M-028 Log Sleep (Phase 2) — night of, bedtime, wake-up time (across midnight), quality and a live duration preview.
 * ?id=… edits / deletes a manual record; ?night=YYYY-MM-DD pre-selects a night.
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { BedDouble, Moon, Sunrise, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors } from "@/components/form"
import { NIGHT_GRADIENT } from "@/components/track/sleep-ui"
import { TimeStepper } from "@/components/track/time-stepper"
import { addDays, formatHM, HHMM, localDate, toHHMM } from "@/components/track/utils"
import { HeaderPhase } from "@/components/track/track-ui"
import { Button, Card, Chip, ConfirmDialog, ErrorState, goBack, Screen, SkeletonList, Text } from "@/components/ui"
import { sleepApi } from "@/lib/api/employee/sleep"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const QUALITY = [
  { value: 1, emoji: "😫", label: "Awful" },
  { value: 2, emoji: "😕", label: "Poor" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😴", label: "Great" },
] as const

/** Minutes between bedtime and wake-up (crossing midnight). */
function durationOf(bed: string, wake: string) {
  if (!HHMM.test(bed) || !HHMM.test(wake)) return null
  const [bh, bm] = bed.split(":").map(Number) as [number, number]
  const [wh, wm] = wake.split(":").map(Number) as [number, number]
  let d = wh * 60 + wm - (bh * 60 + bm)
  if (d <= 0) d += 24 * 60
  return d
}

const schema = z
  .object({
    nightOf: z.string().min(1, "Choose the night"),
    bedtime: z.string().regex(HHMM, "Enter your bedtime"),
    wakeTime: z.string().regex(HHMM, "Enter your wake-up time"),
    quality: z.number().int().min(1, "Rate your sleep").max(5),
  })
  .superRefine((v, ctx) => {
    if (v.nightOf > localDate()) ctx.addIssue({ code: "custom", path: ["nightOf"], message: "Choose last night or earlier" })
    else if (v.nightOf < addDays(localDate(), -30)) ctx.addIssue({ code: "custom", path: ["nightOf"], message: "You can log sleep from the last 30 nights" })
    const d = durationOf(v.bedtime, v.wakeTime)
    if (d !== null && (d < 60 || d > 16 * 60)) ctx.addIssue({ code: "custom", path: ["wakeTime"], message: "Wake-up time must be after bedtime (1–16 hours of sleep)" })
  })
type Values = z.infer<typeof schema>

function SleepForm({ id, defaults }: { id?: string; defaults: Values }) {
  const { colors } = useTheme()
  const [confirm, setConfirm] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const [bed, wake, nightOf] = useWatch({ control: form.control, name: ["bedtime", "wakeTime", "nightOf"] })
  const duration = durationOf(bed, wake)
  const yesterday = addDays(localDate(), -1)
  const nights = Array.from({ length: 14 }, (_, i) => addDays(yesterday, -i))
  if (!nights.includes(nightOf) && nightOf <= localDate()) nights.unshift(nightOf)

  const onError = (e: unknown) => applyApiErrors(form.setError, e)
  const done = () => goBack("/sleep")
  const create = useApiMutation(sleepApi.create, { success: (r) => `Sleep saved: ${formatHM(r.durationMin)}`, onSuccess: done, onError, errorTitle: "Couldn't save your sleep" })
  const update = useApiMutation(sleepApi.update, { success: (r) => `Sleep updated: ${formatHM(r.durationMin)}`, onSuccess: done, onError, errorTitle: "Couldn't update your sleep" })
  const remove = useApiMutation(sleepApi.remove, {
    success: "Sleep record deleted",
    onSuccess: () => {
      setConfirm(false)
      done()
    },
  })
  const pending = create.isPending || update.isPending

  const submit = form.handleSubmit(
    (v) => {
      const input = { nightOf: v.nightOf, bedtime: v.bedtime, wakeTime: v.wakeTime, quality: v.quality as 1 | 2 | 3 | 4 | 5 }
      if (id) update.mutate({ ...input, id })
      else create.mutate(input)
    },
    () => haptic.error(),
  )

  return (
    <Screen
      title={id ? "Edit sleep" : "Log sleep"}
      back
      backHref="/sleep"
      right={<HeaderPhase />}
      footer={
        <View style={styles.footer}>
          {id ? <Button title="Delete" icon={Trash2} variant="outline" size="md" block style={styles.flex} onPress={() => setConfirm(true)} testID="delete-sleep" /> : <Button title="Cancel" variant="outline" size="md" block style={styles.flex} onPress={done} />}
          <Button title="Save" size="md" block style={styles.flex} loading={pending} onPress={submit} testID="save-sleep" />
        </View>
      }
    >
      <LinearGradient colors={[...NIGHT_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
        <Moon size={22} color="rgba(255,255,255,0.85)" />
        <Text variant="display" color="#ffffff" accessibilityLiveRegion="polite">
          {duration ? formatHM(duration) : "—"}
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.85)" align="center">
          {duration && duration >= 7 * 60 && duration <= 16 * 60 ? "Nice — that's a healthy night's sleep" : "Calculated sleep duration"}
        </Text>
      </LinearGradient>

      <Controller
        control={form.control}
        name="nightOf"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <Text variant="label">Night of</Text>
            <Text variant="small" tone="muted">
              The evening you went to bed
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {nights.map((d) => (
                <Chip key={d} size="sm" label={d === yesterday ? "Last night" : formatDate(`${d}T12:00:00`, "EEE d MMM")} selected={field.value === d} onPress={() => field.onChange(d)} />
              ))}
            </ScrollView>
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
        name="bedtime"
        render={({ field, fieldState }) => <TimeStepper label="Bedtime" icon={BedDouble} value={field.value} onChange={field.onChange} error={fieldState.error?.message} testID="bedtime" />}
      />
      <Controller
        control={form.control}
        name="wakeTime"
        render={({ field, fieldState }) => (
          <TimeStepper
            label="Wake-up"
            icon={Sunrise}
            value={field.value}
            onChange={(v) => {
              field.onChange(v)
              form.clearErrors("wakeTime")
            }}
            error={fieldState.error?.message}
            testID="wake-time"
          />
        )}
      />

      <Card>
        <Controller
          control={form.control}
          name="quality"
          render={({ field }) => (
            <View style={styles.group}>
              <Text variant="subtitle">How did you sleep?</Text>
              <View style={styles.quality} accessibilityRole="radiogroup" accessibilityLabel="Sleep quality">
                {QUALITY.map((q) => {
                  const active = field.value === q.value
                  return (
                    <Pressable
                      key={q.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={q.label}
                      onPress={() => {
                        haptic.select()
                        field.onChange(q.value)
                      }}
                      style={({ pressed }) => [styles.qualityCell, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card, borderWidth: active ? 1.5 : 1 }, pressed && styles.pressed]}
                    >
                      <Text style={styles.qualityEmoji}>{q.emoji}</Text>
                      <Text variant="small" tone={active ? "primary" : "muted"} numberOfLines={1}>
                        {q.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}
        />
      </Card>

      <ConfirmDialog
        open={confirm}
        title="Delete this night?"
        message="This sleep record will be removed from your history."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => id && remove.mutate({ id })}
      />
    </Screen>
  )
}

export default function LogSleepScreen() {
  const { id, night } = useLocalSearchParams<{ id?: string; night?: string }>()
  const existing = useApiQuery(["employee", "sleep", "item", id], () => sleepApi.get({ id: id! }), { enabled: !!id, retry: false })
  if (id && !existing.data)
    return (
      <Screen title="Edit sleep" back backHref="/sleep">
        {existing.error ? <ErrorState title="Couldn't load this night" error={existing.error} onRetry={() => existing.refetch()} retrying={existing.isFetching} /> : <SkeletonList count={3} height={110} />}
      </Screen>
    )
  const r = existing.data
  const defaults: Values = r
    ? { nightOf: r.nightOf, bedtime: toHHMM(r.bedtime), wakeTime: toHHMM(r.wakeTime), quality: r.quality }
    : { nightOf: night && /^\d{4}-\d{2}-\d{2}$/.test(night) ? night : addDays(localDate(), -1), bedtime: "23:00", wakeTime: "07:00", quality: 4 }
  return <SleepForm key={r?.id ?? "new"} id={r?.id} defaults={defaults} />
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { flexDirection: "row", gap: 10 },
  preview: { borderRadius: RADIUS.xl, paddingVertical: 22, paddingHorizontal: 16, alignItems: "center", gap: 4 },
  group: { gap: 8 },
  chips: { gap: 8, paddingRight: 16 },
  quality: { flexDirection: "row", gap: 6 },
  qualityCell: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: RADIUS.lg, minWidth: 0 },
  qualityEmoji: { fontSize: 26, lineHeight: 32 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
})
