/** SCR-M-013 Profile Setup — onboarding step 1 of 4. */
import { zodResolver } from "@hookform/resolvers/zod"
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router"
import { Camera, MapPin, Phone, User } from "lucide-react-native"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { Avatar, Button, Chip, ErrorState, SelectField, SkeletonList, Text, TextField } from "@/components/ui"
import { displayToIsoDate, isoToDisplayDate, maskDate } from "@/features/onboarding/options"
import { OnboardingScreen } from "@/features/onboarding/onboarding-screen"
import { onboardingApi, type OnboardingState } from "@/lib/api/employee/onboarding"
import { GENDER_OPTIONS, TIMEZONES } from "@/lib/api/employee/profile"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import type { WellnessProfile } from "@/lib/types"
import { useTheme } from "@/theme/theme"

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(40, "Keep it under 40 characters"),
  lastName: z.string().trim().min(1, "Enter your last name").max(40, "Keep it under 40 characters"),
  phone: z.string().refine((v) => !v.trim() || /^\d{10,13}$/.test(v.replace(/\D/g, "")), "Enter a valid mobile number"),
  gender: z.string(),
  dob: z.string().refine((v) => {
    if (!v.trim()) return true
    const iso = displayToIsoDate(v)
    if (!iso) return false
    const age = (Date.now() - new Date(`${iso}T00:00:00`).getTime()) / (365.25 * 86_400_000)
    return age >= 16 && age <= 100
  }, "Enter a valid date of birth (DD/MM/YYYY), age 16–100"),
  location: z.string().max(80, "Keep it under 80 characters"),
  timezone: z.string().min(1, "Choose your timezone"),
})
type Values = z.infer<typeof schema>

function ProfileForm({ state }: { state: OnboardingState }) {
  const { colors } = useTheme()
  const session = useSession("employee")
  const [photoUrl, setPhotoUrl] = useState(state.profile.photoUrl)
  const [uploading, setUploading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const p = state.profile
  const detectedTz = TIMEZONES.some((t) => t.value === p.timezone) ? p.timezone : "Asia/Kolkata"
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: p.firstName, lastName: p.lastName, phone: p.phone, gender: p.gender, dob: isoToDisplayDate(p.dateOfBirth), location: p.location, timezone: detectedTz },
  })

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.3, base64: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mime = asset.mimeType === "image/png" ? "image/png" : "image/jpeg"
    if (!asset.base64) return toast.error("Photo must be JPG or PNG under 5 MB.")
    setUploading(true)
    try {
      const res = await onboardingApi.uploadPhoto({ dataUrl: `data:${mime};base64,${asset.base64}` })
      setPhotoUrl(res.photoUrl)
      haptic.success()
    } catch (err) {
      toast.error("Photo must be JPG or PNG under 5 MB.", { description: errorMessage(err) })
    } finally {
      setUploading(false)
    }
  }

  const save = async (values: Values, skipOptional: boolean) => {
    try {
      await onboardingApi.saveProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        timezone: values.timezone,
        ...(skipOptional
          ? {}
          : {
              phone: values.phone.trim() || undefined,
              gender: (values.gender || undefined) as WellnessProfile["gender"] | undefined,
              dateOfBirth: displayToIsoDate(values.dob) ?? undefined,
              location: values.location.trim() || undefined,
            }),
      })
      haptic.success()
      router.push("/onboarding/goals")
    } catch (err) {
      haptic.error()
      if (!applyApiErrors(form.setError, err)) toast.error("Couldn't save your profile", { description: errorMessage(err) })
    }
  }

  const submit = form.handleSubmit((v) => save(v, false))
  const skip = form.handleSubmit(async (v) => {
    setSkipping(true)
    await save(v, true)
    setSkipping(false)
  })

  return (
    <OnboardingScreen
      step={1}
      icon={User}
      title="Set up your profile"
      description="Tell us a little about you. Only your name is shared with colleagues (on leaderboards, if your company allows)."
      footer={
        <>
          <Button title="Continue" loading={form.formState.isSubmitting && !skipping} onPress={submit} testID="continue" />
          <Button title="Skip optional fields" variant="ghost" loading={skipping} onPress={skip} />
        </>
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Choose profile photo" onPress={pickPhoto} style={styles.photo}>
        <View>
          <Avatar name={session?.user.name ?? `${p.firstName} ${p.lastName}`} color={session?.user.avatarColor} photoUrl={photoUrl} size={84} />
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Camera size={14} color={colors.primaryForeground} />
          </View>
        </View>
        <Text variant="label" tone="primary">
          {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add a photo"}
        </Text>
      </Pressable>

      <View style={styles.row}>
        <FormTextField control={form.control} name="firstName" label="First name" autoComplete="given-name" containerStyle={styles.flex} testID="first-name" />
        <FormTextField control={form.control} name="lastName" label="Last name" autoComplete="family-name" containerStyle={styles.flex} />
      </View>
      <TextField label="Email" value={p.email} editable={false} hint="From your company invitation" />
      <FormTextField control={form.control} name="phone" label="Mobile number (optional)" icon={Phone} keyboardType="phone-pad" autoComplete="tel" placeholder="98765 43210" />

      <View style={styles.group}>
        <Text variant="label">Gender (optional)</Text>
        <Controller
          control={form.control}
          name="gender"
          render={({ field }) => (
            <View style={styles.chips}>
              {GENDER_OPTIONS.map((g) => (
                <Chip key={g.value} label={g.label} selected={field.value === g.value} onPress={() => field.onChange(field.value === g.value ? "" : g.value)} />
              ))}
            </View>
          )}
        />
      </View>

      <Controller
        control={form.control}
        name="dob"
        render={({ field, fieldState }) => (
          <TextField label="Date of birth (optional)" value={field.value} onChangeText={(t) => field.onChange(maskDate(t))} onBlur={field.onBlur} placeholder="DD/MM/YYYY" keyboardType="number-pad" maxLength={10} error={fieldState.error?.message} />
        )}
      />
      <FormTextField control={form.control} name="location" label="Location (optional)" icon={MapPin} placeholder="City or office" />
      <Controller
        control={form.control}
        name="timezone"
        render={({ field, fieldState }) => (
          <SelectField label="Timezone" value={field.value} options={TIMEZONES} onChange={field.onChange} error={fieldState.error?.message} hint="Detected from your phone — your day resets at midnight here." />
        )}
      />
    </OnboardingScreen>
  )
}

export default function ProfileSetupScreen() {
  const q = useApiQuery(["employee", "onboarding"], () => onboardingApi.state())
  if (q.data) return <ProfileForm state={q.data} />
  return (
    <OnboardingScreen step={1} title="Set up your profile" footer={null}>
      {q.error ? <ErrorState error={q.error} title="Couldn't load your details" onRetry={() => q.refetch()} retrying={q.isFetching} /> : <SkeletonList count={4} height={56} header={false} />}
    </OnboardingScreen>
  )
}

const styles = StyleSheet.create({
  photo: { alignItems: "center", gap: 8, alignSelf: "center" },
  cameraBadge: { position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  group: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
})
