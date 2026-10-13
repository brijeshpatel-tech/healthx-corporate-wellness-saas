"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, MailCheck, Send } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { AuthLayout } from "@/components/shell/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { businessAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"

const schema = z.object({ email: z.string().trim().min(1, "Enter your work email").email("Enter a valid email address") })
type Values = z.infer<typeof schema>

const RESEND_SECONDS = 30

/** SCR-B-003 — Forgot password (step 1: request a reset link). */
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const send = async (email: string) => {
    setBusy(true)
    setError(null)
    try {
      await businessAuthApi.forgotPassword({ email })
      setSentTo(email)
      setCooldown(RESEND_SECONDS)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      productLabel="Business Portal"
      headline="Locked out? We'll get you back in."
      points={["Reset links expire after 30 minutes", "Resetting signs you out on other devices", "Two-step verification stays switched on"]}
    >
      {sentTo ? (
        <div className="space-y-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{sentTo}</span> belongs to a company administrator, you&apos;ll get a link to reset your password in the next few minutes. The link works for 30 minutes.
            </p>
          </div>
          {env.useMock ? (
            <div className="space-y-2 rounded-xl border border-dashed bg-muted/30 p-3.5 text-sm">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo · no email is sent</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/business-portal/reset-password?token=demo-reset">Open the reset link</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/business-portal/reset-password?token=expired">Try an expired link</Link>
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <Button variant="outline" className="h-10 w-full" disabled={busy || cooldown > 0} onClick={() => send(sentTo)}>
              {busy ? <Spinner /> : <Send data-icon="inline-start" />}
              {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Wrong address?{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSentTo(null)}>
                Use a different email
              </button>
            </p>
          </div>
          <BackToSignIn />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Enter the work email you use for the Business Portal and we&apos;ll send you a secure reset link.</p>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={form.handleSubmit((v) => send(v.email))} className="space-y-4" noValidate>
            <TextField control={form.control} name="email" label="Work email" type="email" placeholder="name@company.com" autoComplete="email" />
            <Button type="submit" className="h-10 w-full" disabled={busy}>
              {busy ? <Spinner /> : <Send data-icon="inline-start" />}
              Send reset link
            </Button>
          </form>
          <BackToSignIn />
        </div>
      )}
    </AuthLayout>
  )
}

function BackToSignIn() {
  return (
    <Link href="/business-portal/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Back to sign in
    </Link>
  )
}
