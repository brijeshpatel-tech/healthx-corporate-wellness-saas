"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, FileText, LogOut, ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { ErrorState } from "@/components/common/states"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { employeeAuthApi } from "@/lib/api/auth"
import { legalApi, type LegalDocs } from "@/lib/api/employee/onboarding"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { HOME_PATH, LOGIN_PATH, useAuthStore, useSession } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"

/** SCR-M-012 Terms & Privacy Acceptance. */
function Terms() {
  const q = useApiQuery(["employee", "legal"], () => legalApi.current())
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  return <TermsForm docs={q.data} />
}

function TermsForm({ docs }: { docs: LegalDocs }) {
  const router = useRouter()
  const params = useSearchParams()
  const session = useSession("employee")
  const clearSession = useAuthStore((s) => s.clearSession)
  const queryClient = useQueryClient()
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [reading, setReading] = useState<"terms" | "privacy" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const next = () => {
    const n = params.get("next")
    if (n?.startsWith("/employee-app")) return n
    return session?.onboardingCompleted ? HOME_PATH.employee : "/employee-app/onboarding/profile"
  }
  const accept = useApiMutation(legalApi.accept, {
    errorTitle: "We couldn't record your acceptance. Please try again.",
    onSuccess: () => router.replace(next()),
    onError: () => setError("We couldn't record your acceptance. Please try again."),
  })

  const signOut = async () => {
    try {
      await employeeAuthApi.logout()
    } catch {
      // local sign-out is enough
    }
    clearSession("employee")
    queryClient.clear()
    router.replace(LOGIN_PATH.employee)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-3">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{docs.acceptedVersion ? "We've updated our terms" : "Before you start"}</h1>
        <p className="text-muted-foreground">Please review and accept the HealthX Terms of Use and Privacy Policy (version {docs.version}).</p>
      </div>

      <DocSummary title="Terms of Use" points={docs.termsSummary} onRead={() => setReading("terms")} />
      <DocSummary title="Privacy Policy" points={docs.privacySummary} onRead={() => setReading("privacy")} />

      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <Checkbox id="t" checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />
          <Label htmlFor="t" className="text-sm leading-snug font-normal">
            I accept the Terms of Use
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="p" checked={privacy} onCheckedChange={(v) => setPrivacy(v === true)} className="mt-0.5" />
          <Label htmlFor="p" className="text-sm leading-snug font-normal">
            I accept the Privacy Policy and agree that HealthX stores the wellness data I track
          </Label>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-auto grid gap-2">
        <Button
          className="h-12 text-base"
          disabled={!terms || !privacy || accept.isPending}
          onClick={() => {
            setError(null)
            accept.mutate({ version: docs.version, termsAccepted: terms, privacyAccepted: privacy, device: typeof navigator !== "undefined" ? navigator.userAgent : "web" })
          }}
        >
          {accept.isPending ? <Spinner /> : null} Accept & continue {!accept.isPending ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
        {!terms || !privacy ? <p className="text-center text-xs text-muted-foreground">Tick both boxes to continue.</p> : null}
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={signOut}>
          <LogOut data-icon="inline-start" /> Sign out
        </Button>
      </div>

      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reading === "privacy" ? "Privacy Policy" : "Terms of Use"}</DialogTitle>
            <DialogDescription>
              Version {docs.version} · published {formatDate(docs.publishedAt)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {(reading === "privacy" ? docs.privacySummary : docs.termsSummary).map((p) => (
              <p key={p}>{p}</p>
            ))}
            <p className="rounded-lg bg-muted/60 p-3 text-xs">The full legal text will be provided by the client and shown here. You can also read it online.</p>
            <a href={reading === "privacy" ? docs.privacyUrl : docs.termsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              Open the full document <ArrowRight className="size-3.5" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DocSummary({ title, points, onRead }: { title: string; points: string[]; onRead: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <FileText className="size-4 text-muted-foreground" /> {title}
        </p>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={onRead}>
          Read full document
        </Button>
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function TermsPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Terms />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
