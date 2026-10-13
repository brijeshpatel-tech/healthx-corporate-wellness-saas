/**
 * SCR-M-056 Redeem Reward — confirm points + delivery details (FRM-21).
 * Points are deducted exactly once (idempotency key); the order starts as "Pending approval" (client decision #13).
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import { useLocalSearchParams } from "expo-router"
import { CircleCheck, Clock, Coins, Mail, Package, ShieldCheck, TriangleAlert, Truck } from "lucide-react-native"
import { useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { RewardImage } from "@/components/engage/reward-ui"
import { alpha, Confetti, go, PopIn, replace, SectionCard, TintPill } from "@/components/engage/shared"
import { Button, Card, Checkbox, EmptyState, ErrorState, Notice, Screen, Skeleton, Text } from "@/components/ui"
import { ApiError } from "@/lib/api/core"
import { needsAddress, rewardsApi, type RedeemResult, type RewardDetail } from "@/lib/api/employee/rewards"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

function buildSchema(physical: boolean) {
  return z.object({
    name: z.string().trim().min(2, "Enter the recipient's name").max(80, "Keep it under 80 characters"),
    email: z.string().trim().email("Enter a valid email address"),
    phone: physical ? z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/, "Enter a valid 10-digit mobile number") : z.string().trim(),
    address: physical ? z.string().trim().min(15, "Enter the full address with PIN code").max(300, "Keep it under 300 characters").regex(/\d{6}/, "Include the 6-digit PIN code") : z.string(),
    notes: z.string().trim().max(200, "Keep notes under 200 characters"),
    confirm: z.boolean().refine((v) => v, "Please confirm the points deduction"),
  })
}
type Values = z.infer<ReturnType<typeof buildSchema>>

const newIdempotencyKey = (rewardId: string) => `rdm_${rewardId}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

function RedeemForm({ r, onDone }: { r: RewardDetail; onDone: (res: RedeemResult) => void }) {
  const { colors, tint } = useTheme()
  const qc = useQueryClient()
  const physical = needsAddress(r.delivery)
  const schema = useMemo(() => buildSchema(physical), [physical])
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: r.defaults.name, email: r.defaults.email, phone: r.defaults.phone, address: "", notes: "", confirm: false },
  })
  const key = useRef<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const redeem = useApiMutation(rewardsApi.redeem, {
    errorTitle: "Redemption failed",
    // Show the success panel first, then refresh balances everywhere.
    invalidate: false,
    onSuccess: (res) => {
      haptic.success()
      onDone(res)
      void qc.invalidateQueries()
    },
    onError: (err) => {
      const mapped: Record<string, string> = {}
      if (err instanceof ApiError && err.fieldErrors) for (const [k, v] of Object.entries(err.fieldErrors)) mapped[k.replace(/^delivery\./, "")] = v
      applyApiErrors(form.setError, new ApiError(err.message, err.status, err.code, mapped))
      setApiError(err.status && err.status < 500 ? err.message : "Something went wrong – no points were deducted.")
    },
  })

  const onValid = (v: Values) => {
    setApiError(null)
    // One idempotency key per redemption attempt on this screen → points are deducted exactly once.
    if (!key.current) key.current = newIdempotencyKey(r.id)
    redeem.mutate({
      id: r.id,
      idempotencyKey: key.current,
      confirm: v.confirm,
      delivery: { name: v.name, email: v.email, phone: v.phone || undefined, address: v.address || undefined, notes: v.notes || undefined },
    })
  }
  const submit = () => void form.handleSubmit(onValid)()

  const pts = tint("points")
  return (
    <Screen
      title="Redeem reward"
      back
      backHref={`/rewards/${r.id}`}
      footer={
        <>
          {apiError ? (
            <View style={[styles.apiError, { backgroundColor: colors.destructiveSoft }]} accessibilityRole="alert">
              <TriangleAlert size={16} color={colors.destructive} />
              <Text variant="caption" tone="destructive" style={styles.flex}>
                {apiError}
              </Text>
            </View>
          ) : null}
          <Button title={`Confirm · ${formatNumber(r.pointsCost)} pts`} icon={Coins} loading={redeem.isPending} onPress={submit} feedback="none" testID="confirm-redeem" />
        </>
      }
    >
      <Text variant="caption" tone="muted">
        Check the details below — points are deducted once you confirm.
      </Text>
      <Card padding={0} style={styles.clip}>
        <View style={styles.summary}>
          <RewardImage emoji={r.emoji} color={r.color} height={64} emojiSize={34} radius={18} style={styles.thumb} />
          <View style={styles.flex}>
            <Text variant="subtitle" numberOfLines={2}>
              {r.name}
            </Text>
            <Text variant="caption" tone="muted">
              {r.deliveryLabel}
            </Text>
          </View>
        </View>
        <View style={[styles.math, { borderTopColor: colors.border }]}>
          <View style={styles.mathCell}>
            <Text variant="small" tone="muted">
              Balance
            </Text>
            <Text variant="subtitle">{formatNumber(r.balance)}</Text>
          </View>
          <View style={[styles.mathCell, styles.mathMid, { borderColor: colors.border }]}>
            <Text variant="small" tone="muted">
              Cost
            </Text>
            <Text variant="subtitle" color={pts.fg}>
              −{formatNumber(r.pointsCost)}
            </Text>
          </View>
          <View style={styles.mathCell}>
            <Text variant="small" tone="muted">
              Balance after
            </Text>
            <Text variant="subtitle">{formatNumber(r.balanceAfter)}</Text>
          </View>
        </View>
      </Card>

      <SectionCard icon={physical ? Truck : Mail} tint="steps" title={physical ? "Delivery address" : "Where should we send it?"}>
        <FormTextField control={form.control} name="name" label="Recipient name" autoComplete="name" textContentType="name" testID="delivery-name" />
        <FormTextField
          control={form.control}
          name="email"
          label={physical ? "Email for updates" : "Delivery email"}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          hint={physical ? undefined : "Your code or confirmation is sent here."}
          testID="delivery-email"
        />
        {physical ? (
          <>
            <FormTextField control={form.control} name="phone" label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="+91 98765 43210" testID="delivery-phone" />
            <FormTextField control={form.control} name="address" label="Full address" placeholder="Flat / house, street, area, city, PIN code" multiline numberOfLines={3} maxLength={300} testID="delivery-address" />
          </>
        ) : null}
        <FormTextField control={form.control} name="notes" label="Notes (optional)" placeholder={physical ? "Landmark or delivery instructions" : "Anything we should know?"} multiline maxLength={200} />
        {physical ? (
          <View style={styles.rowSm}>
            <ShieldCheck size={14} color={colors.primary} />
            <Text variant="small" tone="muted" style={styles.flex}>
              Your phone and address are encrypted and only visible to the team fulfilling your order.
            </Text>
          </View>
        ) : null}
      </SectionCard>

      <Controller
        control={form.control}
        name="confirm"
        render={({ field, fieldState }) => (
          <Card>
            <Checkbox
              checked={field.value}
              onChange={field.onChange}
              error={!!fieldState.error}
              label={`I understand ${formatNumber(r.pointsCost)} points will be deducted from my balance.`}
              description={r.approvalRequired ? "Your company approves orders first — it starts as “Pending approval”. If it's rejected, your points are refunded." : undefined}
              testID="confirm-deduction"
            />
            {fieldState.error ? (
              <Text variant="caption" tone="destructive" style={styles.mt8}>
                {fieldState.error.message}
              </Text>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  )
}

function Success({ r, result }: { r: RewardDetail; result: RedeemResult }) {
  const { colors, tint } = useTheme()
  const pending = result.approvalRequired || result.status === "pending_approval"
  const t = pending ? tint("points") : tint("habits")
  return (
    <Screen title="Order placed" back={() => replace("/rewards")} footer={<Button title="View order" icon={Package} onPress={() => replace(`/orders/${result.orderId}`)} testID="view-order" />}>
      <View style={[styles.success, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LinearGradient colors={[alpha(r.color, 0.24), alpha(r.color, 0)]} style={styles.successGlow} />
        <Confetti pieces={44} height={480} />
        <PopIn>
          <RewardImage emoji={r.emoji} color={r.color} height={116} emojiSize={62} radius={30} style={styles.successImg} />
        </PopIn>
        <TintPill label={pending ? "Pending approval" : "Approved"} icon={pending ? Clock : CircleCheck} color={t.fg} bg={t.bg} style={styles.center} />
        <Text variant="title" align="center">
          Order placed!
        </Text>
        <Text variant="body" tone="muted" align="center">
          {formatNumber(result.pointsDeducted)} points deducted. Track it in My Orders.
          {pending ? " Your company will review it shortly — if it's rejected, your points come back." : ""}
        </Text>
        <Text variant="caption" tone="muted" align="center">
          Order {result.orderNumber} · New balance {formatNumber(result.balanceAfter)} pts
        </Text>
      </View>
      <Button title="Back to rewards" variant="outline" onPress={() => replace("/rewards")} />
      <Notice tone="info">Points never expire. You can cancel while the order is pending approval — points are refunded straight away.</Notice>
    </Screen>
  )
}

export default function RedeemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const q = useApiQuery(["employee", "reward", id], () => rewardsApi.detail({ id }), { enabled: !!id, retry: (n, e) => e.status !== 404 && n < 1 })
  const [result, setResult] = useState<RedeemResult | null>(null)
  // Freeze the reward shown on the success panel (the query refetches after redeeming).
  const [snapshot, setSnapshot] = useState<RewardDetail | null>(null)

  if (result && snapshot) return <Success r={snapshot} result={result} />
  if (q.data?.canRedeem)
    return (
      <RedeemForm
        r={q.data}
        onDone={(res) => {
          setSnapshot(q.data!)
          setResult(res)
        }}
      />
    )
  return (
    <Screen title="Redeem reward" back backHref={`/rewards/${id}`}>
      {q.data ? (
        <EmptyState icon={TriangleAlert} title={q.data.blockedReason ?? "You can't redeem this reward right now."} action={{ label: "Browse other rewards", onPress: () => go("/rewards") }} />
      ) : q.error ? (
        q.error.status === 404 ? (
          <EmptyState icon={Package} title="This reward is no longer available." action={{ label: "Browse rewards", onPress: () => go("/rewards") }} />
        ) : (
          <ErrorState title="Couldn't load this reward." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
        )
      ) : (
        <>
          <Skeleton height={140} radius={RADIUS.xl} />
          <Skeleton height={300} radius={RADIUS.xl} />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: "hidden" },
  center: { alignSelf: "center" },
  mt8: { marginTop: 8 },
  rowSm: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  summary: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  thumb: { width: 64 },
  math: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  mathCell: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  mathMid: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
  apiError: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: RADIUS.md },
  success: { borderRadius: RADIUS.xxl, borderWidth: StyleSheet.hairlineWidth, padding: 22, paddingTop: 34, alignItems: "center", gap: 12, overflow: "hidden" },
  successGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  successImg: { width: 116 },
})
