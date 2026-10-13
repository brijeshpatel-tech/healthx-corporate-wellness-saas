"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import type { MfaChallenge } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore, type Portal, type SessionMap } from "@/lib/auth/session"
import { DEMO_CODE, DEMO_PASSWORD } from "@/lib/mock/demo-accounts"

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})
type Values = z.infer<typeof schema>

/** Two-step sign-in (password → 6-digit code) for the Admin and Business portals. */
export function StaffLogin<P extends Extract<Portal, "admin" | "business">>({
  portal,
  title,
  subtitle,
  login,
  verify,
  demoAccounts,
  forgotHref,
  footer,
}: {
  portal: P
  title: string
  subtitle: string
  login: (input: Values) => Promise<MfaChallenge>
  verify: (input: { challengeId: string; code: string }) => Promise<SessionMap[P]>
  demoAccounts: { email: string; name: string; label: string }[]
  forgotHref?: string
  footer?: React.ReactNode
}) {
  const router = useRouter()
  const params = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  const onSubmit = form.handleSubmit(async (values) => {
    setBusy(true)
    setError(null)
    try {
      setChallenge(await login(values))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  })

  const onVerify = async (value = code) => {
    if (!challenge || value.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const session = await verify({ challengeId: challenge.challengeId, code: value })
      setSession(portal, session)
      const next = params.get("next")
      router.replace(next && next.startsWith(`/${portal === "admin" ? "admin-portal" : "business-portal"}`) ? next : HOME_PATH[portal])
    } catch (e) {
      setError(errorMessage(e))
      setCode("")
      setBusy(false)
    }
  }

  if (challenge) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Two-step verification</h1>
          <p className="text-sm text-muted-foreground">
            {challenge.method === "authenticator" ? "Enter the 6-digit code from your authenticator app." : `We sent a 6-digit code to ${challenge.maskedDestination}.`}
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (v.length === 6) void onVerify(v)
            }}
            autoFocus
            disabled={busy}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className="size-11 text-lg" />
              <InputOTPSlot index={1} className="size-11 text-lg" />
              <InputOTPSlot index={2} className="size-11 text-lg" />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} className="size-11 text-lg" />
              <InputOTPSlot index={4} className="size-11 text-lg" />
              <InputOTPSlot index={5} className="size-11 text-lg" />
            </InputOTPGroup>
          </InputOTP>
          {env.useMock ? (
            <p className="text-xs text-muted-foreground">
              Demo: use <span className="font-mono font-semibold text-foreground">{DEMO_CODE}</span> (or any 6 digits).
            </p>
          ) : null}
        </div>
        <Button className="h-10 w-full" disabled={busy || code.length !== 6} onClick={() => onVerify()}>
          {busy ? <Spinner /> : null}
          Verify and sign in
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setChallenge(null); setCode(""); setError(null) }}>
            <ArrowLeft className="size-4" /> Back
          </button>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => onSubmit()}>
            Resend code
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField control={form.control} name="email" label="Work email" type="email" placeholder="name@company.com" autoComplete="email" />
        <div className="space-y-1.5">
          <div className="relative">
            <TextField control={form.control} name="password" label="Password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-[30px] right-2.5 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {forgotHref ? (
            <div className="text-right">
              <Link href={forgotHref} className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          ) : null}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy ? <Spinner /> : <KeyRound data-icon="inline-start" />}
          Continue
        </Button>
      </form>

      {env.useMock ? (
        <div className="space-y-2.5 rounded-xl border border-dashed bg-muted/30 p-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo accounts · tap to fill</p>
          <div className="grid gap-1.5">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  form.setValue("email", a.email, { shouldValidate: true })
                  form.setValue("password", DEMO_PASSWORD, { shouldValidate: true })
                }}
                className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.email}</span>
                </span>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{a.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Password: <span className="font-mono">{DEMO_PASSWORD}</span> · Code: <span className="font-mono">{DEMO_CODE}</span>
          </p>
        </div>
      ) : null}
      {footer}
    </div>
  )
}
