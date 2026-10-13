"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, CheckCircle2, KeyRound, MailCheck, Send, TimerOff } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { PasswordStrength } from "@/components/admin/account/security"
import { TextField } from "@/components/common/form-fields"
import { AuthLayout } from "@/components/shell/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { adminAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { accountApi } from "@/lib/api/platform/account"

const MIN = 10
const STAFF_DOMAIN = "healthx.life"

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email")
    .email("Enter a valid email address")
    .refine((v) => v.toLowerCase().endsWith(`@${STAFF_DOMAIN}`), `Use your @${STAFF_DOMAIN} staff email`),
})
type EmailValues = z.infer<typeof emailSchema>

const resetSchema = z
  .object({
    password: z
      .string()
      .min(MIN, `Use at least ${MIN} characters`)
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letters and at least one number"),
    confirm: z.string().min(1, "Repeat the new password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
type ResetValues = z.infer<typeof resetSchema>

function Header({ icon: Icon, title, text }: { icon: typeof KeyRound; title: string; text: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

const BackToSignIn = () => (
  <Link href="/admin-portal/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="size-4" /> Back to sign in
  </Link>
)

/** Step 1–2: ask for the staff email, then confirm the link was sent. */
function RequestLink() {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const form = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async (email: string) => {
    setBusy(true)
    setError(null)
    try {
      await adminAuthApi.forgotPassword({ email: email.trim().toLowerCase() })
      setSentTo(email.trim().toLowerCase())
      setCooldown(30)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-6">
        <Header
          icon={MailCheck}
          title="Check your inbox"
          text={
            <>
              If <span className="font-medium text-foreground">{sentTo}</span> belongs to a HealthX admin account, we&apos;ve sent a link to reset the password. It expires in 30 minutes.
            </>
          }
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          {env.useMock ? (
            <Button className="h-10 w-full" onClick={() => router.push("/admin-portal/forgot-password?token=demo-reset-token")}>
              <KeyRound data-icon="inline-start" /> Open the reset link (demo)
            </Button>
          ) : null}
          <Button variant="outline" className="h-10 w-full" disabled={busy || cooldown > 0} onClick={() => send(sentTo)}>
            {busy ? <Spinner /> : <Send data-icon="inline-start" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
          </Button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <BackToSignIn />
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSentTo(null)}>
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header icon={KeyRound} title="Reset your password" text="Enter your HealthX staff email and we'll send you a link to choose a new password." />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form noValidate onSubmit={form.handleSubmit((v) => send(v.email))} className="space-y-4">
        <TextField control={form.control} name="email" label="Work email" type="email" placeholder={`name@${STAFF_DOMAIN}`} autoComplete="email" />
        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy ? <Spinner /> : <Send data-icon="inline-start" />}
          Send reset link
        </Button>
      </form>
      <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">For security we don&apos;t say whether an account exists. Lost access to your authenticator app too? Ask another Super Admin to reset your two-step verification.</p>
      <BackToSignIn />
    </div>
  )
}

/** Step 3–4: choose a new password from the emailed link. */
function ChooseNewPassword({ token }: { token: string }) {
  const router = useRouter()
  const check = useApiQuery(["admin", "reset-token", token], () => accountApi.checkResetToken({ token }), { retry: false })
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const password = useWatch({ control: form.control, name: "password" })

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true)
    setError(null)
    try {
      await accountApi.resetPassword({ token, password: v.password })
      setDone(true)
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors?.password) form.setError("password", { message: e.fieldErrors.password })
      else setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  })

  if (check.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (check.error) {
    return (
      <div className="space-y-6">
        <Header icon={TimerOff} title="This link has expired" text={errorMessage(check.error)} />
        <Button className="h-10 w-full" onClick={() => router.push("/admin-portal/forgot-password")}>
          <Send data-icon="inline-start" /> Send a new link
        </Button>
        <BackToSignIn />
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-6">
        <Header icon={CheckCircle2} title="Password updated" text="You can now sign in with your new password and a code from your authenticator app. Other devices were signed out." />
        <Button asChild className="h-10 w-full">
          <Link href="/admin-portal/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header icon={KeyRound} title="Choose a new password" text={<>For {check.data?.email}. Use something you don&apos;t use anywhere else.</>} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <TextField control={form.control} name="password" label="New password" type="password" autoComplete="new-password" />
          <PasswordStrength password={password} min={MIN} />
        </div>
        <TextField control={form.control} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" />
        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy ? <Spinner /> : <KeyRound data-icon="inline-start" />}
          Update password
        </Button>
      </form>
      <BackToSignIn />
    </div>
  )
}

function ForgotPasswordFlow() {
  const token = useSearchParams().get("token")
  return token ? <ChooseNewPassword token={token} /> : <RequestLink />
}

export default function AdminForgotPasswordPage() {
  return (
    <AuthLayout
      productLabel="Platform Admin"
      headline="Run the HealthX platform for every customer."
      points={["Onboard companies and manage subscriptions", "Curate challenges, rewards, workouts and habits", "Monitor platform KPIs, usage and audit trails"]}
      accent="from-slate-800 via-slate-900 to-emerald-900"
    >
      <Suspense>
        <ForgotPasswordFlow />
      </Suspense>
    </AuthLayout>
  )
}
