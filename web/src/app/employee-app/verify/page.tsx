"use client"

import { ArrowLeft, MessageSquareText, RotateCw } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { errorMessage } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore, type EmployeeSession } from "@/lib/auth/session"
import { DEMO_CODE } from "@/lib/mock/demo-accounts"

const MAX_ATTEMPTS = 5
const MAX_RESENDS = 3
const RESEND_AFTER_MS = 30_000
const EXPIRES_MS = 10 * 60_000

interface OtpMeta {
  phone: string
  sentAt: number
  resends: number
}

function readMeta(phone: string): OtpMeta {
  try {
    const raw = sessionStorage.getItem("healthx.otp")
    const m = raw ? (JSON.parse(raw) as OtpMeta) : null
    if (m && m.phone === phone) return m
  } catch {
    // ignore
  }
  return { phone, sentAt: Date.now(), resends: 0 }
}

function writeMeta(m: OtpMeta) {
  try {
    sessionStorage.setItem("healthx.otp", JSON.stringify(m))
  } catch {
    // ignore
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/** SCR-M-008 One-Time Code (OTP) Verification. */
function Verify() {
  const router = useRouter()
  const params = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)
  const phone = params.get("phone") ?? ""
  const to = params.get("to") ?? phone
  const [meta, setMeta] = useState<OtpMeta | null>(null)
  const [now, setNow] = useState(0)
  const [code, setCode] = useState("")
  const [attempts, setAttempts] = useState(MAX_ATTEMPTS)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null)

  // Clock + load the send time once on the client (avoids hydration mismatches).
  useEffect(() => {
    const tick = () => {
      setMeta((m) => m ?? readMeta(phone))
      setNow(Date.now())
    }
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [phone])

  if (!phone)
    return (
      <div className="flex flex-1 flex-col items-center gap-4 pt-8 text-center">
        <p className="text-lg font-semibold">Start by entering your mobile number</p>
        <Button asChild>
          <Link href="/employee-app/sign-in/phone">Enter number</Link>
        </Button>
      </div>
    )

  const ready = !!meta && now > 0
  const expired = ready && now - meta.sentAt > EXPIRES_MS
  const resendIn = ready ? Math.max(0, meta.sentAt + RESEND_AFTER_MS - now) : RESEND_AFTER_MS
  const locked = attempts <= 0

  const finish = (session: EmployeeSession) => {
    setSession("employee", session)
    try {
      sessionStorage.removeItem("healthx.otp")
    } catch {
      // ignore
    }
    toast.success("You're signed in")
    if (!session.onboardingCompleted) router.replace("/employee-app/onboarding")
    else {
      const next = params.get("next")
      router.replace(next?.startsWith("/employee-app") ? next : HOME_PATH.employee)
    }
  }

  const verify = async (value = code) => {
    if (value.length !== 6) return setError("Enter the 6-digit code.")
    if (expired) return setError("This code has expired. Request a new one.")
    if (locked) return setError("Too many wrong attempts. Request a new code.")
    setBusy("verify")
    setError(null)
    try {
      finish(await employeeAuthApi.verifyOtp({ phone, code: value }))
    } catch (e) {
      const left = attempts - 1
      setAttempts(left)
      setCode("")
      if (e instanceof ApiError && e.code === "validation_error") setError(left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code.")
      else setError(errorMessage(e))
      setBusy(null)
    }
  }

  const resend = async () => {
    if (!meta) return
    if (meta.resends >= MAX_RESENDS) return setError("Too many code requests. Try again later.")
    setBusy("resend")
    setError(null)
    try {
      await employeeAuthApi.sendOtp({ phone })
      const m = { phone, sentAt: Date.now(), resends: meta.resends + 1 }
      writeMeta(m)
      setMeta(m)
      setAttempts(MAX_ATTEMPTS)
      setCode("")
      toast.success(`New code sent to ${to}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <div className="space-y-3">
        <Link href="/employee-app/sign-in/phone" className="-ml-1 inline-flex items-center gap-1 rounded-md py-1 pr-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/25">
          <MessageSquareText className="size-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">Enter the code</h1>
        <p className="text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-foreground">{to}</span>.
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
            setCode(v.replace(/\D/g, ""))
            if (v.length === 6) void verify(v)
          }}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          disabled={!!busy || locked || expired}
          containerClassName="justify-center"
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="size-12 rounded-xl border text-xl font-semibold first:rounded-xl last:rounded-xl sm:size-13" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <p className="text-center text-xs text-muted-foreground">{!ready ? " " : expired ? "This code has expired. Request a new one." : `Code expires in ${mmss(meta.sentAt + EXPIRES_MS - now)}`}</p>
      </div>

      <Button className="h-12 w-full text-base" onClick={() => verify()} disabled={!!busy || code.length !== 6 || locked || expired}>
        {busy === "verify" ? <Spinner /> : null} Verify
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/employee-app/sign-in/phone" className="font-medium text-muted-foreground hover:text-foreground">
          Change number
        </Link>
        {resendIn > 0 && !expired && !locked ? (
          <span className="text-muted-foreground tabular-nums">Resend code in {mmss(resendIn)}</span>
        ) : (
          <button type="button" onClick={resend} disabled={busy === "resend"} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60">
            {busy === "resend" ? <Spinner className="size-3.5" /> : <RotateCw className="size-3.5" />} Resend code
          </button>
        )}
      </div>

      {env.useMock ? (
        <p className="mt-auto rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          Demo: use{" "}
          <button type="button" className="font-mono font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => verify(DEMO_CODE)}>
            {DEMO_CODE}
          </button>{" "}
          · <span className="font-mono">000000</span> simulates a wrong code.
        </p>
      ) : null}
    </div>
  )
}

export default function VerifyPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Verify />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
