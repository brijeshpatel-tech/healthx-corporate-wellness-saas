"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Building2, MailX, ShieldCheck, UserCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { adminPasswordSchema, PasswordField } from "@/components/business/people/password-field"
import { CheckboxField, TextField } from "@/components/common/form-fields"
import { EmptyState } from "@/components/common/states"
import { AuthLayout } from "@/components/shell/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { adminsApi, type AdminInvitation } from "@/lib/api/business/admins"
import { ApiError } from "@/lib/api/core"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"
import { BUSINESS_ROLE_LABEL } from "@/lib/types"

const schema = z
  .object({
    fullName: z.string().trim().min(3, "Enter your full name").refine((v) => v.split(/\s+/).length >= 2, "Enter your first and last name"),
    password: adminPasswordSchema,
    confirm: z.string().min(1, "Re-enter your password"),
    acceptTerms: z.boolean().refine((v) => v, "Accept the Terms of Use and Privacy Policy to continue"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
type Values = z.infer<typeof schema>

const ROLE_SUMMARY: Record<string, string> = {
  company_owner: "Full control of your company's HealthX workspace — people, settings, branding, rewards and billing.",
  hr_admin: "Manage employees, departments and teams, run challenges and announcements, and see company analytics.",
  wellness_manager: "Create challenges, programmes and wellness content, and see aggregated participation.",
}

function AcceptInvite() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const invitation = useApiQuery(["public", "admin-invitation", token], () => adminsApi.getInvitation({ token }), { enabled: !!token, retry: false })

  if (!token) return <InvalidInvite message="This invitation link is incomplete. Open the link from your invitation email again." />
  if (invitation.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    )
  }
  if (invitation.error || !invitation.data) return <InvalidInvite message={errorMessage(invitation.error)} />
  return <SetupForm invitation={invitation.data} />
}

function InvalidInvite({ message }: { message: string }) {
  return (
    <EmptyState
      icon={MailX}
      title="We can't use this invitation"
      description={message}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/business-portal/login">Go to sign in</Link>
          </Button>
          <Button asChild variant="ghost">
            <a href="mailto:support@healthx.life">Contact HealthX support</a>
          </Button>
        </div>
      }
      className="border-0 bg-transparent p-0"
    />
  )
}

function SetupForm({ invitation }: { invitation: AdminInvitation }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"form" | "google" | "microsoft" | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { fullName: invitation.name, password: "", confirm: "", acceptTerms: false }, mode: "onTouched" })

  useEffect(() => {
    form.reset({ fullName: invitation.name, password: "", confirm: "", acceptTerms: false })
  }, [invitation.name, form])

  const finish = async (input: { fullName: string; password: string; acceptTerms: boolean }, via: "form" | "google" | "microsoft") => {
    setBusy(via)
    setError(null)
    try {
      const session = await adminsApi.acceptInvitation({ token: invitation.token, ...input })
      setSession("business", session)
      queryClient.clear()
      toast.success(`Welcome to ${invitation.companyName}`, { description: `You're signed in as ${BUSINESS_ROLE_LABEL[session.role]}.` })
      router.replace(HOME_PATH.business)
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) Object.entries(e.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  const sso = (provider: "google" | "microsoft") => {
    if (!form.getValues("acceptTerms")) {
      form.setError("acceptTerms", { message: "Accept the Terms of Use and Privacy Policy to continue" })
      return
    }
    // The identity provider handles the password; the demo generates a strong one.
    void finish({ fullName: form.getValues("fullName") || invitation.name, password: `Sso!${crypto.randomUUID().slice(0, 12)}9`, acceptTerms: true }, provider)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Set up your account</h1>
        <p className="text-sm text-muted-foreground">{invitation.invitedBy} invited you to manage wellness at {invitation.companyName}.</p>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{invitation.companyName}</p>
              <Badge variant="secondary">{BUSINESS_ROLE_LABEL[invitation.role]}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_SUMMARY[invitation.role]}</p>
          </div>
        </div>
        {invitation.expiresAt ? <p className="text-xs text-muted-foreground">Invitation valid until {formatDate(invitation.expiresAt)}.</p> : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={form.handleSubmit((v) => finish(v, "form"))} className="space-y-4" noValidate>
        <TextField control={form.control} name="fullName" label="Full name" autoComplete="name" required />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-email" className="text-sm font-medium">
            Work email
          </Label>
          <Input id="invite-email" value={invitation.email} readOnly disabled className="h-9" />
        </div>
        <PasswordField control={form.control} name="password" label="Password" showStrength required />
        <PasswordField control={form.control} name="confirm" label="Confirm password" required />
        <CheckboxField
          control={form.control}
          name="acceptTerms"
          label={
            <>
              I accept the{" "}
              <a href="https://healthx.life/terms" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                Terms of Use
              </a>{" "}
              and{" "}
              <a href="https://healthx.life/privacy" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                Privacy Policy
              </a>
            </>
          }
        />
        <Button type="submit" className="h-10 w-full" disabled={!!busy}>
          {busy === "form" ? <Spinner /> : <UserCheck data-icon="inline-start" />}
          Create account
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" /> or <Separator className="flex-1" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-10" disabled={!!busy} onClick={() => sso("google")}>
          {busy === "google" ? <Spinner /> : <GoogleMark />}
          Continue with Google
        </Button>
        <Button type="button" variant="outline" className="h-10" disabled={!!busy} onClick={() => sso("microsoft")}>
          {busy === "microsoft" ? <Spinner /> : <MicrosoftMark />}
          Continue with Microsoft
        </Button>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Two-step verification is required for administrators. You&apos;ll get a code by email each time you sign in from a new device.
      </p>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.2 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  )
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  )
}

/** SCR-B-004 — Accept admin invitation (account set-up). */
export default function AcceptInvitePage() {
  return (
    <AuthLayout
      productLabel="Business Portal"
      headline="Welcome aboard — let's set up your admin account."
      points={["See participation across your company, never individual health data", "Launch challenges, rewards and announcements", "Your account is protected with two-step verification"]}
    >
      <Suspense fallback={<Spinner className="mx-auto size-6 text-primary" />}>
        <AcceptInvite />
      </Suspense>
    </AuthLayout>
  )
}
