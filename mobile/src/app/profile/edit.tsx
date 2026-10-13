/** SCR-M-070 Edit Profile – Basic Details (FRM-07): photo, name, verified email / phone change, personal details. */
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router"
import { Camera, Contact, Info, Lock, Trash2, UserRound } from "lucide-react-native"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { ChoiceGroup, VerifyCodeSheet } from "@/components/engage/account"
import { SectionCard } from "@/components/engage/shared"
import { Avatar, Button, ConfirmDialog, ErrorState, Notice, Screen, SelectField, SkeletonList, Text, TextField } from "@/components/ui"
import { displayToIsoDate, isoToDisplayDate, maskDate } from "@/features/onboarding/options"
import { ApiError } from "@/lib/api/core"
import { GENDER_OPTIONS, NAME_PATTERN, PHONE_PATTERN, ageOn, normalisePhone, profileApi, type ContactChangeRequest, type ContactChannel, type MyProfile, type ProfileOptions } from "@/lib/api/employee/profile"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { WellnessProfile } from "@/lib/types"
import { useTheme } from "@/theme/theme"

const name = (label: string) => z.string().trim().min(1, `Enter your ${label}`).max(50, "Use 50 characters or fewer").regex(NAME_PATTERN, "Use letters only (spaces, hyphens and apostrophes are fine)")

const schema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || PHONE_PATTERN.test(v.replace(/\s/g, "")), "Enter a valid 10-digit mobile number"),
  gender: z.enum(["female", "male", "other", "undisclosed"]),
  dob: z.string().refine((v) => {
    if (!v.trim()) return true
    const iso = displayToIsoDate(v)
    if (!iso) return false
    const age = ageOn(iso)
    return age >= 16 && age <= 100
  }, "Enter a valid date (DD/MM/YYYY) — you must be 16 to 100"),
  locationId: z.string(),
  timezone: z.string().min(1, "Choose your time zone"),
})
type Values = z.infer<typeof schema>

interface Pending {
  channel: ContactChannel
  value: string
}

