"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Building2, CalendarClock, Mail, MailX, Ticket, Users } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextField } from "@/components/common/form-fields"
import { PASSWORD_RULE, PasswordStrength } from "@/components/employee/track/password-strength"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { ApiError } from "@/lib/api/core"
import { employeeAuthApi } from "@/lib/api/auth"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"
import { DEMO_INVITE_TOKEN } from "@/lib/mock/demo-accounts"

const schema = z
  .object({
    password: z.string().regex(PASSWORD_RULE, "Use at least 8 characters with letters and numbers"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })
type Values = z.infer<typeof schema>

/** SCR-M-005 Invitation Acceptance. Token comes from the link (?token=) or is typed in. */
function Invite() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("token")?.trim() ?? ""
  const [code, setCode] = useState("")

  if (!token)
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="space-y-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <Ticket className="size-7" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Enter your invitation code</h1>
          <p className="text-muted-foreground">You&apos;ll find it in the invitation email or SMS from your company.</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) router.push(`/employee-app/invite?token=${encodeURIComponent(code.trim())}`)
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="code">Invitation code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. NIMBUS-WELCOME-2026" className="h-11 text-base uppercase" autoFocus autoCapitalize="characters" />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!code.trim()}>
            Continue <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
        {env.useMock ? (
          <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            Demo: use{" "}
            <button type="button" className="font-mono font-semibold text-foreground underline-offset-2 hover:underline" onClick={() => setCode(DEMO_INVITE_TOKEN)}>
              {DEMO_INVITE_TOKEN}
            </button>
          </p>
        ) : null}
        <Button asChild variant="ghost" className="mt-auto text-muted-foreground">
          <Link href="/employee-app/welcome">Back</Link>
        </Button>
      </div>
    )

  return <InviteDetails token={token} />
}

function InviteDetails({ token }: { token: string }) {
  const router = useRouter()
  const setSession = useAuthStore((s) => s.setSession)
  const setPendingCompany = useAuthStore((s) => s.setPendingCompany)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const q = useApiQuery(["employee", "invitation", token], () => employeeAuthApi.getInvitation({ token }), { retry: false })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } })
  const password = useWatch({ control: form.control, name: "password" })

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )

  if (q.error) {
    const expired = q.error instanceof ApiError && q.error.status === 410
    return (
      <div className="flex flex-1 flex-col items-center gap-4 pt-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-600">
          <MailX className="size-8" />
        </span>
        <h1 className="text-2xl font-extrabold">{expired ? "Invitation no longer valid" : "We couldn't find this invitation"}</h1>
        <p className="text-muted-foreground">{expired ? "This invitation has expired or was cancelled. Ask your HR team to send a new one." : "Check the link or code from your invitation email, or ask your HR team to resend it."}</p>
        <div className="mt-4 grid w-full gap-2">
          <Button asChild className="h-11">
            <Link href="/employee-app/invite">Enter a code instead</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/employee-app/welcome">Back to start</Link>
          </Button>
        </div>
      </div>
    )
  }

  const inv = q.data!
  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true)
    setError(null)
    try {
      const session = await employeeAuthApi.acceptInvitation({ token, password: v.password })
      setPendingCompany({ id: inv.company.id, name: inv.company.name, code: inv.company.code })
      setSession("employee", session)
      toast.success("Invitation accepted")
      router.replace("/employee-app/terms?next=/employee-app/onboarding/profile")
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors?.password) form.setError("password", { message: e.fieldErrors.password })
      setError(errorMessage(e))
      setBusy(false)
    }
  })

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="space-y-3">
        <span className="flex size-16 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${inv.company.branding.primaryColor}, ${inv.company.branding.accentColor})` }}>
          {inv.company.branding.logoInitials}
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Hi {inv.firstName}, you&apos;ve been invited to join {inv.company.name} on HealthX
        </h1>
        <p className="text-muted-foreground">Track your wellness, join team challenges and earn rewards from your company.</p>
      </div>

      <dl className="divide-y rounded-2xl border bg-card text-sm">
        {[
          { icon: Mail, label: "Email", value: inv.email },
          { icon: Building2, label: "Department", value: inv.department || "—" },
          { icon: Users, label: "Team", value: inv.team || "—" },
          { icon: CalendarClock, label: "Invitation expires", value: formatDate(inv.expiresAt, "d MMM yyyy") },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 px-4 py-3">
            <r.icon className="size-4 shrink-0 text-muted-foreground" />
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="ml-auto truncate font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <TextField control={form.control} name="password" label="Create a password" type="password" autoComplete="new-password" placeholder="••••••••" />
          <PasswordStrength password={password} />
        </div>
        <TextField control={form.control} name="confirm" label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" />
        <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
          {busy ? <Spinner /> : null} Accept & continue {!busy ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Not {inv.firstName}?{" "}
        <Link href="/employee-app/welcome" className="font-medium text-primary hover:underline">
          Use another account
        </Link>
      </p>
    </div>
  )
}

export default function InvitePage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Invite />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
