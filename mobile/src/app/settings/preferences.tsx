/** SCR-M-072 Preferences (FRM-09) — activities, workouts, food, language, units (Phase 2) and appearance. */
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, Dumbbell, Languages, Monitor, Moon, Palette, Ruler, Salad, Sun, Timer } from "lucide-react-native"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors } from "@/components/form"
import { ChoiceGroup } from "@/components/engage/account"
import { SectionCard } from "@/components/engage/shared"
import { Button, ErrorState, PhaseBadge, Screen, SkeletonList, Text } from "@/components/ui"
import { ACTIVITY_OPTIONS, LANGUAGE_OPTIONS, profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { haptic } from "@/lib/haptics"
import { usePreferences, type ThemePreference } from "@/lib/preferences"
import type { EmployeePreferences } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const schema = z.object({
  activities: z.array(z.string()).min(1, "Choose at least one activity").max(10, "Choose up to 10 activities"),
  workoutLocation: z.enum(["home", "gym", "outdoor", "any"], { error: "Choose where you like to work out" }),
  workoutDurationMin: z.string().min(1, "Choose a workout length"),
  foodPreference: z.enum(["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain", "no_preference"], { error: "Choose a food preference" }),
  language: z.string().min(1),
  units: z.enum(["metric", "imperial"]),
})
type Values = z.infer<typeof schema>

const LOCATION_OPTIONS: { value: EmployeePreferences["workoutLocation"]; label: string; emoji: string }[] = [
  { value: "home", label: "At home", emoji: "🏠" },
  { value: "gym", label: "At the gym", emoji: "🏋️" },
  { value: "outdoor", label: "Outdoors", emoji: "🌳" },
  { value: "any", label: "Anywhere", emoji: "✨" },
]
const DURATION_OPTIONS = ["10", "20", "30", "45", "60"].map((v) => ({ value: v, label: `${v} min` }))
const FOOD_OPTIONS: { value: EmployeePreferences["foodPreference"]; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "eggetarian", label: "Eggetarian", emoji: "🥚" },
  { value: "non_vegetarian", label: "Non-vegetarian", emoji: "🍗" },
  { value: "jain", label: "Jain", emoji: "🪷" },
  { value: "no_preference", label: "No preference", emoji: "🍽️" },
]
const THEMES: { value: ThemePreference; label: string; icon: typeof Sun; hint: string }[] = [
  { value: "system", label: "System", icon: Monitor, hint: "Match your phone" },
  { value: "light", label: "Light", icon: Sun, hint: "Bright and clear" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Easy on the eyes" },
]

/** Theme applies immediately on this phone and is saved to the account. */
function Appearance() {
  const { colors } = useTheme()
  const theme = usePreferences((s) => s.theme)
  const setTheme = usePreferences((s) => s.setTheme)
  const save = useApiMutation(profileApi.updatePreferences, { errorTitle: "Couldn't save your theme", invalidate: [["employee", "profile"]] })
  return (
    <SectionCard icon={Palette} tint="insight" title="Appearance" description="Changes apply straight away.">
      <View style={styles.themes} accessibilityRole="radiogroup" accessibilityLabel="Theme">
        {THEMES.map((t) => {
          const active = theme === t.value
          return (
            <Pressable
              key={t.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t.label}
              onPress={() => {
                haptic.select()
                setTheme(t.value)
                save.mutate({ theme: t.value })
              }}
              style={[styles.theme, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card }]}
            >
              <t.icon size={22} color={active ? colors.primary : colors.foreground} />
              <Text variant="label" tone={active ? "primary" : "default"}>
                {t.label}
              </Text>
              <Text variant="small" tone="muted" align="center">
                {t.hint}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </SectionCard>
  )
}

function PreferencesForm({ data }: { data: MyProfile }) {
  const { colors } = useTheme()
  const p = data.preferences
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      activities: p.activities,
      workoutLocation: p.workoutLocation,
      workoutDurationMin: String(p.workoutDurationMin),
      foodPreference: p.foodPreference,
      language: p.language || "English",
      units: p.units,
    },
  })
  const save = useApiMutation(profileApi.updatePreferences, {
    success: "Preferences saved.",
    errorTitle: "Couldn't save your preferences.",
    onSuccess: (prefs) => {
      haptic.success()
      form.reset({ ...form.getValues(), activities: prefs.activities })
    },
    onError: (err) => applyApiErrors(form.setError, err),
  })
  const submit = () =>
    void form.handleSubmit(
      (v) =>
        save.mutate({
          activities: v.activities,
          workoutLocation: v.workoutLocation,
          workoutDurationMin: Number(v.workoutDurationMin),
          foodPreference: v.foodPreference,
          language: v.language,
          units: v.units,
        }),
      () => haptic.error(),
    )()

  return (
    <Screen title="Preferences" back backHref="/settings" footer={<Button title="Save" loading={save.isPending} onPress={submit} feedback="none" testID="save-preferences" />}>
      <Text variant="caption" tone="muted">
        We use these to suggest workouts, challenges and tips you&apos;ll enjoy.
      </Text>
      <SectionCard icon={Activity} tint="habits" title="Preferred activities" description="Pick everything you enjoy — choose at least one.">
        <Controller
          control={form.control}
          name="activities"
          render={({ field, fieldState }) => <ChoiceGroup multiple options={ACTIVITY_OPTIONS} value={field.value} onChange={(v) => field.onChange(v as string[])} error={fieldState.error?.message} accessibilityLabel="Preferred activities" />}
        />
      </SectionCard>

      <SectionCard icon={Dumbbell} tint="workout" title="Workouts" description="Where and how long you like to train.">
        <Text variant="label">Workout location</Text>
        <Controller
          control={form.control}
          name="workoutLocation"
          render={({ field, fieldState }) => <ChoiceGroup options={LOCATION_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Workout location" />}
        />
        <View style={styles.labelRow}>
          <Timer size={15} color={colors.mutedForeground} />
          <Text variant="label">Preferred workout length</Text>
        </View>
        <Controller
          control={form.control}
          name="workoutDurationMin"
          render={({ field, fieldState }) => <ChoiceGroup options={DURATION_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Preferred workout length" />}
        />
      </SectionCard>

      <SectionCard icon={Salad} tint="habits" title="Food preference" description="Used for meal ideas and nutrition tips.">
        <Controller
          control={form.control}
          name="foodPreference"
          render={({ field, fieldState }) => <ChoiceGroup options={FOOD_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Food preference" />}
        />
      </SectionCard>

      <SectionCard icon={Languages} tint="steps" title="Language" description="More languages are coming soon. Your choice applies straight away.">
        <Controller
          control={form.control}
          name="language"
          render={({ field }) => (
            <ChoiceGroup options={LANGUAGE_OPTIONS.map((l) => ({ value: l.value, label: l.label, disabled: !l.available, hint: l.available ? undefined : "Soon" }))} value={field.value} onChange={(v) => field.onChange(v)} accessibilityLabel="Language" />
          )}
        />
      </SectionCard>

      <SectionCard icon={Ruler} tint="points" title="Units" description="How distances, weight and height are shown." right={<PhaseBadge phase={2} />}>
        <Controller
          control={form.control}
          name="units"
          render={({ field }) => (
            <ChoiceGroup
              options={[
                { value: "metric", label: "Metric (km, kg, cm)" },
                { value: "imperial", label: "Imperial (mi, lb, ft)" },
              ]}
              value={field.value}
              onChange={(v) => field.onChange(v)}
              accessibilityLabel="Units"
            />
          )}
        />
      </SectionCard>

      <Appearance />
    </Screen>
  )
}

export default function PreferencesScreen() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  if (q.data) return <PreferencesForm data={q.data} />
  return (
    <Screen title="Preferences" back backHref="/settings">
      {q.error ? <ErrorState title="Couldn't load your preferences." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} /> : <SkeletonList count={4} height={140} header={false} />}
    </Screen>
  )
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  themes: { flexDirection: "row", gap: 8 },
  theme: { flex: 1, alignItems: "center", gap: 4, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 6, minHeight: 92 },
})