function PhotoCard({ data }: { data: MyProfile }) {
  const { colors } = useTheme()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const upload = useApiMutation(profileApi.uploadPhoto, { success: "Photo updated.", errorTitle: "Couldn't update your photo", onSuccess: () => haptic.success() })
  const remove = useApiMutation(profileApi.removePhoto, { success: "Photo removed.", errorTitle: "Couldn't remove your photo", onSuccess: () => setConfirmRemove(false) })
  const busy = upload.isPending || remove.isPending

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true })
      if (result.canceled || !result.assets[0]) return
      const asset = result.assets[0]
      if (!asset.base64) return toast.error("Choose a JPG, PNG or WebP image.")
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return toast.error("That photo is too large. Choose an image under 5 MB.")
      const mime = asset.mimeType === "image/png" ? "image/png" : asset.mimeType === "image/webp" ? "image/webp" : "image/jpeg"
      upload.mutate({ dataUrl: `data:${mime};base64,${asset.base64}` })
    } catch (err) {
      toast.error("Couldn't open your photos", { description: errorMessage(err) })
    }
  }

  return (
    <View style={styles.photo}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={busy} onPress={pick}>
        <Avatar name={data.fullName} color={data.avatarColor} photoUrl={data.photoUrl} size={96} />
        <View style={[styles.camera, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          {busy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Camera size={16} color={colors.primaryForeground} />}
        </View>
      </Pressable>
      <Text variant="caption" tone="muted" align="center">
        JPG, PNG or WebP, up to 5 MB. We&apos;ll crop it to a square.
      </Text>
      <View style={styles.photoActions}>
        <Button title={data.photoUrl ? "Change photo" : "Add photo"} icon={Camera} variant="outline" size="sm" onPress={pick} disabled={busy} />
        {data.photoUrl ? <Button title="Remove" icon={Trash2} variant="ghost" size="sm" onPress={() => setConfirmRemove(true)} disabled={busy} /> : null}
      </View>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove your photo?"
        message="Your initials will be shown instead, including on leaderboards."
        confirmLabel="Remove photo"
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
      />
    </View>
  )
}

function EditForm({ data, options }: { data: MyProfile; options: ProfileOptions }) {
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
      dob: isoToDisplayDate(data.dateOfBirth ?? ""),
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
      haptic.success()
      const session = useAuthStore.getState().sessions.employee
      if (session) useAuthStore.getState().updateSession("employee", { user: { ...session.user, name: p.fullName, email: p.email } })
      if (router.canGoBack()) router.back()
      else router.replace("/profile")
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        const { dateOfBirth, ...rest } = err.fieldErrors
        applyApiErrors(form.setError, new ApiError(err.message, err.status, err.code, { ...rest, ...(dateOfBirth ? { dob: dateOfBirth } : {}) }))
      }
    },
  })

  const saveRest = (v: Values) =>
    save.mutate({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), gender: v.gender, dateOfBirth: displayToIsoDate(v.dob) ?? undefined, locationId: v.locationId || undefined, timezone: v.timezone })

  /** Sends a one-time code for the next email/phone change, then opens the verification sheet. */
  const requestCode = async (item: Pending, rest: Pending[], values: Values) => {
    setRequesting(true)
    try {
      const req = await profileApi.requestContactChange({ channel: item.channel, value: item.value })
      setVerify({ req, value: item.value, rest, values })
    } catch (err) {
      if (!applyApiErrors(form.setError, err)) toast.error("Couldn't send the code", { description: errorMessage(err) })
    } finally {
      setRequesting(false)
    }
  }

  const onValid = (v: Values) => {
    if (data.phone && !v.phone) {
      form.setError("phone", { message: "Enter your 10-digit mobile number" })
      return
    }
    const current = qc.getQueryData<MyProfile>(["employee", "profile"]) ?? data
    const queue: Pending[] = []
    if (v.email.trim().toLowerCase() !== current.email.toLowerCase()) queue.push({ channel: "email", value: v.email.trim() })
    if (v.phone && normalisePhone(v.phone) !== normalisePhone(current.phone ?? "")) queue.push({ channel: "phone", value: v.phone })
    if (queue.length) void requestCode(queue[0]!, queue.slice(1), v)
    else saveRest(v)
  }
  const submit = () => void form.handleSubmit(onValid, () => haptic.error())()

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

  return (
    <Screen title="Basic details" back backHref="/profile" footer={<Button title="Save" loading={save.isPending || requesting} onPress={submit} feedback="none" testID="save-profile" />}>
      <PhotoCard data={data} />

      <SectionCard icon={UserRound} tint="steps" title="Your name" description="Shown on leaderboards as your company's privacy setting allows.">
        <FormTextField control={form.control} name="firstName" label="First name" autoComplete="given-name" testID="first-name" />
        <FormTextField control={form.control} name="lastName" label="Last name" autoComplete="family-name" />
      </SectionCard>

      <SectionCard icon={Contact} tint="habits" title="Contact details">
        <Notice tone="info" icon={Info}>
          Changing your email or phone number? We&apos;ll send a one-time code to the new address or number to confirm it&apos;s yours before we update it.
        </Notice>
        <FormTextField control={form.control} name="email" label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="email" />
        <FormTextField control={form.control} name="phone" label="Mobile number" keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" right="+91" hint="10-digit Indian mobile number" />
      </SectionCard>

      <SectionCard icon={Lock} tint="workout" title="Personal details" description="Private and encrypted — never visible to colleagues.">
        <Controller
          control={form.control}
          name="gender"
          render={({ field, fieldState }) => (
            <View style={styles.gap8}>
              <Text variant="label">Gender</Text>
              <ChoiceGroup<WellnessProfile["gender"]> options={GENDER_OPTIONS} value={field.value} onChange={(v) => field.onChange(v)} error={fieldState.error?.message} accessibilityLabel="Gender" />
            </View>
          )}
        />
        <Controller
          control={form.control}
          name="dob"
          render={({ field, fieldState }) => (
            <TextField label="Date of birth" value={field.value} onChangeText={(t) => field.onChange(maskDate(t))} onBlur={field.onBlur} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={form.control}
          name="locationId"
          render={({ field }) => (
            <SelectField label="Office location" placeholder="Choose your office" value={field.value} onChange={field.onChange} options={options.locations.map((l) => ({ value: l.id, label: `${l.name} · ${l.city}` }))} />
          )}
        />
        <Controller
          control={form.control}
          name="timezone"
          render={({ field, fieldState }) => <SelectField label="Time zone" value={field.value} onChange={field.onChange} options={options.timezones} error={fieldState.error?.message} />}
        />
      </SectionCard>

      {verify ? (
        <VerifyCodeSheet
          key={`${verify.req.channel}:${verify.value}`}
          open
          title={verify.req.channel === "email" ? "Verify your new email" : "Verify your new number"}
          sentTo={verify.req.sentTo}
          confirmLabel="Verify & save"
          onClose={() => setVerify(null)}
          onVerify={onVerify}
          onResend={async () => {
            const req = await profileApi.requestContactChange({ channel: verify.req.channel, value: verify.value })
            setVerify((s) => (s ? { ...s, req } : s))
          }}
        />
      ) : null}
    </Screen>
  )
}

export default function EditProfileScreen() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  const options = useApiQuery(["employee", "profile", "options"], () => profileApi.options(), { staleTime: 5 * 60_000 })
  const error = q.error ?? options.error
  if (q.data && options.data) return <EditForm data={q.data} options={options.data} />
  return (
    <Screen title="Basic details" back backHref="/profile">
      {error ? (
        <ErrorState
          title="Couldn't load your profile."
          error={error}
          onRetry={() => {
            void q.refetch()
            void options.refetch()
          }}
        />
      ) : (
        <SkeletonList count={4} height={150} header={false} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  gap8: { gap: 8 },
  photo: { alignItems: "center", gap: 10 },
  camera: { position: "absolute", right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  photoActions: { flexDirection: "row", gap: 8 },
})
