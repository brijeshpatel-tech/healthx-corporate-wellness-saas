/** SCR-M-071 Edit Profile – Wellness Details (FRM-08): height, weight, main goal, activity / fitness level, daily step goal. Private to the employee. */
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "expo-router"
import { Footprints, Gauge, Ruler, Target } from "lucide-react-native"
import { Controller, useForm, useWatch } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors } from "@/components/form"
import { ChoiceGroup } from "@/components/engage/account"
import { SectionCard } from "@/components/engage/shared"
import { Button, Chip, ErrorState, Notice, Screen, SkeletonList, Text, TextField } from "@/components/ui"
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_LEVEL_OPTIONS, GOAL_OPTIONS } from "@/features/onboarding/options"
import { profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { WellnessProfile } from "@/lib/types"

const num = (msg: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max, msg)

const schema = z.object({
  heightCm: num("Enter a height between 100 and 250 cm", 100, 250),
  weightKg: num("Enter a weight between 30 and 250 kg", 30, 250),
  mainGoal: z.enum(["lose_weight", "stay_active", "build_strength", "reduce_stress", "sleep_better", "eat_healthier"], { error: "Choose your main goal" }),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very_active"], { error: "Choose your activity level" }),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"], { error: "Choose your fitness level" }),
  dailyStepGoal: num("Choose a goal between 1,000 and 50,000 steps", 1000, 50000).refine((v) => Number.isInteger(Number(v)), "Use a whole number"),
})
type Values = z.infer<typeof schema>

const STEP_PRESETS = [6000, 8000, 10000, 12000]
const GOAL_DESC: Record<WellnessProfile["mainGoal"], string> = {
  stay_active: "Move more every day",
  lose_weight: "Reach a healthier weight",
  build_strength: "Get fitter and stronger",
  reduce_stress: "Feel calmer and focused",
  sleep_better: "More rest, more energy",
  eat_healthier: "Build better food habits",
}

function WellnessForm({ data }: { data: MyProfile }) {
  const w = data.wellness
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      heightCm: w.heightCm ? String(w.heightCm) : "",
      weightKg: w.weightKg ? String(w.weightKg) : "",
      mainGoal: w.mainGoal,
      activityLevel: w.activityLevel,
      fitnessLevel: w.fitnessLevel,
      dailyStepGoal: String(w.dailyStepGoal || 8000),
    },
  })
  const stepGoal = useWatch({ control: form.control, name: "dailyStepGoal" })
  const save = useApiMutation(profileApi.updateWellness, {
    success: "Wellness details updated.",
    errorTitle: "Couldn't save your wellness details",
    onSuccess: () => {
      haptic.success()
      if (router.canGoBack()) router.back()
      else router.replace("/profile")
    },
    onError: (err) => applyApiErrors(form.setError, err),
  })
  const submit = () =>
    void form.handleSubmit(
      (v) =>
        save.mutate({
          heightCm: Number(v.heightCm),
          weightKg: Number(v.weightKg),
          mainGoal: v.mainGoal,
          activityLevel: v.activityLevel,
          fitnessLevel: v.fitnessLevel,
          dailyStepGoal: Number(v.dailyStepGoal),
        }),
      () => haptic.error(),
    )()

  return (
    <Screen title="Wellness details" back backHref="/profile" footer={<Button title="Save" loading={save.isPending} onPress={submit} feedback="none" testID="save-wellness" />}>
      <Notice tone="privacy" title="Only you can see these details.">
        They&apos;re encrypted and never shown to HR, your manager or company admins.
      </Notice>

      <SectionCard icon={Ruler} tint="steps" title="Body measurements">
        <View style={styles.row2}>
          <Controller
            control={form.control}
            name="heightCm"
            render={({ field, fieldState }) => (
              <TextField label="Height (cm)" value={field.value} onChangeText={(t) => field.onChange(t.replace(/[^\d.]/g, ""))} onBlur={field.onBlur} keyboardType="decimal-pad" maxLength={5} error={fieldState.error?.message} hint="100–250 cm" containerStyle={styles.flex} />
            )}
          />
          <Controller
            control={form.control}
            name="weightKg"
            render={({ field, fieldState }) => (
              <TextField label="Weight (kg)" value={field.value} onChangeText={(t) => field.onChange(t.replace(/[^\d.]/g, ""))} onBlur={field.onBlur} keyboardType="decimal-pad" maxLength={5} error={fieldState.error?.message} hint="30–250 kg" containerStyle={styles.flex} />
            )}
          />
        </View>
      </SectionCard>

      <SectionCard icon={Target} tint="danger" title="Main goal" description="What matters most to you right now?">
        <Controller
          control={form.control}
          name="mainGoal"
          render={({ field, fieldState }) => (
            <ChoiceGroup columns={2} options={GOAL_OPTIONS.map((g) => ({ value: g.value as WellnessProfile["mainGoal"], label: g.label, emoji: g.emoji, description: GOAL_DESC[g.value as WellnessProfile["mainGoal"]] }))} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Main goal" />
          )}
        />
      </SectionCard>

      <SectionCard icon={Gauge} tint="workout" title="Activity & fitness">
        <Text variant="label">Activity level</Text>
        <Controller
          control={form.control}
          name="activityLevel"
          render={({ field, fieldState }) => <ChoiceGroup columns={2} options={ACTIVITY_LEVEL_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Activity level" />}
        />
        <Text variant="label">Fitness level</Text>
        <Controller
          control={form.control}
          name="fitnessLevel"
          render={({ field, fieldState }) => <ChoiceGroup options={FITNESS_LEVEL_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Fitness level" />}
        />
      </SectionCard>

      <SectionCard icon={Footprints} tint="habits" title="Daily step goal" description="Your goal on Home, Activity and in your Wellness Score.">
        <Controller
          control={form.control}
          name="dailyStepGoal"
          render={({ field, fieldState }) => (
            <TextField label="Steps per day" right="steps" value={field.value} onChangeText={(t) => field.onChange(t.replace(/\D/g, ""))} onBlur={field.onBlur} keyboardType="number-pad" maxLength={5} error={fieldState.error?.message} hint="Between 1,000 and 50,000 steps" />
          )}
        />
        <View style={styles.presets}>
          {STEP_PRESETS.map((n) => (
            <Chip key={n} size="sm" label={formatNumber(n)} selected={stepGoal === String(n)} onPress={() => form.setValue("dailyStepGoal", String(n), { shouldDirty: true, shouldValidate: true })} />
          ))}
        </View>
      </SectionCard>
    </Screen>
  )
}

export default function WellnessDetailsScreen() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  if (q.data) return <WellnessForm data={q.data} />
  return (
    <Screen title="Wellness details" back backHref="/profile">
      {q.error ? <ErrorState title="Couldn't load your wellness details." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} /> : <SkeletonList count={4} height={150} header={false} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row2: { flexDirection: "row", gap: 10 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
