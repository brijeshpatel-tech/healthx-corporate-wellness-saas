/** SCR-M-014 Health & Wellness Goals — onboarding step 2 of 4. */
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "expo-router"
import { Check, Target } from "lucide-react-native"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { Button, Chip, ErrorState, Notice, SegmentedControl, SkeletonList, Text } from "@/components/ui"
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_LEVEL_OPTIONS, GOAL_OPTIONS } from "@/features/onboarding/options"
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen"
import { onboardingApi, type OnboardingState, type WellnessGoal } from "@/lib/api/employee/onboarding"
import { ACTIVITY_OPTIONS } from "@/lib/api/employee/profile"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { WellnessProfile } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const num = (v: string) => Number(v.replace(",", "."))
const schema = z.object({
  goals: z.array(z.string()).min(1, "Choose at least one goal"),
  heightCm: z.string().refine((v) => num(v) >= 100 && num(v) <= 250, "Enter a height between 100 and 250 cm."),
  weightKg: z.string().refine((v) => num(v) >= 30 && num(v) <= 300, "Enter a weight between 30 and 300 kg."),
  activityLevel: z.string().min(1, "Choose your activity level"),
  fitnessLevel: z.string().min(1, "Choose your fitness level"),
  activities: z.array(z.string()),
})
type Values = z.infer<typeof schema>

function FieldError({ message }: { message?: string }) {
  return message ? (
    <Text variant="caption" tone="destructive">
      {message}
    </Text>
  ) : null
}

function GoalsForm({ state }: { state: OnboardingState }) {
  const { colors } = useTheme()
  const w = state.wellness
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      goals: w.goals,
      heightCm: w.heightCm ? String(w.heightCm) : "",
      weightKg: w.weightKg ? String(w.weightKg) : "",
      activityLevel: w.activityLevel,
      fitnessLevel: w.fitnessLevel || "beginner",
      activities: w.activities,
    },
  })

  const submit = form.handleSubmit(async (v) => {
    try {
      await onboardingApi.saveWellness({
        goals: v.goals as WellnessGoal[],
        heightCm: num(v.heightCm),
        weightKg: num(v.weightKg),
        activityLevel: v.activityLevel as WellnessProfile["activityLevel"],
        fitnessLevel: v.fitnessLevel as WellnessProfile["fitnessLevel"],
        activities: v.activities,
      })
      haptic.success()
      router.push("/onboarding/permissions")
    } catch (err) {
      haptic.error()
      if (!applyApiErrors(form.setError, err)) toast.error("Couldn't save your goals", { description: errorMessage(err) })
    }
  })

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  return (
    <OnboardingScreen
      step={2}
      icon={Target}
      title="Your wellness goals"
      description="We use these to suggest goals, workouts and challenges that suit you."
      backHref="/onboarding/profile"
      footer={<Button title="Continue" loading={form.formState.isSubmitting} onPress={submit} testID="continue" />}
    >
      <Controller
        control={form.control}
        name="goals"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <Text variant="subtitle">What would you like to focus on?</Text>
            <View style={styles.chips}>
              {GOAL_OPTIONS.map((g) => (
                <Chip key={g.value} emoji={g.emoji} label={g.label} selected={field.value.includes(g.value)} onPress={() => field.onChange(toggle(field.value, g.value))} />
              ))}
            </View>
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <View style={styles.row}>
        <FormTextField control={form.control} name="heightCm" label="Height" right="cm" keyboardType="decimal-pad" placeholder="170" containerStyle={styles.half} testID="height" />
        <FormTextField control={form.control} name="weightKg" label="Weight" right="kg" keyboardType="decimal-pad" placeholder="65" containerStyle={styles.half} testID="weight" />
      </View>

      <Controller
        control={form.control}
        name="activityLevel"
        render={({ field, fieldState }) => (
          <View style={styles.group}>
            <Text variant="subtitle">How active are you today?</Text>
            {ACTIVITY_LEVEL_OPTIONS.map((o) => {
              const active = field.value === o.value
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    haptic.select()
                    field.onChange(o.value)
                  }}
                  style={[styles.option, { borderColor: active ? colors.primary : fieldState.error ? colors.destructive : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
                >
                  <View style={styles.flex}>
                    <Text variant="bodyMedium">{o.label}</Text>
                    <Text variant="caption" tone="muted">
                      {o.description}
                    </Text>
                  </View>
                  <View style={[styles.radio, { borderColor: active ? colors.primary : colors.input, backgroundColor: active ? colors.primary : "transparent" }]}>
                    {active ? <Check size={14} color={colors.primaryForeground} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              )
            })}
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="fitnessLevel"
        render={({ field }) => (
          <View style={styles.group}>
            <Text variant="subtitle">Fitness level</Text>
            <SegmentedControl options={FITNESS_LEVEL_OPTIONS} value={field.value as WellnessProfile["fitnessLevel"]} onChange={field.onChange} accessibilityLabel="Fitness level" />
          </View>
        )}
      />

      <Controller
        control={form.control}
        name="activities"
        render={({ field }) => (
          <View style={styles.group}>
            <Text variant="subtitle">Activities you enjoy</Text>
            <View style={styles.chips}>
              {ACTIVITY_OPTIONS.map((a) => (
                <Chip key={a.value} size="sm" emoji={a.emoji} label={a.label} selected={field.value.includes(a.value)} onPress={() => field.onChange(toggle(field.value, a.value))} />
              ))}
            </View>
          </View>
        )}
      />

      <Notice tone="privacy" title="Only you can see these details">
        Your height, weight and goals are encrypted and never shown to your employer.
      </Notice>
    </OnboardingScreen>
  )
}

export default function GoalsScreen() {
  const q = useApiQuery(["employee", "onboarding"], () => onboardingApi.state())
  if (q.data) return <GoalsForm state={q.data} />
  return (
    <OnboardingScreen step={2} title="Your wellness goals" footer={null} backHref="/onboarding/profile">
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} /> : <SkeletonList count={4} height={56} header={false} />}
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1, gap: 2 },
  half: { flex: 1 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
})
