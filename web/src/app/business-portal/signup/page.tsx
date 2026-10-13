"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Rocket } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { adminPasswordSchema, PasswordField } from "@/components/business/people/password-field"
import { CheckboxField, SelectField, TextField } from "@/components/common/form-fields"
import { PhaseBadge } from "@/components/common/status-badge"
import { AuthLayout } from "@/components/shell/auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { INDUSTRIES } from "@/lib/api/business/settings"
import { SIGNUP_SIZES, signupApi, TRIAL_DAYS } from "@/lib/api/business/signup"
import { ApiError } from "@/lib/api/core"
import { errorMessage } from "@/lib/api/hooks"
import { HOME_PATH, useAuthStore } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"

const schema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(80),
  industry: z.string().min(1, "Choose an industry"),
  companySize: z.enum(SIGNUP_SIZES, { message: "Choose a company size" }),
  firstName: z.string().trim().min(1, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
  email: z.string().trim().min(1, "Enter your work email").email("Enter a valid work email"),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a valid mobile number"),
  password: adminPasswordSchema,
  acceptTerms: z.boolean().refine((v) => v, "Accept the Terms of Use and Privacy Policy to continue"),
})
type Values = z.infer<typeof schema>

/** #353 — Self-serve sign-up with a 30-day free trial (Phase 2). */
export default function SignupPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { companyName: "", industry: "", companySize: undefined, firstName: "", lastName: "", email: "", phone: "", password: "", acceptTerms: false },
  })

  const checkDomain = async () => {
    const email = form.getValues("email")
    if (!/^\S+@\S+\.\S+$/.test(email)) return
    try {
      const r = await signupApi.checkDomain({ email })
      if (!r.available && r.message) form.setError("email", { message: r.message })
    } catch {
      // The full check runs again on submit.
    }
  }

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true)
    setError(null)
    try {
      const session = await signupApi.register({ ...v, phone: v.phone || undefined })
      const { trialEndsAt, ...rest } = session
      setSession("business", rest)
      queryClient.clear()
      toast.success(`Welcome to HealthX, ${v.firstName}!`, { description: `Your free trial runs until ${formatDate(trialEndsAt)}.` })
      router.replace(HOME_PATH.business)
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) Object.entries(e.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
      setError(errorMessage(e))
      setBusy(false)
    }
  })

  return (
    <AuthLayout
      productLabel="Business Portal"
      headline={`Try HealthX free for ${TRIAL_DAYS} days.`}
      points={["Every Growth-plan feature, no card needed", "Invite your whole team and launch a challenge today", "Privacy-first: you only ever see aggregated data"]}
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="size-5" />
            </span>
            <PhaseBadge phase={2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Start your free trial</h1>
          <p className="text-sm text-muted-foreground">Set up your company workspace in two minutes. You&apos;ll be the Company Owner.</p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <TextField control={form.control} name="companyName" label="Company name" placeholder="e.g. Acme Technologies" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="industry" label="Industry" required options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
            <SelectField control={form.control} name="companySize" label="Employees" required options={SIGNUP_SIZES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="firstName" label="First name" autoComplete="given-name" required />
            <TextField control={form.control} name="lastName" label="Last name" autoComplete="family-name" required />
          </div>
          <div onBlur={checkDomain}>
            <TextField control={form.control} name="email" label="Work email" type="email" autoComplete="email" placeholder="you@company.com" required description="Employees with this email domain can find your company." />
          </div>
          <TextField control={form.control} name="phone" label="Mobile number" placeholder="Optional" autoComplete="tel" />
          <PasswordField control={form.control} name="password" label="Password" showStrength required />
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
          <Button type="submit" className="h-10 w-full" disabled={busy}>
            {busy ? <Spinner /> : <CheckCircle2 data-icon="inline-start" />}
            Create account &amp; start trial
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already using HealthX?{" "}
          <Link href="/business-portal/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
