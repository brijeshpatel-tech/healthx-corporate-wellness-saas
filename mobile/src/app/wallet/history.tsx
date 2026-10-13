/** SCR-M-053 Points History — earned / spent filter, date range, totals, grouped by day, load more, row detail. */
import { isToday, isYesterday, parseISO } from "date-fns"
import { CalendarRange, ReceiptText } from "lucide-react-native"
import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { ChipScroller, GroupLabel } from "@/components/engage/shared"
import { TxRow, TxSheet } from "@/components/engage/wallet-ui"
import { Button, Card, EmptyState, ErrorState, Screen, SelectField, SkeletonList, Text, TextField } from "@/components/ui"
import { displayToIsoDate, maskDate } from "@/features/onboarding/options"
import { gamificationApi, type TxFilter, type TxRange, type TxView } from "@/lib/api/employee/gamification"
import { useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const PAGE = 20

function dayLabel(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return formatDate(d, "EEEE, d MMM yyyy")
}

export default function PointsHistoryScreen() {
  const { colors } = useTheme()
  const [type, setType] = useState<TxFilter>("all")
  const [range, setRange] = useState<TxRange>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<TxView | null>(null)

  const fromIso = from ? displayToIsoDate(from) : null
  const toIso = to ? displayToIsoDate(to) : null
  const fromError = range === "custom" && from.length === 10 && !fromIso ? "Enter a valid date (DD/MM/YYYY)" : undefined
  const toError =
    range === "custom" && to.length === 10 && !toIso ? "Enter a valid date (DD/MM/YYYY)" : fromIso && toIso && fromIso > toIso ? "End date must be after the start date" : undefined
  const customIncomplete = range === "custom" && ((from && !fromIso) || (to && !toIso))

  const q = useApiQuery(
    ["employee", "wallet", "transactions", type, range, fromIso, toIso, limit],
    () => gamificationApi.transactions({ type, range, from: fromIso ?? undefined, to: toIso ?? undefined, page: 1, pageSize: limit }),
    { placeholderData: (prev) => prev, enabled: !toError && !fromError && !customIncomplete },
  )
  const items = q.data?.items ?? []
  const hasMore = !!q.data && q.data.total > items.length
  const reset = () => setLimit(PAGE)

  const groups: { label: string; items: TxView[] }[] = []
  for (const t of items) {
    const label = dayLabel(t.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(t)
    else groups.push({ label, items: [t] })
  }

  return (
    <Screen title="Points history" back backHref="/wallet" refreshing={q.isRefetching && !q.isPlaceholderData} onRefresh={() => q.refetch()} testID="points-history-screen">
      <ChipScroller<TxFilter>
        accessibilityLabel="Transaction type"
        value={type}
        onChange={(v) => {
          setType(v)
          reset()
        }}
        options={[
          { value: "all", label: "All" },
          { value: "earned", label: "Earned" },
          { value: "spent", label: "Spent" },
        ]}
      />
      <SelectField<TxRange>
        label="Date range"
        value={range}
        onChange={(v) => {
          setRange(v)
          reset()
        }}
        options={[
          { value: "all", label: "All time" },
          { value: "7d", label: "Last 7 days" },
          { value: "30d", label: "Last 30 days" },
          { value: "month", label: "This month" },
          { value: "custom", label: "Custom dates…" },
        ]}
      />
      {range === "custom" ? (
        <View style={styles.row2}>
          <TextField
            label="From"
            value={from}
            onChangeText={(t) => {
              setFrom(maskDate(t))
              reset()
            }}
            placeholder="DD/MM/YYYY"
            keyboardType="number-pad"
            maxLength={10}
            icon={CalendarRange}
            error={fromError}
            containerStyle={styles.flex}
          />
          <TextField
            label="To"
            value={to}
            onChangeText={(t) => {
              setTo(maskDate(t))
              reset()
            }}
            placeholder="DD/MM/YYYY"
            keyboardType="number-pad"
            maxLength={10}
            error={toError}
            containerStyle={styles.flex}
          />
        </View>
      ) : null}

      {q.data ? (
        <View style={styles.row2}>
          <View style={[styles.total, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text variant="small" tone="muted">
              Earned
            </Text>
            <Text variant="heading" tone="success">
              +{formatNumber(q.data.totals.earned)}
            </Text>
          </View>
          <View style={[styles.total, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text variant="small" tone="muted">
              Spent on rewards
            </Text>
            <Text variant="heading">−{formatNumber(q.data.totals.spent)}</Text>
          </View>
        </View>
      ) : null}

      {q.error && !q.data ? (
        <ErrorState title="Couldn't load history." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={6} height={60} header={false} />
      ) : items.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No transactions in this period." description="Try a different filter or date range." />
      ) : (
        <View style={[styles.groups, q.isFetching && limit === PAGE && q.isPlaceholderData && styles.dim]}>
          {groups.map((g) => (
            <View key={g.label} style={styles.group}>
              <GroupLabel>{g.label}</GroupLabel>
              <Card padding={4}>
                {g.items.map((t) => (
                  <TxRow key={t.id} t={t} onPress={() => setSelected(t)} />
                ))}
              </Card>
            </View>
          ))}
          {hasMore ? (
            <Button title="Load more" variant="outline" loading={q.isFetching} onPress={() => setLimit((l) => l + PAGE)} />
          ) : (
            <Text variant="small" tone="muted" align="center">
              That&apos;s everything · {formatNumber(q.data.total)} transactions
            </Text>
          )}
        </View>
      )}
      <TxSheet t={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row2: { flexDirection: "row", gap: 10 },
  total: { flex: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 2 },
  groups: { gap: 16 },
  group: { gap: 8 },
  dim: { opacity: 0.6 },
})
