/**
 * Platform Admin — companies (SCR-P-003 Companies, SCR-P-004 Company Detail, SCR-P-005 Create / Edit Company).
 * Company figures are aggregates only — no individual employee health data is ever returned.
 */
import { defaultCompanySettings } from "@/lib/mock/defaults"
import { dailySeries, DAY_MS, localDaysFromNow, noise } from "@/lib/mock/series"
import type {
  AuditLog,
  BillingCycle,
  Company,
  CompanySegment,
  CompanyStatus,
  Invoice,
  ListParams,
  ModuleCode,
  Paginated,
  Plan,
  Subscription,
  SubscriptionStatus,
} from "@/lib/types"
import { MODULE_LABEL } from "@/lib/types"
import { audit, badRequest, endpoint, matchesSearch, paginate, sortBy } from "../core"
import { findCompany, planOf, ratio, requireAdmin, toCsv, today, withinDays, type AdminCtx } from "./common"
import { addDirectoryUser, companyAdmins, companyUsers, initCompanyDirectory, updateDirectoryUser, type DirectoryUser } from "./directory"

// ─── Types ──────────────────────────────────────────────────────────────

export interface CompanyQuery extends ListParams {
  status?: CompanyStatus | "all"
  planId?: string
  segment?: CompanySegment | "all"
  industry?: string
}

export interface CompanyRow extends Company {
  planName: string
  subscriptionStatus: SubscriptionStatus | null
  renewalDate: string | null
  trialEndsAt: string | null
  mrr: number
  currency: "INR" | "USD"
  /** Registered ÷ invited. */
  adoption: number
  /** Active ÷ registered. */
  activeRate: number
}

export type CompanyStatusCounts = Record<CompanyStatus | "all", number>

export interface CompanyLookups {
  plans: Pick<Plan, "id" | "name" | "code" | "status" | "modules" | "pricePerEmployee" | "currency" | "billingCycle" | "minEmployees" | "maxEmployees" | "supportLevel">[]
  industries: string[]
  countries: string[]
  timezones: string[]
}

export interface OwnerInvitation {
  status: "pending" | "accepted" | "expired"
  sentAt: string
  expiresAt: string
  resentCount: number
}

export interface SupportSession {
  companyId: string
  by: string
  reason: string
  startedAt: string
  expiresAt: string
}

export interface StatusChange {
  status: CompanyStatus
  reason?: string
  by: string
  at: string
  previousStatus?: CompanyStatus
}

export interface CompanyUsage {
  invited: number
  registered: number
  active: number
  monthlyActiveWellnessParticipants: number
  wellnessEngagementRate: number
  healthConnectedRate: number
  activeChallenges: number
  pointsAwarded30d: number
  rewardsRedeemed30d: number
  trend: { date: string; active: number }[]
  moduleAdoption: { module: ModuleCode; label: string; rate: number }[]
}

export interface CompanyDetail {
  company: CompanyRow
  plan: Plan | null
  subscription: Subscription | null
  admins: DirectoryUser[]
  ownerInvitation: OwnerInvitation | null
  usage: CompanyUsage
  invoices: Invoice[]
  audit: AuditLog[]
  supportSession: SupportSession | null
  lastStatusChange: StatusChange | null
  /** Email of a real company-owner account that can open the Business Portal (demo data). */
  businessPortalEmail: string | null
}

export interface CompanyInput {
  name: string
  legalName: string
  companyCode: string
  industry: string
  segment: CompanySegment
  country: string
  city: string
  timezone: string
  emailDomains: string[]
  planId: string
  seats: number
  billingCycle: BillingCycle
  startDate: string
  status: Extract<CompanyStatus, "onboarding" | "trial" | "active">
  modules: ModuleCode[]
  ownerName: string
  ownerEmail: string
  primaryColor: string
  sendInvite: boolean
}

export type UpdateCompanyInput = Partial<Omit<CompanyInput, "sendInvite" | "startDate">> & { id: string; renewalDate?: string }

// ─── Constants ──────────────────────────────────────────────────────────

