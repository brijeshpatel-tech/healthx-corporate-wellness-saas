"use client"

import { CheckCircle2, LinkIcon, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore } from "@/lib/auth/session"

const VALID_MS = 15 * 60_000
const USED_KEY = "healthx.magic.used"

/** SCR-M-009 — the link from the email lands here and signs the user in. */
function ConsumeLink() {
  const params = useSearchParams()
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  const email = params.get("email") ?? ""
  const token = params.get("token") ?? ""
  const [state, setState] = useState<{ status: "working" | "done" | "error"; message?: string }>({ status: "working" })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const fail = (message: string) => setTimeout(() => setState({ status: "error", message }), 0)
    // Demo tokens encode their send time ("ml-<base36 ms>"); links work once, for 15 minutes.
    const sent = token.startsWith("ml-") ? parseInt(token.slice(3), 36) : NaN
    let used: string[] = []
    try {
      used = JSON.parse(localStorage.getItem(USED_KEY) ?? "[]") as string[]
    } catch {
      used = []
    }
    if (!email || !token || token === "expired" || used.includes(token) || (Number.isFinite(sent) && Date.now() - sent > VALID_MS)) {
      fail("This sign-in link has expired or was already used. Request a new one.")
      return
    }
    employeeAuthApi
      .consumeMagicLink({ email, token })
      .then((session) => {
        try {
          localStorage.setItem(USED_KEY, JSON.stringify([...used, token].slice(-20)))
        } catch {
          // ignore
        }
        setSession("employee", session)
        setState({ status: "done" })
        setTimeout(() => router.replace(session.onboardingCompleted ? HOME_PATH.employee : "/employee-app/onboarding"), 900)
      })
      .catch((e: unknown) => setState({ status: "error", message: errorMessage(e) }))
  }, [email, token, router, setSession])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      {state.status === "working" ? (
        <>
          <span className="flex size-20 items-center justify-center rounded-3xl bg-muted">
            <Spinner className="size-8 text-primary" />
          </span>
          <h1 className="text-2xl font-extrabold">Signing you in…</h1>
          <p className="text-muted-foreground">Checking your sign-in link.</p>
        </>
      ) : state.status === "done" ? (
        <>
          <span className="flex size-20 items-center justify-center rounded-3xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 animate-in duration-500 zoom-in-50">
            <CheckCircle2 className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold">You&apos;re signed in</h1>
          <p className="text-muted-foreground">Taking you to HealthX…</p>
        </>
      ) : (
        <>
          <span className="flex size-20 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-600">
            <TriangleAlert className="size-10" />
          </span>
          <h1 className="text-2xl font-extrabold">Link not valid</h1>
          <p className="text-muted-foreground">{state.message}</p>
          <div className="mt-4 grid w-full gap-2">
            <Button asChild className="h-11">
              <Link href={`/employee-app/sign-in/magic-link${email ? `?email=${encodeURIComponent(email)}` : ""}`}>
                <LinkIcon data-icon="inline-start" /> Request a new link
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/employee-app/sign-in">Use another method</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default function MagicLinkVerifyPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-60 rounded-2xl" />}>
        <ConsumeLink />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
