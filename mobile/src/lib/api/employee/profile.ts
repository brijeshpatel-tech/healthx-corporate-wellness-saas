// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — My profile & personal settings (own data only).
 * SCR-M-069 My Profile, SCR-M-070 Basic details, SCR-M-071 Wellness details,
 * SCR-M-072 Preferences, SCR-M-073 Notification preferences.
 */
import type { EmployeePrivate } from "@/lib/mock/db"
import type { Employee, EmployeeAppRole, EmployeePreferences, NotificationPreferences, WellnessProfile } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProfileCompletionItem {
  key: "photo" | "phone" | "dob" | "location" | "wellness" | "preferences" | "health"
  label: string
  href: string
}

export interface MyProfile {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone?: string
  photoUrl?: string
  avatarColor: string
  jobTitle: string
  employeeCode: string
  role: EmployeeAppRole
  companyName: string
  companyDomain?: string
  departmentName: string
  teamName: string
  locationId?: string
  locationName?: string
  timezone: string
  gender: WellnessProfile["gender"]
  dateOfBirth?: string
  joinedAt?: string
  stats: { pointsBalance: number; badgesCount: number; currentStreak: number }
  completion: { percent: number; done: number; total: number; missing: ProfileCompletionItem[] }
  wellness: WellnessProfile
  preferences: EmployeePreferences
  /** Names of the health apps currently connected. */
  connectedApps: string[]
  quietHours: { start: string; end: string }
  notificationsOn: boolean
  deletionRequestedAt?: string
  dataExportRequestedAt?: string
}

export interface ProfileOptions {
  locations: { id: string; name: string; city: string; timezone: string }[]
  timezones: { value: string; label: string }[]
}

export interface UpdateProfileInput {
  firstName: string
  lastName: string
  gender: WellnessProfile["gender"]
  dateOfBirth?: string
  locationId?: string
  timezone: string
}

export type ContactChannel = "email" | "phone"

export interface ContactChangeRequest {
  requestId: string
  channel: ContactChannel
  /** Masked destination the code was sent to. */
  sentTo: string
  expiresAt: string
}

export type UpdateWellnessInput = Pick<WellnessProfile, "heightCm" | "weightKg" | "mainGoal" | "activityLevel" | "fitnessLevel" | "dailyStepGoal">

/** Notification preferences incl. keys the shared type doesn't have yet. */
export interface NotificationSettings extends NotificationPreferences {
  habitReminders: boolean
  /** Phase 2 (#348) — leaderboard rank changes, incl. dropping out of the top 3. */
  rankChangeAlerts: boolean
}

// ─── Option lists (shared with the screens) ─────────────────────────────

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "India (IST, GMT+5:30)" },
  { value: "Asia/Dubai", label: "Dubai (GST, GMT+4)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, GMT+8)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Central Europe (CET)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "Australia/Sydney", label: "Sydney (AET)" },
]

export const GENDER_OPTIONS: { value: WellnessProfile["gender"]; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
]

export const ACTIVITY_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "walking", label: "Walking", emoji: "🚶" },
  { value: "running", label: "Running", emoji: "🏃" },
  { value: "cycling", label: "Cycling", emoji: "🚴" },
  { value: "yoga", label: "Yoga", emoji: "🧘" },
  { value: "strength", label: "Strength", emoji: "🏋️" },
  { value: "hiit", label: "HIIT", emoji: "⚡" },
  { value: "swimming", label: "Swimming", emoji: "🏊" },
  { value: "meditation", label: "Meditation", emoji: "🌿" },
  { value: "dance", label: "Dance", emoji: "💃" },
  { value: "sports", label: "Sports", emoji: "🏸" },
]

export const LANGUAGE_OPTIONS: { value: string; label: string; available: boolean }[] = [
  { value: "English", label: "English", available: true },
  { value: "Hindi", label: "हिन्दी (Hindi)", available: false },
  { value: "Tamil", label: "தமிழ் (Tamil)", available: false },
  { value: "Marathi", label: "मराठी (Marathi)", available: false },
  { value: "Bengali", label: "বাংলা (Bengali)", available: false },
]

