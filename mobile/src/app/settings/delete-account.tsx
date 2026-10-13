/**
 * SCR-M-078 Delete Account (FRM-23) — what gets deleted, points & orders impact, reason, type DELETE to confirm,
 * re-authenticate (password or one-time code), final confirmation → account deactivated and signed out.
 */
import { zodResolver } from "@hookform/resolvers/zod"
import { router } from "expo-router"
import { CalendarClock, Coins, KeyRound, LogOut, Package, Trash2, TriangleAlert, UserX } from "lucide-react-native"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors } from "@/components/form"
import { Bullet, go, SectionCard } from "@/components/engage/shared"
import { Button, Card, ConfirmDialog, ErrorState, IconTile, Notice, OtpInput, Screen, SegmentedControl, SelectField, SkeletonList, Text, TextField } from "@/components/ui"
import { env } from "@/config/env"
import { privacyApi, type DeletionInfo } from "@/lib/api/employee/privacy"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, pluralize } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const REASONS = [
  { value: "not_using", label: "I don't use HealthX any more" },
  { value: "privacy", label: "I'm worried about my privacy" },
  { value: "leaving", label: "I'm leaving my company" },
  { value: "notifications", label: "Too many notifications" },
  { value: "not_useful", label: "It isn't useful for me" },
  { value: "other", label: "Something else" },
]

const schema = z
  .object({
    reason: z.string(),
    details: z.string().max(500, "Use 500 characters or fewer"),
    confirmation: z.string().refine((v) => v.trim() === "DELETE", "Type DELETE in capital letters to confirm"),
    method: z.enum(["password", "code"]),
    password: z.string(),
    code: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "password" && !v.password) ctx.addIssue({ code: "custom", path: ["password"], message: "Enter your password" })
    if (v.method === "code" && !/^\d{6}$/.test(v.code)) ctx.addIssue({ code: "custom", path: ["code"], message: "Enter the 6-digit code" })
  })
type Values = z.infer<typeof schema>

function AlreadyRequested({ info }: { info: DeletionInfo }) {
  const [confirm, setConfirm] = useState(false)
  const cancel = useApiMutation(privacyApi.cancelDeletion, { success: "Deletion request cancelled. Your account stays active.", errorTitle: "Couldn't cancel the request", onSuccess: () => setConfirm(false), onError: () => setConfirm(false) })
  const { colors } = useTheme()
  return (
    <Card style={{ borderColor: colors.destructive }}>
      <View style={styles.row}>
        <IconTile icon={CalendarClock} tint="danger" size={46} />
        <View style={styles.flex}>
          <Text variant="subtitle">Deletion requested on {formatDate(info.requestedAt)}</Text>
          <Text variant="caption" tone="muted">
            Your personal data will be deleted by {formatDate(info.deleteBy)}. Changed your mind? You can cancel until then.
          </Text>
        </View>
      </View>
      <Button title="Cancel request" variant="outline" loading={cancel.isPending} onPress={() => setConfirm(true)} style={styles.mt14} />
      <ConfirmDialog
        open={confirm}
        title="Keep your account?"
        message="We'll cancel your deletion request and your account and data will stay as they are."
        confirmLabel="Keep my account"
        cancelLabel="Go back"
        loading={cancel.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => cancel.mutate()}
      />
    </Card>
  )
}

