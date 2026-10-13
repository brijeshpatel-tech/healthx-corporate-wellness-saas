"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Copy, Download, KeyRound, Laptop, LogOut, Mail, MonitorSmartphone, Save, ShieldCheck, Smartphone } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { adminPasswordSchema, PasswordField } from "@/components/business/people/password-field"
import { PseudoQr } from "@/components/business/people/pseudo-qr"
import { SwitchField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog, KeyValueList, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { env } from "@/config/env"
import { accountApi, type AccountProfile, type AccountSession } from "@/lib/api/business/account"
import { businessAuthApi } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/core"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { LOGIN_PATH, useAuthStore } from "@/lib/auth/session"
import { downloadText } from "@/lib/download"
import { formatDate, formatRelative } from "@/lib/format"
import { DEMO_PASSWORD } from "@/lib/mock/demo-accounts"
import { BUSINESS_ROLE_LABEL } from "@/lib/types"

/** SCR-B-045 — My account: profile, password, two-step verification, sessions. */
export default function MyAccountPage() {
  const q = useApiQuery(["business", "me"], () => accountApi.me())
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearSession = useAuthStore((s) => s.clearSession)
  const signOut = async () => {
    try {
      await businessAuthApi.logout()
    } catch {
      // Signing out locally is enough.
    }
    clearSession("business")
    queryClient.clear()
    router.replace(LOGIN_PATH.business)
  }

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader
        title="My account"
        description="Your own sign-in details and security. Only you can change these."
        actions={
          <Button variant="outline" onClick={signOut}>
            <LogOut data-icon="inline-start" /> Sign out
          </Button>
        }
      />
      {q.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <ProfileSection me={q.data!} />
          <PasswordSection me={q.data!} />
          <TwoStepSection me={q.data!} />
          <SessionsSection />
        </div>
      )}
    </PageContainer>
  )
}

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
  jobTitle: z.string().trim().max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a valid mobile number"),
  signInAlerts: z.boolean(),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileSection({ me }: { me: AccountProfile }) {
  const updateSession = useAuthStore((s) => s.updateSession)
  const toValues = (m: AccountProfile): ProfileValues => ({ firstName: m.firstName, lastName: m.lastName, jobTitle: m.jobTitle, phone: m.phone, signInAlerts: m.signInAlerts })
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: toValues(me) })
  useEffect(() => form.reset(toValues(me)), [me, form])
  const save = useApiMutation(accountApi.updateProfile, {
    success: "Profile saved.",
    onSuccess: (m) => {
      const session = useAuthStore.getState().sessions.business
      if (session) updateSession("business", { user: { ...session.user, name: `${m.firstName} ${m.lastName}`, jobTitle: m.jobTitle } })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof ProfileValues, { message }))
    },
  })
  return (
    <SectionCard title="Profile">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex items-center gap-4 md:w-56 md:flex-col md:items-start">
          <UserAvatar name={`${me.firstName} ${me.lastName}`} color={me.avatarColor} size="xl" />
          <KeyValueList
            columns={1}
            items={[
              { label: "Role", value: <Badge variant="secondary">{BUSINESS_ROLE_LABEL[me.role]}</Badge> },
              { label: "Company", value: me.companyName },
            ]}
          />
        </div>
        <form noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid flex-1 gap-4 sm:grid-cols-2">
          <TextField control={form.control} name="firstName" label="First name" required />
          <TextField control={form.control} name="lastName" label="Last name" required />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="acc-email" className="text-sm font-medium">
              Work email
            </Label>
            <Input id="acc-email" value={me.email} disabled className="h-9" />
            <p className="text-xs text-muted-foreground">Ask your Company Owner or HealthX to change your sign-in email.</p>
          </div>
          <TextField control={form.control} name="jobTitle" label="Job title" />
          <TextField control={form.control} name="phone" label="Mobile number" placeholder="+91 98765 43210" />
          <SwitchField control={form.control} name="signInAlerts" label="Email me about new sign-ins" description="Get an alert when your account is used on a new device." className="sm:col-span-2" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" disabled={!form.formState.isDirty} onClick={() => form.reset(toValues(me))}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
              {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
              Save
            </Button>
          </div>
        </form>
      </div>
    </SectionCard>
  )
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: adminPasswordSchema, confirm: z.string().min(1, "Re-enter the new password") })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
type PasswordValues = z.infer<typeof passwordSchema>