const GENDERS = GENDER_OPTIONS.map((g) => g.value)
const GOALS: WellnessProfile["mainGoal"][] = ["lose_weight", "stay_active", "build_strength", "reduce_stress", "sleep_better", "eat_healthier"]
const ACTIVITY_LEVELS: WellnessProfile["activityLevel"][] = ["sedentary", "light", "moderate", "very_active"]
const FITNESS_LEVELS: WellnessProfile["fitnessLevel"][] = ["beginner", "intermediate", "advanced"]
const LOCATIONS: EmployeePreferences["workoutLocation"][] = ["home", "gym", "outdoor", "any"]
const FOODS: EmployeePreferences["foodPreference"][] = ["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain", "no_preference"]
const DURATIONS = [10, 20, 30, 45, 60]
const THEMES: EmployeePreferences["theme"][] = ["system", "light", "dark"]

export const PROVIDER_NAME: Record<string, string> = {
  apple_health: "Apple Health",
  health_connect: "Health Connect",
  fitbit: "Fitbit",
  garmin: "Garmin",
}

// ─── Validation helpers (mirror the screens' zod rules — FRM-07/08/09/10) ───

/** Letters (any script), spaces, hyphens, apostrophes and dots; 1–50 characters. */
export const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '.-]*$/u
/** Indian mobile number: 10 digits starting 6–9, optional +91 / 0 prefix. */
export const PHONE_PATTERN = /^(?:\+?91[\s-]?|0)?[6-9]\d{9}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Age in whole years on a given day. */
export function ageOn(dateOfBirth: string, today = new Date()) {
  const [y, m, d] = dateOfBirth.split("-").map(Number) as [number, number, number]
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--
  return age
}

export function normalisePhone(value: string) {
  const digits = value.replace(/\D/g, "")
  const ten = digits.length > 10 ? digits.slice(-10) : digits
  return ten ? `+91 ${ten}` : ""
}

function nameError(value: string | undefined, label: string) {
  const v = (value ?? "").trim()
  if (!v) return `Enter your ${label}`
  if (v.length > 50) return "Use 50 characters or fewer"
  if (!NAME_PATTERN.test(v)) return "Use letters only (spaces, hyphens and apostrophes are fine)"
  return null
}

const maskEmail = (email: string) => {
  const [user = "", domain = ""] = email.split("@")
  return `${user.slice(0, 2)}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`
}
const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "").slice(-10)
  return `+91 ••••• ${digits.slice(-5)}`
}

// ─── Extra sample data owned by this feature ───────────────────────────

/** Profile photos (data URLs ≤ 256 px). `null` = removed by the user. */
const photos = (ctx: Ctx) => ctx.extra("emp-profile-photos", () => ({}) as Record<string, string | null>)
const profileExtra = (ctx: Ctx) => ctx.extra("emp-profile-extra", () => ({}) as Record<string, { timezone?: string }>)
/** Keys the shared NotificationPreferences type doesn't have (the leaderboard service reads `rankChangeAlerts`). */
const notificationExtra = (ctx: Ctx) => ctx.extra("emp-notification-extra", () => ({}) as Record<string, { habitReminders?: boolean; rankChangeAlerts?: boolean }>)
const contactChanges = (ctx: Ctx) =>
  ctx.extra("emp-contact-changes", () => ({}) as Record<string, { employeeId: string; channel: ContactChannel; value: string; createdAt: string }>)
/** Read-only: values the onboarding flow may have captured (photo, timezone). */
const onboardingExtra = (ctx: Ctx) => ctx.extra("emp-onboarding", () => ({}) as Record<string, { photoUrl?: string | null; timezone?: string }>)

// ─── Helpers ────────────────────────────────────────────────────────────

function employeeOf(ctx: Ctx, me: EmployeePrivate): Employee {
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return emp
}

/** Current profile photo (data URL) of an employee, if any. */
export function photoOf(ctx: Ctx, employeeId: string): string | undefined {
  const own = photos(ctx)
  if (employeeId in own) return own[employeeId] ?? undefined
  return onboardingExtra(ctx)[employeeId]?.photoUrl ?? undefined
}

