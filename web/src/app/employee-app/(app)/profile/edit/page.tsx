"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Camera, Contact, Info, Lock, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { useController, useForm, type Control } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FieldShell, SelectField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { UserAvatar } from "@/components/common/user-avatar"
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, fileToAvatarDataUrl } from "@/components/employee/engage/account/image"
import { FormActions, FormSection } from "@/components/employee/engage/account/rows"
import { VerifyCodeDialog } from "@/components/employee/engage/account/verify-code-dialog"
import { EngagePage, LoadError } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import {
  GENDER_OPTIONS,
  NAME_PATTERN,
  PHONE_PATTERN,
  ageOn,
  normalisePhone,
  profileApi,
  type ContactChangeRequest,
  type ContactChannel,
  type MyProfile,
  type ProfileOptions,
} from "@/lib/api/employee/profile"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(50, "Use 50 characters or fewer")
    .regex(NAME_PATTERN, "Use letters only (spaces, hyphens and apostrophes are fine)")

/** FRM-07 */
const schema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_PATTERN.test(v.replace(/\s/g, "")), "Enter a valid 10-digit mobile number"),
  gender: z.enum(["female", "male", "other", "undisclosed"]),
  dateOfBirth: z.string().refine((v) => {
    if (!v) return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) return false
    const age = ageOn(v)
    return age >= 16 && age <= 100
  }, "You must be between 16 and 100 years old"),
  locationId: z.string(),
  timezone: z.string().min(1, "Choose your time zone"),
})
type Values = z.infer<typeof schema>

/** SCR-M-070 Edit Profile – Basic Details. */
export default function EditBasicDetailsPage() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  const options = useApiQuery(["employee", "profile", "options"], () => profileApi.options(), { staleTime: 5 * 60_000 })
  const error = q.error ?? options.error
  return (
    <EngagePage size="narrow" title="Basic details" description="Your name, photo and contact details." backHref="/employee-app/profile" backLabel="Profile">
      {error ? (
        <LoadError
          title="Couldn't load your profile."
          error={error}
          onRetry={() => {
            void q.refetch()
            void options.refetch()
          }}
        />
      ) : !q.data || !options.data ? (
        <FormSkeleton />
      ) : (
        <EditForm data={q.data} options={options.data} />
      )}
    </EngagePage>
  )
}

interface Pending {
  channel: ContactChannel
  value: string
}

