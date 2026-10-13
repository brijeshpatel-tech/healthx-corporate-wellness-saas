"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, CheckCircle2, KeyRound, TimerOff } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { adminPasswordSchema, PasswordField } from "@/components/business/people/password-field"
import { EmptyState } from "@/components/common/states"
import { AuthLayout } from "@/components/shell/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { businessAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { errorMessage } from "@/lib/api/hooks"

const schema = z
  .object({ password: adminPasswordSchema, confirm: z.string().min(1, "Re-enter your new password") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
type Values = z.infer<typeof schema>

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" }, mode: "onTouched" })

  if (!token || token === "expired") {
    return (
      <EmptyState
        icon={TimerOff}
        title={token ? "This reset link has expired." : "This reset link isn't valid."}
        description="Reset links work once and expire after 30 minutes. Request a new one and use the latest email."
        action={
          <Button asChild>
            <Link href="/business-portal/forgot-password">Request a new link</Link>
          </Button>
        }
        className="border-0 bg-transparent p-0"
      />
    )
  }

  if (done) {
    return (
      <div className="space-y-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Password updated</h1>
          <p className="text-sm text-muted-foreground">Password updated. Please sign in. For your security we signed you out on all other devices.</p>
        </div>
        <Button asChild className="h-10 w-full">
          <Link href="/business-portal/login">Go to sign in</Link>
        </Button>
      </div>
    )
  }

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true)
    setError(null)
    try {
      await businessAuthApi.resetPassword({ token, password: v.password })
      setDone(true)
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors?.password) form.setError("password", { message: e.fieldErrors.password })
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Administrators can see company-wide data, so we ask for a strong password.</p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <PasswordField control={form.control} name="password" label="New password" showStrength required />
        <PasswordField control={form.control} name="confirm" label="Confirm new password" required />
        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy ? <Spinner /> : <KeyRound data-icon="inline-start" />}
          Save password
        </Button>
      </form>
      <Link href="/business-portal/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </div>
  )
}

/** SCR-B-003 — Reset password (step 2: from the email link). */
export default function ResetPasswordPage() {
  return (
    <AuthLayout
      productLabel="Business Portal"
      headline="A fresh start for your account."
      points={["Minimum 10 characters with letters, numbers and a symbol", "Other sessions are signed out automatically", "Reach out to HealthX support if you need help"]}
    >
      <Suspense fallback={<Spinner className="mx-auto size-6 text-primary" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  )
}
