"use client"

import { ArrowRight, Building2, Mail, Ticket } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { DEMO_INVITE_TOKEN } from "@/lib/mock/demo-accounts"

/** SCR-M-003 Company Identification — company code or work email. */
export default function WelcomePage() {
  const router = useRouter()
  const setPendingCompany = useAuthStore((s) => s.setPendingCompany)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const company = await employeeAuthApi.identifyCompany({ query })
      setPendingCompany({ id: company.id, name: company.name, code: company.code })
      router.push(`/employee-app/sign-in${query.includes("@") ? `?email=${encodeURIComponent(query.trim())}` : ""}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <EmployeeAuthLayout>
      <div className="flex flex-1 flex-col gap-8">
        <div className="space-y-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Building2 className="size-7" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Find your company</h1>
          <p className="text-muted-foreground">Enter the company code from your invitation, or your work email address.</p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="company">Company code or work email</Label>
            <Input id="company" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. NIMBUS or you@company.com" className="h-11 text-base" autoFocus autoComplete="email" />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={busy || !query.trim()}>
            {busy ? <Spinner /> : null}
            Continue
            {!busy ? <ArrowRight data-icon="inline-end" /> : null}
          </Button>
        </form>

        <div className="grid gap-2">
          <Button asChild variant="outline" className="h-11 justify-start">
            <Link href={`/employee-app/invite${env.useMock ? `?token=${DEMO_INVITE_TOKEN}` : ""}`}>
              <Ticket data-icon="inline-start" /> I have an invitation link
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 justify-start text-muted-foreground">
            <Link href="/employee-app/help">
              <Mail data-icon="inline-start" /> I can&apos;t find my company
            </Link>
          </Button>
        </div>

        {env.useMock ? (
          <p className="mt-auto rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Demo: type <button type="button" className="font-mono font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => setQuery("NIMBUS")}>NIMBUS</button> or an email ending in{" "}
            <span className="font-mono">@nimbustech.in</span>.
          </p>
        ) : null}
      </div>
    </EmployeeAuthLayout>
  )
}
