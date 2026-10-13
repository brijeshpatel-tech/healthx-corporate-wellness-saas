"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Laptop, LogOut, RefreshCw, Save, ShieldAlert, ShieldCheck, Smartphone, Tablet } from "lucide-react"
import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { BackupCodesDialog, MfaSetupDialog, PasswordStrength } from "@/components/admin/account/security"
import { FormSection } from "@/components/admin/form-layout"
import { FieldShell, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PageSkeleton, QueryState } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { accountApi, type AccountProfile, type AccountSession } from "@/lib/api/platform/account"
import { useAuthStore } from "@/lib/auth/session"
import { formatDate, formatRelative } from "@/lib/format"
import { PLATFORM_ROLE_LABEL } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function AccountPage() {
  const account = useApiQuery(["admin", "account"], () => accountApi.get())
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader title="My account" description="Your profile, password, two-step verification and signed-in devices." />
      <QueryState query={account} loading={<PageSkeleton kpis={0} />}>
        {(data) => (
          <div className="flex flex-col gap-8">
            <ProfileSection key={`${data.id}:${data.name}:${data.phone}:${data.jobTitle}`} data={data} />
            <PasswordSection data={data} />
            <MfaSection data={data} />
            <SessionsSection data={data} />
          </div>
        )}
      </QueryState>
    </PageContainer>
  )
}

// ─── Profile ────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || /^\+?[\d\s-]{8,16}$/.test(v), "Enter a valid phone number"),
  jobTitle: z.string().trim().max(60, "Keep it under 60 characters"),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileSection({ data }: { data: AccountProfile }) {
  const updateSession = useAuthStore((s) => s.updateSession)
  const session = useAuthStore((s) => s.sessions.admin)
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { name: data.name, phone: data.phone, jobTitle: data.jobTitle } })
  const save = useApiMutation(accountApi.updateProfile, {
    success: "Profile saved.",
    onSuccess: (p) => {
      if (session) updateSession("admin", { user: { ...session.user, name: p.name } })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof ProfileValues, { message }))
    },
  })
  const name = useWatch({ control: form.control, name: "name" })
  return (
    <FormSection
      title="Profile"
      description="How you appear in audit logs and support conversations."
      aside={
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <UserAvatar name={name || data.name} color={data.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{name || data.name}</p>
            <Badge variant="secondary" className="mt-1">
              {PLATFORM_ROLE_LABEL[data.role]}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">Member since {formatDate(data.createdAt, "MMM yyyy")}</p>
          </div>
        </div>
      }
    >
      <form id="profile-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="contents">
        <TextField control={form.control} name="name" label="Full name" required autoComplete="name" />
        <FieldShell id="account-email" label="Email" description="Ask another Super Admin to change your sign-in email.">
          <Input id="account-email" value={data.email} disabled className="h-9" />
        </FieldShell>
        <TextField control={form.control} name="phone" label="Phone" placeholder="+91 98765 43210" autoComplete="tel" />
        <TextField control={form.control} name="jobTitle" label="Job title" placeholder="Customer Success Lead" />
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" form="profile-form" disabled={!form.formState.isDirty || save.isPending}>
            {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />} Save profile
          </Button>
        </div>
      </form>
    </FormSection>
  )
}

// ─── Password ───────────────────────────────────────────────────────────

function passwordSchema(min: number) {
  return z
    .object({
      currentPassword: z.string().min(1, "Enter your current password"),
      newPassword: z
        .string()
        .min(min, `Use at least ${min} characters`)
        .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letters and at least one number"),
      confirm: z.string().min(1, "Repeat the new password"),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
}

function PasswordSection({ data }: { data: AccountProfile }) {
  const min = data.passwordMinLength
  const schema = useMemo(() => passwordSchema(min), [min])
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } })
  const newPassword = useWatch({ control: form.control, name: "newPassword" })
  const change = useApiMutation(accountApi.changePassword, {
    success: "Password updated — other devices were signed out.",
    onSuccess: () => form.reset(),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })
  return (
    <FormSection title="Password" description={`Last changed ${formatRelative(data.passwordUpdatedAt)}. Changing it signs you out on your other devices.`}>
      <form id="password-form" noValidate onSubmit={form.handleSubmit((v) => change.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword }))} className="contents">
        <TextField control={form.control} name="currentPassword" label="Current password" type="password" autoComplete="current-password" required className="sm:col-span-2" description="Demo: the current password is Demo@1234 until you change it." />
        <div className="space-y-2">
          <TextField control={form.control} name="newPassword" label="New password" type="password" autoComplete="new-password" required />
          <PasswordStrength password={newPassword} min={min} />
        </div>
        <TextField control={form.control} name="confirm" label="Confirm new password" type="password" autoComplete="new-password" required />
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" form="password-form" disabled={change.isPending}>
            {change.isPending ? <Spinner /> : <KeyRound data-icon="inline-start" />} Update password
          </Button>
        </div>
      </form>
    </FormSection>
  )
}

// ─── Two-step verification ──────────────────────────────────────────────

