/**
 * Business Portal — self-serve sign-up & 30-day free trial (#353, Phase 2; trial length = client decision #17).
 * Public endpoint: creates the company (status "trial"), its subscription, a starter department/team
 * and the Company Owner account, then signs the owner in.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Company, Department, Employee, Subscription, Team } from "@/lib/types"
import { defaultCompanySettings } from "@/lib/mock/defaults"
import { AVATAR_COLORS } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, newId } from "../core"
import { buildBusinessSession } from "../auth"

export const TRIAL_DAYS = 30
export const SIGNUP_SIZES = ["1–49", "50–199", "200–499", "500–999", "1,000+"] as const

export interface SignupInput {
  companyName: string
  industry: string
  companySize: (typeof SIGNUP_SIZES)[number]
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
  acceptTerms: boolean
}

const FREE_EMAIL = ["gmail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com", "live.com", "icloud.com", "rediffmail.com", "proton.me", "protonmail.com"]
const strong = (p: string) => p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const SEATS: Record<SignupInput["companySize"], number> = { "1–49": 49, "50–199": 199, "200–499": 499, "500–999": 999, "1,000+": 2000 }

export const signupApi = {
  /** Is this work-email domain free to register? (live check on the sign-up form) */
  checkDomain: endpoint<{ email: string }, { available: boolean; message?: string }, "business">("business", "GET", "/auth/signup/check-domain", ({ email }, { db }) => {
    const domain = email.trim().toLowerCase().split("@")[1] ?? ""
    if (!domain) return { available: false }
    if (FREE_EMAIL.includes(domain)) return { available: false, message: "Use your work email, not a personal address." }
    if (db.companies.some((c) => c.emailDomains.includes(domain))) return { available: false, message: `A company with @${domain} already uses HealthX. Ask your HR team to invite you.` }
    return { available: true }
  }),

  register: endpoint<SignupInput, BusinessSession & { trialEndsAt: string }, "business">("business", "POST", "/auth/signup", (input, ctx) => {
    const { db } = ctx
    const errors: Record<string, string> = {}
    const email = input.email.trim().toLowerCase()
    const domain = email.split("@")[1] ?? ""
    if (input.companyName.trim().length < 2) errors.companyName = "Enter your company name"
    if (!input.industry) errors.industry = "Choose an industry"
    if (!input.companySize) errors.companySize = "Choose a company size"
    if (!input.firstName.trim()) errors.firstName = "Enter your first name"
    if (!input.lastName.trim()) errors.lastName = "Enter your last name"
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid work email"
    else if (FREE_EMAIL.includes(domain)) errors.email = "Use your work email, not a personal address"
    else if (db.companies.some((c) => c.emailDomains.includes(domain))) errors.email = `A company with @${domain} already uses HealthX — ask your HR team to invite you`
    else if (db.employees.some((e) => e.email.toLowerCase() === email)) errors.email = "This email already has a HealthX account"
    if (input.phone && input.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a valid mobile number"
    if (!strong(input.password)) errors.password = "Use at least 10 characters with letters, numbers and a symbol"
    if (!input.acceptTerms) errors.acceptTerms = "Accept the Terms of Use and Privacy Policy to continue"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)

    const plan = db.plans.find((p) => p.code === "growth" && p.status === "active") ?? db.plans.find((p) => p.status === "active")
    if (!plan) throw new ApiError("Sign-up is temporarily unavailable. Please contact HealthX.", 503, "unavailable")

    const now = new Date()
    const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 86_400_000)
    const companyId = newId("org")
    const name = input.companyName.trim()
    const initials = name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "CO"
    let code = (name.replace(/[^A-Za-z]/g, "").slice(0, 6) || "TEAM").toUpperCase()
    while (db.companies.some((c) => c.companyCode === code)) code = `${code.slice(0, 5)}${Math.floor(10 + Math.random() * 89)}`
    const seats = SEATS[input.companySize]

    const departmentId = newId("dep")
    const teamId = newId("team")
    const ownerId = newId("emp")
    const owner: Employee = {
      id: ownerId,
      companyId,
      employeeCode: "E0001",
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      jobTitle: "Company Owner",
      departmentId,
      teamId,
      appRole: "employee",
      adminRole: "company_owner",
      status: "active",
      invitedAt: now.toISOString(),
      joinedAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      healthConnected: false,
      avatarColor: AVATAR_COLORS[db.companies.length % AVATAR_COLORS.length]!,
      stats: { stepsToday: 0, stepsWeek: 0, stepsMonth: 0, pointsBalance: 0, pointsLifetime: 0, pointsMonth: 0, workoutsMonth: 0, activeDaysMonth: 0, badgesCount: 0, currentStreak: 0 },
    }
    const subscription: Subscription = {
      id: newId("sub"),
      companyId,
      planId: plan.id,
      status: "trial",
      seats,
      activeSeats: 1,
      billingCycle: plan.billingCycle,
      startDate: now.toISOString().slice(0, 10),
      renewalDate: trialEnds.toISOString().slice(0, 10),
      trialEndsAt: trialEnds.toISOString().slice(0, 10),
      mrr: 0,
      currency: plan.currency,
    }
    const company: Company = {
      id: companyId,
      name,
      legalName: name,
      slug: slugify(name),
      companyCode: code,
      industry: input.industry,
      segment: seats >= 1000 ? "enterprise" : seats >= 100 ? "mid_market" : "smb",
      status: "trial",
      country: "India",
      city: "",
      timezone: "Asia/Kolkata",
      emailDomains: [domain],
      planId: plan.id,
      subscriptionId: subscription.id,
      employeeCount: 1,
      registeredCount: 1,
      activeCount: 1,
      ownerName: `${owner.firstName} ${owner.lastName}`,
      ownerEmail: email,
      branding: { primaryColor: "#059669", accentColor: "#0ea5e9", logoInitials: initials, appDisplayName: undefined },
      modules: [...plan.modules],
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
    }
    const department: Department = { id: departmentId, companyId, name: "General", description: "Starter department — rename or add more under Departments.", createdAt: now.toISOString() }
    const team: Team = { id: teamId, companyId, departmentId, name: "General", description: "Starter team", managerIds: [], createdAt: now.toISOString() }

    db.companies.push(company)
    db.subscriptions.push(subscription)
    db.departments.push(department)
    db.teams.push(team)
    db.employees.push(owner)
    db.settings[companyId] = defaultCompanySettings(companyId)
    plan.companiesCount++
    const accounts = ctx.extra<Record<string, { password?: string; passwordChangedAt?: string; termsAcceptedAt?: string }>>("biz-account", () => ({}))
    accounts[ownerId] = { password: input.password, passwordChangedAt: now.toISOString(), termsAcceptedAt: now.toISOString() }
    db.auditLogs.unshift({
      id: newId("aud"),
      companyId,
      actorName: company.ownerName,
      actorRole: "Company Owner",
      action: `Signed up for a ${TRIAL_DAYS}-day free trial (${plan.name})`,
      entityType: "Company",
      entityName: name,
      ip: "127.0.0.1",
      createdAt: now.toISOString(),
      severity: "info",
    })
    ctx.save()
    return { ...buildBusinessSession(db, owner), trialEndsAt: subscription.trialEndsAt! }
  }),
}
