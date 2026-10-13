/**
 * Business Portal — company configuration:
 * SCR-B-040 Organisation profile, SCR-B-041 Company settings, SCR-B-042 Branding,
 * SCR-B-038 Notification settings (Phase 2), SCR-B-039 AI configuration (Phase 2).
 * Changes are written to the company record / company settings, so the employee app picks them up.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Branding, CompanySettings, CompanySegment, LeaderboardNameDisplay, ModuleCode } from "@/lib/types"
import { MODULE_LABEL } from "@/lib/types"
import { noise } from "@/lib/mock/series"
import { audit, badRequest, endpoint, notFound } from "../core"
import { companyEmployees, companySettings, requireRole, type BusinessCtx } from "./common"

// ─── Colour helpers (shared with the Branding page) ─────────────────────

export const HEX_COLOR = /^#[0-9a-f]{6}$/i

function channel(v: number) {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Buttons and headers put white text on the brand colour: needs ≥ 3:1 (large/bold text). */
export const MIN_BRAND_CONTRAST = 3

export const HEALTHX_BRANDING: Branding = { primaryColor: "#059669", accentColor: "#0ea5e9", logoInitials: "HX", appDisplayName: "HealthX" }

// ─── Types ──────────────────────────────────────────────────────────────

export interface GettingStarted {
  dismissed: boolean
  steps: (SetupStep & { ownerOnly?: boolean })[]
}

export const COMPANY_SIZES = ["1–49", "50–199", "200–499", "500–999", "1,000–4,999", "5,000+"] as const
export const INDUSTRIES = ["IT Services", "Software & SaaS", "Banking & Financial Services", "Insurance", "Healthcare", "Pharmaceuticals", "Manufacturing", "Retail & E-commerce", "Consulting", "Education", "Media & Entertainment", "Logistics", "Telecom", "Government & Public Sector", "Other"] as const

export interface SetupStep {
  key: string
  label: string
  description: string
  done: boolean
  href: string
}

export interface OrganisationProfile {
  id: string
  name: string
  legalName: string
  industry: string
  companySize: string
  segment: CompanySegment
  website: string
  address: string
  city: string
  country: string
  timezone: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
  companyCode: string
  emailDomains: string[]
  createdAt: string
  planName: string
  checklist: SetupStep[]
}

export type OrganisationInput = Omit<OrganisationProfile, "id" | "companyCode" | "emailDomains" | "createdAt" | "planName" | "checklist" | "segment">

export interface ModuleSetting {
  code: ModuleCode
  label: string
  included: boolean
  enabled: boolean
  /** Core modules are always on. */
  locked: boolean
}

export interface CompanySettingsView extends CompanySettings {
  companyName: string
  planName: string
  showProfilePhotos: boolean
  lowParticipationThreshold: number
  modules: ModuleSetting[]
  updatedAt?: string
  updatedBy?: string
}

export type CompanySettingsInput = Partial<
  Pick<
    CompanySettings,
    | "defaultLanguage"
    | "timezone"
    | "weekStartsOn"
    | "leaderboardNameDisplay"
    | "allowLeaderboardOptOut"
    | "allowManualActivity"
    | "manualActivityEarnsPoints"
    | "minAnalyticsGroupSize"
    | "defaultStepGoal"
    | "defaultWaterGoalMl"
  >
> & { showProfilePhotos?: boolean; lowParticipationThreshold?: number; enabledModules?: ModuleCode[] }

export interface BrandingView extends Branding {
  companyName: string
  updatedAt?: string
  defaults: Branding
}

export interface NotificationSettingsView {
  types: { key: NotificationTypeKey; label: string; description: string; enabled: boolean }[]
  quietHoursStart: string
  quietHoursEnd: string
  weeklySummaryDay: "monday" | "friday" | "saturday" | "sunday"
  maxPushesPerDay: number
}

export type NotificationTypeKey =
  | "challengeReminders"
  | "weeklySummary"
  | "rewardUpdates"
  | "inactivityNudges"
  | "waterReminders"
  | "workoutReminders"
  | "streakAlerts"
  | "leaderboardUpdates"
  | "badgeEarned"