function timezoneOf(ctx: Ctx, emp: Employee): string {
  const own = profileExtra(ctx)[emp.id]?.timezone
  if (own) return own
  const fromOnboarding = onboardingExtra(ctx)[emp.id]?.timezone
  if (fromOnboarding) return fromOnboarding
  const loc = ctx.db.locations.find((l) => l.id === emp.locationId)
  return loc?.timezone ?? ctx.db.companies.find((c) => c.id === emp.companyId)?.timezone ?? "Asia/Kolkata"
}

function notificationExtraOf(ctx: Ctx, me: EmployeePrivate) {
  const stored = notificationExtra(ctx)[me.employeeId]
  return { habitReminders: stored?.habitReminders ?? true, rankChangeAlerts: stored?.rankChangeAlerts ?? true }
}

function completionOf(ctx: Ctx, me: EmployeePrivate, emp: Employee): MyProfile["completion"] {
  const items: (ProfileCompletionItem & { done: boolean })[] = [
    { key: "photo", label: "Add a profile photo", href: "/employee-app/profile/edit", done: !!photoOf(ctx, emp.id) },
    { key: "phone", label: "Add your phone number", href: "/employee-app/profile/edit", done: !!emp.phone },
    { key: "dob", label: "Add your date of birth", href: "/employee-app/profile/edit", done: !!me.profile.dateOfBirth },
    { key: "location", label: "Choose your office location", href: "/employee-app/profile/edit", done: !!emp.locationId },
    { key: "wellness", label: "Complete your wellness details", href: "/employee-app/profile/wellness", done: !!(me.profile.heightCm && me.profile.weightKg && me.profile.mainGoal) },
    { key: "preferences", label: "Pick your favourite activities", href: "/employee-app/settings/preferences", done: me.preferences.activities.length > 0 },
    { key: "health", label: "Connect a health app", href: "/employee-app/settings/connected-apps", done: me.healthConnections.some((h) => h.status === "connected") },
  ]
  const done = items.filter((i) => i.done).length
  return {
    percent: Math.round((done / items.length) * 100),
    done,
    total: items.length,
    missing: items.filter((i) => !i.done).map(({ key, label, href }) => ({ key, label, href })),
  }
}

function snapshot(ctx: Ctx): MyProfile {
  const me = ctx.me()
  const emp = employeeOf(ctx, me)
  const company = ctx.db.companies.find((c) => c.id === emp.companyId)
  const location = ctx.db.locations.find((l) => l.id === emp.locationId)
  const np = me.notificationPreferences
  return {
    id: emp.id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    fullName: `${emp.firstName} ${emp.lastName}`,
    email: emp.email,
    phone: emp.phone,
    photoUrl: photoOf(ctx, emp.id),
    avatarColor: emp.avatarColor,
    jobTitle: emp.jobTitle,
    employeeCode: emp.employeeCode,
    role: emp.appRole,
    companyName: company?.name ?? "",
    companyDomain: company?.emailDomains[0] ?? emp.email.split("@")[1],
    departmentName: ctx.db.departments.find((d) => d.id === emp.departmentId)?.name ?? "",
    teamName: ctx.db.teams.find((t) => t.id === emp.teamId)?.name ?? "",
    locationId: emp.locationId,
    locationName: location ? location.name : undefined,
    timezone: timezoneOf(ctx, emp),
    gender: me.profile.gender ?? emp.gender ?? "undisclosed",
    dateOfBirth: me.profile.dateOfBirth,
    joinedAt: emp.joinedAt,
    stats: { pointsBalance: emp.stats.pointsBalance, badgesCount: emp.stats.badgesCount, currentStreak: emp.stats.currentStreak },
    completion: completionOf(ctx, me, emp),
    wellness: me.profile,
    preferences: me.preferences,
    connectedApps: me.healthConnections.filter((h) => h.status === "connected").map((h) => PROVIDER_NAME[h.provider] ?? h.provider),
    quietHours: { start: np.quietHoursStart, end: np.quietHoursEnd },
    notificationsOn: np.push || np.email,
    deletionRequestedAt: me.deletionRequestedAt,
    dataExportRequestedAt: me.dataExportRequestedAt,
  }
}

