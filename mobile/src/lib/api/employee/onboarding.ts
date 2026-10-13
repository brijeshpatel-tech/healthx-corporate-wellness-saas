// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — sign-in extras and onboarding:
 * SCR-M-002 App Update Required, SCR-M-011 reset password, SCR-M-012 Terms & Privacy,
 * SCR-M-013 … SCR-M-017 onboarding (profile, goals, permissions, health integration, baseline).
 */
import type { EmployeeSession } from "@/lib/auth/session"
import type { EmployeePrivate } from "@/lib/mock/db"
import type { EmployeePreferences, HealthProvider, WellnessProfile } from "@/lib/types"
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

export type OnboardingStep = "profile" | "goals" | "permissions" | "health" | "baseline"
export const ONBOARDING_STEPS: OnboardingStep[] = ["profile", "goals", "permissions", "health", "baseline"]
export type WellnessGoal = WellnessProfile["mainGoal"]
export type PermissionState = "granted" | "denied" | "skipped"

export interface OnboardingState {
  step: OnboardingStep
  completed: boolean
  termsAccepted: boolean
  company: { name: string; department: string; team: string }
  profile: {
    firstName: string
    lastName: string
    email: string
    phone: string
    gender: WellnessProfile["gender"] | ""
    dateOfBirth: string
    location: string
    timezone: string
    photoUrl: string | null
  }
  wellness: {
    goals: WellnessGoal[]
    heightCm: number | null
    weightKg: number | null
    activityLevel: WellnessProfile["activityLevel"] | ""
    fitnessLevel: WellnessProfile["fitnessLevel"] | ""
    activities: string[]
  }
  permissions: { notifications: PermissionState | null; motion: PermissionState | null }
  health: { provider: HealthProvider | null; connected: boolean; skipped: boolean; dataTypes: string[] }
}

export interface ProfileInput {
  firstName: string
  lastName: string
  phone?: string
  gender?: WellnessProfile["gender"] | ""
  dateOfBirth?: string
  location?: string
  timezone: string
}

export interface WellnessInput {
  goals: WellnessGoal[]
  heightCm: number
  weightKg: number
  activityLevel: WellnessProfile["activityLevel"]
  fitnessLevel: WellnessProfile["fitnessLevel"]
  activities: string[]
}

export interface Baseline {
  firstName: string
  hasData: boolean
  syncedDays: number
  score: number | null
  typicalSteps: number | null
  activeMinutes: number | null
  stepGoal: number
  waterGoalMl: number
  healthConnected: boolean
  goals: WellnessGoal[]
  suggestedChallenge: { id: string; name: string; emoji: string; color: string; points: number } | null
}

export interface LegalDocs {
  version: string
  publishedAt: string
  termsSummary: string[]
  privacySummary: string[]
  termsUrl: string
  privacyUrl: string
  acceptedVersion: string | null
  acceptedAt: string | null
}

export interface AppConfig {
  platform: "ios" | "android" | "web"
  installedVersion: string
  minimumVersion: string
  latestVersion: string
  updateRequired: boolean
  storeUrl: string
  releaseNotes: string[]
}

interface OnboardingExtra {
  step: OnboardingStep
  goals: WellnessGoal[]
  location: string
  timezone: string
  photoUrl: string | null
  profileSaved: boolean
  wellnessSaved: boolean
  permissions: { notifications: PermissionState | null; motion: PermissionState | null }
  healthSkipped: boolean
  legal?: { version: string; at: string; device: string }
}

const LEGAL_VERSION = "2026.1"

const store = (ctx: Ctx) => ctx.extra<Record<string, OnboardingExtra>>("emp-onboarding", () => ({}))

/**
 * Private data for the signed-in employee. A new joiner who hasn't finished onboarding
 * starts with an empty history (the sample generator would otherwise back-fill 90 days).
 */
