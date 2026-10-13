/** SCR-M-025 Water Tracker — one-tap logging, goal ring, streak, weekly chart, today's entries. */
import { router } from "expo-router"
import { Droplets, Flame, GlassWater, Pencil, Plus, Settings2, Trash2 } from "lucide-react-native"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { BarChart, BottomSheet, Button, Card, Chip, EmptyState, ErrorState, IconButton, ProgressRing, Screen, SectionHeader, Skeleton, Text, TextField } from "@/components/ui"
import { waterApi, type WaterToday } from "@/lib/api/employee/water"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatMl, formatNumber, formatTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { WaterLog } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const amountError = (v: string) => {
  const n = Number(v)
  return !Number.isFinite(n) || n < 50 || n > 2000 ? "Enter an amount between 50 ml and 2,000 ml." : undefined
}

function AmountSheet({ open, onClose, title, initial, onSave, saving, onDelete }: { open: boolean; onClose: () => void; title: string; initial: string; onSave: (ml: number) => void; saving: boolean; onDelete?: () => void }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string>()
  const submit = () => {
    const e = amountError(value)
    if (e) return setError(e)
    onSave(Number(value))
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <View style={styles.sheetActions}>
          {onDelete ? <Button title="Delete" icon={Trash2} variant="outline" size="md" block style={styles.flex} onPress={onDelete} /> : null}
          <Button title="Save" size="md" block style={styles.flex} loading={saving} onPress={submit} />
        </View>
      }
    >
      <TextField
        label="Amount"
        right="ml"
        value={value}
        onChangeText={(t) => {
          setValue(t.replace(/\D/g, ""))
          setError(undefined)
        }}
        keyboardType="number-pad"
        maxLength={4}
        error={error}
        hint="50 – 2,000 ml"
        autoFocus
        testID="water-amount"
      />
      <View style={styles.chips}>
        {[150, 200, 330, 400].map((ml) => (
          <Chip key={ml} size="sm" label={`${ml} ml`} selected={value === String(ml)} onPress={() => setValue(String(ml))} />
        ))}
      </View>
    </BottomSheet>
  )
}

