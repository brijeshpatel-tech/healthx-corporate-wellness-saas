/** SCR-M-026 Water Goal & Reminders — daily goal (1–5 L) and smart, rule-based reminders. */
import { router } from "expo-router"
import { BellRing, Clock, Minus, Plus } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { Button, Card, ErrorState, IconButton, Notice, Screen, SelectField, SkeletonList, SwitchRow, Text, TextField } from "@/components/ui"
import { waterApi } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import type { WaterSettings } from "@/lib/types"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const INTERVALS = [30, 60, 90, 120, 180, 240].map((m) => ({ value: String(m), label: m < 60 ? `Every ${m} minutes` : m === 60 ? "Every hour" : `Every ${m / 60} hours` }))
const maskTime = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

function SettingsForm({ initial }: { initial: WaterSettings }) {
  const [goalMl, setGoalMl] = useState(initial.goalMl)
  const [reminders, setReminders] = useState(initial.remindersEnabled)
  const [start, setStart] = useState(initial.reminderStart)
  const [end, setEnd] = useState(initial.reminderEnd)
  const [every, setEvery] = useState(String(initial.reminderEveryMin))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useApiMutation(waterApi.updateSettings, {
    success: (r) => `Water goal updated to ${formatNumber(r.goalMl / 1000, 1)} L.`,
    onSuccess: () => router.back(),
    onError: (err) => {
      if (err.fieldErrors) setErrors(err.fieldErrors)
    },
  })

  const submit = () => {
    const e: Record<string, string> = {}
    if (goalMl < 1000 || goalMl > 5000) e.goalMl = "Choose a goal between 1 and 5 litres."
    if (reminders) {
      if (!HHMM.test(start)) e.reminderStart = "Enter a time like 09:00"
      if (!HHMM.test(end)) e.reminderEnd = "Enter a time like 20:00"
      else if (HHMM.test(start) && end <= start) e.reminderEnd = "End time must be after start time"
    }
    setErrors(e)
    if (Object.keys(e).length) return
    save.mutate({ goalMl, remindersEnabled: reminders, reminderStart: start, reminderEnd: end, reminderEveryMin: Number(every) })
  }

  return (
    <Screen
      title="Goal & reminders"
      back
      backHref="/water"
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="outline" block style={styles.flex} onPress={() => router.back()} />
          <Button title="Save" block style={styles.flex} loading={save.isPending} onPress={submit} testID="save-water-settings" />
        </View>
      }
    >
      <Card padding={18}>
        <Text variant="subtitle">Daily water goal</Text>
        <View style={styles.stepper}>
          <IconButton icon={Minus} accessibilityLabel="Decrease goal by 100 ml" disabled={goalMl <= 1000} onPress={() => setGoalMl((g) => Math.max(1000, g - 100))} />
          <View style={styles.value}>
            <Text variant="display">{formatNumber(goalMl / 1000, 1)} L</Text>
            <Text variant="caption" tone="muted">
              about {Math.round(goalMl / 250)} glasses
            </Text>
          </View>
          <IconButton icon={Plus} accessibilityLabel="Increase goal by 100 ml" disabled={goalMl >= 5000} onPress={() => setGoalMl((g) => Math.min(5000, g + 100))} />
        </View>
        {errors.goalMl ? (
          <Text variant="caption" tone="destructive" align="center">
            {errors.goalMl}
          </Text>
        ) : (
          <Text variant="small" tone="muted" align="center">
            Between 1 and 5 litres, in 0.1 L steps. Today&apos;s progress updates straight away.
          </Text>
        )}
      </Card>

      <Card>
        <SwitchRow icon={BellRing} tint="water" title="Smart reminders" description="Gentle nudges through the day" value={reminders} onValueChange={setReminders} />
        {reminders ? (
          <View style={styles.reminders}>
            <View style={styles.row}>
              <TextField label="From" icon={Clock} value={start} onChangeText={(t) => setStart(maskTime(t))} keyboardType="number-pad" maxLength={5} placeholder="09:00" error={errors.reminderStart} containerStyle={styles.flex} />
              <TextField label="Until" icon={Clock} value={end} onChangeText={(t) => setEnd(maskTime(t))} keyboardType="number-pad" maxLength={5} placeholder="20:00" error={errors.reminderEnd} containerStyle={styles.flex} />
            </View>
            <SelectField label="How often" value={every} options={INTERVALS} onChange={setEvery} />
          </View>
        ) : null}
      </Card>

      <Notice tone="info" title="How smart reminders work">
        Reminders are spaced through your chosen hours and stop once you reach your goal for the day. Quiet hours and your notification settings are always respected.
      </Notice>
    </Screen>
  )
}

export default function WaterSettingsScreen() {
  const q = useApiQuery(["employee", "water"], () => waterApi.today())
  if (q.data) return <SettingsForm initial={q.data.settings} />
  return (
    <Screen title="Goal & reminders" back backHref="/water">
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} /> : <SkeletonList count={2} height={140} header={false} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  value: { flex: 1, alignItems: "center" },
  reminders: { gap: 14, marginTop: 10 },
  row: { flexDirection: "row", gap: 10 },
  footer: { flexDirection: "row", gap: 10 },
})