export function freshMe(ctx: Ctx): EmployeePrivate {
  const s = ctx.session() as EmployeeSession
  if (!ctx.db.private[s.user.id] && !s.onboardingCompleted) {
    const emp = ctx.db.employees.find((e) => e.id === s.user.id)
    if (emp && emp.status !== "invited") {
      const prev = emp.status
      emp.status = "invited"
      try {
        return ctx.me()
      } finally {
        emp.status = prev
      }
    }
  }
  return ctx.me()
}

function extraFor(ctx: Ctx, me: EmployeePrivate): OnboardingExtra {
  const all = store(ctx)
  const existing = all[me.employeeId]
  if (existing) return existing
  const created: OnboardingExtra = {
    step: me.onboardingCompleted ? "baseline" : "profile",
    goals: me.onboardingCompleted ? [me.profile.mainGoal] : [],
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
    photoUrl: null,
    profileSaved: me.onboardingCompleted,
    wellnessSaved: me.onboardingCompleted,
    permissions: { notifications: null, motion: null },
    healthSkipped: false,
  }
  all[me.employeeId] = created
  return created
}

const advance = (x: OnboardingExtra, to: OnboardingStep) => {
  if (ONBOARDING_STEPS.indexOf(to) > ONBOARDING_STEPS.indexOf(x.step)) x.step = to
}

function employeeOf(ctx: Ctx, me: EmployeePrivate) {
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return emp
}

function state(ctx: Ctx): OnboardingState {
  const me = freshMe(ctx)
  const x = extraFor(ctx, me)
  const emp = employeeOf(ctx, me)
  const company = ctx.db.companies.find((c) => c.id === emp.companyId)
  const conn = me.healthConnections.find((h) => (h.provider === "apple_health" || h.provider === "health_connect") && h.status === "connected")
  return {
    step: x.step,
    completed: me.onboardingCompleted,
    termsAccepted: !!me.termsAcceptedAt,
    company: {
      name: company?.name ?? "",
      department: ctx.db.departments.find((d) => d.id === emp.departmentId)?.name ?? "",
      team: ctx.db.teams.find((t) => t.id === emp.teamId)?.name ?? "",
    },
    profile: {
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone ?? "",
      gender: x.profileSaved ? me.profile.gender : emp.gender && emp.gender !== "undisclosed" ? emp.gender : "",
      dateOfBirth: x.profileSaved ? (me.profile.dateOfBirth ?? "") : "",
      location: x.location,
      timezone: x.timezone,
      photoUrl: x.photoUrl,
    },
    wellness: {
      goals: x.goals,
      heightCm: x.wellnessSaved ? me.profile.heightCm : null,
      weightKg: x.wellnessSaved ? me.profile.weightKg : null,
      activityLevel: x.wellnessSaved ? me.profile.activityLevel : "",
      fitnessLevel: x.wellnessSaved ? me.profile.fitnessLevel : "",
      activities: x.wellnessSaved ? me.preferences.activities : [],
    },
    permissions: x.permissions,
    health: { provider: conn?.provider ?? null, connected: !!conn, skipped: x.healthSkipped, dataTypes: conn?.dataTypes ?? [] },
  }
}