const INDUSTRIES = ["IT Services", "Software", "Banking", "Insurance", "Manufacturing", "Education", "Healthcare", "BPO / KPO", "Retail", "Logistics", "Pharmaceuticals", "Consulting", "Media", "Hospitality", "Other"]
const COUNTRIES = ["India", "United Arab Emirates", "Singapore", "United Kingdom", "United States"]
const TIMEZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York"]
const TRIAL_DAYS = 30
const INVITE_DAYS = 14

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_RE = /^[A-Z0-9]{3,12}$/

// ─── Extra state (owned by this feature) ────────────────────────────────

const inviteStore = (ctx: AdminCtx) => ctx.extra<Record<string, OwnerInvitation>>("admin-owner-invites", () => ({}))
const supportStore = (ctx: AdminCtx) => ctx.extra<Record<string, SupportSession>>("admin-support-sessions", () => ({}))
const statusStore = (ctx: AdminCtx) => ctx.extra<Record<string, StatusChange[]>>("admin-company-status", () => ({}))

// ─── Helpers ────────────────────────────────────────────────────────────

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

const segmentFor = (seats: number): CompanySegment => (seats >= 1000 ? "enterprise" : seats >= 100 ? "mid_market" : "smb")

const subscriptionOf = (ctx: AdminCtx, c: Company) => ctx.db.subscriptions.find((s) => s.id === c.subscriptionId) ?? ctx.db.subscriptions.find((s) => s.companyId === c.id)

/** Keep the headcount figures of companies with real employee records in sync. */
function liveCounts(ctx: AdminCtx, c: Company) {
  const emps = ctx.db.employees.filter((e) => e.companyId === c.id)
  if (!emps.length) return { invited: c.employeeCount, registered: c.registeredCount, active: c.activeCount }
  return {
    invited: emps.filter((e) => e.status !== "deactivated").length,
    registered: emps.filter((e) => e.status === "registered" || e.status === "active" || e.status === "inactive").length,
    active: emps.filter((e) => e.status === "active").length,
  }
}

export function toCompanyRow(ctx: AdminCtx, c: Company): CompanyRow {
  const sub = subscriptionOf(ctx, c)
  const counts = liveCounts(ctx, c)
  return {
    ...c,
    employeeCount: counts.invited,
    registeredCount: counts.registered,
    activeCount: counts.active,
    planName: planOf(ctx, c.planId)?.name ?? "No plan",
    subscriptionStatus: sub?.status ?? null,
    renewalDate: sub?.renewalDate ?? null,
    trialEndsAt: sub?.trialEndsAt ?? null,
    mrr: sub?.mrr ?? 0,
    currency: sub?.currency ?? "INR",
    adoption: ratio(counts.registered, counts.invited),
    activeRate: ratio(counts.active, counts.registered),
  }
}

function ownerInvitation(ctx: AdminCtx, c: Company): OwnerInvitation | null {
  const stored = inviteStore(ctx)[c.id]
  if (stored) {
    const owner = companyAdmins(ctx, c.id).find((u) => u.role === "company_owner")
    if (owner && owner.status !== "invited") return { ...stored, status: "accepted" }
    if (stored.status === "pending" && new Date(stored.expiresAt).getTime() < Date.now()) return { ...stored, status: "expired" }
    return stored
  }
  const owner = companyAdmins(ctx, c.id).find((u) => u.role === "company_owner")
  if (!owner) return null
  return {
    status: owner.status === "invited" ? "pending" : "accepted",
    sentAt: owner.invitedAt,
    expiresAt: new Date(new Date(owner.invitedAt).getTime() + INVITE_DAYS * DAY_MS).toISOString(),
    resentCount: 0,
  }
}