function WaterContent({ data }: { data: WaterToday }) {
  const { colors, tint } = useTheme()
  const water = tint("water")
  const [customOpen, setCustomOpen] = useState(false)
  const [editing, setEditing] = useState<WaterLog | null>(null)
  const pct = Math.round((data.totalMl / data.goalMl) * 100)

  const add = useApiMutation(waterApi.add, {
    onSuccess: (r, input) => {
      setCustomOpen(false)
      if (r.pointsEarned) {
        haptic.success()
        toast.success(`Goal reached! +${r.pointsEarned} points 🎉`)
      } else {
        haptic.tap()
        toast.success(`+${formatMl(input.amountMl)} logged`)
      }
    },
    errorTitle: "Couldn't save. Check your connection and try again.",
  })
  const update = useApiMutation(waterApi.update, { success: "Entry updated", onSuccess: () => setEditing(null) })
  const remove = useApiMutation(waterApi.remove, {
    onSuccess: (_r, input) => {
      const log = data.logs.find((l) => l.id === input.id)
      setEditing(null)
      toast.success("Entry deleted", { duration: 5000, action: log ? { label: "Undo", onPress: () => add.mutate({ amountMl: log.amountMl, at: log.at }) } : undefined })
    },
  })
  const week = data.history.slice(-7)

  return (
    <>
      <Card padding={18}>
        <View style={styles.ringWrap}>
          <ProgressRing value={data.totalMl} max={data.goalMl} size={190} stroke={16} color={water.fg} trackColor={water.bg} accessibilityLabel={`${formatMl(data.totalMl)} of ${formatMl(data.goalMl)}`}>
            <Droplets size={22} color={water.fg} />
            <Text variant="display">{formatMl(data.totalMl)}</Text>
            <Text variant="caption" tone="muted">
              of {formatMl(data.goalMl)} · {pct}%
            </Text>
          </ProgressRing>
        </View>
        <View style={styles.badges}>
          <Chip size="sm" icon={Flame} tint="streak" label={`${data.streakDays}-day streak`} />
          {data.goalPoints ? <Chip size="sm" tint="points" label={data.pointsToday ? `+${data.pointsToday} pts earned today` : `+${data.goalPoints} pts at goal`} /> : null}
        </View>
      </Card>

      <View style={styles.quick}>
        {data.settings.quickAmounts.map((ml) => (
          <Pressable
            key={ml}
            accessibilityRole="button"
            accessibilityLabel={`Add ${formatMl(ml)}`}
            disabled={add.isPending}
            onPress={() => add.mutate({ amountMl: ml })}
            style={({ pressed }) => [styles.quickBtn, { backgroundColor: water.bg, borderColor: colors.border }, pressed && styles.pressed]}
            testID={`water-${ml}`}
          >
            <GlassWater size={ml >= 750 ? 26 : 22} color={water.fg} />
            <Text variant="label">{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Custom amount" icon={Plus} variant="outline" onPress={() => setCustomOpen(true)} testID="water-custom" />

      <Card>
        <Text variant="subtitle">This week</Text>
        <BarChart
          data={week.map((d) => ({ key: d.date, label: formatDate(d.date, "EEEEE"), detail: formatDate(d.date, "EEE, d MMM"), value: d.totalMl }))}
          goal={data.goalMl}
          color={water.fg}
          unit="ml"
          height={150}
          format={(v) => formatNumber(v)}
          accessibilityLabel="Water per day this week"
        />
      </Card>

      <SectionHeader title="Today's entries" subtitle={data.logs.length ? "Tap an entry to edit or delete" : undefined} />
      {data.logs.length ? (
        <Card padding={4}>
          {data.logs.map((log) => (
            <Pressable key={log.id} accessibilityRole="button" onPress={() => setEditing(log)} style={({ pressed }) => [styles.entry, pressed && { backgroundColor: colors.muted }]}>
              <View style={[styles.entryIcon, { backgroundColor: water.bg }]}>
                <GlassWater size={18} color={water.fg} />
              </View>
              <Text variant="bodyMedium" style={styles.flex}>
                {formatMl(log.amountMl)}
              </Text>
              <Text variant="caption" tone="muted">
                {formatTime(log.at)}
              </Text>
              <Pencil size={14} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState compact icon={GlassWater} title="Nothing yet" description="No water logged today. Tap a glass to start." />
        </Card>
      )}

      <AmountSheet key={`c-${customOpen}`} open={customOpen} onClose={() => setCustomOpen(false)} title="Custom amount" initial="" saving={add.isPending} onSave={(ml) => add.mutate({ amountMl: ml })} />
      <AmountSheet
        key={editing?.id ?? "none"}
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit entry · ${formatTime(editing.at)}` : "Edit entry"}
        initial={editing ? String(editing.amountMl) : ""}
        saving={update.isPending}
        onSave={(ml) => editing && update.mutate({ id: editing.id, amountMl: ml })}
        onDelete={() => editing && remove.mutate({ id: editing.id })}
      />
    </>
  )
}

export default function WaterScreen() {
  const q = useApiQuery(["employee", "water"], () => waterApi.today())
  return (
    <Screen
      title="Water"
      back
      right={<IconButton icon={Settings2} variant="ghost" accessibilityLabel="Water goal and reminders" onPress={() => router.push("/water/settings")} testID="water-settings" />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.data ? (
        <WaterContent data={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load your water log" error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <>
          <Skeleton height={260} radius={RADIUS.xl} />
          <Skeleton height={80} radius={RADIUS.xl} />
          <Skeleton height={200} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ringWrap: { alignItems: "center" },
  badges: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 },
  quick: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, minHeight: 84, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", gap: 6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  entry: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.lg },
  entryIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetActions: { flexDirection: "row", gap: 10 },
})