/** Typical-day baseline from synced history; also seeds the first Wellness Score. */
function computeBaseline(ctx: Ctx): Baseline {
  const me = freshMe(ctx)
  const emp = employeeOf(ctx, me)
  const x = extraFor(ctx, me)
  const today = toLocalDate(new Date())
  const recent = me.daily.filter((d) => d.date < today).slice(-7)
  const withData = recent.filter((d) => d.steps > 0)
  const hasData = withData.length >= 3
  const typicalSteps = withData.length ? Math.round(withData.reduce((a, d) => a + d.steps, 0) / withData.length / 10) * 10 : null
  const activeMinutes = withData.length ? Math.round(withData.reduce((a, d) => a + d.activeMinutes, 0) / withData.length) : null
  let score: number | null = null
  if (hasData) {
    const latest = [...me.scores].sort((a, b) => a.date.localeCompare(b.date)).filter((s) => s.total > 0)
    if (latest.length) score = latest[latest.length - 1]!.total
    else {
      // Store a first score for each synced day (activity-led; other parts start neutral).
      for (const d of withData) {
        const activity = Math.min(100, Math.round((d.steps / me.profile.dailyStepGoal) * 85))
        const components = { activity, sleep: 60, hydration: 55, exercise: 45, habits: 50, mindfulness: 40 }
        const total = Math.round(activity * 0.25 + 60 * 0.2 + 55 * 0.15 + 45 * 0.2 + 50 * 0.1 + 40 * 0.1)
        const row = me.scores.find((s) => s.date === d.date)
        if (row) Object.assign(row, { total, components })
        else me.scores.push({ date: d.date, total, components })
      }
      me.scores.sort((a, b) => a.date.localeCompare(b.date))
      const last = me.scores.filter((s) => s.total > 0)
      score = last[last.length - 1]?.total ?? null
      const todayRow = me.scores.find((s) => s.date === today)
      const lastRow = last[last.length - 1]
      if (todayRow && lastRow && todayRow.total === 0) Object.assign(todayRow, { total: lastRow.total, components: { ...lastRow.components } })
      ctx.save()
    }
  }
  const challenge = ctx.db.challenges.find((c) => c.companyId === emp.companyId && c.status === "active" && c.audienceType === "all")
  return {
    firstName: emp.firstName,
    hasData,
    syncedDays: withData.length,
    score,
    typicalSteps,
    activeMinutes,
    stepGoal: me.profile.dailyStepGoal,
    waterGoalMl: me.waterSettings.goalMl,
    healthConnected: me.healthConnections.some((h) => h.status === "connected"),
    goals: x.goals,
    suggestedChallenge: challenge ? { id: challenge.id, name: challenge.name, emoji: challenge.coverEmoji, color: challenge.coverColor, points: challenge.points } : null,
  }
}

const HHMM_DATE = /^\d{4}-\d{2}-\d{2}$/
const GOALS: WellnessGoal[] = ["stay_active", "lose_weight", "build_strength", "reduce_stress", "sleep_better", "eat_healthier"]