export type NotificationSettingsInput = Omit<NotificationSettingsView, "types"> & { types: Record<NotificationTypeKey, boolean> }

export interface AiSettingsView {
  aiCoachEnabled: boolean
  aiInsightsEnabled: boolean
  /** #229 usage controls: coach messages per employee per day. */
  dailyMessageLimit: number
  coachIncluded: boolean
  insightsIncluded: boolean
  planName: string
  usage: { conversationsThisMonth: number; activeUsers: number; insightsDelivered: number; monthlyConversationLimit: number }
  updatedAt?: string
}

// ─── Extra sample data (per company) ────────────────────────────────────

interface ProfileExtra {
  companySize?: string
  website?: string
  address?: string
  primaryContactName?: string
  primaryContactEmail?: string
  primaryContactPhone?: string
}
interface SettingsExtra {
  showProfilePhotos: boolean
  lowParticipationThreshold: number
  reviewed?: boolean
  updatedAt?: string
  updatedBy?: string
  brandingUpdatedAt?: string
  aiUpdatedAt?: string
  aiDailyMessageLimit?: number
  gettingStartedDismissed?: boolean
  notifications?: Partial<Record<NotificationTypeKey, boolean>> & { weeklySummaryDay?: NotificationSettingsView["weeklySummaryDay"]; maxPushesPerDay?: number }
}

const profileExtra = (ctx: BusinessCtx) => {
  const store = ctx.extra<Record<string, ProfileExtra>>("biz-org-profile", () => ({}))
  const id = ctx.companyId()
  store[id] ??= {}
  return store[id]!
}

const settingsExtra = (ctx: BusinessCtx) => {
  const store = ctx.extra<Record<string, SettingsExtra>>("biz-settings-extra", () => ({}))
  const id = ctx.companyId()
  store[id] ??= { showProfilePhotos: true, lowParticipationThreshold: 0.6 }
  return store[id]!
}

/** Participation below this share flags a department/team as "low" (Company settings → Analytics). */
export const lowParticipationThreshold = (ctx: BusinessCtx) => settingsExtra(ctx).lowParticipationThreshold

const OWNER: BusinessSession["role"][] = ["company_owner"]
const OWNER_HR: BusinessSession["role"][] = ["company_owner", "hr_admin"]

/** Always-on modules. Others can be switched off if the company prefers. */
const CORE_MODULES: ModuleCode[] = ["activity", "challenges", "leaderboards", "announcements", "analytics"]
const ALL_MODULES = Object.keys(MODULE_LABEL) as ModuleCode[]

function company(ctx: BusinessCtx) {
  const c = ctx.db.companies.find((x) => x.id === ctx.companyId())
  if (!c) throw notFound("Company")
  return c
}

const plan = (ctx: BusinessCtx) => {
  const c = company(ctx)
  return ctx.db.plans.find((p) => p.id === c.planId)
}

function sizeFor(count: number) {
  if (count < 50) return COMPANY_SIZES[0]
  if (count < 200) return COMPANY_SIZES[1]
  if (count < 500) return COMPANY_SIZES[2]
  if (count < 1000) return COMPANY_SIZES[3]
  if (count < 5000) return COMPANY_SIZES[4]
  return COMPANY_SIZES[5]
}

function checklist(ctx: BusinessCtx): SetupStep[] {
  const c = company(ctx)
  const px = profileExtra(ctx)
  const sx = settingsExtra(ctx)
  const employees = companyEmployees(ctx)
  const admins = employees.filter((e) => e.adminRole)
  const branded = !!c.branding.logoUrl || c.branding.primaryColor.toLowerCase() !== HEALTHX_BRANDING.primaryColor
  return [
    { key: "profile", label: "Complete your organisation profile", description: "Address and primary contact", done: !!(px.address ?? c.city) && !!(px.primaryContactEmail ?? c.ownerEmail), href: "/business-portal/settings/organisation" },
    { key: "branding", label: "Add your logo and colours", description: "Co-brand the employee app", done: branded, href: "/business-portal/settings/branding" },
    { key: "structure", label: "Set up departments and teams", description: "Used for filters, challenges and analytics", done: ctx.db.departments.some((d) => d.companyId === c.id) && ctx.db.teams.some((t) => t.companyId === c.id), href: "/business-portal/departments" },
    { key: "employees", label: "Invite your employees", description: "One by one or with a CSV file", done: employees.length > admins.length + 1, href: "/business-portal/employees" },
    { key: "admins", label: "Add another administrator", description: "An HR Admin or Wellness Manager", done: admins.length > 1, href: "/business-portal/administrators" },
    { key: "settings", label: "Review company settings", description: "Leaderboard privacy and default goals", done: !!sx.reviewed, href: "/business-portal/settings/company" },
    { key: "challenge", label: "Launch your first challenge", description: "The fastest way to get people moving", done: ctx.db.challenges.some((x) => x.companyId === c.id && x.status !== "draft"), href: "/business-portal/challenges/new" },
  ]
}