function notificationSnapshot(ctx: Ctx): NotificationSettings {
  const me = ctx.me()
  return { ...me.notificationPreferences, ...notificationExtraOf(ctx, me) }
}

// ─── Service ────────────────────────────────────────────────────────────

export const profileApi = {
  /** SCR-M-069 — profile summary. */
  get: endpoint<void, MyProfile, "employee">("employee", "GET", "/me", (_i, ctx) => snapshot(ctx)),

  /** Lookups for the basic-details form (company locations, time zones). */
  options: endpoint<void, ProfileOptions, "employee">("employee", "GET", "/me/profile/options", (_i, ctx) => {
    const emp = employeeOf(ctx, ctx.me())
    return {
      locations: ctx.db.locations.filter((l) => l.companyId === emp.companyId).map((l) => ({ id: l.id, name: l.name, city: l.city, timezone: l.timezone })),
      timezones: TIMEZONES,
    }
  }),

  /** SCR-M-070 — save basic details (email/phone go through the verified contact-change flow). */
  update: endpoint<UpdateProfileInput, MyProfile, "employee">("employee", "PATCH", "/me/profile", (input, ctx) => {
    const errors: Record<string, string> = {}
    const first = nameError(input.firstName, "first name")
    const last = nameError(input.lastName, "last name")
    if (first) errors.firstName = first
    if (last) errors.lastName = last
    if (!GENDERS.includes(input.gender)) errors.gender = "Choose an option"
    if (input.dateOfBirth) {
      if (!DATE_PATTERN.test(input.dateOfBirth) || Number.isNaN(new Date(input.dateOfBirth).getTime())) errors.dateOfBirth = "Enter a valid date"
      else {
        const age = ageOn(input.dateOfBirth)
        if (age < 16 || age > 100) errors.dateOfBirth = "You must be between 16 and 100 years old"
      }
    }
    const me = ctx.me()
    const emp = employeeOf(ctx, me)
    if (input.locationId && !ctx.db.locations.some((l) => l.id === input.locationId && l.companyId === emp.companyId)) errors.locationId = "Choose a location from the list"
    if (!input.timezone || !TIMEZONES.some((t) => t.value === input.timezone)) errors.timezone = "Choose your time zone"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)

    emp.firstName = input.firstName.trim()
    emp.lastName = input.lastName.trim()
    emp.gender = input.gender
    emp.locationId = input.locationId || undefined
    me.profile.gender = input.gender
    me.profile.dateOfBirth = input.dateOfBirth || undefined
    const extra = profileExtra(ctx)
    extra[emp.id] = { ...extra[emp.id], timezone: input.timezone }
    ctx.save()
    return snapshot(ctx)
  }),

  uploadPhoto: endpoint<{ dataUrl: string }, { photoUrl: string }, "employee">("employee", "POST", "/me/profile/photo", ({ dataUrl }, ctx) => {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl ?? "")) throw badRequest("Choose a JPG, PNG or WebP image.")
    if (dataUrl.length > 400_000) throw badRequest("That photo is too large. Choose an image under 5 MB.")
    const me = ctx.me()
    photos(ctx)[me.employeeId] = dataUrl
    ctx.save()
    return { photoUrl: dataUrl }
  }),

  removePhoto: endpoint<void, { ok: true }, "employee">("employee", "DELETE", "/me/profile/photo", (_i, ctx) => {
    const me = ctx.me()
    photos(ctx)[me.employeeId] = null
    ctx.save()
    return { ok: true }
  }),

  /** Step 1 of an email/phone change: validates the new value and sends a one-time code to it. */
  requestContactChange: endpoint<{ channel: ContactChannel; value: string }, ContactChangeRequest, "employee">(
    "employee",
    "POST",
    "/me/contact-change",
    ({ channel, value }, ctx) => {
      const me = ctx.me()
      const emp = employeeOf(ctx, me)
      const v = (value ?? "").trim()
      if (channel === "email") {
        if (!EMAIL_PATTERN.test(v)) throw badRequest("Enter a valid email address.", { email: "Enter a valid email address" })
        if (v.toLowerCase() === emp.email.toLowerCase()) throw badRequest("This is already your email address.", { email: "This is already your email address" })
        if (ctx.db.employees.some((e) => e.id !== emp.id && e.email.toLowerCase() === v.toLowerCase()))
          throw badRequest("This email is already used by another account.", { email: "This email is already used by another account." })
      } else {
        if (!PHONE_PATTERN.test(v.replace(/\s/g, ""))) throw badRequest("Enter a valid 10-digit mobile number.", { phone: "Enter a valid 10-digit mobile number" })
        const normalised = normalisePhone(v)
        if (emp.phone && normalisePhone(emp.phone) === normalised) throw badRequest("This is already your phone number.", { phone: "This is already your phone number" })
        if (ctx.db.employees.some((e) => e.id !== emp.id && e.phone && normalisePhone(e.phone) === normalised))
          throw badRequest("This phone number is already used by another account.", { phone: "This phone number is already used by another account." })
      }
      const requestId = newId("ccr")
      contactChanges(ctx)[requestId] = { employeeId: emp.id, channel, value: channel === "phone" ? normalisePhone(v) : v, createdAt: new Date().toISOString() }
      ctx.save()
      return { requestId, channel, sentTo: channel === "email" ? maskEmail(v) : maskPhone(v), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }
    },
  ),

  /** Step 2: confirms the code and applies the new email/phone. */
  verifyContactChange: endpoint<{ requestId: string; code: string }, { channel: ContactChannel; value: string }, "employee">(
    "employee",
    "POST",
    "/me/contact-change/:requestId/verify",
    ({ requestId, code }, ctx) => {
      if (!/^\d{6}$/.test(code ?? "")) throw badRequest("Enter the 6-digit code.", { code: "Enter the 6-digit code." })
      if (code === "000000") throw badRequest("That code is incorrect. Please try again.", { code: "That code is incorrect. Please try again." })
      const me = ctx.me()
      const all = contactChanges(ctx)
      const req = all[requestId]
      if (!req || req.employeeId !== me.employeeId) throw new ApiError("This code has expired. Request a new one.", 410, "code_expired")
      if (Date.now() - new Date(req.createdAt).getTime() > 10 * 60_000) throw new ApiError("This code has expired. Request a new one.", 410, "code_expired")
      const emp = employeeOf(ctx, me)
      if (req.channel === "email") {
        if (ctx.db.employees.some((e) => e.id !== emp.id && e.email.toLowerCase() === req.value.toLowerCase()))
          throw badRequest("This email is already used by another account.", { email: "This email is already used by another account." })
        emp.email = req.value
      } else emp.phone = req.value
      delete all[requestId]
      ctx.save()
      return { channel: req.channel, value: req.value }
    },
  ),

  /** SCR-M-071 — wellness details (private to the employee). */
  updateWellness: endpoint<UpdateWellnessInput, MyProfile, "employee">("employee", "PATCH", "/me/wellness-profile", (input, ctx) => {
    const errors: Record<string, string> = {}
    if (!Number.isFinite(input.heightCm) || input.heightCm < 100 || input.heightCm > 250) errors.heightCm = "Enter a height between 100 and 250 cm"
    if (!Number.isFinite(input.weightKg) || input.weightKg < 30 || input.weightKg > 250) errors.weightKg = "Enter a weight between 30 and 250 kg"
    if (!GOALS.includes(input.mainGoal)) errors.mainGoal = "Choose your main goal"
    if (!ACTIVITY_LEVELS.includes(input.activityLevel)) errors.activityLevel = "Choose your activity level"
    if (!FITNESS_LEVELS.includes(input.fitnessLevel)) errors.fitnessLevel = "Choose your fitness level"
    if (!Number.isInteger(input.dailyStepGoal) || input.dailyStepGoal < 1000 || input.dailyStepGoal > 50000) errors.dailyStepGoal = "Choose a goal between 1,000 and 50,000 steps"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const me = ctx.me()
    me.profile = {
      ...me.profile,
      heightCm: Math.round(input.heightCm),
      weightKg: Math.round(input.weightKg * 10) / 10,
      mainGoal: input.mainGoal,
      activityLevel: input.activityLevel,
      fitnessLevel: input.fitnessLevel,
      dailyStepGoal: input.dailyStepGoal,
    }
    // Recalculate today's goal so Home and Activity pick up the new target straight away.
    const today = toLocalDate(new Date())
    const row = me.daily.find((d) => d.date === today)
    if (row) row.goalSteps = input.dailyStepGoal
    ctx.save()
    return snapshot(ctx)
  }),

  /** SCR-M-072 — preferences (partial update; theme saves on its own). */
  updatePreferences: endpoint<Partial<EmployeePreferences>, EmployeePreferences, "employee">("employee", "PATCH", "/me/preferences", (patch, ctx) => {
    const errors: Record<string, string> = {}
    if (patch.activities !== undefined) {
      if (!patch.activities.length) errors.activities = "Choose at least one activity"
      else if (patch.activities.length > 10) errors.activities = "Choose up to 10 activities"
    }
    if (patch.workoutLocation !== undefined && !LOCATIONS.includes(patch.workoutLocation)) errors.workoutLocation = "Choose where you like to work out"
    if (patch.workoutDurationMin !== undefined && !DURATIONS.includes(patch.workoutDurationMin)) errors.workoutDurationMin = "Choose a workout length"
    if (patch.foodPreference !== undefined && !FOODS.includes(patch.foodPreference)) errors.foodPreference = "Choose a food preference"
    if (patch.language !== undefined && !LANGUAGE_OPTIONS.some((l) => l.value === patch.language && l.available)) errors.language = "That language isn't available yet"
    if (patch.units !== undefined && patch.units !== "metric" && patch.units !== "imperial") errors.units = "Choose metric or imperial"
    if (patch.theme !== undefined && !THEMES.includes(patch.theme)) errors.theme = "Choose a theme"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const me = ctx.me()
    me.preferences = { ...me.preferences, ...patch }
    ctx.save()
    return me.preferences
  }),

  /** SCR-M-073 */
  notificationPreferences: endpoint<void, NotificationSettings, "employee">("employee", "GET", "/me/notification-preferences", (_i, ctx) => notificationSnapshot(ctx)),

  updateNotificationPreferences: endpoint<Partial<NotificationSettings>, NotificationSettings, "employee">(
    "employee",
    "PUT",
    "/me/notification-preferences",
    (patch, ctx) => {
      const me = ctx.me()
      const errors: Record<string, string> = {}
      if (patch.quietHoursStart !== undefined && !HHMM.test(patch.quietHoursStart)) errors.quietHoursStart = "Choose a valid time"
      if (patch.quietHoursEnd !== undefined && !HHMM.test(patch.quietHoursEnd)) errors.quietHoursEnd = "Choose a valid time"
      const start = patch.quietHoursStart ?? me.notificationPreferences.quietHoursStart
      const end = patch.quietHoursEnd ?? me.notificationPreferences.quietHoursEnd
      if (!errors.quietHoursEnd && start === end) errors.quietHoursEnd = "Quiet hours must end at a different time than they start"
      if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
      const { habitReminders, rankChangeAlerts, ...rest } = patch
      const allowed = Object.fromEntries(Object.entries(rest).filter(([k]) => k in me.notificationPreferences)) as Partial<NotificationPreferences>
      me.notificationPreferences = { ...me.notificationPreferences, ...allowed }
      if (allowed.waterReminders !== undefined) me.waterSettings.remindersEnabled = allowed.waterReminders
      if (habitReminders !== undefined || rankChangeAlerts !== undefined) {
        const extra = notificationExtra(ctx)
        extra[me.employeeId] = {
          ...extra[me.employeeId],
          ...(habitReminders !== undefined ? { habitReminders } : {}),
          ...(rankChangeAlerts !== undefined ? { rankChangeAlerts } : {}),
        }
      }
      ctx.save()
      return notificationSnapshot(ctx)
    },
  ),
}

/** Days until a pending deletion is carried out (ASSUMPTION — retention period TBC). */
export const DELETION_GRACE_DAYS = 30
export const deletionDueDate = (requestedAt: string) => new Date(new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * DAY_MS).toISOString()