export const onboardingApi = {
  state: endpoint<void, OnboardingState, "employee">("employee", "GET", "/me/onboarding", (_i, ctx) => {
    const s = state(ctx)
    ctx.save()
    return s
  }),

  saveProfile: endpoint<ProfileInput, OnboardingState, "employee">("employee", "PATCH", "/me/profile", (input, ctx) => {
    const errors: Record<string, string> = {}
    const first = input.firstName?.trim() ?? ""
    const last = input.lastName?.trim() ?? ""
    if (!first) errors.firstName = "Enter your first name"
    else if (first.length > 40) errors.firstName = "Keep it under 40 characters"
    if (!last) errors.lastName = "Enter your last name"
    else if (last.length > 40) errors.lastName = "Keep it under 40 characters"
    const phoneDigits = (input.phone ?? "").replace(/\D/g, "")
    if (input.phone && (phoneDigits.length < 10 || phoneDigits.length > 13)) errors.phone = "Enter a valid mobile number"
    if (input.dateOfBirth) {
      if (!HHMM_DATE.test(input.dateOfBirth)) errors.dateOfBirth = "Enter a valid date"
      else {
        const age = (Date.now() - new Date(`${input.dateOfBirth}T00:00:00`).getTime()) / (365.25 * DAY_MS)
        if (age < 16 || age > 100) errors.dateOfBirth = "Enter a date of birth between 16 and 100 years ago"
      }
    }
    if (!input.timezone) errors.timezone = "Choose your timezone"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const me = freshMe(ctx)
    const emp = employeeOf(ctx, me)
    const x = extraFor(ctx, me)
    emp.firstName = first
    emp.lastName = last
    emp.phone = input.phone?.trim() || emp.phone
    if (input.gender) {
      me.profile.gender = input.gender
      emp.gender = input.gender
    }
    me.profile.dateOfBirth = input.dateOfBirth || undefined
    x.location = input.location?.trim() ?? ""
    x.timezone = input.timezone
    x.profileSaved = true
    advance(x, "goals")
    ctx.save()
    return state(ctx)
  }),

  uploadPhoto: endpoint<{ dataUrl: string | null }, { photoUrl: string | null }, "employee">("employee", "POST", "/me/profile/photo", ({ dataUrl }, ctx) => {
    if (dataUrl && !/^data:image\/(jpeg|png);base64,/.test(dataUrl)) throw badRequest("Photo must be JPG or PNG under 5 MB.")
    if (dataUrl && dataUrl.length > 400_000) throw badRequest("Photo must be JPG or PNG under 5 MB.")
    const me = freshMe(ctx)
    const x = extraFor(ctx, me)
    x.photoUrl = dataUrl
    ctx.save()
    return { photoUrl: x.photoUrl }
  }),

  saveWellness: endpoint<WellnessInput, OnboardingState, "employee">("employee", "PATCH", "/me/wellness-profile", (input, ctx) => {
    const errors: Record<string, string> = {}
    if (!input.goals?.length) errors.goals = "Choose at least one goal"
    else if (input.goals.some((g) => !GOALS.includes(g))) errors.goals = "Choose from the list"
    if (!Number.isFinite(input.heightCm) || input.heightCm < 100 || input.heightCm > 250) errors.heightCm = "Enter a height between 100 and 250 cm."
    if (!Number.isFinite(input.weightKg) || input.weightKg < 30 || input.weightKg > 300) errors.weightKg = "Enter a weight between 30 and 300 kg."
    if (!input.activityLevel) errors.activityLevel = "Choose your activity level"
    if (!input.fitnessLevel) errors.fitnessLevel = "Choose your fitness level"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const me = freshMe(ctx)
    const x = extraFor(ctx, me)
    me.profile.heightCm = Math.round(input.heightCm)
    me.profile.weightKg = Math.round(input.weightKg * 10) / 10
    me.profile.activityLevel = input.activityLevel
    me.profile.fitnessLevel = input.fitnessLevel
    me.profile.mainGoal = input.goals[0]!
    me.preferences.activities = input.activities
    // Personalise defaults from the answers (company default goals apply first).
    if (!x.wellnessSaved) {
      const emp = employeeOf(ctx, me)
      const settings = ctx.db.settings[emp.companyId]
      const base = settings?.defaultStepGoal ?? 8000
      me.profile.dailyStepGoal = input.activityLevel === "sedentary" ? Math.min(base, 6000) : input.activityLevel === "very_active" ? Math.max(base, 10000) : base
      const level: Record<string, EmployeePreferences["workoutDurationMin"]> = { beginner: 10, intermediate: 20, advanced: 30 }
      me.preferences.workoutDurationMin = level[input.fitnessLevel] ?? 20
    }
    x.goals = input.goals
    x.wellnessSaved = true
    advance(x, "permissions")
    ctx.save()
    return state(ctx)
  }),

  savePermissions: endpoint<{ notifications: PermissionState; motion: PermissionState; pushToken?: string }, OnboardingState, "employee">("employee", "POST", "/me/devices", (input, ctx) => {
    const me = freshMe(ctx)
    const x = extraFor(ctx, me)
    x.permissions = { notifications: input.notifications, motion: input.motion }
    me.notificationPreferences.push = input.notifications === "granted"
    const consent = me.consents.find((c) => c.key === "notifications")
    if (consent) {
      consent.granted = input.notifications === "granted"
      consent.updatedAt = new Date().toISOString()
    }
    advance(x, "health")
    ctx.save()
    return state(ctx)
  }),

  connectHealth: endpoint<{ provider: "apple_health" | "health_connect"; dataTypes: string[] }, OnboardingState & { syncedDays: number }, "employee">(
    "employee",
    "POST",
    "/me/health-connections",
    ({ provider, dataTypes }, ctx) => {
      if (!dataTypes?.length) throw badRequest("Choose at least one type of data to share.", { dataTypes: "Choose at least one" })
      const me = freshMe(ctx)
      const emp = employeeOf(ctx, me)
      const x = extraFor(ctx, me)
      const conn = me.healthConnections.find((h) => h.provider === provider)
      if (!conn) throw new ApiError(`We couldn't connect to ${provider === "apple_health" ? "Apple Health" : "Health Connect"}. You can try again from Profile > Connected apps.`, 502, "health_connect_failed")
      const now = new Date().toISOString()
      conn.status = "connected"
      conn.connectedAt = now
      conn.lastSyncAt = now
      conn.dataTypes = dataTypes
      emp.healthConnected = true
      const consent = me.consents.find((c) => c.key === "wearable_connection")
      if (consent) {
        consent.granted = true
        consent.updatedAt = now
      }
      // First sync: last 7 days (ASSUMPTION). Fill days that have no data yet.
      const today = new Date()
      let syncedDays = 0
      if (dataTypes.includes("Steps")) {
        for (let i = 7; i >= 0; i--) {
          const date = toLocalDate(new Date(today.getTime() - i * DAY_MS))
          let row = me.daily.find((d) => d.date === date)
          if (!row) {
            row = { date, steps: 0, distanceKm: 0, activeCalories: 0, activeMinutes: 0, goalSteps: me.profile.dailyStepGoal }
            me.daily.push(row)
          }
          if (row.steps > 0) {
            syncedDays++
            continue
          }
          const dow = new Date(`${date}T12:00:00`).getDay()
          const fraction = i === 0 ? Math.min(1, Math.max(0.15, (today.getHours() - 6) / 15)) : 1
          const steps = Math.round((5200 + noise(`${emp.id}:${date}`, 1) * 5600) * (dow === 0 || dow === 6 ? 0.75 : 1) * fraction)
          Object.assign(row, { steps, distanceKm: Number((steps * 0.00076).toFixed(2)), activeCalories: Math.round(steps * 0.042), activeMinutes: Math.round(steps / 150) })
          syncedDays++
        }
        me.daily.sort((a, b) => a.date.localeCompare(b.date))
        emp.stats.stepsToday = me.daily.find((d) => d.date === toLocalDate(today))?.steps ?? 0
      }
      x.healthSkipped = false
      advance(x, "baseline")
      ctx.save()
      return { ...state(ctx), syncedDays }
    },
  ),

  skipHealth: endpoint<void, OnboardingState, "employee">("employee", "POST", "/me/onboarding/skip-health", (_i, ctx) => {
    const me = freshMe(ctx)
    const x = extraFor(ctx, me)
    x.healthSkipped = true
    advance(x, "baseline")
    ctx.save()
    return state(ctx)
  }),

  baseline: endpoint<void, Baseline, "employee">("employee", "GET", "/me/baseline", (_i, ctx) => computeBaseline(ctx)),

  complete: endpoint<void, { ok: true }, "employee">("employee", "POST", "/me/onboarding/complete", (_i, ctx) => {
    const me = freshMe(ctx)
    const emp = employeeOf(ctx, me)
    const x = extraFor(ctx, me)
    me.onboardingCompleted = true
    me.termsAcceptedAt = me.termsAcceptedAt ?? new Date().toISOString()
    if (emp.status === "invited" || emp.status === "registered") emp.status = "active"
    emp.joinedAt = emp.joinedAt ?? new Date().toISOString()
    emp.lastActiveAt = new Date().toISOString()
    x.step = "baseline"
    // Welcome notification.
    if (!me.notifications.some((n) => n.title.startsWith("You're all set"))) {
      me.notifications.unshift({ id: `ntf_${Date.now().toString(36)}`, type: "system", title: "You're all set 🎉", body: "Log water, try a workout or join a challenge to start earning points.", createdAt: new Date().toISOString(), read: false, href: "/employee-app/challenges" })
    }
    ctx.save()
    return { ok: true }
  }),
}