function profile(ctx: BusinessCtx): OrganisationProfile {
  const c = company(ctx)
  const px = profileExtra(ctx)
  return {
    id: c.id,
    name: c.name,
    legalName: c.legalName,
    industry: c.industry,
    companySize: px.companySize ?? sizeFor(c.employeeCount || companyEmployees(ctx).length),
    segment: c.segment,
    website: px.website ?? `https://www.${c.emailDomains[0] ?? "example.com"}`,
    address: px.address ?? (c.id === "org_nimbus" ? "4th Floor, Prestige Tech Park, Outer Ring Road" : ""),
    city: c.city,
    country: c.country,
    timezone: c.timezone,
    primaryContactName: px.primaryContactName ?? c.ownerName,
    primaryContactEmail: px.primaryContactEmail ?? c.ownerEmail,
    primaryContactPhone: px.primaryContactPhone ?? "",
    companyCode: c.companyCode,
    emailDomains: c.emailDomains,
    createdAt: c.createdAt,
    planName: plan(ctx)?.name ?? "—",
    checklist: checklist(ctx),
  }
}

function settingsView(ctx: BusinessCtx): CompanySettingsView {
  const c = company(ctx)
  const s = companySettings(ctx)
  const sx = settingsExtra(ctx)
  const p = plan(ctx)
  const included = new Set<ModuleCode>(p?.modules ?? c.modules)
  return {
    ...s,
    companyName: c.name,
    planName: p?.name ?? "—",
    showProfilePhotos: sx.showProfilePhotos,
    lowParticipationThreshold: sx.lowParticipationThreshold,
    modules: ALL_MODULES.map((code) => ({ code, label: MODULE_LABEL[code], included: included.has(code), enabled: c.modules.includes(code), locked: CORE_MODULES.includes(code) })),
    updatedAt: sx.updatedAt,
    updatedBy: sx.updatedBy,
  }
}

const NAME_DISPLAY_LABEL: Record<LeaderboardNameDisplay, string> = {
  full_name: "full names",
  first_name_initial: "first name + initial",
  anonymous: "anonymous names",
}

const NOTIFICATION_TYPES: { key: NotificationTypeKey; label: string; description: string; default: boolean }[] = [
  { key: "challengeReminders", label: "Challenge reminders", description: "Start, halfway and last-day nudges for joined challenges.", default: true },
  { key: "weeklySummary", label: "Weekly wellness summary", description: "A short recap of the week, sent on the day you choose.", default: true },
  { key: "rewardUpdates", label: "Reward & order updates", description: "When an order is approved, fulfilled or cancelled.", default: true },
  { key: "inactivityNudges", label: "Inactivity nudges", description: "A friendly reminder after 7 days without activity.", default: false },
  { key: "waterReminders", label: "Water reminders", description: "Employees can still turn these off or change times.", default: true },
  { key: "workoutReminders", label: "Workout reminders", description: "Based on each employee's preferred workout time.", default: true },
  { key: "streakAlerts", label: "Streak alerts", description: "When a streak is about to break.", default: true },
  { key: "leaderboardUpdates", label: "Leaderboard updates", description: "Weekly rank changes in company and team boards.", default: false },
  { key: "badgeEarned", label: "Badges earned", description: "Celebrate new badges straight away.", default: true },
]