function PasswordSection({ me }: { me: AccountProfile }) {
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } })
  const change = useApiMutation(accountApi.changePassword, {
    success: (r) => (r.signedOut ? `Password changed. ${r.signedOut} other ${r.signedOut === 1 ? "session was" : "sessions were"} signed out.` : "Password changed."),
    onSuccess: () => form.reset(),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof PasswordValues, { message }))
    },
  })
  return (
    <SectionCard title="Password" description={me.passwordChangedAt ? `Last changed ${formatRelative(me.passwordChangedAt)}.` : "Use at least 10 characters with letters, numbers and a symbol."}>
      <form noValidate onSubmit={form.handleSubmit((v) => change.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }))} className="grid gap-4 md:grid-cols-3">
        <PasswordField
          control={form.control}
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          required
          description={env.useMock && !me.passwordChangedAt ? `Demo: ${DEMO_PASSWORD}` : undefined}
        />
        <PasswordField control={form.control} name="newPassword" label="New password" showStrength required />
        <PasswordField control={form.control} name="confirm" label="Confirm new password" required />
        <div className="flex items-center justify-between gap-2 md:col-span-3">
          <p className="text-xs text-muted-foreground">Changing your password signs you out on your other devices.</p>
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? <Spinner /> : <KeyRound data-icon="inline-start" />}
            Change password
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

function TwoStepSection({ me }: { me: AccountProfile }) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const regen = useApiMutation(accountApi.regenerateRecoveryCodes, { success: "New recovery codes generated. Old codes no longer work.", onSuccess: (r) => setCodes(r.recoveryCodes) })
  const app = me.mfa.method === "authenticator"
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          Two-step verification <Badge className="gap-1 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
            <ShieldCheck /> On
          </Badge>
        </span>
      }
      description="Required for all company administrators, because you can see company-wide data."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{app ? <Smartphone className="size-5" /> : <Mail className="size-5" />}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">{app ? "Authenticator app" : "Email code"}</p>
            <p className="text-sm text-muted-foreground">{app ? `Set up ${formatDate(me.mfa.enrolledAt)}. Codes come from your authenticator app.` : `We email a 6-digit code to ${me.email} when you sign in.`}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => setSetupOpen(true)}>
                {app ? "Move to a new phone" : "Set up authenticator app"}
              </Button>
              {app ? (
                <Button size="sm" variant="ghost" onClick={() => setEmailOpen(true)}>
                  Use email codes instead
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/14 text-amber-600 dark:text-amber-400">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">Recovery codes</p>
            <p className="text-sm text-muted-foreground">{me.mfa.recoveryCodesLeft} unused codes. Use one if you can&apos;t get a verification code.</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => setRegenOpen(true)}>
              Generate new codes
            </Button>
          </div>
        </div>
      </div>
      <AuthenticatorDialog open={setupOpen} onOpenChange={setSetupOpen} onDone={setCodes} />
      <EmailCodesDialog open={emailOpen} onOpenChange={setEmailOpen} />
      <RecoveryCodesDialog codes={codes} email={me.email} onClose={() => setCodes(null)} />
      <ConfirmDialog open={regenOpen} onOpenChange={setRegenOpen} title="Generate new recovery codes?" description="Your current recovery codes will stop working." confirmLabel="Generate codes" onConfirm={() => regen.mutate()} />
    </SectionCard>
  )
}

function AuthenticatorDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (codes: string[]) => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const start = useApiMutation(accountApi.startAuthenticatorSetup, { invalidate: false, onSuccess: setSetup, onError: (e) => setError(e.message) })
  const confirm = useApiMutation(accountApi.confirmAuthenticatorSetup, {
    success: "Authenticator app is set up.",
    onSuccess: (r) => {
      onOpenChange(false)
      onDone(r.recoveryCodes)
    },
    onError: (e) => {
      setError(e.fieldErrors?.code ?? e.message)
      setCode("")
    },
  })
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSetup(null)
      setCode("")
      setError(null)
    }
  }
  useEffect(() => {
    if (open && !setup && !start.isPending && !start.isError) start.mutate()
  }, [open, setup, start])

  const copy = async () => {
    if (!setup) return
    try {
      await navigator.clipboard.writeText(setup.secret)
      toast.success("Set-up key copied")
    } catch {
      toast.message(setup.secret)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up an authenticator app</DialogTitle>
          <DialogDescription>Scan the code with Google Authenticator, Microsoft Authenticator or a similar app, then enter the 6-digit code it shows.</DialogDescription>
        </DialogHeader>
        {!setup ? (
          <div className="flex justify-center py-6">{start.isError ? <p className="text-sm text-destructive">{error}</p> : <Skeleton className="size-44" />}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <PseudoQr value={setup.otpauthUri} />
              <div className="w-full space-y-1">
                <p className="text-xs text-muted-foreground">Can&apos;t scan? Enter this key manually:</p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <code className="flex-1 font-mono text-xs tracking-wider break-all">{setup.secret.match(/.{1,4}/g)?.join(" ")}</code>
                  <Button size="icon-xs" variant="ghost" aria-label="Copy key" onClick={copy}>
                    <Copy />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Verification code</Label>
              <InputOTP maxLength={6} value={code} onChange={(v) => {
                setCode(v)
                setError(null)
              }}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              {error ? <p className="text-xs font-medium text-destructive">{error}</p> : env.useMock ? <p className="text-xs text-muted-foreground">Demo: any 6 digits except 000000.</p> : null}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => confirm.mutate({ code })} disabled={code.length !== 6 || confirm.isPending || !setup}>
            {confirm.isPending ? <Spinner /> : <ShieldCheck data-icon="inline-start" />}
            Verify and turn on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmailCodesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const sw = useApiMutation(accountApi.useEmailCodes, {
    success: "You'll now get sign-in codes by email.",
    onSuccess: () => {
      setPassword("")
      onOpenChange(false)
    },
    onError: (e) => setError(e.fieldErrors?.password ?? errorMessage(e)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Use email codes instead?</DialogTitle>
          <DialogDescription>Email codes are less secure than an authenticator app. Confirm with your password.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="sw-pass" className="text-sm font-medium">
            Current password
          </Label>
          <Input id="sw-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9" aria-invalid={!!error} autoComplete="current-password" />
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => sw.mutate({ password })} disabled={!password || sw.isPending}>
            {sw.isPending ? <Spinner /> : null}
            Switch to email codes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RecoveryCodesDialog({ codes, email, onClose }: { codes: string[] | null; email: string; onClose: () => void }) {
  const copy = async () => {
    if (!codes) return
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      toast.success("Recovery codes copied")
    } catch {
      toast.message("Copy failed — download the codes instead.")
    }
  }
  return (
    <Dialog open={!!codes} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your recovery codes</DialogTitle>
          <DialogDescription>Each code works once. Keep them somewhere safe — we won&apos;t show them again.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 font-mono text-sm">
          {codes?.map((c) => (
            <span key={c} className="text-center tracking-wider">
              {c}
            </span>
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              <Copy data-icon="inline-start" /> Copy
            </Button>
            <Button variant="outline" onClick={() => codes && downloadText("healthx-recovery-codes.txt", `HealthX Business Portal recovery codes for ${email}\n\n${codes.join("\n")}\n`, "text/plain;charset=utf-8")}>
              <Download data-icon="inline-start" /> Download
            </Button>
          </div>
          <Button onClick={onClose}>I&apos;ve saved them</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SessionsSection() {
  const q = useApiQuery(["business", "my-sessions"], () => accountApi.sessions())
  const [confirmAll, setConfirmAll] = useState(false)
  const revoke = useApiMutation(accountApi.revokeSession, { success: "Session signed out." })
  const revokeAll = useApiMutation(accountApi.revokeOtherSessions, { success: (r) => (r.signedOut ? `Signed out ${r.signedOut} other ${r.signedOut === 1 ? "session" : "sessions"}.` : "No other sessions to sign out.") })
  const others = (q.data ?? []).filter((s) => !s.current).length
  return (
    <SectionCard
      title="Where you're signed in"
      description="Sign out of devices you don't recognise, then change your password."
      actions={
        others ? (
          <Button size="sm" variant="outline" onClick={() => setConfirmAll(true)}>
            Sign out other sessions
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-32" />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ul className="divide-y rounded-xl border">
          {q.data!.map((s) => (
            <SessionItem key={s.id} s={s} onRevoke={() => revoke.mutate({ id: s.id })} pending={revoke.isPending && revoke.variables?.id === s.id} />
          ))}
        </ul>
      )}
      <ConfirmDialog open={confirmAll} onOpenChange={setConfirmAll} title="Sign out all other sessions?" description="You'll stay signed in on this device." confirmLabel="Sign out others" onConfirm={() => revokeAll.mutate()} />
    </SectionCard>
  )
}

function SessionItem({ s, onRevoke, pending }: { s: AccountSession; onRevoke: () => void; pending: boolean }) {
  const Icon = /iphone|android|phone/i.test(s.device) ? Smartphone : /mac|laptop/i.test(s.device) ? Laptop : MonitorSmartphone
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">
            {s.browser} on {s.device}
          </p>
          {s.current ? <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">This device</Badge> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {s.location} · {s.ip} · {s.current ? "active now" : `last active ${formatRelative(s.lastActiveAt)}`}
        </p>
      </div>
      {!s.current ? (
        <Button size="sm" variant="ghost" onClick={onRevoke} disabled={pending}>
          {pending ? <Spinner /> : <LogOut data-icon="inline-start" />} Sign out
        </Button>
      ) : null}
    </li>
  )
}