export const legalApi = {
  current: endpoint<void, LegalDocs, "employee">("employee", "GET", "/legal/current", (_i, ctx) => {
    const me = freshMe(ctx)
    const x = extraFor(ctx, me)
    return {
      version: LEGAL_VERSION,
      publishedAt: "2026-06-01T00:00:00.000Z",
      termsSummary: [
        "HealthX is a wellness and engagement app — not a medical service. Talk to a doctor about health concerns.",
        "Use the app fairly: don't fake activity or misuse rewards. Points and rewards follow your company's rules.",
        "Your company can end access when you leave; your personal data is then handled as described in the Privacy Policy.",
      ],
      privacySummary: [
        "Your health data (steps, water, sleep, workouts) is private to you and encrypted.",
        "Your employer only sees combined figures for groups of 5 or more people — never your individual data.",
        "You can download or delete your data and change your consents at any time in Settings.",
      ],
      termsUrl: "https://healthx.life/legal/terms",
      privacyUrl: "https://healthx.life/legal/privacy",
      acceptedVersion: me.termsAcceptedAt ? (x.legal?.version ?? LEGAL_VERSION) : null,
      acceptedAt: me.termsAcceptedAt ?? null,
    }
  }),

  accept: endpoint<{ version: string; termsAccepted: boolean; privacyAccepted: boolean; device: string }, { ok: true; acceptedAt: string }, "employee">(
    "employee",
    "POST",
    "/me/legal-acceptances",
    (input, ctx) => {
      if (!input.termsAccepted || !input.privacyAccepted) throw badRequest("Please accept both the Terms of Use and the Privacy Policy to continue.")
      if (input.version !== LEGAL_VERSION) throw new ApiError("A newer version of our terms is available. Please review it.", 409, "legal_version_changed")
      const me = freshMe(ctx)
      const x = extraFor(ctx, me)
      const at = new Date().toISOString()
      me.termsAcceptedAt = at
      x.legal = { version: input.version, at, device: input.device.slice(0, 120) }
      const consent = me.consents.find((c) => c.key === "health_data")
      if (consent) {
        consent.granted = true
        consent.updatedAt = at
      }
      ctx.save()
      return { ok: true, acceptedAt: at }
    },
  ),
}