export const settingsApi = {
  // ─── Admin getting-started checklist (#354, Phase 2) ────────────────

  gettingStarted: endpoint<void, GettingStarted, "business">("business", "GET", "/organization/getting-started", (_i, ctx) => {
    requireRole(ctx, OWNER_HR)
    const c = company(ctx)
    const employees = companyEmployees(ctx)
    const branded = !!c.branding.logoUrl || c.branding.primaryColor.toLowerCase() !== HEALTHX_BRANDING.primaryColor || !!settingsExtra(ctx).brandingUpdatedAt
    return {
      dismissed: !!settingsExtra(ctx).gettingStartedDismissed,
      steps: [
        { key: "branding", label: "Set up your branding", description: "Logo and colours in the employee app", done: branded, href: "/business-portal/settings/branding", ownerOnly: true },
        { key: "structure", label: "Add departments & teams", description: "Used for challenges, filters and analytics", done: ctx.db.departments.some((d) => d.companyId === c.id) && ctx.db.teams.some((t) => t.companyId === c.id), href: "/business-portal/departments" },
        { key: "employees", label: "Invite your employees", description: "One by one or with a CSV file", done: employees.filter((e) => !e.adminRole).length > 0, href: "/business-portal/employees?invite=1" },
        { key: "challenge", label: "Create your first challenge", description: "The quickest way to get people moving", done: ctx.db.challenges.some((x) => x.companyId === c.id && x.status !== "draft"), href: "/business-portal/challenges/new" },
        { key: "announcement", label: "Send your first announcement", description: "Welcome everyone to HealthX", done: ctx.db.announcements.some((a) => a.companyId === c.id && a.status === "sent"), href: "/business-portal/announcements/new" },
      ],
    }
  }),

  dismissGettingStarted: endpoint<{ dismissed: boolean }, { ok: true }, "business">("business", "POST", "/organization/getting-started/dismiss", ({ dismissed }, ctx) => {
    requireRole(ctx, OWNER_HR)
    settingsExtra(ctx).gettingStartedDismissed = dismissed
    ctx.save()
    return { ok: true }
  }),

  // ─── Organisation profile (SCR-B-040) ───────────────────────────────

  organisation: endpoint<void, OrganisationProfile, "business">("business", "GET", "/organization", (_i, ctx) => {
    requireRole(ctx, OWNER)
    return profile(ctx)
  }),

  updateOrganisation: endpoint<OrganisationInput, OrganisationProfile, "business">("business", "PATCH", "/organization", (input, ctx) => {
    requireRole(ctx, OWNER)
    const errors: Record<string, string> = {}
    if (input.name.trim().length < 2) errors.name = "Enter the company name"
    if (input.legalName.trim().length < 2) errors.legalName = "Enter the registered company name"
    if (!input.industry) errors.industry = "Choose an industry"
    if (!input.city.trim()) errors.city = "Enter a city"
    if (!input.country.trim()) errors.country = "Enter a country"
    if (!input.primaryContactName.trim()) errors.primaryContactName = "Enter a contact name"
    if (!/^\S+@\S+\.\S+$/.test(input.primaryContactEmail.trim())) errors.primaryContactEmail = "Enter a valid email address"
    if (input.website && !/^https?:\/\/\S+\.\S+/.test(input.website.trim())) errors.website = "Enter a full web address, e.g. https://example.com"
    if (input.primaryContactPhone && input.primaryContactPhone.replace(/\D/g, "").length < 10) errors.primaryContactPhone = "Enter a valid phone number"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const c = company(ctx)
    c.name = input.name.trim()
    c.legalName = input.legalName.trim()
    c.industry = input.industry
    c.city = input.city.trim()
    c.country = input.country.trim()
    c.timezone = input.timezone
    const px = profileExtra(ctx)
    Object.assign(px, {
      companySize: input.companySize,
      website: input.website.trim(),
      address: input.address.trim(),
      primaryContactName: input.primaryContactName.trim(),
      primaryContactEmail: input.primaryContactEmail.trim().toLowerCase(),
      primaryContactPhone: input.primaryContactPhone.trim(),
    })
    audit(ctx, { action: "Updated organisation profile", entityType: "Company", entityName: c.name, companyId: c.id })
    ctx.save()
    return profile(ctx)
  }),

  // ─── Company settings (SCR-B-041) ───────────────────────────────────

  settings: endpoint<void, CompanySettingsView, "business">("business", "GET", "/organization/settings", (_i, ctx) => {
    requireRole(ctx, OWNER)
    return settingsView(ctx)
  }),

  updateSettings: endpoint<CompanySettingsInput, CompanySettingsView & { message: string }, "business">("business", "PATCH", "/organization/settings", (input, ctx) => {
    const session = requireRole(ctx, OWNER)
    const errors: Record<string, string> = {}
    if (input.minAnalyticsGroupSize !== undefined && (!Number.isInteger(input.minAnalyticsGroupSize) || input.minAnalyticsGroupSize < 5 || input.minAnalyticsGroupSize > 50))
      errors.minAnalyticsGroupSize = "Use a whole number between 5 and 50 (5 is the privacy minimum)"
    if (input.defaultStepGoal !== undefined && (input.defaultStepGoal < 1000 || input.defaultStepGoal > 50000)) errors.defaultStepGoal = "Use a goal between 1,000 and 50,000 steps"
    if (input.defaultWaterGoalMl !== undefined && (input.defaultWaterGoalMl < 500 || input.defaultWaterGoalMl > 6000)) errors.defaultWaterGoalMl = "Use a goal between 500 and 6,000 ml"
    if (input.lowParticipationThreshold !== undefined && (input.lowParticipationThreshold < 0.1 || input.lowParticipationThreshold > 0.95)) errors.lowParticipationThreshold = "Use a threshold between 10% and 95%"
    if (input.manualActivityEarnsPoints && input.allowManualActivity === false) errors.manualActivityEarnsPoints = "Allow manual activity first"
    if (Object.keys(errors).length) throw badRequest("Couldn't save settings. Please fix the highlighted fields.", errors)

    const s = companySettings(ctx)
    const before = s.leaderboardNameDisplay
    const { showProfilePhotos, lowParticipationThreshold, enabledModules, ...core } = input
    Object.assign(s, Object.fromEntries(Object.entries(core).filter(([, v]) => v !== undefined)))
    // Client decisions #13 and #14: approval is always required and points never expire.
    s.redemptionApprovalRequired = true
    s.pointsExpiryMonths = null
    const sx = settingsExtra(ctx)
    if (showProfilePhotos !== undefined) sx.showProfilePhotos = showProfilePhotos
    if (lowParticipationThreshold !== undefined) sx.lowParticipationThreshold = lowParticipationThreshold
    if (enabledModules) {
      const c = company(ctx)
      const included = new Set(plan(ctx)?.modules ?? c.modules)
      const next = ALL_MODULES.filter((m) => included.has(m) && (CORE_MODULES.includes(m) || enabledModules.includes(m)))
      // Modules outside the plan that were switched on by HealthX stay as they are.
      const extras = c.modules.filter((m) => !included.has(m))
      c.modules = [...next, ...extras]
    }
    sx.reviewed = true
    sx.updatedAt = new Date().toISOString()
    sx.updatedBy = session.user.name
    audit(ctx, { action: "Updated company settings", entityType: "Settings", entityName: company(ctx).name, companyId: ctx.companyId() })
    if (before !== s.leaderboardNameDisplay) audit(ctx, { action: `Leaderboard names now show ${NAME_DISPLAY_LABEL[s.leaderboardNameDisplay]}`, entityType: "Settings", entityName: "Leaderboard privacy", companyId: ctx.companyId(), severity: "warning" })
    ctx.save()
    const message = before !== s.leaderboardNameDisplay ? `Settings saved. Leaderboards now show ${NAME_DISPLAY_LABEL[s.leaderboardNameDisplay]}.` : "Settings saved."
    return { ...settingsView(ctx), message }
  }),

  // ─── Branding (SCR-B-042) ───────────────────────────────────────────

  branding: endpoint<void, BrandingView, "business">("business", "GET", "/organization/branding", (_i, ctx) => {
    requireRole(ctx, OWNER)
    const c = company(ctx)
    return { ...c.branding, companyName: c.name, updatedAt: settingsExtra(ctx).brandingUpdatedAt, defaults: HEALTHX_BRANDING }
  }),

  updateBranding: endpoint<Branding, BrandingView, "business">("business", "PUT", "/organization/branding", (input, ctx) => {
    requireRole(ctx, OWNER)
    const errors: Record<string, string> = {}
    if (!HEX_COLOR.test(input.primaryColor)) errors.primaryColor = "Enter a colour like #0EA5E9"
    else if (contrastRatio(input.primaryColor, "#ffffff") < MIN_BRAND_CONTRAST) errors.primaryColor = "This colour is too light for text."
    if (!HEX_COLOR.test(input.accentColor)) errors.accentColor = "Enter a colour like #10B981"
    if (!/^[A-Za-z0-9]{1,3}$/.test(input.logoInitials.trim())) errors.logoInitials = "Use 1–3 letters or numbers"
    if (input.appDisplayName && input.appDisplayName.trim().length > 30) errors.appDisplayName = "Keep it under 30 characters"
    if (input.logoUrl && (!input.logoUrl.startsWith("data:image/") || input.logoUrl.length > 2_800_000)) errors.logoUrl = "Logo must be PNG, SVG or JPG under 2 MB."
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const c = company(ctx)
    c.branding = {
      primaryColor: input.primaryColor.toLowerCase(),
      accentColor: input.accentColor.toLowerCase(),
      logoInitials: input.logoInitials.trim().toUpperCase(),
      logoUrl: input.logoUrl || undefined,
      appDisplayName: input.appDisplayName?.trim() || undefined,
    }
    settingsExtra(ctx).brandingUpdatedAt = new Date().toISOString()
    audit(ctx, { action: "Updated branding", entityType: "Branding", entityName: c.name, companyId: c.id })
    ctx.save()
    return { ...c.branding, companyName: c.name, updatedAt: settingsExtra(ctx).brandingUpdatedAt, defaults: HEALTHX_BRANDING }
  }),

  // ─── Notification settings (SCR-B-038, Phase 2) ─────────────────────

  notifications: endpoint<void, NotificationSettingsView, "business">("business", "GET", "/organization/notification-settings", (_i, ctx) => {
    requireRole(ctx, OWNER_HR)
    const s = companySettings(ctx)
    const n = settingsExtra(ctx).notifications ?? {}
    const base: Partial<Record<NotificationTypeKey, boolean>> = {
      challengeReminders: s.notifications.challengeReminders,
      weeklySummary: s.notifications.weeklySummary,
      rewardUpdates: s.notifications.rewardUpdates,
      inactivityNudges: s.notifications.inactivityNudges,
    }
    return {
      types: NOTIFICATION_TYPES.map((t) => ({ key: t.key, label: t.label, description: t.description, enabled: base[t.key] ?? n[t.key] ?? t.default })),
      quietHoursStart: s.notifications.quietHoursStart,
      quietHoursEnd: s.notifications.quietHoursEnd,
      weeklySummaryDay: n.weeklySummaryDay ?? "monday",
      maxPushesPerDay: n.maxPushesPerDay ?? 4,
    }
  }),

  updateNotifications: endpoint<NotificationSettingsInput, { ok: true }, "business">("business", "PUT", "/organization/notification-settings", (input, ctx) => {
    requireRole(ctx, OWNER_HR)
    const errors: Record<string, string> = {}
    const time = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!time.test(input.quietHoursStart)) errors.quietHoursStart = "Use HH:MM"
    if (!time.test(input.quietHoursEnd)) errors.quietHoursEnd = "Use HH:MM"
    if (!Number.isInteger(input.maxPushesPerDay) || input.maxPushesPerDay < 1 || input.maxPushesPerDay > 10) errors.maxPushesPerDay = "Choose between 1 and 10"
    if (Object.keys(errors).length) throw badRequest("Couldn't save settings.", errors)
    const s = companySettings(ctx)
    s.notifications = {
      challengeReminders: input.types.challengeReminders,
      weeklySummary: input.types.weeklySummary,
      rewardUpdates: input.types.rewardUpdates,
      inactivityNudges: input.types.inactivityNudges,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
    }
    settingsExtra(ctx).notifications = { ...input.types, weeklySummaryDay: input.weeklySummaryDay, maxPushesPerDay: input.maxPushesPerDay }
    audit(ctx, { action: "Updated notification settings", entityType: "Settings", entityName: "Notifications", companyId: ctx.companyId() })
    ctx.save()
    return { ok: true }
  }),

  // ─── AI configuration (SCR-B-039, Phase 2) ──────────────────────────

  ai: endpoint<void, AiSettingsView, "business">("business", "GET", "/organization/ai-settings", (_i, ctx) => {
    requireRole(ctx, OWNER)
    return aiView(ctx)
  }),

  updateAi: endpoint<{ aiCoachEnabled: boolean; aiInsightsEnabled: boolean; dailyMessageLimit: number }, AiSettingsView, "business">("business", "PUT", "/organization/ai-settings", (input, ctx) => {
    requireRole(ctx, OWNER)
    const view = aiView(ctx)
    if (![10, 20, 30, 50].includes(input.dailyMessageLimit)) throw badRequest("Choose a daily limit.", { dailyMessageLimit: "Choose a daily limit" })
    settingsExtra(ctx).aiDailyMessageLimit = input.dailyMessageLimit
    if (input.aiCoachEnabled && !view.coachIncluded) throw badRequest(`AI Coach isn't included in the ${view.planName} plan. Contact HealthX to add it.`, { aiCoachEnabled: "Not included in your plan" })
    if (input.aiInsightsEnabled && !view.insightsIncluded) throw badRequest(`Weekly AI insights aren't included in the ${view.planName} plan.`, { aiInsightsEnabled: "Not included in your plan" })
    const s = companySettings(ctx)
    s.aiCoachEnabled = input.aiCoachEnabled
    s.aiInsightsEnabled = input.aiInsightsEnabled
    const c = company(ctx)
    if (input.aiCoachEnabled && !c.modules.includes("ai_coach")) c.modules = [...c.modules, "ai_coach"]
    if (!input.aiCoachEnabled) c.modules = c.modules.filter((m) => m !== "ai_coach")
    settingsExtra(ctx).aiUpdatedAt = new Date().toISOString()
    audit(ctx, { action: `AI Coach ${input.aiCoachEnabled ? "enabled" : "disabled"}, weekly insights ${input.aiInsightsEnabled ? "enabled" : "disabled"}, limit ${input.dailyMessageLimit} messages/day`, entityType: "Settings", entityName: "AI configuration", companyId: c.id })
    ctx.save()
    return aiView(ctx)
  }),
}

