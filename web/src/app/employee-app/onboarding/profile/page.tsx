"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Camera, Lock, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { SelectField, TextField } from "@/components/common/form-fields"
import { OnboardingFrame, OnboardingGate, useOnboardingState } from "@/components/employee/track/onboarding-frame"
import { PhotoCropper } from "@/components/employee/track/photo-cropper"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { onboardingApi, type OnboardingState } from "@/lib/api/employee/onboarding"
import { useApiMutation } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { initials } from "@/lib/format"

const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"]

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(40, "Keep it under 40 characters"),
  lastName: z.string().trim().min(1, "Enter your last name").max(40, "Keep it under 40 characters"),
  email: z.string(),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || /^\+?[\d\s-]{10,16}$/.test(v), "Enter a valid mobile number"),
  gender: z.string(),
  dateOfBirth: z.string().refine((v) => {
    if (!v) return true
    const age = (Date.now() - new Date(`${v}T00:00:00`).getTime()) / (365.25 * 86_400_000)
    return age >= 16 && age <= 100
  }, "Enter a date of birth between 16 and 100 years ago"),
  location: z.string().max(60, "Keep it under 60 characters"),
  timezone: z.string().min(1, "Choose your timezone"),
})
type Values = z.infer<typeof schema>

/** SCR-M-013 Profile Setup — onboarding step 1 of 4. */
export default function ProfileSetupPage() {
  const q = useOnboardingState()
  return (
    <OnboardingFrame step={1} title="Tell us about you" subtitle="This helps personalise HealthX. Only your name is shown to colleagues.">
      <OnboardingGate query={q}>{(s) => <ProfileForm state={s} />}</OnboardingGate>
    </OnboardingFrame>
  )
}

function ProfileForm({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const updateSession = useAuthStore((s) => s.updateSession)
  const session = useAuthStore((s) => s.sessions.employee)
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string | null>(state.profile.photoUrl)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const p = state.profile
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Kolkata"
  const zones = [...new Set([p.timezone || detected, detected, ...TIMEZONES])]

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, gender: p.gender, dateOfBirth: p.dateOfBirth, location: p.location, timezone: p.timezone || detected },
  })

  const upload = useApiMutation(onboardingApi.uploadPhoto, { invalidate: false, onSuccess: (r) => setPhoto(r.photoUrl), onError: (e) => setPhotoError(e.message) })
  const save = useApiMutation(onboardingApi.saveProfile, {
    onSuccess: (s) => {
      if (session) updateSession("employee", { user: { ...session.user, name: `${s.profile.firstName} ${s.profile.lastName}` } })
      router.push("/employee-app/onboarding/goals")
    },
    onError: (e) => {
      if (e.fieldErrors) for (const [k, v] of Object.entries(e.fieldErrors)) form.setError(k as keyof Values, { message: v })
    },
  })

  const submit = (skipOptional: boolean) =>
    form.handleSubmit(
      (v) =>
        save.mutate({
          firstName: v.firstName,
          lastName: v.lastName,
          timezone: v.timezone,
          phone: skipOptional ? undefined : v.phone,
          gender: skipOptional ? "" : (v.gender as OnboardingState["profile"]["gender"]),
          dateOfBirth: skipOptional ? undefined : v.dateOfBirth,
          location: skipOptional ? undefined : v.location,
        }),
      (errors) => {
        // "Skip optional fields": ignore errors on optional fields.
        if (skipOptional && !errors.firstName && !errors.lastName && !errors.timezone) {
          const v = form.getValues()
          save.mutate({ firstName: v.firstName, lastName: v.lastName, timezone: v.timezone })
        }
      },
    )

  const onFile = (file?: File) => {
    setPhotoError(null)
    if (!file) return
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be JPG or PNG under 5 MB.")
      return
    }
    setCropSrc(URL.createObjectURL(file))
  }

  const [first, last] = useWatch({ control: form.control, name: ["firstName", "lastName"] })
  const name = `${first} ${last}`.trim() || "You"

  return (
    <form onSubmit={submit(false)} className="flex flex-1 flex-col gap-5" noValidate>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="group relative size-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-bold text-white shadow-md" aria-label="Choose profile photo">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Your profile photo" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">{initials(name)}</span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-black/45 opacity-90 transition-opacity group-hover:opacity-100">
            {upload.isPending ? <Spinner className="size-3.5" /> : <Camera className="size-3.5" />}
          </span>
        </button>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">Profile photo</p>
          <p className="text-xs text-muted-foreground">Optional · JPG or PNG under 5 MB</p>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              {photo ? "Change" : "Add photo"}
            </Button>
            {photo ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => upload.mutate({ dataUrl: null })} aria-label="Remove photo">
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>
      {photoError ? <p className="-mt-3 text-xs font-medium text-destructive">{photoError}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <TextField control={form.control} name="firstName" label="First name" required autoComplete="given-name" />
        <TextField control={form.control} name="lastName" label="Last name" required autoComplete="family-name" />
      </div>
      <TextField control={form.control} name="email" label="Work email" disabled description="From your invitation — contact HR to change it" />
      <TextField control={form.control} name="phone" label="Mobile number" type="tel" placeholder="+91 98765 43210" autoComplete="tel" description="Optional · for sign-in codes" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          placeholder="Optional"
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
            { value: "other", label: "Other" },
            { value: "undisclosed", label: "Prefer not to say" },
          ]}
        />
        <TextField control={form.control} name="dateOfBirth" label="Date of birth" type="date" />
      </div>
      <TextField control={form.control} name="location" label="Location" placeholder="City, e.g. Bengaluru" autoComplete="address-level2" />
      <SelectField control={form.control} name="timezone" label="Timezone" required options={zones.map((z) => ({ value: z, label: `${z.replace(/_/g, " ")}${z === detected ? " (detected)" : ""}` }))} />

      <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" /> Gender, date of birth and location are private and encrypted. Your HR team never sees them.
      </p>

      <div className="mt-auto grid gap-2 pt-2">
        <Button type="submit" className="h-12 text-base" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : null} Continue {!save.isPending ? <ArrowRight data-icon="inline-end" /> : null}
        </Button>
        <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => submit(true)()} disabled={save.isPending}>
          Skip optional fields
        </Button>
      </div>

      <PhotoCropper
        src={cropSrc}
        onCancel={() => setCropSrc(null)}
        onDone={(dataUrl) => {
          setCropSrc(null)
          upload.mutate({ dataUrl }, { onSuccess: () => toast.success("Photo updated") })
        }}
      />
    </form>
  )
}