function usageFor(ctx: AdminCtx, c: Company): CompanyUsage {
  const counts = liveCounts(ctx, c)
  const key = `company:${c.id}`
  const emps = ctx.db.employees.filter((e) => e.companyId === c.id)
  const live = c.status !== "suspended" && c.status !== "onboarding"
  const mawp = emps.length
    ? emps.filter((e) => (e.status === "active" || e.status === "registered") && e.stats.activeDaysMonth >= 1).length
    : Math.round(counts.active * (0.82 + noise(key, 1) * 0.12))
  const activeChallenges = emps.length
    ? ctx.db.challenges.filter((ch) => ch.companyId === c.id && ch.status === "active").length
    : live
      ? 1 + Math.floor(noise(key, 2) * 5)
      : 0
  const points = emps.length ? emps.reduce((a, e) => a + e.stats.pointsMonth, 0) : Math.round(counts.active * (650 + noise(key, 3) * 500))
  const redeemed = ctx.db.orders.filter((o) => o.companyId === c.id && withinDays(o.createdAt, 30) && o.status !== "cancelled" && o.status !== "rejected").length
  const healthConnectedRate = emps.length
    ? ratio(emps.filter((e) => e.healthConnected).length, counts.registered)
    : counts.registered
      ? 0.6 + noise(key, 4) * 0.3
      : 0
  const trend = dailySeries(`${key}:active`, 30, {
    base: Math.max(0, counts.active * (c.status === "suspended" ? 0.02 : 0.74)),
    variance: 0.09,
    trend: c.status === "onboarding" ? 0.5 : 0.06,
    weekendDip: 0.3,
    max: Math.max(counts.registered, 1),
  }).map((p) => ({ date: p.date, active: Math.round(p.value) }))
  const BASE: Partial<Record<ModuleCode, number>> = { activity: 0.92, water: 0.64, challenges: 0.58, leaderboards: 0.51, rewards: 0.38, workouts: 0.34, habits: 0.29, announcements: 0.72, analytics: 0.08, sleep: 0.31, programs: 0.18, content: 0.27, nutrition: 0.16, ai_coach: 0.22, integrations: 0.05 }
  const moduleAdoption = c.modules
    .filter((m) => m !== "analytics" && m !== "integrations")
    .map((m, i) => ({ module: m, label: MODULE_LABEL[m], rate: counts.active ? Math.min(0.99, Math.max(0.02, (BASE[m] ?? 0.2) * (0.8 + noise(key, 10 + i) * 0.4))) : 0 }))
    .sort((a, b) => b.rate - a.rate)
  return {
    invited: counts.invited,
    registered: counts.registered,
    active: counts.active,
    monthlyActiveWellnessParticipants: mawp,
    wellnessEngagementRate: ratio(mawp, counts.invited),
    healthConnectedRate,
    activeChallenges,
    pointsAwarded30d: points,
    rewardsRedeemed30d: redeemed,
    trend,
    moduleAdoption,
  }
}

function companyAudit(ctx: AdminCtx, c: Company) {
  return ctx.db.auditLogs.filter((l) => l.companyId === c.id || (l.companyId === null && l.entityName === c.name)).slice(0, 60)
}

