/** SCR-M-068 7-Day Wellness Plan (Phase 2) — day tabs, tick items off, save / regenerate / delete. Not medical advice. */
import { useQueryClient } from "@tanstack/react-query"
import { Brain, Check, ChevronRight, CircleCheckBig, Droplets, Footprints, Moon, RefreshCw, Save, Sparkles, Trash2, TriangleAlert, Utensils, type LucideIcon } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { CoachAvatar, CoachDisclaimer } from "@/components/engage/coach"
import { alpha, go, replace } from "@/components/engage/shared"
import { Button, Card, ConfirmDialog, ErrorState, IconTile, PhaseBadge, ProgressBar, ProgressRing, Screen, Skeleton, Text } from "@/components/ui"
import { coachApi, type CoachPlan, type CoachPlanItem, type PlanKind } from "@/lib/api/employee/coach"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"

const PLAN_KEY = ["employee", "coach", "plan"]
const KIND: Record<PlanKind, { icon: LucideIcon; tint: TintName; label: string }> = {
  move: { icon: Footprints, tint: "habits", label: "Move" },
  eat: { icon: Utensils, tint: "points", label: "Eat" },
  hydrate: { icon: Droplets, tint: "water", label: "Hydrate" },
  rest: { icon: Moon, tint: "sleep", label: "Rest" },
  mind: { icon: Brain, tint: "insight", label: "Mind" },
}