function EditForm({ data, options }: { data: MyProfile; options: ProfileOptions }) {
  const router = useRouter()
  const qc = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone ? data.phone.replace(/\D/g, "").slice(-10) : "",
      gender: data.gender,
      dateOfBirth: data.dateOfBirth ?? "",
      locationId: data.locationId ?? "",
      timezone: data.timezone,
    },
  })
  const [verify, setVerify] = useState<{ req: ContactChangeRequest; value: string; rest: Pending[]; values: Values } | null>(null)
  const [requesting, setRequesting] = useState(false)

  const save = useApiMutation(profileApi.update, {
    success: "Profile updated.",
    errorTitle: "Couldn't save your details",
    onSuccess: (p) => {
      const session = useAuthStore.getState().sessions.employee
      if (session) useAuthStore.getState().updateSession("employee", { user: { ...session.user, name: p.fullName, email: p.email } })
      router.push("/employee-app/profile")
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const saveRest = (v: Values) =>
    save.mutate({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      gender: v.gender,
      dateOfBirth: v.dateOfBirth || undefined,
      locationId: v.locationId || undefined,
      timezone: v.timezone,
    })

  /** Sends a one-time code for the next email/phone change, then opens the verification dialog. */
  const requestCode = async (item: Pending, rest: Pending[], values: Values) => {
    setRequesting(true)
    try {
      const req = await profileApi.requestContactChange({ channel: item.channel, value: item.value })
      setVerify({ req, value: item.value, rest, values })
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }, { shouldFocus: true }))
      } else toast.error("Couldn't send the code", { description: errorMessage(err) })
    } finally {
      setRequesting(false)
    }
  }

  const onSubmit = (v: Values) => {
    if (data.phone && !v.phone) {
      form.setError("phone", { message: "Enter your 10-digit mobile number" }, { shouldFocus: true })
      return
    }
    const current = qc.getQueryData<MyProfile>(["employee", "profile"]) ?? data
    const queue: Pending[] = []
    if (v.email.trim().toLowerCase() !== current.email.toLowerCase()) queue.push({ channel: "email", value: v.email.trim() })
    if (v.phone && normalisePhone(v.phone) !== normalisePhone(current.phone ?? "")) queue.push({ channel: "phone", value: v.phone })
    if (queue.length) void requestCode(queue[0]!, queue.slice(1), v)
    else saveRest(v)
  }

  const onVerify = async (code: string) => {
    if (!verify) return
    const res = await profileApi.verifyContactChange({ requestId: verify.req.requestId, code })
    if (res.channel === "email") {
      const session = useAuthStore.getState().sessions.employee
      if (session) useAuthStore.getState().updateSession("employee", { user: { ...session.user, email: res.value } })
    }
    await qc.invalidateQueries({ queryKey: ["employee", "profile"] })
    toast.success(res.channel === "email" ? "Email address verified." : "Phone number verified.")
    const { rest, values } = verify
    setVerify(null)
    if (rest.length) await requestCode(rest[0]!, rest.slice(1), values)
    else saveRest(values)
  }

  const resend = async () => {
    if (!verify) return
    const req = await profileApi.requestContactChange({ channel: verify.req.channel, value: verify.value })
    setVerify((s) => (s ? { ...s, req } : s))
  }

  const busy = save.isPending || requesting

  return (
    <>
      <PhotoCard data={data} />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormSection icon={UserRound} tone="sky" title="Your name" description="Shown on leaderboards as your company's privacy setting allows.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="firstName" label="First name" autoComplete="given-name" required />
            <TextField control={form.control} name="lastName" label="Last name" autoComplete="family-name" required />
          </div>
        </FormSection>

        <FormSection icon={Contact} tone="emerald" title="Contact details">
          <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/8 px-3.5 py-2.5 text-xs text-sky-900 dark:text-sky-200">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <p>Changing your email or phone number? We&apos;ll send a one-time code to the new address or number to confirm it&apos;s yours before we update it.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" required className="sm:col-span-2" />
            <PhoneField control={form.control} className="sm:col-span-2" />
          </div>
        </FormSection>

        <FormSection icon={Lock} tone="violet" title="Personal details" description="Private and encrypted — never visible to colleagues.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={form.control} name="gender" label="Gender" options={GENDER_OPTIONS} />
            <TextField control={form.control} name="dateOfBirth" label="Date of birth" type="date" />
            <SelectField
              control={form.control}
              name="locationId"
              label="Office location"
              placeholder="Choose your office"
              options={options.locations.map((l) => ({ value: l.id, label: `${l.name} · ${l.city}` }))}
            />
            <SelectField control={form.control} name="timezone" label="Time zone" options={options.timezones} />
          </div>
        </FormSection>

        <FormActions>
          <Button asChild variant="outline">
            <Link href="/employee-app/profile">Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner /> : null}
            Save
          </Button>
        </FormActions>
      </form>

      {verify ? (
        <VerifyCodeDialog
          key={`${verify.req.channel}:${verify.value}`}
          open
          onOpenChange={(o) => {
            if (!o) setVerify(null)
          }}
          channel={verify.req.channel}
          title={verify.req.channel === "email" ? "Verify your new email" : "Verify your new number"}
          sentTo={verify.req.sentTo}
          onVerify={onVerify}
          onResend={resend}
          confirmLabel="Verify & save"
        />
      ) : null}
    </>
  )
}

/** Mobile number with a fixed +91 prefix (the shared TextField prefix is sized for one character). */
function PhoneField({ control, className }: { control: Control<Values>; className?: string }) {
  const { field, fieldState } = useController({ control, name: "phone" })
  return (
    <FieldShell id="f-phone" label="Mobile number" description="10-digit Indian mobile number" error={fieldState.error?.message} className={className}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-muted-foreground">+91</span>
        <Input
          id="f-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          aria-invalid={!!fieldState.error}
          className="h-9 pl-12"
          {...field}
          value={field.value ?? ""}
        />
      </div>
    </FieldShell>
  )
}

function PhotoCard({ data }: { data: MyProfile }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const upload = useApiMutation(profileApi.uploadPhoto, { success: "Photo updated.", errorTitle: "Couldn't update your photo" })
  const remove = useApiMutation(profileApi.removePhoto, { success: "Photo removed.", errorTitle: "Couldn't remove your photo" })
  const busy = processing || upload.isPending || remove.isPending

  const onFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return void toast.error("Choose a JPG, PNG or WebP image.")
    if (file.size > MAX_UPLOAD_BYTES) return void toast.error("That photo is too large. Choose an image under 5 MB.")
    setProcessing(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file, 256)
      upload.mutate({ dataUrl })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-5 text-center shadow-xs sm:flex-row sm:text-left">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="group relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Change profile photo"
      >
        <UserAvatar name={data.fullName} color={data.avatarColor} src={data.photoUrl} size="xl" className="size-24 [&_[data-slot=avatar-fallback]]:text-3xl" />
        <span className="absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
          {busy ? <Spinner className="size-4" /> : <Camera className="size-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-heading text-base font-semibold">Profile photo</p>
        <p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5 MB. We&apos;ll crop it to a square.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera data-icon="inline-start" />
            {data.photoUrl ? "Change photo" : "Add photo"}
          </Button>
          {data.photoUrl ? (
            <Button variant="ghost" className="h-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmRemove(true)} disabled={busy}>
              <Trash2 data-icon="inline-start" />
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your photo?"
        description="Your initials will be shown instead, including on leaderboards."
        confirmLabel="Remove photo"
        destructive
        onConfirm={() => remove.mutate()}
      />
    </section>
  )
}

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  )
}