function validate(ctx: AdminCtx, input: Partial<CompanyInput>, existing?: Company) {
  const errors: Record<string, string> = {}
  const others = ctx.db.companies.filter((c) => c.id !== existing?.id)
  if (input.name !== undefined) {
    if (input.name.trim().length < 2) errors.name = "Enter the company name"
    else if (others.some((c) => c.name.toLowerCase() === input.name!.trim().toLowerCase())) errors.name = "A company with this name already exists"
  }
  if (input.legalName !== undefined && !input.legalName.trim()) errors.legalName = "Enter the legal name"
  if (input.companyCode !== undefined) {
    const code = input.companyCode.trim().toUpperCase()
    if (!CODE_RE.test(code)) errors.companyCode = "3–12 letters or numbers, no spaces"
    else if (others.some((c) => c.companyCode.toUpperCase() === code)) errors.companyCode = "Company code already in use."
  }
  if (input.emailDomains !== undefined) {
    const domains = input.emailDomains.map((d) => d.trim().toLowerCase())
    const bad = domains.find((d) => !DOMAIN_RE.test(d))
    const taken = domains.find((d) => others.some((c) => c.emailDomains.includes(d)))
    if (!domains.length) errors.emailDomains = "Add at least one email domain"
    else if (bad) errors.emailDomains = `“${bad}” isn't a valid domain`
    else if (taken) errors.emailDomains = `${taken} is already used by another company`
  }
  if (input.ownerName !== undefined && input.ownerName.trim().length < 2) errors.ownerName = "Enter the owner's full name"
  if (input.ownerEmail !== undefined) {
    const email = input.ownerEmail.trim().toLowerCase()
    const domains = (input.emailDomains ?? existing?.emailDomains ?? []).map((d) => d.toLowerCase())
    if (!EMAIL_RE.test(email)) errors.ownerEmail = "Enter a valid email address"
    else if (domains.length && !domains.some((d) => email.endsWith(`@${d}`))) errors.ownerEmail = `Use one of the company's domains (${domains.map((d) => `@${d}`).join(", ")})`
  }
  let plan: Plan | undefined
  if (input.planId !== undefined) {
    plan = planOf(ctx, input.planId)
    if (!plan) errors.planId = "Choose a plan"
    else if (plan.status !== "active" && plan.id !== existing?.planId) errors.planId = "This plan isn't available for new subscriptions"
  }
  plan ??= existing ? planOf(ctx, existing.planId) : undefined
  if (input.seats !== undefined) {
    if (!Number.isInteger(input.seats) || input.seats < 1) errors.seats = "Enter at least 1 seat"
    else if (plan?.maxEmployees && input.seats > plan.maxEmployees) errors.seats = `${plan.name} covers up to ${plan.maxEmployees.toLocaleString("en-IN")} employees — choose a bigger plan`
  }
  if (input.modules !== undefined && plan) {
    const notIncluded = input.modules.find((m) => !plan!.modules.includes(m))
    if (notIncluded) errors.modules = `${MODULE_LABEL[notIncluded]} isn't included in the ${plan.name} plan`
    else if (!input.modules.length) errors.modules = "Enable at least one module"
  }
  if (input.timezone !== undefined && !input.timezone) errors.timezone = "Choose a timezone"
  if (input.city !== undefined && !input.city.trim()) errors.city = "Enter the city"
  return errors
}

function sendOwnerInvite(ctx: AdminCtx, c: Company, resend = false) {
  const store = inviteStore(ctx)
  const prev = store[c.id]
  const sentAt = new Date().toISOString()
  store[c.id] = { status: "pending", sentAt, expiresAt: new Date(Date.now() + INVITE_DAYS * DAY_MS).toISOString(), resentCount: resend ? (prev?.resentCount ?? 0) + 1 : 0 }
  const owner = companyAdmins(ctx, c.id).find((u) => u.role === "company_owner")
  if (owner && owner.status === "invited") updateDirectoryUser(ctx, owner.id, { invitedAt: sentAt })
}

// ─── Service ────────────────────────────────────────────────────────────

