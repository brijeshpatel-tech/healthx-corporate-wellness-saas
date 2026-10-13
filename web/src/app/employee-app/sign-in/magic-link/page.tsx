"use client"

import { ArrowLeft, ExternalLink, Link2, MailCheck, RotateCw } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"

const RESEND_AFTER_MS = 60_000
const maskEmail = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_, a: string, mid: string, b: string) => `${a}${"•".repeat(Math.min(6, mid.length))}${b}`)

/** SCR-M-009 Magic Link — request a link, then the "link sent" state. */
function MagicLink() {
  const params = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [touched, setTouched] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const valid = /^\S+@\S+\.\S+$/.test(email.trim())

  useEffect(() => {
    if (!sentAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sentAt])

  const send = async () => {
    setTouched(true)
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await employeeAuthApi.sendMagicLink({ email: email.trim() })
      const t = Date.now()
      setSentAt(t)
      setNow(t)
      if (sentAt) toast.success("We sent you a new link")
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (sentAt) {
    const wait = Math.max(0, sentAt + RESEND_AFTER_MS - now)
    const demoHref = `/employee-app/sign-in/magic-link/verify?email=${encodeURIComponent(email.trim())}&token=ml-${sentAt.toString(36)}`
    return (
      <div className="flex flex-1 flex-col gap-7">
        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <span className="relative flex size-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/30 animate-in duration-500 zoom-in-75">
            <MailCheck className="size-11" />
            <span className="absolute -top-1 -right-1 size-5 rounded-full border-4 border-background bg-emerald-500" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a sign-in link to <span className="font-semibold text-foreground">{maskEmail(email.trim())}</span>. Tap it on this device within 15 minutes to sign in. The link works once.
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Button asChild className="h-12 text-base">
            <a href="mailto:">
              <ExternalLink data-icon="inline-start" /> Open email app
            </a>
          </Button>
          {env.useMock ? (
            <Button variant="secondary" className="h-11" onClick={() => router.push(demoHref)}>
              <Link2 data-icon="inline-start" /> Open the link (demo)
            </Button>
          ) : null}
          <Button variant="outline" className="h-11" onClick={send} disabled={busy || wait > 0}>
            {busy ? <Spinner /> : <RotateCw data-icon="inline-start" />}
            {wait > 0 ? `Resend link in ${Math.ceil(wait / 1000)}s` : "Resend link"}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Can&apos;t find it? Check your spam or promotions folder.</p>
        <div className="mt-auto flex justify-between text-sm">
          <button type="button" onClick={() => setSentAt(null)} className="font-medium text-muted-foreground hover:text-foreground">
            Change email
          </button>
          <Link href="/employee-app/sign-in" className="font-medium text-primary hover:underline">
            Use another method
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="space-y-3">
        <Link href="/employee-app/sign-in" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
          <Link2 className="size-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Email me a sign-in link</h1>
        <p className="text-muted-foreground">No password needed — we&apos;ll email you a link that signs you in.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="space-y-4"
        noValidate
      >
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} placeholder="you@company.com" className="h-11 text-base" aria-invalid={touched && !valid} autoFocus />
          {touched && !valid ? <p className="text-xs font-medium text-destructive">Enter a valid email address.</p> : null}
        </div>
        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
          {busy ? <Spinner /> : null} Send link
        </Button>
      </form>
      <Button asChild variant="ghost" className="text-muted-foreground">
        <Link href="/employee-app/sign-in">Use another method</Link>
      </Button>
      {env.useMock ? (
        <p className="mt-auto rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          Demo: use{" "}
          <button type="button" className="font-mono font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => setEmail("priya.sharma@nimbustech.in")}>
            priya.sharma@nimbustech.in
          </button>
        </p>
      ) : null}
    </div>
  )
}

export default function MagicLinkPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <MagicLink />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
