"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Link2, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore, type EmployeeSession } from "@/lib/auth/session"
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/mock/demo-accounts"

const schema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

/** SCR-M-004 Sign-in Options + SCR-M-006 Email sign-in + SCR-M-010 Google / Microsoft. */
function SignIn() {
  const router = useRouter()
  const params = useSearchParams()
  const pending = useAuthStore((s) => s.pendingCompany)
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: params.get("email") ?? "", password: "" } })

  const finish = (session: EmployeeSession) => {
    setSession("employee", session)
    const next = params.get("next")
    if (!session.onboardingCompleted) router.replace("/employee-app/onboarding/profile")
    else router.replace(next?.startsWith("/employee-app") ? next : HOME_PATH.employee)
  }

  const run = async (key: string, fn: () => Promise<EmployeeSession>) => {
    setBusy(key)
    setError(null)
    try {
      finish(await fn())
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  const onSubmit = form.handleSubmit((v) => run("email", () => employeeAuthApi.emailLogin({ ...v, companyId: pending?.id })))

  return (
    <EmployeeAuthLayout>
      <div className="flex flex-1 flex-col gap-6">
        <div className="space-y-3">
          {pending ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500 text-sm font-bold text-white">{pending.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <p className="text-sm font-semibold">{pending.name}</p>
                  <p className="text-xs text-muted-foreground">Code {pending.code}</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/employee-app/welcome">Change</Link>
              </Button>
            </div>
          ) : null}
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to track your wellness and join challenges.</p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2.5">
          <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => run("google", () => employeeAuthApi.oauth({ provider: "google" }))}>
            {busy === "google" ? <Spinner /> : <GoogleIcon />} Continue with Google
          </Button>
          <Button variant="outline" className="h-11" disabled={!!busy} onClick={() => run("microsoft", () => employeeAuthApi.oauth({ provider: "microsoft" }))}>
            {busy === "microsoft" ? <Spinner /> : <MicrosoftIcon />} Continue with Microsoft
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Separator className="flex-1" /> or with email <Separator className="flex-1" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField control={form.control} name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" />
          <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" placeholder="••••••••" />
          <div className="flex justify-end">
            <Link href="/employee-app/forgot-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!!busy}>
            {busy === "email" ? <Spinner /> : null}
            Sign in
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="secondary" className="h-10">
            <Link href="/employee-app/sign-in/phone">
              <Smartphone data-icon="inline-start" /> Phone OTP
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-10">
            <Link href="/employee-app/sign-in/magic-link">
              <Link2 data-icon="inline-start" /> Email me a link
            </Link>
          </Button>
        </div>

        {env.useMock ? (
          <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo accounts · tap to fill</p>
            {DEMO_ACCOUNTS.employee.slice(0, 2).map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  form.setValue("email", a.email)
                  form.setValue("password", DEMO_PASSWORD)
                }}
                className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm hover:border-primary/40"
              >
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.label}</span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground">
              New joiner? Use <Link href="/employee-app/welcome" className="font-medium text-primary">I have an invitation link</Link> to try onboarding.
            </p>
          </div>
        ) : null}
      </div>
    </EmployeeAuthLayout>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  )
}
