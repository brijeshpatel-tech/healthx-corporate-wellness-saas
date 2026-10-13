"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { CalendarClock, Coins, KeyRound, LogOut, Package, Trash2, TriangleAlert, UserX } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FieldShell, SelectField, TextareaField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { FormActions, FormSection } from "@/components/employee/engage/account/rows"
import { EngagePage, LoadError, Segmented } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { ApiError } from "@/lib/api/core"
import { privacyApi, type DeletionInfo } from "@/lib/api/employee/privacy"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { DEMO_CODE } from "@/lib/mock/demo-accounts"
import { formatDate, formatNumber, pluralize } from "@/lib/format"

const REASONS = [
  { value: "not_using", label: "I don't use HealthX any more" },
  { value: "privacy", label: "I'm worried about my privacy" },
  { value: "leaving", label: "I'm leaving my company" },
  { value: "notifications", label: "Too many notifications" },
  { value: "not_useful", label: "It isn't useful for me" },
  { value: "other", label: "Something else" },
]

/** FRM-23 */
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

/** SCR-M-078 Delete Account. */
export default function DeleteAccountPage() {
  const q = useApiQuery(["employee", "privacy", "deletion"], () => privacyApi.deletionInfo())
  return (
    <EngagePage size="narrow" title="Delete account" description="Deactivate your HealthX account and delete your personal data." backHref="/employee-app/settings" backLabel="Settings">
      {q.error ? (
        <LoadError title="Couldn't load this page." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : q.data.requestedAt ? (
        <AlreadyRequested info={q.data} />
      ) : (
        <DeleteForm info={q.data} />
      )}
    </EngagePage>
  )
}

function AlreadyRequested({ info }: { info: DeletionInfo }) {
  const [confirm, setConfirm] = useState(false)
  const cancel = useApiMutation(privacyApi.cancelDeletion, { success: "Deletion request cancelled. Your account stays active.", errorTitle: "Couldn't cancel the request" })
  return (
    <section className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/6 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive text-white">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <p className="font-heading text-base font-semibold">Deletion requested on {formatDate(info.requestedAt)}</p>
          <p className="text-sm text-muted-foreground">Your personal data will be deleted by {formatDate(info.deleteBy)}. Changed your mind? You can cancel until then.</p>
        </div>
      </div>
      <Button variant="outline" className="h-11 w-full rounded-xl sm:w-auto" onClick={() => setConfirm(true)} disabled={cancel.isPending}>
        {cancel.isPending ? <Spinner /> : null}
        Cancel request
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Keep your account?"
        description="We'll cancel your deletion request and your account and data will stay as they are."
        confirmLabel="Keep my account"
        cancelLabel="Go back"
        onConfirm={() => cancel.mutate()}
      />
    </section>
  )
}

function DeleteForm({ info }: { info: DeletionInfo }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { reason: "", details: "", confirmation: "", method: "password", password: "", code: "" },
  })
  const method = useWatch({ control: form.control, name: "method" })
  const valid = form.formState.isValid

  const remove = useApiMutation(privacyApi.requestDeletion, {
    // No refetch here: the blocked screen signs the employee out and clears all cached data.
    invalidate: false,
    errorTitle: "We couldn't process your request. Please try again.",
    onSuccess: () => router.replace("/employee-app/blocked?reason=deleted"),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
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

  const submit = (v: Values) =>
    remove.mutate({
      reason: v.reason || undefined,
      details: v.details.trim() || undefined,
      confirmation: v.confirmation.trim(),
      method: v.method,
      password: v.method === "password" ? v.password : undefined,
      code: v.method === "code" ? v.code : undefined,
    })

  return (
    <>
      <section className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-gradient-to-br from-rose-500/12 to-transparent p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25">
          <UserX className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-heading text-base font-semibold">We&apos;re sorry to see you go</p>
          <p className="text-sm text-muted-foreground">Your account will be deactivated straight away and your personal data deleted within {info.graceDays} days. After that, it can&apos;t be recovered.</p>
        </div>
      </section>

      <FormSection icon={Trash2} tone="rose" title="What will be deleted">
        <ul className="space-y-2 text-sm">
          {[
            "Your profile, photo and contact details",
            "Steps, activity, water, sleep and workout history",
            `Habits, Wellness Score and ${pluralize(info.badgesCount, "badge")}`,
            info.connectedApps.length ? `Connections to ${info.connectedApps.join(" and ")} (we'll stop syncing)` : "Any connected health apps",
            "Your preferences, consents and AI coach chats",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Your company keeps anonymous, combined statistics only — nothing that identifies you.</p>
      </FormSection>

      <FormSection icon={Coins} tone="amber" title="Your points & orders">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Coins className="size-3.5" /> Points balance
            </p>
            <p className="font-heading text-xl font-bold tabular-nums">{formatNumber(info.pointsBalance)}</p>
            <p className="text-xs text-muted-foreground">Forfeited — points can&apos;t be restored or transferred.</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Package className="size-3.5" /> Pending reward orders
            </p>
            <p className="font-heading text-xl font-bold tabular-nums">{info.pendingOrders}</p>
            <p className="text-xs text-muted-foreground">{info.pendingOrders ? "Will be cancelled. Delivered orders aren't affected." : "Nothing to cancel. Delivered orders aren't affected."}</p>
          </div>
        </div>
        {info.pointsBalance > 0 ? (
          <p className="text-sm">
            Want to use your points first?{" "}
            <Link href="/employee-app/rewards" className="font-medium text-primary underline-offset-4 hover:underline">
              Browse rewards
            </Link>
          </p>
        ) : null}
      </FormSection>

      <form onSubmit={form.handleSubmit(() => setConfirmOpen(true))} className="space-y-5" noValidate>
        <FormSection icon={TriangleAlert} tone="rose" title="Confirm it's you">
          <SelectField control={form.control} name="reason" label="Why are you leaving? (optional)" placeholder="Choose a reason" options={REASONS} />
          <TextareaField control={form.control} name="details" label="Anything else you'd like to tell us? (optional)" rows={3} maxLength={500} placeholder="Your feedback helps us improve HealthX." />

          <Controller
            control={form.control}
            name="confirmation"
            render={({ field, fieldState }) => (
              <FieldShell
                id="f-confirmation"
                label={
                  <>
                    Type <span className="rounded bg-destructive/10 px-1.5 font-mono font-bold text-destructive">DELETE</span> to confirm
                  </>
                }
                error={fieldState.isTouched || form.formState.isSubmitted ? fieldState.error?.message : undefined}
              >
                <Input
                  id="f-confirmation"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="DELETE"
                  aria-invalid={!!fieldState.error && (fieldState.isTouched || form.formState.isSubmitted)}
                  className="h-11 font-mono tracking-widest uppercase"
                  {...field}
                />
              </FieldShell>
            )}
          />

          <div className="space-y-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" /> Re-enter your password or use a one-time code
            </p>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <Segmented
                  ariaLabel="How to confirm"
                  className="sm:w-full sm:min-w-0"
                  options={[
                    { value: "password", label: "Password" },
                    { value: "code", label: "One-time code" },
                  ]}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    void form.trigger()
                  }}
                />
              )}
            />
            {method === "password" ? (
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <FieldShell id="f-password" label="Password" error={fieldState.isTouched || form.formState.isSubmitted ? fieldState.error?.message : undefined} description={env.useMock ? "Demo: any password works." : undefined}>
                    <Input id="f-password" type="password" autoComplete="current-password" className="h-11" aria-invalid={!!fieldState.error && fieldState.isTouched} {...field} />
                  </FieldShell>
                )}
              />
            ) : (
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <FieldShell
                    id="f-code"
                    label="6-digit code"
                    error={fieldState.isTouched || form.formState.isSubmitted ? fieldState.error?.message : undefined}
                    description={codeSentTo ? `Sent to ${codeSentTo}.${env.useMock ? ` Demo: ${DEMO_CODE}` : ""}` : "We'll email you a code."}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <InputOTP
                        id="f-code"
                        maxLength={6}
                        pattern={REGEXP_ONLY_DIGITS}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={!codeSentTo}
                        aria-label="6-digit code"
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot key={i} index={i} aria-invalid={!!fieldState.error && fieldState.isTouched} className="size-10 text-base font-semibold" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => void sendCode()} disabled={sending}>
                        {sending ? <Spinner /> : null}
                        {codeSentTo ? "Resend code" : "Send code"}
                      </Button>
                    </div>
                  </FieldShell>
                )}
              />
            )}
          </div>
        </FormSection>

        <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <LogOut className="mt-0.5 size-4 shrink-0" />
          <p>You&apos;ll be signed out on all devices. Changed your mind? Sign in again within {info.graceDays} days and cancel the request in Settings.</p>
        </div>

        <FormActions>
          <Button asChild variant="outline">
            <Link href="/employee-app/settings">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!valid || remove.isPending} className="bg-destructive text-white hover:bg-destructive/90">
            {remove.isPending ? <Spinner /> : <Trash2 data-icon="inline-start" />}
            Delete my account
          </Button>
        </FormActions>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your account?"
        description={`Your account will be deactivated now and your personal data deleted within ${info.graceDays} days. ${info.pointsBalance ? `Your ${formatNumber(info.pointsBalance)} points will be forfeited.` : ""}`}
        confirmLabel="Yes, delete my account"
        cancelLabel="Keep my account"
        destructive
        onConfirm={() => form.handleSubmit(submit)()}
      />
    </>
  )
}
