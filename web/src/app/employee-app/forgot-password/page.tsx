"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, CheckCircle2, KeyRound, Link2, MailCheck, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { PASSWORD_RULE, PasswordStrength } from "@/components/employee/track/password-strength"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { accountApi } from "@/lib/api/employee/onboarding"
import { errorMessage } from "@/lib/api/hooks"

const emailSchema = z.object({ email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address") })
const resetSchema = z
  .object({
    password: z.string().regex(PASSWORD_RULE, "Use at least 8 characters with letters and numbers"),
    confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })

/** SCR-M-011 Forgot / Reset Password. Step 2 opens from the emailed link (?token=). */
function ForgotPassword() {
  const token = useSearchParams().get("token")
  return token ? <ResetStep token={token} /> : <RequestStep />
}

function RequestStep() {
  const router = useRouter()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } })
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      await employeeAuthApi.forgotPassword({ email: v.email })
      setSentTo(v.email)
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  if (sentTo)
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/25 animate-in duration-500 zoom-in-75">
            <MailCheck className="size-10" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">If an account exists for {sentTo}, we&apos;ve sent a reset link. It&apos;s valid for 30 minutes.</p>
        </div>
        {env.useMock ? (
          <Button variant="secondary" className="h-11" onClick={() => router.push(`/employee-app/forgot-password?token=rst-${Date.now().toString(36)}`)}>
            <Link2 data-icon="inline-start" /> Open the reset link (demo)
          </Button>
        ) : null}
        <Button asChild variant="outline" className="h-11">
          <Link href="/employee-app/sign-in">Back to sign in</Link>
        </Button>
        <button type="button" onClick={() => setSentTo(null)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Use a different email
        </button>
      </div>
    )

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="space-y-3">
        <Link href="/employee-app/sign-in" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <KeyRound className="size-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
        <p className="text-muted-foreground">Enter your work email and we&apos;ll send you a link to set a new one.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <TextField control={form.control} name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" />
        <Button type="submit" className="h-12 w-full text-base" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Send reset link
        </Button>
      </form>
    </div>
  )
}

function ResetStep({ token }: { token: string }) {
  const [done, setDone] = useState(false)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: "", confirm: "" } })
  const password = useWatch({ control: form.control, name: "password" })
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null)
    try {
      await accountApi.resetPassword({ token, password: v.password })
      setDone(true)
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) setExpired(true)
      else if (e instanceof ApiError && e.fieldErrors?.password) form.setError("password", { message: e.fieldErrors.password })
      else setError(errorMessage(e))
    }
  })

  if (done || expired)
    return (
      <div className="flex flex-1 flex-col items-center gap-4 pt-6 text-center">
        <span className={done ? "flex size-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 animate-in duration-500 zoom-in-50" : "flex size-20 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-600"}>
          {done ? <CheckCircle2 className="size-10" /> : <TriangleAlert className="size-10" />}
        </span>
        <h1 className="text-2xl font-extrabold">{done ? "Password updated" : "Link expired"}</h1>
        <p className="text-muted-foreground">{done ? "Password updated. Please sign in. For your security we've signed you out on other devices." : "This reset link has expired. Request a new one."}</p>
        <Button asChild className="mt-4 h-11 w-full">
          <Link href={done ? "/employee-app/sign-in" : "/employee-app/forgot-password"}>{done ? "Back to sign in" : "Request a new link"}</Link>
        </Button>
      </div>
    )

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="space-y-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <KeyRound className="size-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Set a new password</h1>
        <p className="text-muted-foreground">Choose a password you don&apos;t use anywhere else.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <TextField control={form.control} name="password" label="New password" type="password" autoComplete="new-password" placeholder="••••••••" />
          <PasswordStrength password={password} />
        </div>
        <TextField control={form.control} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" placeholder="••••••••" />
        <Button type="submit" className="h-12 w-full text-base" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null} Save new password
        </Button>
      </form>
      <Button asChild variant="ghost" className="text-muted-foreground">
        <Link href="/employee-app/sign-in">Back to sign in</Link>
      </Button>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <ForgotPassword />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
