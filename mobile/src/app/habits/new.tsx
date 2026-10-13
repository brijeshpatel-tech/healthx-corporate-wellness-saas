/** SCR-M-041 Create Custom Habit (Phase 2) — name, icon, how it's tracked and a daily target. */
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "expo-router"
import { Info } from "lucide-react-native"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { formatTarget, targetText } from "@/components/track/habit-ui"
import { FinePrint, HeaderPhase, NumberStepper, OptionCard } from "@/components/track/track-ui"
import { Button, Card, goBack, Screen, Text } from "@/components/ui"
import { habitsApi, UNIT_RANGE, type HabitUnit } from "@/lib/api/employee/habits"
import { useApiMutation } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const ICONS = ["✅", "📚", "🧘", "🚶", "💪", "🥗", "🍎", "💧", "😴", "🎯", "🎨", "🎸", "🌱", "☀️", "🧹", "📝", "🙏", "🫶", "🚴", "🏊"]
type CustomUnit = Exclude<HabitUnit, "steps">
const TYPES: { value: CustomUnit; label: string; hint: string }[] = [
  { value: "check", label: "Yes / no", hint: "Tick it off once a day" },
  { value: "times", label: "Times", hint: "e.g. 3 stretch breaks" },
  { value: "minutes", label: "Minutes", hint: "e.g. 20 minutes reading" },
  { value: "glasses", label: "Glasses", hint: "e.g. 2 cups of green tea" },
  { value: "hours", label: "Hours", hint: "e.g. 1 hour offline" },
]
const DEFAULT_TARGET: Record<CustomUnit, number> = { check: 1, times: 3, minutes: 20, glasses: 3, hours: 4 }

const schema = z.object({
  name: z.string().trim().min(2, "Habit name must be 2–40 characters").max(40, "Habit name must be 2–40 characters"),
  icon: z.string().min(1, "Pick an icon"),
  unit: z.enum(["check", "times", "minutes", "glasses", "hours"]),
  target: z.number(),
})
type Values = z.infer<typeof schema>

export default function NewHabitScreen() {
  const { colors } = useTheme()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", icon: "✅", unit: "check", target: 1 } })
  const [icon, unit, target, name] = useWatch({ control: form.control, name: ["icon", "unit", "target", "name"] })
  const range = UNIT_RANGE[unit]
  const create = useApiMutation(habitsApi.createCustom, {
    success: "Habit created.",
    errorTitle: "Couldn't create this habit",
    onSuccess: () => router.dismissTo("/habits"),
    onError: (e) => applyApiErrors(form.setError, e),
  })
  const submit = form.handleSubmit(
    (v) => create.mutate({ name: v.name, icon: v.icon, unit: v.unit, target: v.unit === "check" ? 1 : v.target }),
    () => haptic.error(),
  )

  return (
    <Screen
      title="Create a habit"
      back
      backHref="/habits/choose"
      right={<HeaderPhase />}
      footer={
        <View style={styles.footer}>
          <Button title="Cancel" variant="outline" size="md" block style={styles.flex} onPress={() => goBack("/habits/choose")} />
          <Button title="Create" size="md" block style={styles.flex} loading={create.isPending} onPress={submit} testID="create-habit-submit" />
        </View>
      }
    >
      <Text variant="caption" tone="muted">
        Track something personal that isn&apos;t in the HealthX list.
      </Text>

      <Card>
        <View style={styles.preview}>
          <View style={[styles.previewIcon, { backgroundColor: colors.muted }]}>
            <Text style={styles.previewEmoji}>{icon}</Text>
          </View>
          <View style={styles.flex}>
            <Text variant="heading" numberOfLines={1}>
              {name.trim() || "Your new habit"}
            </Text>
            <Text variant="caption" tone="muted">
              {targetText(unit, unit === "check" ? 1 : target)}
            </Text>
          </View>
        </View>
      </Card>

      <FormTextField control={form.control} name="name" label="Habit name" placeholder="e.g. Read for 20 minutes" maxLength={40} autoCapitalize="sentences" returnKeyType="done" testID="habit-name" />

      <View style={styles.group}>
        <Text variant="label">Icon</Text>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <View style={styles.icons} accessibilityRole="radiogroup" accessibilityLabel="Icon">
              {ICONS.map((i) => {
                const active = field.value === i
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`Icon ${i}`}
                    onPress={() => {
                      haptic.select()
                      field.onChange(i)
                    }}
                    style={({ pressed }) => [styles.iconCell, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.card, borderWidth: active ? 1.5 : 1 }, pressed && styles.pressed]}
                  >
                    <Text style={styles.iconEmoji}>{i}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        />
      </View>

      <View style={styles.group}>
        <Text variant="label">How will you track it?</Text>
        <View style={styles.types}>
          {TYPES.map((t) => (
            <OptionCard
              key={t.value}
              selected={unit === t.value}
              accessibilityLabel={`${t.label}. ${t.hint}`}
              onPress={() => {
                form.setValue("unit", t.value)
                form.setValue("target", DEFAULT_TARGET[t.value])
              }}
              style={styles.type}
            >
              <Text variant="subtitle">{t.label}</Text>
              <Text variant="small" tone="muted">
                {t.hint}
              </Text>
            </OptionCard>
          ))}
        </View>
      </View>

      {unit !== "check" ? (
        <Card>
          <View style={styles.group}>
            <Text variant="subtitle">Daily target</Text>
            <NumberStepper
              label="Daily target"
              value={target}
              min={range.min}
              max={range.max}
              step={range.step}
              onChange={(v) => form.setValue("target", v)}
              format={(v) => formatTarget(unit, v)}
              hint={`${formatNumber(range.min)} – ${formatNumber(range.max)} ${range.label}`}
              size="lg"
            />
          </View>
        </Card>
      ) : null}

      <FinePrint icon={Info}>Custom habits count towards your streaks and the habits part of your Wellness Score, but don&apos;t earn points (to be confirmed by your company).</FinePrint>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  footer: { flexDirection: "row", gap: 10 },
  preview: { flexDirection: "row", alignItems: "center", gap: 14 },
  previewIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  previewEmoji: { fontSize: 34, lineHeight: 42 },
  group: { gap: 10 },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconCell: { width: "18%", flexGrow: 1, aspectRatio: 1, maxHeight: 64, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
  iconEmoji: { fontSize: 24, lineHeight: 30 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  types: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  type: { width: "48%", flexGrow: 1, padding: 12, gap: 2 },
})