function PlanView({ plan, onSave, saving }: { plan: CoachPlan; onSave: () => void; saving: boolean }) {
  const { colors, tint } = useTheme()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const today = Math.min(7, Math.max(1, plan.todayDay))
  const dayNo = picked ?? today
  const drop = (id: string) =>
    setOverrides((o) => {
      const next = { ...o }
      delete next[id]
      return next
    })
  const toggle = useApiMutation(coachApi.setItemDone, {
    invalidate: false,
    onSuccess: (next, input) => {
      qc.setQueryData(PLAN_KEY, next)
      drop(input.itemId)
      const day = next.days.find((d) => d.items.some((i) => i.id === input.itemId))
      if (input.done && day && day.doneCount === day.items.length) {
        haptic.success()
        toast.success(`Day ${day.day} complete! 🎉`, { description: "Every item ticked off — brilliant work." })
      }
    },
    onError: (_e, input) => drop(input.itemId),
  })
  const isDone = (item: CoachPlanItem) => overrides[item.id] ?? item.done
  const days = plan.days.map((d) => ({ ...d, doneCount: d.items.filter(isDone).length }))
  const day = days.find((d) => d.day === dayNo) ?? days[0]!
  const doneTotal = days.reduce((a, d) => a + d.doneCount, 0)
  const pct = plan.totalCount ? Math.round((doneTotal / plan.totalCount) * 100) : 0
  const onToggle = (item: CoachPlanItem) => {
    haptic.select()
    const next = !isDone(item)
    setOverrides((o) => ({ ...o, [item.id]: next }))
    toggle.mutate({ id: plan.id, itemId: item.id, done: next })
  }

  return (
    <>
      {plan.savedAt ? (
        <View style={[styles.banner, { backgroundColor: tint("habits").bg }]}>
          <CircleCheckBig size={18} color={tint("habits").fg} />
          <Text variant="caption" style={styles.flex}>
            <Text variant="label">Plan saved</Text> · {formatRelative(plan.savedAt)} · {plan.todayDay > 7 ? "this plan has finished — regenerate for a fresh week" : `day ${today} of 7`}
          </Text>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: tint("insight").bg }]}>
          <Save size={18} color={tint("insight").fg} />
          <View style={styles.flex}>
            <Text variant="label">This plan isn&apos;t saved yet</Text>
            <Text variant="small" tone="muted">
              Save it to keep it with your coach and track your progress day by day.
            </Text>
          </View>
          <Button title="Save" icon={Check} size="sm" loading={saving} onPress={onSave} testID="save-plan" />
        </View>
      )}

      <Card>
        <View style={styles.row}>
          <ProgressRing value={pct} size={88} stroke={9} accessibilityLabel={`${pct}% of the week done`}>
            <Text variant="heading">{pct}%</Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text variant="subtitle">Your week</Text>
            <Text variant="caption" tone="muted">
              <Text variant="label">{doneTotal}</Text> of {plan.totalCount} items done
            </Text>
            <Text variant="small" tone="muted">
              Started {formatDate(plan.createdAt, "d MMM")}
            </Text>
          </View>
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.days} accessibilityRole="tablist">
        {days.map((d) => {
          const active = d.day === day.day
          const complete = d.items.length > 0 && d.doneCount === d.items.length
          return (
            <Pressable
              key={d.day}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Day ${d.day}, ${formatDate(d.date, "EEEE")}, ${d.doneCount} of ${d.items.length} done`}
              onPress={() => {
                haptic.select()
                setPicked(d.day)
              }}
              style={[styles.dayChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Text variant="small" color={active ? colors.primaryForeground : colors.mutedForeground}>
                {formatDate(d.date, "EEE")}
              </Text>
              <Text variant="heading" color={active ? colors.primaryForeground : colors.foreground}>
                {d.day}
              </Text>
              {complete ? (
                <CircleCheckBig size={15} color={active ? colors.primaryForeground : colors.success} />
              ) : (
                <Text variant="small" color={active ? colors.primaryForeground : colors.mutedForeground}>
                  {d.doneCount}/{d.items.length}
                </Text>
              )}
              {d.day === plan.todayDay ? <View style={[styles.todayDot, { backgroundColor: active ? colors.primaryForeground : colors.primary }]} /> : null}
            </Pressable>
          )
        })}
      </ScrollView>

      <Card padding={0} style={styles.clip}>
        <View style={[styles.dayHead, { borderBottomColor: colors.border }]}>
          <View style={styles.between}>
            <View style={styles.flex}>
              <Text variant="overline" tone="muted">
                Day {day.day} · {formatDate(day.date, "EEEE, d MMM")}
                {day.day === plan.todayDay ? " · Today" : ""}
              </Text>
              <Text variant="heading">{day.title}</Text>
            </View>
            <Text variant="label">
              {day.doneCount}/{day.items.length}
            </Text>
          </View>
          <ProgressBar value={day.items.length ? (day.doneCount / day.items.length) * 100 : 0} height={6} />
        </View>
        {day.items.map((item) => {
          const k = KIND[item.kind]
          const done = isDone(item)
          return (
            <View key={item.id} style={[styles.item, { borderTopColor: colors.border }, done && { backgroundColor: alpha(colors.primary, 0.05) }]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={item.label} onPress={() => onToggle(item)} hitSlop={6} style={styles.checkHit}>
                <View style={[styles.check, done ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.input }]}>{done ? <Check size={15} color="#ffffff" strokeWidth={3} /> : null}</View>
              </Pressable>
              <IconTile icon={k.icon} tint={k.tint} size={34} />
              <View style={styles.flex}>
                <Text variant="bodyMedium" tone={done ? "muted" : "default"} style={done ? styles.strike : undefined}>
                  {item.label}
                </Text>
                <Text variant="small" tone="muted" numberOfLines={1}>
                  <Text variant="small" weight="semibold">
                    {item.time}
                  </Text>
                  {item.detail ? ` · ${item.detail}` : ` · ${k.label}`}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} hitSlop={6} onPress={() => openHref(item.href)} style={styles.open}>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )
        })}
      </Card>

      <Card>
        <Text variant="overline" tone="muted">
          Based on
        </Text>
        {plan.basedOn.map((b) => (
          <View key={b.label} style={[styles.between, styles.mt6]}>
            <Text variant="caption" tone="muted">
              {b.label}
            </Text>
            <Text variant="label">{b.value}</Text>
          </View>
        ))}
        <Button title="Change my goals & preferences" variant="ghost" size="sm" iconRight={ChevronRight} onPress={() => go("/settings/preferences")} style={styles.mt8} />
      </Card>
    </>
  )
}

export default function WellnessPlanScreen() {
  const { colors } = useTheme()
  const access = useApiQuery(["employee", "coach", "access"], () => coachApi.access())
  const allowed = !!access.data?.enabled && !!access.data?.granted
  const mustLeave = !!access.data && !allowed
  const plan = useApiQuery(PLAN_KEY, () => coachApi.plan(), { enabled: allowed })
  const [confirm, setConfirm] = useState<"regenerate" | "delete" | null>(null)
  const create = useApiMutation(coachApi.createPlan, {
    success: (_p, input) => (input && input.regenerate ? "New plan ready" : "Your plan is ready"),
    errorTitle: "Couldn't create a plan right now.",
    invalidate: [["employee", "coach"]],
    onSuccess: () => setConfirm(null),
    onError: () => setConfirm(null),
  })
  const save = useApiMutation(coachApi.savePlan, { success: "Plan saved.", invalidate: [["employee", "coach"]] })
  const remove = useApiMutation(coachApi.deletePlan, { success: "Plan deleted", invalidate: [["employee", "coach"]], onSuccess: () => setConfirm(null), onError: () => setConfirm(null) })

  // No consent (or coach switched off) → back to the coach intro.
  useEffect(() => {
    if (mustLeave) replace("/coach")
  }, [mustLeave])

  const data = plan.data
  return (
    <Screen
      title="7-day plan"
      back
      backHref="/coach"
      right={<PhaseBadge phase={2} />}
      refreshing={plan.isRefetching}
      onRefresh={allowed ? () => plan.refetch() : undefined}
      footer={
        data ? (
          <View style={styles.footer}>
            <Button title="Regenerate" icon={RefreshCw} variant="outline" size="md" block style={styles.flex1} loading={create.isPending} onPress={() => setConfirm("regenerate")} />
            <Button title="Delete" icon={Trash2} variant="ghost" size="md" onPress={() => setConfirm("delete")} />
          </View>
        ) : undefined
      }
      testID="coach-plan-screen"
    >
      <CoachDisclaimer compact />
      {access.error ? (
        <ErrorState title="Coach is unavailable right now. Please try again later." error={access.error} onRetry={() => access.refetch()} retrying={access.isFetching} />
      ) : plan.error ? (
        <ErrorState title="Couldn't load your plan." error={plan.error} onRetry={() => plan.refetch()} retrying={plan.isFetching} />
      ) : !access.data || mustLeave || plan.isPending ? (
        <>
          <Skeleton height={64} radius={RADIUS.xl} />
          <Skeleton height={80} radius={RADIUS.xl} />
          <Skeleton height={320} radius={RADIUS.xl} />
        </>
      ) : !data ? (
        <Card>
          <View style={styles.empty}>
            <CoachAvatar size={72} />
            <Text variant="title" align="center">
              Let&apos;s build your 7-day plan
            </Text>
            <Text variant="caption" tone="muted" align="center">
              Your coach uses your step goal, workout place and time, food preference, water goal and sleep goal to plan simple daily actions.
            </Text>
            <Button title="Create my plan" icon={Sparkles} loading={create.isPending} onPress={() => create.mutate({})} testID="create-plan" />
            {create.error ? (
              <View style={styles.rowSm}>
                <TriangleAlert size={14} color={colors.destructive} />
                <Text variant="caption" tone="destructive">
                  Couldn&apos;t create a plan right now.
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : (
        <PlanView key={data.id} plan={data} onSave={() => save.mutate({ id: data.id })} saving={save.isPending} />
      )}

      <ConfirmDialog
        open={confirm === "regenerate"}
        title="Regenerate your plan?"
        message="You'll get fresh suggestions for all 7 days. Ticked items will be cleared and you'll need to save the new plan."
        confirmLabel="Regenerate"
        loading={create.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => create.mutate({ regenerate: true })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete this plan?"
        message="Your 7-day plan and its ticked items will be removed. You can create a new one any time."
        confirmLabel="Delete plan"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => data && remove.mutate({ id: data.id })}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  flex1: { flex: 1 },
  clip: { overflow: "hidden" },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  banner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: RADIUS.lg },
  bleed: { marginHorizontal: -16, flexGrow: 0 },
  days: { gap: 8, paddingHorizontal: 16 },
  dayChip: { width: 64, alignItems: "center", gap: 2, borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 10 },
  todayDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
  dayHead: { padding: 14, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingRight: 6, paddingLeft: 4, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  checkHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  strike: { textDecorationLine: "line-through" },
  open: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", gap: 8, alignItems: "center" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 12 },
})