function MfaSection({ data }: { data: AccountProfile }) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [codesOpen, setCodesOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [password, setPassword] = useState("")
  const disable = useApiMutation(accountApi.disableMfa, { success: "Two-step verification turned off.", onSuccess: () => setDisable(false) })
  const setDisable = (open: boolean) => {
    setDisableOpen(open)
    if (!open) setPassword("")
  }
  const m = data.mfa
  return (
    <FormSection title="Two-step verification" description="A 6-digit code from your authenticator app is required at every sign-in." contentClassName="sm:grid-cols-1">
      <div className={cn("flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center", m.enabled ? "border-emerald-500/30 bg-emerald-500/6" : "border-amber-500/40 bg-amber-500/8")}>
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", m.enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}>
          {m.enabled ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{m.enabled ? "On — authenticator app" : "Off"}</p>
          <p className="text-sm text-muted-foreground">
            {m.enabled ? `Set up ${formatDate(m.enrolledAt)} · ${m.backupCodesRemaining} backup codes left` : m.required ? "Required for HealthX admins — set it up now to keep access." : "Recommended for every HealthX admin."}
          </p>
        </div>
        {!m.enabled ? (
          <Button onClick={() => setSetupOpen(true)}>
            <ShieldCheck data-icon="inline-start" /> Set up
          </Button>
        ) : null}
      </div>
      {m.enabled ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSetupOpen(true)}>
            <Smartphone data-icon="inline-start" /> Reset authenticator app
          </Button>
          <Button variant="outline" onClick={() => setCodesOpen(true)}>
            <RefreshCw data-icon="inline-start" /> Regenerate backup codes
          </Button>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDisableOpen(true)} disabled={m.required}>
            Turn off
          </Button>
          {m.required ? <p className="w-full text-xs text-muted-foreground">Turning it off isn&apos;t allowed while System configuration requires two-step verification for admins.</p> : null}
        </div>
      ) : null}

      <MfaSetupDialog open={setupOpen} onOpenChange={setSetupOpen} reset={m.enabled} />
      <BackupCodesDialog open={codesOpen} onOpenChange={setCodesOpen} />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisable}
        destructive
        title="Turn off two-step verification?"
        description={
          <span className="block space-y-3">
            <span className="block">Anyone with your password could sign in to the Platform Admin portal. This is audit-logged.</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Confirm with your password" aria-label="Password" />
          </span>
        }
        confirmLabel="Turn off"
        onConfirm={() => disable.mutate({ password })}
      />
    </FormSection>
  )
}

// ─── Sessions ───────────────────────────────────────────────────────────

const DEVICE_ICON = { desktop: Laptop, mobile: Smartphone, tablet: Tablet }

function SessionsSection({ data }: { data: AccountProfile }) {
  const [confirmAll, setConfirmAll] = useState(false)
  const [target, setTarget] = useState<AccountSession | null>(null)
  const revoke = useApiMutation(accountApi.revokeSession, { success: "Device signed out." })
  const revokeOthers = useApiMutation(accountApi.revokeOtherSessions, { success: (r) => (r.revoked ? `Signed out of ${r.revoked} other device${r.revoked === 1 ? "" : "s"}.` : "No other devices were signed in.") })
  const others = data.sessions.filter((s) => !s.current).length
  return (
    <FormSection
      title="Where you're signed in"
      description="Sign out any device you don't recognise, then change your password."
      contentClassName="sm:grid-cols-1 p-0 sm:p-0"
      aside={
        others > 0 ? (
          <Button variant="outline" onClick={() => setConfirmAll(true)} disabled={revokeOthers.isPending}>
            <LogOut data-icon="inline-start" /> Sign out all other devices
          </Button>
        ) : null
      }
    >
      <ul className="divide-y">
        {data.sessions.map((s) => {
          const Icon = DEVICE_ICON[s.device]
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.browser} on {s.os}
                  {s.current ? <Badge className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">This device</Badge> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.location} · {s.ip} · {s.current ? "Active now" : `Last active ${formatRelative(s.lastActiveAt)}`}
                </p>
              </div>
              {!s.current ? (
                <Button variant="ghost" size="sm" onClick={() => setTarget(s)} disabled={revoke.isPending}>
                  Sign out
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {others === 0 ? (
        <Card className="m-4 border-dashed py-0 shadow-none sm:m-6">
          <CardContent className="p-3 text-center text-xs text-muted-foreground">You&apos;re only signed in on this device.</CardContent>
        </Card>
      ) : null}
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        destructive
        title="Sign out of all other devices?"
        description={`${others} other session${others === 1 ? "" : "s"} will be ended. You'll stay signed in here.`}
        confirmLabel="Sign out others"
        onConfirm={() => revokeOthers.mutate()}
      />
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Sign out ${target?.browser} on ${target?.os}?`}
        description="That device will need your password and a verification code to sign in again."
        confirmLabel="Sign out"
        onConfirm={() => {
          if (target) revoke.mutate({ id: target.id })
          setTarget(null)
        }}
      />
    </FormSection>
  )
}