export const accountApi = {
  resetPassword: endpoint<{ token: string; password: string }, { ok: true }, "employee">("employee", "POST", "/auth/password/reset", ({ token, password }) => {
    if (!token || token.toLowerCase() === "expired") throw new ApiError("This reset link has expired. Request a new one.", 410, "reset_link_expired")
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw badRequest("Use at least 8 characters with letters and numbers.", { password: "At least 8 characters with letters and numbers" })
    return { ok: true }
  }),

  appConfig: endpoint<{ platform: "ios" | "android" | "web"; version: string }, AppConfig, "employee">("employee", "GET", "/app/config", ({ platform, version }, ctx) => {
    const key = platform === "android" ? "app.min_version_android" : "app.min_version_ios"
    const configured = String(ctx.db.systemSettings.find((s) => s.key === key)?.value ?? "1.0.0")
    // Demo: pretend the store has 2.4.0 and the minimum is at least 2.0.0.
    const minimumVersion = cmp(configured, "2.0.0") > 0 ? configured : "2.0.0"
    return {
      platform,
      installedVersion: version,
      minimumVersion,
      latestVersion: "2.4.0",
      updateRequired: cmp(version, minimumVersion) < 0,
      storeUrl: platform === "android" ? "https://play.google.com/store/apps/details?id=life.healthx.app" : "https://apps.apple.com/app/healthx/id0000000000",
      releaseNotes: ["Faster step syncing with Apple Health and Health Connect", "New workout player with rest timer", "Security and privacy improvements"],
    }
  }),
}

/** Compares semantic versions ("2.10.0" > "2.9.1"). */
function cmp(a: string, b: string) {
  const pa = a.split(".").map((n) => Number(n) || 0)
  const pb = b.split(".").map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}