function aiView(ctx: BusinessCtx): AiSettingsView {
  const c = company(ctx)
  const s = companySettings(ctx)
  const p = plan(ctx)
  // Growth companies get AI as a pilot add-on (enabled by HealthX); Enterprise includes it.
  const coachIncluded = (p?.modules.includes("ai_coach") ?? false) || p?.code === "growth" || c.modules.includes("ai_coach")
  const active = companyEmployees(ctx).filter((e) => e.status === "active").length
  const key = `${c.id}:ai`
  return {
    aiCoachEnabled: s.aiCoachEnabled,
    aiInsightsEnabled: s.aiInsightsEnabled,
    dailyMessageLimit: settingsExtra(ctx).aiDailyMessageLimit ?? 20,
    coachIncluded,
    insightsIncluded: true,
    planName: p?.name ?? "—",
    usage: {
      conversationsThisMonth: s.aiCoachEnabled ? Math.round(active * (2.2 + noise(key, 1))) : 0,
      activeUsers: s.aiCoachEnabled ? Math.round(active * (0.32 + noise(key, 2) * 0.1)) : 0,
      insightsDelivered: s.aiInsightsEnabled ? Math.round(active * 4 * (0.9 + noise(key, 3) * 0.1)) : 0,
      monthlyConversationLimit: Math.max(500, Math.round(c.employeeCount * 5 / 100) * 100),
    },
    updatedAt: settingsExtra(ctx).aiUpdatedAt,
  }
}