export const companiesApi = {
  list: endpoint<CompanyQuery, Paginated<CompanyRow> & { counts: CompanyStatusCounts }, "admin">("admin", "GET", "/platform/organizations", (q, ctx) => {
    requireAdmin(ctx)
    const base = ctx.db.companies.filter(
      (c) =>
        (!q.planId || q.planId === "all" || c.planId === q.planId) &&
        (!q.segment || q.segment === "all" || c.segment === q.segment) &&
        (!q.industry || q.industry === "all" || c.industry === q.industry) &&
        matchesSearch(q.search, c.name, c.legalName, c.companyCode, c.city, c.ownerName, c.ownerEmail, ...c.emailDomains),
    )
    const counts: CompanyStatusCounts = { all: base.length, active: 0, onboarding: 0, trial: 0, suspended: 0 }
    base.forEach((c) => counts[c.status]++)
    const rows = base.filter((c) => !q.status || q.status === "all" || c.status === q.status).map((c) => toCompanyRow(ctx, c))
    const key = q.sort ?? "name"
    const sorted = sortBy(
      rows,
      (r) =>
        key === "employees" ? r.employeeCount : key === "created" ? r.createdAt : key === "renewal" ? r.renewalDate ?? "9999" : key === "mrr" ? r.mrr : key === "adoption" ? r.adoption : r.name.toLowerCase(),
      q.order ?? (key === "employees" || key === "created" || key === "mrr" || key === "adoption" ? "desc" : "asc"),
    )
    return { ...paginate(sorted, q.page ?? 1, q.pageSize ?? 15), counts }
  }),

  lookups: endpoint<void, CompanyLookups, "admin">("admin", "GET", "/platform/organizations/lookups", (_i, ctx) => {
    requireAdmin(ctx)
    const industries = [...new Set([...INDUSTRIES, ...ctx.db.companies.map((c) => c.industry)])].sort()
    return {
      plans: ctx.db.plans.map(({ id, name, code, status, modules, pricePerEmployee, currency, billingCycle, minEmployees, maxEmployees, supportLevel }) => ({ id, name, code, status, modules, pricePerEmployee, currency, billingCycle, minEmployees, maxEmployees, supportLevel })),
      industries,
      countries: COUNTRIES,
      timezones: TIMEZONES,
    }
  }),

  /** Suggests a free company code from a name (e.g. "Acme Health" → ACME01). */
  suggestCode: endpoint<{ name: string }, { code: string }, "admin">("admin", "GET", "/platform/organizations/code-suggestion", ({ name }, ctx) => {
    requireAdmin(ctx)
    const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean)
    const stem = (words.length > 1 ? words.map((w) => w[0]).join("") + (words[0] ?? "").slice(1, 4) : (words[0] ?? "HX").slice(0, 6)).slice(0, 8) || "HX"
    const taken = new Set(ctx.db.companies.map((c) => c.companyCode.toUpperCase()))
    if (stem.length >= 3 && !taken.has(stem)) return { code: stem }
    for (let i = 1; i < 100; i++) {
      const code = `${stem.slice(0, 8)}${String(i).padStart(2, "0")}`
      if (!taken.has(code)) return { code }
    }
    return { code: `${stem.slice(0, 6)}${Date.now().toString(36).slice(-4).toUpperCase()}` }
  }),

  get: endpoint<{ id: string }, CompanyDetail, "admin">("admin", "GET", "/platform/organizations/:id", ({ id }, ctx) => {
    requireAdmin(ctx)
    const c = findCompany(ctx, id)
    const sub = subscriptionOf(ctx, c) ?? null
    const session = supportStore(ctx)[c.id]
    const owner = ctx.db.employees.find((e) => e.companyId === c.id && e.adminRole === "company_owner" && e.status !== "deactivated")
    const history = statusStore(ctx)[c.id] ?? []
    return {
      company: toCompanyRow(ctx, c),
      plan: planOf(ctx, c.planId) ?? null,
      subscription: sub,
      admins: companyAdmins(ctx, c.id),
      ownerInvitation: ownerInvitation(ctx, c),
      usage: usageFor(ctx, c),
      invoices: ctx.db.invoices.filter((i) => i.companyId === c.id).sort((a, b) => b.periodStart.localeCompare(a.periodStart)).slice(0, 6),
      audit: companyAudit(ctx, c),
      supportSession: session && new Date(session.expiresAt).getTime() > Date.now() ? session : null,
      lastStatusChange: history[history.length - 1] ?? null,
      businessPortalEmail: owner?.email ?? null,
    }
  }),

  create: endpoint<CompanyInput, CompanyRow, "admin">("admin", "POST", "/platform/organizations", (input, ctx) => {
    const s = requireAdmin(ctx, "companies.manage")
    const errors = validate(ctx, input)
    if (!input.startDate) errors.startDate = "Choose a start date"
    if (Object.keys(errors).length) throw badRequest(errors.companyCode === "Company code already in use." ? "Company code already in use." : "Please fix the highlighted fields.", errors)
    const plan = planOf(ctx, input.planId)!
    const slug = slugify(input.name)
    let id = `org_${slug.slice(0, 18)}`
    while (ctx.db.companies.some((c) => c.id === id)) id = `${id}_${Math.floor(Math.random() * 90 + 10)}`
    const now = new Date().toISOString()
    const trial = input.status === "trial"
    const subscription: Subscription = {
      id: `sub_${id.slice(4)}`,
      companyId: id,
      planId: plan.id,
      status: trial ? "trial" : "active",
      seats: input.seats,
      activeSeats: 0,
      billingCycle: input.billingCycle,
      startDate: input.startDate,
      renewalDate: (() => {
        const d = new Date(input.startDate)
        if (input.billingCycle === "annual") d.setFullYear(d.getFullYear() + 1)
        else d.setMonth(d.getMonth() + 1)
        return d.toISOString().slice(0, 10)
      })(),
      trialEndsAt: trial ? new Date(new Date(input.startDate).getTime() + TRIAL_DAYS * DAY_MS).toISOString().slice(0, 10) : undefined,
      mrr: 0,
      currency: plan.currency,
    }
    const company: Company = {
      id,
      name: input.name.trim(),
      legalName: input.legalName.trim(),
      slug,
      companyCode: input.companyCode.trim().toUpperCase(),
      industry: input.industry,
      segment: input.segment ?? segmentFor(input.seats),
      status: input.status,
      country: input.country,
      city: input.city.trim(),
      timezone: input.timezone,
      emailDomains: input.emailDomains.map((d) => d.trim().toLowerCase()),
      planId: plan.id,
      subscriptionId: subscription.id,
      employeeCount: 0,
      registeredCount: 0,
      activeCount: 0,
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      branding: { primaryColor: input.primaryColor, accentColor: "#10b981", logoInitials: initials(input.name) || "HX" },
      modules: input.modules,
      createdAt: now,
      lastActivityAt: now,
    }
    ctx.db.companies.push(company)
    ctx.db.subscriptions.push(subscription)
    ctx.db.settings[id] = defaultCompanySettings(id)
    ctx.db.settings[id]!.timezone = company.timezone
    initCompanyDirectory(ctx, id)
    const [first, ...rest] = company.ownerName.split(" ")
    addDirectoryUser(ctx, {
      companyId: id,
      firstName: first ?? company.ownerName,
      lastName: rest.join(" ") || "—",
      email: company.ownerEmail,
      jobTitle: "Company Owner",
      role: "company_owner",
      status: "invited",
      invitedAt: now,
      avatarColor: input.primaryColor,
      activeSessions: 0,
    })
    statusStore(ctx)[id] = [{ status: company.status, by: s.user.name, at: now }]
    audit(ctx, { action: "Created company", entityType: "Company", entityName: company.name, companyId: id })
    if (input.sendInvite) {
      sendOwnerInvite(ctx, company)
      audit(ctx, { action: "Sent owner invitation", entityType: "Invitation", entityName: company.ownerEmail, companyId: id })
    }
    ctx.save()
    return toCompanyRow(ctx, company)
  }),

  update: endpoint<UpdateCompanyInput, CompanyRow, "admin">("admin", "PATCH", "/platform/organizations/:id", (input, ctx) => {
    requireAdmin(ctx, "companies.manage")
    const c = findCompany(ctx, input.id)
    const errors = validate(ctx, input, c)
    const sub = subscriptionOf(ctx, c)
    if (input.renewalDate && sub && input.renewalDate <= sub.startDate) errors.renewalDate = "Renewal must be after the start date"
    if (Object.keys(errors).length) throw badRequest(errors.companyCode === "Company code already in use." ? "Company code already in use." : "Please fix the highlighted fields.", errors)
    const ownerChanged = (input.ownerEmail && input.ownerEmail.trim().toLowerCase() !== c.ownerEmail) || (input.ownerName && input.ownerName.trim() !== c.ownerName)
    const planChanged = input.planId && input.planId !== c.planId

    if (input.name !== undefined) {
      c.name = input.name.trim()
      c.branding.logoInitials = initials(c.name) || c.branding.logoInitials
    }
    if (input.legalName !== undefined) c.legalName = input.legalName.trim()
    if (input.companyCode !== undefined) c.companyCode = input.companyCode.trim().toUpperCase()
    if (input.industry !== undefined) c.industry = input.industry
    if (input.segment !== undefined) c.segment = input.segment
    if (input.country !== undefined) c.country = input.country
    if (input.city !== undefined) c.city = input.city.trim()
    if (input.timezone !== undefined) c.timezone = input.timezone
    if (input.emailDomains !== undefined) c.emailDomains = input.emailDomains.map((d) => d.trim().toLowerCase())
    if (input.status !== undefined && c.status !== "suspended") c.status = input.status
    if (input.primaryColor !== undefined) c.branding.primaryColor = input.primaryColor
    if (input.planId !== undefined) c.planId = input.planId
    if (input.modules !== undefined) c.modules = input.modules
    else if (planChanged) c.modules = c.modules.filter((m) => planOf(ctx, c.planId)!.modules.includes(m))
    if (sub) {
      const plan = planOf(ctx, c.planId)!
      sub.planId = plan.id
      if (input.seats !== undefined) sub.seats = input.seats
      if (input.billingCycle !== undefined) sub.billingCycle = input.billingCycle
      if (input.renewalDate) sub.renewalDate = input.renewalDate
      sub.currency = plan.currency
      if (sub.status !== "trial" && sub.status !== "cancelled") sub.mrr = sub.activeSeats * plan.pricePerEmployee
    }
    if (ownerChanged) {
      if (input.ownerName) c.ownerName = input.ownerName.trim()
      if (input.ownerEmail) c.ownerEmail = input.ownerEmail.trim().toLowerCase()
      const owner = companyUsers(ctx, c.id).find((u) => u.role === "company_owner")
      const [first, ...rest] = c.ownerName.split(" ")
      if (owner) updateDirectoryUser(ctx, owner.id, { firstName: first, lastName: rest.join(" ") || "—", email: c.ownerEmail })
    }
    if (input.timezone !== undefined && ctx.db.settings[c.id]) ctx.db.settings[c.id]!.timezone = c.timezone
    audit(ctx, { action: planChanged ? "Changed company plan" : "Updated company", entityType: "Company", entityName: c.name, companyId: c.id, severity: planChanged ? "warning" : "info" })
    ctx.save()
    return toCompanyRow(ctx, c)
  }),

  suspend: endpoint<{ id: string; reason: string }, CompanyRow, "admin">("admin", "POST", "/platform/organizations/:id/suspend", ({ id, reason }, ctx) => {
    const s = requireAdmin(ctx, "companies.manage")
    const c = findCompany(ctx, id)
    if (!reason || reason.trim().length < 5) throw badRequest("A reason is required to suspend a company.", { reason: "Explain why (at least 5 characters)" })
    if (c.status === "suspended") throw badRequest("This company is already suspended.")
    const history = (statusStore(ctx)[c.id] ??= [])
    history.push({ status: "suspended", previousStatus: c.status, reason: reason.trim(), by: s.user.name, at: new Date().toISOString() })
    c.status = "suspended"
    delete supportStore(ctx)[c.id]
    audit(ctx, { action: "Suspended company", entityType: "Company", entityName: c.name, companyId: c.id, severity: "critical" })
    ctx.save()
    return toCompanyRow(ctx, c)
  }),

  reactivate: endpoint<{ id: string }, CompanyRow, "admin">("admin", "POST", "/platform/organizations/:id/reactivate", ({ id }, ctx) => {
    const s = requireAdmin(ctx, "companies.manage")
    const c = findCompany(ctx, id)
    if (c.status !== "suspended") throw badRequest("Only suspended companies can be reactivated.")
    const history = (statusStore(ctx)[c.id] ??= [])
    const last = [...history].reverse().find((h) => h.status === "suspended")
    const next: CompanyStatus = last?.previousStatus && last.previousStatus !== "suspended" ? last.previousStatus : "active"
    history.push({ status: next, previousStatus: "suspended", by: s.user.name, at: new Date().toISOString() })
    c.status = next
    c.lastActivityAt = new Date().toISOString()
    const sub = subscriptionOf(ctx, c)
    if (sub && sub.status === "past_due") sub.status = "active"
    audit(ctx, { action: "Reactivated company", entityType: "Company", entityName: c.name, companyId: c.id, severity: "warning" })
    ctx.save()
    return toCompanyRow(ctx, c)
  }),

  resendOwnerInvite: endpoint<{ id: string }, OwnerInvitation, "admin">("admin", "POST", "/platform/organizations/:id/owner-invitation/resend", ({ id }, ctx) => {
    requireAdmin(ctx, "companies.support")
    const c = findCompany(ctx, id)
    const current = ownerInvitation(ctx, c)
    if (current?.status === "accepted") throw badRequest(`${c.ownerName} has already accepted the invitation.`)
    if (c.status === "suspended") throw badRequest("Reactivate the company before sending invitations.")
    sendOwnerInvite(ctx, c, true)
    audit(ctx, { action: "Resent owner invitation", entityType: "Invitation", entityName: c.ownerEmail, companyId: c.id })
    ctx.save()
    return inviteStore(ctx)[c.id]!
  }),

  updateModules: endpoint<{ id: string; modules: ModuleCode[] }, CompanyRow, "admin">("admin", "PUT", "/platform/organizations/:id/modules", ({ id, modules }, ctx) => {
    requireAdmin(ctx, "companies.manage")
    const c = findCompany(ctx, id)
    const errors = validate(ctx, { modules }, c)
    if (errors.modules) throw badRequest(errors.modules, errors)
    const added = modules.filter((m) => !c.modules.includes(m))
    const removed = c.modules.filter((m) => !modules.includes(m))
    c.modules = modules
    audit(ctx, {
      action: "Updated company modules",
      entityType: "Company",
      entityName: `${c.name}${added.length ? ` · +${added.map((m) => MODULE_LABEL[m]).join(", ")}` : ""}${removed.length ? ` · −${removed.map((m) => MODULE_LABEL[m]).join(", ")}` : ""}`,
      companyId: c.id,
      severity: "warning",
    })
    ctx.save()
    return toCompanyRow(ctx, c)
  }),

  /** Time-boxed support access (read-only), always audit-logged with a reason. */
  openAsSupport: endpoint<{ id: string; reason: string }, SupportSession, "admin">("admin", "POST", "/platform/organizations/:id/support-session", ({ id, reason }, ctx) => {
    const s = requireAdmin(ctx, "companies.support")
    const c = findCompany(ctx, id)
    if (!reason || reason.trim().length < 5) throw badRequest("Give a reason for support access.", { reason: "Explain why (at least 5 characters), e.g. a ticket number" })
    if (c.status === "suspended") throw badRequest("Support access isn't available while the company is suspended.")
    const session: SupportSession = { companyId: c.id, by: s.user.name, reason: reason.trim(), startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }
    supportStore(ctx)[c.id] = session
    audit(ctx, { action: "Viewed company as support", entityType: "Company", entityName: `${c.name} — ${session.reason}`, companyId: c.id, severity: "warning" })
    ctx.save()
    return session
  }),

  endSupport: endpoint<{ id: string }, { ok: true }, "admin">("admin", "DELETE", "/platform/organizations/:id/support-session", ({ id }, ctx) => {
    requireAdmin(ctx, "companies.support")
    const c = findCompany(ctx, id)
    delete supportStore(ctx)[c.id]
    audit(ctx, { action: "Ended support session", entityType: "Company", entityName: c.name, companyId: c.id })
    ctx.save()
    return { ok: true }
  }),

  exportCsv: endpoint<CompanyQuery, { fileName: string; csv: string }, "admin">("admin", "GET", "/platform/organizations/export", (q, ctx) => {
    requireAdmin(ctx)
    const rows = ctx.db.companies
      .filter(
        (c) =>
          (!q.status || q.status === "all" || c.status === q.status) &&
          (!q.planId || q.planId === "all" || c.planId === q.planId) &&
          (!q.segment || q.segment === "all" || c.segment === q.segment) &&
          matchesSearch(q.search, c.name, c.companyCode, c.city),
      )
      .map((c) => toCompanyRow(ctx, c))
    const csv = toCsv(
      ["Company", "Legal name", "Code", "Plan", "Status", "Segment", "Industry", "City", "Invited", "Registered", "Active", "Subscription", "MRR", "Renewal", "Created"],
      rows.map((r) => [r.name, r.legalName, r.companyCode, r.planName, r.status, r.segment, r.industry, r.city, r.employeeCount, r.registeredCount, r.activeCount, r.subscriptionStatus ?? "", r.mrr, r.renewalDate ?? "", r.createdAt.slice(0, 10)]),
    )
    audit(ctx, { action: "Exported companies (CSV)", entityType: "Report", entityName: `${rows.length} companies` })
    ctx.save()
    return { fileName: `healthx-companies-${today()}.csv`, csv }
  }),
}

/** Default renewal/start values for the create form. */
export const companyFormDefaults = () => ({ startDate: today(), renewalDate: localDaysFromNow(365) })