function DeleteForm({ info }: { info: DeletionInfo }) {
  const { colors, tint } = useTheme()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onChange", defaultValues: { reason: "", details: "", confirmation: "", method: "password", password: "", code: "" } })
  const method = useWatch({ control: form.control, name: "method" })
  const valid = form.formState.isValid

  const remove = useApiMutation(privacyApi.requestDeletion, {
    invalidate: false,
    errorTitle: "We couldn't process your request. Please try again.",
    // The "account deleted" screen (public route) signs the employee out and clears all cached data.
    onSuccess: () => {
      haptic.success()
      setConfirmOpen(false)
      router.replace("/blocked?reason=deleted" as never)
    },
    onError: (err) => {
      setConfirmOpen(false)
      applyApiErrors(form.setError, err)
    },
  })

  const sendCode = async () => {
    setSending(true)
    try {
      const r = await privacyApi.sendReauthCode()
      setCodeSentTo(r.sentTo)
      toast.success(`Code sent to ${r.sentTo}`)
    } catch (err) {
      toast.error("Couldn't send the code", { description: errorMessage(err) })
    } finally {
      setSending(false)
    }
  }

  const onValid = (v: Values) =>
    remove.mutate({
      reason: v.reason || undefined,
      details: v.details.trim() || undefined,
      confirmation: v.confirmation.trim(),
      method: v.method,
      password: v.method === "password" ? v.password : undefined,
      code: v.method === "code" ? v.code : undefined,
    })

  const pts = tint("points")
  return (
    <Screen
      title="Delete account"
      back
      backHref="/settings"
      footer={<Button title="Delete my account" icon={Trash2} variant="destructive" disabled={!valid} loading={remove.isPending} onPress={() => setConfirmOpen(true)} testID="delete-account" />}
    >
      <Card style={{ borderColor: colors.destructive }}>
        <View style={styles.row}>
          <IconTile icon={UserX} tint="danger" size={46} />
          <View style={styles.flex}>
            <Text variant="subtitle">We&apos;re sorry to see you go</Text>
            <Text variant="caption" tone="muted">
              Your account will be deactivated straight away and your personal data deleted within {info.graceDays} days. After that, it can&apos;t be recovered.
            </Text>
          </View>
        </View>
      </Card>

      <SectionCard icon={Trash2} tint="danger" title="What will be deleted">
        <View style={styles.gap8}>
          {[
            "Your profile, photo and contact details",
            "Steps, activity, water, sleep and workout history",
            `Habits, Wellness Score and ${pluralize(info.badgesCount, "badge")}`,
            info.connectedApps.length ? `Connections to ${info.connectedApps.join(" and ")} (we'll stop syncing)` : "Any connected health apps",
            "Your preferences, consents and AI coach chats",
          ].map((t) => (
            <Bullet key={t} color={colors.destructive}>
              {t}
            </Bullet>
          ))}
        </View>
        <Text variant="small" tone="muted">
          Your company keeps anonymous, combined statistics only — nothing that identifies you.
        </Text>
      </SectionCard>

      <SectionCard icon={Coins} tint="points" title="Your points & orders">
        <View style={styles.row2}>
          <View style={[styles.box, { backgroundColor: pts.bg }]}>
            <Text variant="small" tone="muted">
              Points balance
            </Text>
            <Text variant="heading">{formatNumber(info.pointsBalance)}</Text>
            <Text variant="small" tone="muted">
              Forfeited — points can&apos;t be restored or transferred.
            </Text>
          </View>
          <View style={[styles.box, { backgroundColor: colors.muted }]}>
            <View style={styles.rowSm}>
              <Package size={13} color={colors.mutedForeground} />
              <Text variant="small" tone="muted">
                Pending orders
              </Text>
            </View>
            <Text variant="heading">{info.pendingOrders}</Text>
            <Text variant="small" tone="muted">
              {info.pendingOrders ? "Will be cancelled. Delivered orders aren't affected." : "Nothing to cancel."}
            </Text>
          </View>
        </View>
        {info.pointsBalance > 0 ? <Button title="Use my points first — browse rewards" variant="ghost" size="sm" onPress={() => go("/rewards")} /> : null}
      </SectionCard>

      <SectionCard icon={TriangleAlert} tint="danger" title="Confirm it's you">
        <Controller control={form.control} name="reason" render={({ field }) => <SelectField label="Why are you leaving? (optional)" placeholder="Choose a reason" value={field.value} onChange={field.onChange} options={REASONS} />} />
        <Controller
          control={form.control}
          name="details"
          render={({ field, fieldState }) => (
            <TextField label="Anything else you'd like to tell us? (optional)" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} multiline numberOfLines={3} maxLength={500} placeholder="Your feedback helps us improve HealthX." error={fieldState.error?.message} hint={`${field.value.length}/500`} />
          )}
        />
        <Controller
          control={form.control}
          name="confirmation"
          render={({ field, fieldState }) => (
            <TextField
              label="Type DELETE to confirm"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              error={fieldState.isTouched || form.formState.isSubmitted ? fieldState.error?.message : undefined}
              testID="type-delete"
            />
          )}
        />
        <View style={[styles.reauth, { backgroundColor: colors.muted }]}>
          <View style={styles.rowSm}>
            <KeyRound size={15} color={colors.mutedForeground} />
            <Text variant="label">Re-enter your password or use a one-time code</Text>
          </View>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <SegmentedControl
                value={field.value}
                onChange={(v) => {
                  field.onChange(v)
                  void form.trigger()
                }}
                accessibilityLabel="How to confirm"
                options={[
                  { value: "password", label: "Password" },
                  { value: "code", label: "One-time code" },
                ]}
              />
            )}
          />
          {method === "password" ? (
            <Controller
              control={form.control}
              name="password"
              render={({ field, fieldState }) => (
                <TextField label="Password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} secure autoComplete="current-password" error={fieldState.isTouched ? fieldState.error?.message : undefined} hint={env.useMock ? "Demo: any password works." : undefined} testID="reauth-password" />
              )}
            />
          ) : (
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <View style={styles.gap8}>
                  <Button title={codeSentTo ? "Resend code" : "Send code"} variant="outline" size="md" loading={sending} onPress={sendCode} />
                  {codeSentTo ? (
                    <>
                      <OtpInput value={field.value} onChange={field.onChange} error={!!fieldState.error && fieldState.isTouched} autoFocus />
                      <Text variant="small" tone={fieldState.error && fieldState.isTouched ? "destructive" : "muted"}>
                        {fieldState.error && fieldState.isTouched ? fieldState.error.message : `Sent to ${codeSentTo}.${env.useMock ? " Demo: any 6 digits work." : ""}`}
                      </Text>
                    </>
                  ) : (
                    <Text variant="small" tone="muted">
                      We&apos;ll email you a 6-digit code.
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </SectionCard>

      <Notice tone="info" icon={LogOut}>{`You'll be signed out on all devices. Changed your mind? Sign in again within ${info.graceDays} days and cancel the request in Settings.`}</Notice>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete your account?"
        message={`Your account will be deactivated now and your personal data deleted within ${info.graceDays} days.${info.pointsBalance ? ` Your ${formatNumber(info.pointsBalance)} points will be forfeited.` : ""}`}
        confirmLabel="Yes, delete"
        cancelLabel="Keep account"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void form.handleSubmit(onValid, () => setConfirmOpen(false))()}
      />
    </Screen>
  )
}

export default function DeleteAccountScreen() {
  const q = useApiQuery(["employee", "privacy", "deletion"], () => privacyApi.deletionInfo())
  if (q.data && !q.data.requestedAt) return <DeleteForm info={q.data} />
  return (
    <Screen title="Delete account" back backHref="/settings" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.data ? (
        <AlreadyRequested info={q.data} />
      ) : q.error ? (
        <ErrorState title="Couldn't load this page." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : (
        <SkeletonList count={3} height={160} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  gap8: { gap: 8 },
  mt14: { marginTop: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  row2: { flexDirection: "row", gap: 10 },
  box: { flex: 1, borderRadius: RADIUS.lg, padding: 12, gap: 3 },
  reauth: { borderRadius: RADIUS.lg, padding: 12, gap: 12 },
})
