// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Builds the complete sample database used when NEXT_PUBLIC_USE_MOCK_API is on
 * (or no API URL is configured). Data is generated once, then persisted in the
 * browser so changes made in the UI survive reloads.
 */
import type {
  Announcement,
  AuditLog,
  Badge,
  Challenge,
  ChallengeMetric,
  ChallengeParticipant,
  ChallengeTemplate,
  Company,
  CompanySettings,
  ContentItem,
  Department,
  Employee,
  EmployeeStatus,
  Exercise,
  FoodItem,
  HabitDefinition,
  ImportJob,
  Integration,
  Invitation,
  Invoice,
  Location,
  OrderStatus,
  Plan,
  PlatformAdmin,
  PointsRule,
  PointsTransaction,
  RedemptionOrder,
  Reward,
  RewardCategory,
  SupportTicket,
  Subscription,
  SystemSetting,
  Team,
  WellnessProgram,
  WellnessScoreConfig,
  Workout,
} from "@/lib/types"
import {
  AVATAR_COLORS,
  DAY_MS,
  chance,
  faker,
  float,
  int,
  isoBetweenDaysAgo,
  localDaysAgo,
  localDaysFromNow,
  makeId,
  pick,
  resetIds,
  seedRandom,
} from "../random"
import {
  BADGES,
  CHALLENGE_TEMPLATES,
  COMPANY_REWARDS,
  CONTENT,
  EXERCISES,
  FOODS,
  GLOBAL_REWARDS,
  HABITS,
  OTHER_COMPANIES,
  PLANS,
  POINTS_RULES,
  PROGRAMS,
  REWARD_CATEGORIES,
  SYSTEM_SETTINGS,
  WORKOUTS,
} from "./catalog"
import type { EmployeePrivate } from "./private"
import { DEMO_ACCOUNTS, DEMO_COMPANY_ID, DEMO_INVITE_TOKEN } from "../demo-accounts"
import { defaultCompanySettings } from "../defaults"

export const SEED_VERSION = 3


// ─── Database shape ─────────────────────────────────────────────────────

export interface MockDB {
  version: number
  seededAt: string
  companies: Company[]
  plans: Plan[]
  subscriptions: Subscription[]
  invoices: Invoice[]
  platformAdmins: PlatformAdmin[]
  departments: Department[]
  teams: Team[]
  locations: Location[]
  employees: Employee[]
  invitations: Invitation[]
  importJobs: ImportJob[]
  settings: Record<string, CompanySettings>
  rewardSettings: Record<string, { hiddenGlobalRewardIds: string[]; monthlyBudgetPoints: number | null }>
  challenges: Challenge[]
  participants: ChallengeParticipant[]
  challengeTemplates: ChallengeTemplate[]
  pointsRules: PointsRule[]
  pointsTransactions: PointsTransaction[]
  badges: Badge[]
  rewardCategories: RewardCategory[]
  rewards: Reward[]
  orders: RedemptionOrder[]
  announcements: Announcement[]
  content: ContentItem[]
  programs: WellnessProgram[]
  exercises: Exercise[]
  workouts: Workout[]
  habits: HabitDefinition[]
  foods: FoodItem[]
  scoreConfigs: WellnessScoreConfig[]
  systemSettings: SystemSetting[]
  auditLogs: AuditLog[]
  supportTickets: SupportTicket[]
  integrations: Integration[]
  /** Employee-only private data, created on first sign-in to the employee app. */
  private: Record<string, EmployeePrivate>
  /** Free space for screens that need extra sample data (keyed by feature). */
  extra: Record<string, unknown>
}

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

const segmentFor = (employees: number): Company["segment"] =>
  employees >= 1000 ? "enterprise" : employees >= 100 ? "mid_market" : "smb"

const planFor = (employees: number) =>
  employees >= 1000 ? "plan_enterprise" : employees >= 100 ? "plan_growth" : "plan_starter"

// ─── Nimbus Technologies structure ──────────────────────────────────────

const NIMBUS_STRUCTURE: { name: string; size: number; teams: string[]; titles: string[] }[] = [
  { name: "Engineering", size: 96, teams: ["Platform", "Mobile", "Web", "QA & Automation", "DevOps"], titles: ["Software Engineer", "Senior Software Engineer", "Staff Engineer", "QA Engineer", "DevOps Engineer", "Tech Lead"] },
  { name: "Product & Design", size: 28, teams: ["Product Management", "Design"], titles: ["Product Manager", "Senior Product Manager", "Product Designer", "UX Researcher"] },
  { name: "Sales", size: 44, teams: ["Enterprise Sales", "Inside Sales"], titles: ["Account Executive", "Sales Development Rep", "Regional Sales Manager"] },
  { name: "Marketing", size: 24, teams: ["Growth Marketing", "Brand & Content"], titles: ["Marketing Manager", "Content Strategist", "Performance Marketer", "Designer"] },
  { name: "Customer Success", size: 36, teams: ["Support", "Onboarding"], titles: ["Support Specialist", "Customer Success Manager", "Onboarding Specialist"] },
  { name: "People & HR", size: 14, teams: ["People Operations"], titles: ["HR Generalist", "Talent Partner", "People Ops Specialist"] },
  { name: "Finance & Operations", size: 22, teams: ["Finance", "Facilities & Admin"], titles: ["Accountant", "Finance Analyst", "Admin Executive", "Operations Manager"] },
]

interface NamedSeed {
  first: string
  last: string
  dept: string
  team: string
  title: string
  appRole: Employee["appRole"]
  adminRole?: Employee["adminRole"]
  status: EmployeeStatus
  activity: number
}

const NAMED: NamedSeed[] = [
  { first: "Ananya", last: "Iyer", dept: "Finance & Operations", team: "Finance", title: "Co-founder & COO", appRole: "employee", adminRole: "company_owner", status: "active", activity: 9200 },
  { first: "Vikram", last: "Mehta", dept: "People & HR", team: "People Operations", title: "HR Business Partner", appRole: "employee", adminRole: "hr_admin", status: "active", activity: 7600 },
  { first: "Sneha", last: "Kapoor", dept: "People & HR", team: "People Operations", title: "Employee Wellbeing Lead", appRole: "employee", adminRole: "wellness_manager", status: "active", activity: 11800 },
  { first: "Rahul", last: "Verma", dept: "Engineering", team: "Mobile", title: "Engineering Manager", appRole: "team_manager", status: "active", activity: 10400 },
  { first: "Priya", last: "Sharma", dept: "Engineering", team: "Mobile", title: "Senior Software Engineer", appRole: "employee", status: "active", activity: 9600 },
  { first: "Karan", last: "Malhotra", dept: "Engineering", team: "Mobile", title: "Software Engineer", appRole: "employee", status: "invited", activity: 7000 },
]

function employeeStats(status: EmployeeStatus, base: number) {
  if (status === "invited" || status === "deactivated") {
    return { stepsToday: 0, stepsWeek: 0, stepsMonth: 0, pointsBalance: 0, pointsLifetime: 0, pointsMonth: 0, workoutsMonth: 0, activeDaysMonth: 0, badgesCount: 0, currentStreak: 0 }
  }
  const factor = status === "inactive" ? 0.08 : status === "registered" ? 0.35 : 1
  const daily = base * factor
  const hour = new Date().getHours()
  const dayFraction = Math.min(1, Math.max(0.15, (hour - 6) / 15))
  const stepsToday = Math.round(daily * dayFraction * float(0.7, 1.25))
  const stepsWeek = Math.round(daily * 7 * float(0.85, 1.15))
  const stepsMonth = Math.round(daily * 30 * float(0.85, 1.15))
  const workoutsMonth = status === "active" ? int(0, 14) : int(0, 2)
  const activeDaysMonth = status === "active" ? int(12, 30) : status === "registered" ? int(2, 10) : int(0, 3)
  const pointsMonth = Math.round(Math.min(150, daily / 100) * activeDaysMonth + workoutsMonth * 50 + int(0, 300))
  const pointsLifetime = Math.round(pointsMonth * float(3, 9))
  const pointsBalance = Math.round(pointsLifetime * float(0.35, 0.85))
  return {
    stepsToday,
    stepsWeek,
    stepsMonth,
    pointsBalance,
    pointsLifetime,
    pointsMonth,
    workoutsMonth,
    activeDaysMonth,
    badgesCount: status === "active" ? int(1, 9) : int(0, 2),
    currentStreak: status === "active" ? int(0, 24) : 0,
  }
}

// ─── Builder ────────────────────────────────────────────────────────────

export function buildSeed(): MockDB {
  seedRandom(20261012)
  resetIds()
  const now = new Date()
  const nowIso = now.toISOString()

  // Catalogues
  const plans: Plan[] = PLANS.map((p) => ({ ...p }))
  const pointsRules: PointsRule[] = POINTS_RULES.map((r) => ({ ...r }))
  const badges: Badge[] = BADGES.map((b) => ({ ...b }))
  const rewardCategories = REWARD_CATEGORIES.map((c) => ({ ...c }))
  const exercises = EXERCISES.map((e) => ({ ...e }))
  const workouts: Workout[] = WORKOUTS.map((w, i) => ({
    ...w,
    id: `wo_${String(i + 1).padStart(3, "0")}`,
    companyId: null,
    status: i === WORKOUTS.length - 1 ? "draft" : "published",
    completions: int(120, 4800),
    updatedAt: isoBetweenDaysAgo(120, 3),
  }))
  workouts.push({
    ...WORKOUTS[0]!,
    id: "wo_nimbus_01",
    companyId: DEMO_COMPANY_ID,
    name: "Nimbus Stand-up Stretch",
    description: "Our own 5-minute stretch routine, made for the Monday stand-up.",
    durationMin: 5,
    status: "published",
    completions: 214,
    updatedAt: isoBetweenDaysAgo(30, 2),
  })
  const habits: HabitDefinition[] = HABITS.map((h, i) => ({
    ...h,
    id: `hab_${String(i + 1).padStart(3, "0")}`,
    status: "active",
    usersCount: int(80, 3200),
  }))
  const foods: FoodItem[] = FOODS.map((f, i) => ({ ...f, id: `food_${String(i + 1).padStart(3, "0")}` }))
  const challengeTemplates: ChallengeTemplate[] = CHALLENGE_TEMPLATES.map((t, i) => ({
    ...t,
    id: `tpl_${String(i + 1).padStart(3, "0")}`,
    status: i === CHALLENGE_TEMPLATES.length - 1 ? "draft" : "published",
    usageCount: int(3, 64),
    updatedAt: isoBetweenDaysAgo(90, 5),
  }))
  const systemSettings: SystemSetting[] = SYSTEM_SETTINGS.map((s) => ({ ...s, updatedAt: isoBetweenDaysAgo(60, 1) }))
  const scoreConfigs: WellnessScoreConfig[] = [
    { version: 1, weights: { activity: 30, sleep: 15, hydration: 15, exercise: 20, habits: 10, mindfulness: 10 }, updatedAt: "2026-04-02T09:00:00.000Z", updatedBy: "Arjun Nair", note: "Initial configuration" },
    { version: 2, weights: { activity: 25, sleep: 20, hydration: 15, exercise: 20, habits: 10, mindfulness: 10 }, updatedAt: "2026-07-14T09:00:00.000Z", updatedBy: "Arjun Nair", note: "Aligned with SRS §12 default weights" },
  ]

  // Platform admins
  const platformAdmins: PlatformAdmin[] = [
    ...DEMO_ACCOUNTS.platform.map((a, i) => ({
      id: `padm_${i + 1}`,
      name: a.name,
      email: a.email,
      role: a.role,
      status: "active" as const,
      mfaEnabled: true,
      lastLoginAt: isoBetweenDaysAgo(3, 0),
      createdAt: "2026-02-01T09:00:00.000Z",
      avatarColor: AVATAR_COLORS[i]!,
    })),
    { id: "padm_4", name: "Ishaan Gupta", email: "ishaan.gupta@healthx.life", role: "support_admin", status: "active", mfaEnabled: true, lastLoginAt: isoBetweenDaysAgo(6, 1), createdAt: "2026-05-11T09:00:00.000Z", avatarColor: AVATAR_COLORS[4]! },
    { id: "padm_5", name: "Tara Menon", email: "tara.menon@healthx.life", role: "content_admin", status: "invited", mfaEnabled: false, createdAt: isoBetweenDaysAgo(4, 2), avatarColor: AVATAR_COLORS[5]! },
    { id: "padm_6", name: "Dev Khanna", email: "dev.khanna@healthx.life", role: "support_admin", status: "disabled", mfaEnabled: true, lastLoginAt: isoBetweenDaysAgo(90, 60), createdAt: "2026-03-03T09:00:00.000Z", avatarColor: AVATAR_COLORS[6]! },
  ]

  // ── Companies ──
  const companies: Company[] = []
  const subscriptions: Subscription[] = []
  const invoices: Invoice[] = []

  const nimbus: Company = {
    id: DEMO_COMPANY_ID,
    name: "Nimbus Technologies",
    legalName: "Nimbus Technologies Pvt Ltd",
    slug: "nimbus-technologies",
    companyCode: "NIMBUS",
    industry: "IT Services",
    segment: "mid_market",
    status: "active",
    country: "India",
    city: "Bengaluru",
    timezone: "Asia/Kolkata",
    emailDomains: ["nimbustech.in"],
    planId: "plan_growth",
    subscriptionId: "sub_nimbus",
    employeeCount: 0,
    registeredCount: 0,
    activeCount: 0,
    ownerName: "Ananya Iyer",
    ownerEmail: "ananya.iyer@nimbustech.in",
    branding: { primaryColor: "#0ea5e9", accentColor: "#10b981", logoInitials: "NT", appDisplayName: "Nimbus Wellness" },
    modules: plans.find((p) => p.id === "plan_growth")!.modules,
    createdAt: "2026-03-18T10:00:00.000Z",
    lastActivityAt: nowIso,
  }
  companies.push(nimbus)

  const statusPool: Company["status"][] = ["active", "active", "active", "active", "active", "active", "trial", "onboarding", "active", "active"]
  OTHER_COMPANIES.forEach((c, i) => {
    const id = `org_${slugify(c.name).slice(0, 18)}`
    const planId = planFor(c.employees)
    const status: Company["status"] = i === 7 ? "suspended" : i === 13 || i === 19 ? "trial" : i === 17 || i === 21 ? "onboarding" : pick(statusPool)
    const registered = status === "onboarding" ? Math.round(c.employees * float(0.05, 0.3)) : Math.round(c.employees * float(0.6, 0.93))
    const active = status === "suspended" ? 0 : Math.round(registered * float(0.55, 0.88))
    const words = c.name.split(" ")
    const domain = `${words[0]!.toLowerCase()}${words[1] ? words[1].toLowerCase().slice(0, 4) : ""}.com`
    companies.push({
      id,
      name: c.name,
      legalName: `${c.name} ${c.industry === "Banking" ? "Ltd" : "Pvt Ltd"}`,
      slug: slugify(c.name),
      companyCode: words.map((w) => w[0]).join("").toUpperCase().padEnd(3, "X") + int(10, 99),
      industry: c.industry,
      segment: segmentFor(c.employees),
      status,
      country: "India",
      city: c.city,
      timezone: "Asia/Kolkata",
      emailDomains: [domain],
      planId,
      subscriptionId: `sub_${id.slice(4)}`,
      employeeCount: c.employees,
      registeredCount: registered,
      activeCount: active,
      ownerName: faker.person.fullName(),
      ownerEmail: `owner@${domain}`,
      branding: { primaryColor: pick(AVATAR_COLORS), accentColor: pick(AVATAR_COLORS), logoInitials: initials(c.name) },
      modules: plans.find((p) => p.id === planId)!.modules,
      createdAt: isoBetweenDaysAgo(240, 10),
      lastActivityAt: status === "suspended" ? isoBetweenDaysAgo(40, 20) : isoBetweenDaysAgo(2, 0),
    })
  })

  // ── Nimbus departments, teams, locations ──
  const locations: Location[] = [
    { id: "loc_blr", companyId: DEMO_COMPANY_ID, name: "Bengaluru HQ", city: "Bengaluru", country: "India", address: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103", timezone: "Asia/Kolkata" },
    { id: "loc_pune", companyId: DEMO_COMPANY_ID, name: "Pune Office", city: "Pune", country: "India", address: "Level 7, Panchshil Business Park, Viman Nagar, Pune 411014", timezone: "Asia/Kolkata" },
    { id: "loc_ggn", companyId: DEMO_COMPANY_ID, name: "Gurugram Office", city: "Gurugram", country: "India", address: "Tower B, DLF Cyber City, Phase 2, Gurugram 122002", timezone: "Asia/Kolkata" },
  ]
  const departments: Department[] = []
  const teams: Team[] = []
  for (const d of NIMBUS_STRUCTURE) {
    const deptId = `dep_${slugify(d.name).slice(0, 14)}`
    departments.push({ id: deptId, companyId: DEMO_COMPANY_ID, name: d.name, description: `${d.name} at Nimbus Technologies`, locationId: "loc_blr", createdAt: "2026-03-20T10:00:00.000Z" })
    for (const t of d.teams) {
      teams.push({ id: `team_${slugify(t).slice(0, 16)}`, companyId: DEMO_COMPANY_ID, departmentId: deptId, name: t, managerIds: [], createdAt: "2026-03-20T10:00:00.000Z" })
    }
  }
  const deptByName = new Map(departments.map((d) => [d.name, d]))
  const teamByName = new Map(teams.map((t) => [t.name, t]))

  // ── Nimbus employees ──
  const employees: Employee[] = []
  const usedEmails = new Set<string>()
  let code = 1001

  const addEmployee = (s: NamedSeed) => {
    const dept = deptByName.get(s.dept)!
    const team = teamByName.get(s.team)!
    let email = `${s.first}.${s.last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@nimbustech.in"
    while (usedEmails.has(email)) email = email.replace("@", `${int(1, 99)}@`)
    usedEmails.add(email)
    const invitedAgo = int(30, 200)
    const joined = s.status !== "invited"
    const emp: Employee = {
      id: `emp_${code}`,
      companyId: DEMO_COMPANY_ID,
      employeeCode: `NT${code}`,
      firstName: s.first,
      lastName: s.last,
      email,
      phone: chance(0.8) ? `+91 9${int(100000000, 999999999)}` : undefined,
      jobTitle: s.title,
      departmentId: dept.id,
      teamId: team.id,
      locationId: pick(["loc_blr", "loc_blr", "loc_blr", "loc_pune", "loc_ggn"]),
      appRole: s.appRole,
      adminRole: s.adminRole,
      status: s.status,
      invitedAt: new Date(Date.now() - invitedAgo * DAY_MS).toISOString(),
      joinedAt: joined ? new Date(Date.now() - (invitedAgo - int(0, 5)) * DAY_MS).toISOString() : undefined,
      lastActiveAt: !joined ? undefined : s.status === "inactive" ? isoBetweenDaysAgo(60, 21) : s.status === "deactivated" ? isoBetweenDaysAgo(120, 60) : isoBetweenDaysAgo(s.status === "registered" ? 12 : 2, 0),
      healthConnected: joined && s.status !== "deactivated" && chance(s.status === "active" ? 0.92 : 0.5),
      avatarColor: pick(AVATAR_COLORS),
      gender: pick(["female", "male", "female", "male", "undisclosed"] as const),
      stats: employeeStats(s.status, s.activity),
    }
    code++
    employees.push(emp)
    return emp
  }

  NAMED.forEach((n) => addEmployee(n))
  for (const d of NIMBUS_STRUCTURE) {
    const existing = employees.filter((e) => e.departmentId === deptByName.get(d.name)!.id).length
    for (let i = existing; i < d.size; i++) {
      const roll = faker.number.float({ min: 0, max: 1 })
      const status: EmployeeStatus = roll < 0.7 ? "active" : roll < 0.78 ? "registered" : roll < 0.88 ? "inactive" : roll < 0.97 ? "invited" : "deactivated"
      const sex = pick(["female", "male"] as const)
      addEmployee({
        first: faker.person.firstName(sex),
        last: faker.person.lastName(),
        dept: d.name,
        team: pick(d.teams),
        title: pick(d.titles),
        appRole: "employee",
        status,
        activity: Math.round(Math.exp(float(Math.log(3200), Math.log(14500), 3))),
      })
    }
  }

  // Team managers: Rahul manages Mobile; pick one active member for every other team
  for (const team of teams) {
    if (team.name === "Mobile") {
      team.managerIds = [employees.find((e) => e.firstName === "Rahul" && e.lastName === "Verma")!.id]
      continue
    }
    const candidate = employees.find((e) => e.teamId === team.id && e.status === "active" && !e.adminRole)
    if (candidate) {
      candidate.appRole = "team_manager"
      candidate.jobTitle = candidate.jobTitle.includes("Manager") ? candidate.jobTitle : `${team.name} Lead`
      team.managerIds = [candidate.id]
    }
  }
  for (const dept of departments) {
    const head = employees.find((e) => e.departmentId === dept.id && e.appRole === "team_manager")
    dept.headEmployeeId = head?.id
  }

  // Fixed, demo-friendly figures for the named demo users
  for (const e of employees) {
    if (e.firstName === "Priya" && e.lastName === "Sharma") e.stats.currentStreak = 12
    if (e.firstName === "Rahul" && e.lastName === "Verma") e.stats.currentStreak = 9
    if (e.firstName === "Sneha" && e.lastName === "Kapoor") e.stats.currentStreak = 21
  }

  nimbus.employeeCount = employees.filter((e) => e.status !== "deactivated").length
  nimbus.registeredCount = employees.filter((e) => ["registered", "active", "inactive"].includes(e.status)).length
  nimbus.activeCount = employees.filter((e) => e.status === "active").length

  const invitations: Invitation[] = employees
    .filter((e) => e.status === "invited")
    .map((e) => ({
      id: makeId("inv"),
      companyId: DEMO_COMPANY_ID,
      employeeId: e.id,
      email: e.email,
      token: e.firstName === "Karan" ? DEMO_INVITE_TOKEN : faker.string.alphanumeric(16).toUpperCase(),
      status: chance(0.15) ? "expired" : "pending",
      sentAt: e.invitedAt,
      expiresAt: new Date(new Date(e.invitedAt).getTime() + 14 * DAY_MS).toISOString(),
      resentCount: int(0, 2),
    }))
  // Keep the demo invitation valid
  const karanInvite = invitations.find((i) => i.token === DEMO_INVITE_TOKEN)
  if (karanInvite) {
    karanInvite.status = "pending"
    karanInvite.sentAt = isoBetweenDaysAgo(2, 1)
    karanInvite.expiresAt = new Date(Date.now() + 12 * DAY_MS).toISOString()
  }

  const importJobs: ImportJob[] = [
    { id: "imp_1", companyId: DEMO_COMPANY_ID, fileName: "nimbus-employees-march.csv", status: "completed", totalRows: 236, createdRows: 231, skippedRows: 5, errors: [{ row: 14, message: "Email already exists" }, { row: 52, message: "Unknown department 'R&D'" }, { row: 77, message: "Invalid email address" }, { row: 160, message: "Email already exists" }, { row: 201, message: "Team not found in department" }], createdAt: "2026-03-21T11:20:00.000Z", createdBy: "Vikram Mehta" },
    { id: "imp_2", companyId: DEMO_COMPANY_ID, fileName: "new-joiners-september.csv", status: "completed", totalRows: 28, createdRows: 28, skippedRows: 0, errors: [], createdAt: isoBetweenDaysAgo(25, 20), createdBy: "Vikram Mehta" },
  ]

  // ── Settings ──
  const settings: Record<string, CompanySettings> = {}
  for (const c of companies) settings[c.id] = defaultCompanySettings(c.id)
  settings[DEMO_COMPANY_ID]!.aiCoachEnabled = true

  // ── Rewards ──
  const rewards: Reward[] = [
    ...GLOBAL_REWARDS.map((r, i) => ({
      ...r,
      id: `rwd_g${String(i + 1).padStart(2, "0")}`,
      companyId: null,
      featured: r.featured ?? false,
      status: (r.stock === 0 ? "out_of_stock" : "active") as Reward["status"],
      provider: r.delivery === "digital_voucher" ? "VoucherHub" : r.delivery === "donation" ? "GiveIndia Partners" : "HealthX Store",
      redemptionsCount: int(10, 640),
      createdAt: isoBetweenDaysAgo(200, 30),
    })),
    ...COMPANY_REWARDS.map((r, i) => ({
      ...r,
      id: `rwd_c${String(i + 1).padStart(2, "0")}`,
      companyId: DEMO_COMPANY_ID,
      featured: r.featured ?? false,
      status: (i === 4 ? "out_of_stock" : "active") as Reward["status"],
      redemptionsCount: int(2, 40),
      createdAt: isoBetweenDaysAgo(150, 10),
    })),
  ]
  rewards.find((r) => r.id === "rwd_c05")!.stock = 0
  const rewardSettings: MockDB["rewardSettings"] = {
    [DEMO_COMPANY_ID]: { hiddenGlobalRewardIds: ["rwd_g03"], monthlyBudgetPoints: 400000 },
  }

  // ── Challenges ──
  const idOf = (name: string) => deptByName.get(name)!.id
  const challengeSeeds: (Omit<Challenge, "id" | "companyId" | "participantsCount" | "eligibleCount" | "completedCount" | "createdAt" | "createdBy" | "rules"> & { startAgo: number; createdBy?: string; rules?: string[] })[] = [
    { name: "October Step Up", description: "Walk 300,000 steps this month — that's about 10,000 a day. Every step syncs automatically from your phone.", type: "individual", metric: "steps", target: 300000, startAgo: 12, startDate: localDaysAgo(12), endDate: localDaysFromNow(18), status: "active", audienceType: "all", audienceIds: [], points: 150, rewardId: "rwd_c03", coverEmoji: "👟", coverColor: "#10b981", templateId: "tpl_001" },
    { name: "Department Step Battle", description: "Which department can rack up the highest average steps per person? Join to count towards your department.", type: "team", teamUnit: "department", metric: "steps", target: 180000, startAgo: 5, startDate: localDaysAgo(5), endDate: localDaysFromNow(16), status: "active", audienceType: "all", audienceIds: [], points: 120, rewardId: "rwd_c06", coverEmoji: "⚔️", coverColor: "#6366f1", templateId: "tpl_002" },
    { name: "21-Day Hydration Habit", description: "Drink 2 litres of water every day for 21 days. Log water in the app to track progress.", type: "individual", metric: "water", target: 42000, startAgo: 9, startDate: localDaysAgo(9), endDate: localDaysFromNow(12), status: "active", audienceType: "all", audienceIds: [], points: 100, coverEmoji: "💧", coverColor: "#06b6d4", templateId: "tpl_003" },
    { name: "Mindful Minutes Together", description: "Let's meditate 25,000 minutes together as a company. Every minute you log counts towards the shared goal.", type: "collaborative", metric: "meditation", target: 25000, startAgo: 15, startDate: localDaysAgo(15), endDate: localDaysFromNow(15), status: "active", audienceType: "all", audienceIds: [], points: 80, coverEmoji: "🧘", coverColor: "#14b8a6", templateId: "tpl_004" },
    { name: "Fit Fridays: 12 Workouts", description: "Complete 12 guided workouts in 4 weeks. Open to Engineering and Product & Design.", type: "individual", metric: "workouts", target: 12, startAgo: 20, startDate: localDaysAgo(20), endDate: localDaysFromNow(8), status: "active", audienceType: "departments", audienceIds: [idOf("Engineering"), idOf("Product & Design")], points: 120, coverEmoji: "🏋️", coverColor: "#8b5cf6", templateId: "tpl_005" },
    { name: "Weekend Warrior", description: "Who can take the most steps this weekend? Top 10 get bonus points.", type: "leaderboard", metric: "steps", target: 30000, startAgo: -4, startDate: localDaysFromNow(4), endDate: localDaysFromNow(6), status: "scheduled", audienceType: "all", audienceIds: [], points: 60, coverEmoji: "🏁", coverColor: "#f97316", templateId: "tpl_006" },
    { name: "No Sugar Week", description: "Check in each day you avoid added sugar. Small swaps, big difference.", type: "individual", metric: "custom", customMetricLabel: "Sugar-free days", target: 7, startAgo: -9, startDate: localDaysFromNow(9), endDate: localDaysFromNow(15), status: "scheduled", audienceType: "all", audienceIds: [], points: 70, coverEmoji: "🍬", coverColor: "#ec4899", templateId: "tpl_008" },
    { name: "Monsoon Walkathon", description: "Our first company challenge — 200,000 steps through the monsoon.", type: "individual", metric: "steps", target: 200000, startAgo: 75, startDate: localDaysAgo(75), endDate: localDaysAgo(45), status: "completed", audienceType: "all", audienceIds: [], points: 150, coverEmoji: "🌧️", coverColor: "#0ea5e9" },
    { name: "Plank Power Month", description: "Check in every day you hold a plank for at least 60 seconds.", type: "individual", metric: "custom", customMetricLabel: "Plank check-ins", target: 20, startAgo: 58, startDate: localDaysAgo(58), endDate: localDaysAgo(28), status: "completed", audienceType: "teams", audienceIds: [teamByName.get("Mobile")!.id, teamByName.get("Web")!.id, teamByName.get("Platform")!.id], points: 100, coverEmoji: "🧱", coverColor: "#f59e0b" },
    { name: "Sales vs Success Step-off", description: "Sales and Customer Success go head-to-head on steps.", type: "team", teamUnit: "department", metric: "steps", target: 150000, startAgo: 40, startDate: localDaysAgo(40), endDate: localDaysAgo(26), status: "completed", audienceType: "departments", audienceIds: [idOf("Sales"), idOf("Customer Success")], points: 100, coverEmoji: "🤝", coverColor: "#22c55e" },
    { name: "Diwali Fitness Fiesta", description: "Stay active through the festive season with 600 active minutes.", type: "company", metric: "active_minutes", target: 600, startAgo: -25, startDate: localDaysFromNow(25), endDate: localDaysFromNow(40), status: "draft", audienceType: "all", audienceIds: [], points: 100, coverEmoji: "🪔", coverColor: "#f97316", templateId: "tpl_007" },
    { name: "Cycle to Work Week", description: "Cancelled due to the office relocation.", type: "individual", metric: "distance", target: 50, startAgo: 30, startDate: localDaysAgo(30), endDate: localDaysAgo(23), status: "cancelled", audienceType: "all", audienceIds: [], points: 80, coverEmoji: "🚲", coverColor: "#64748b" },
  ]

  const challenges: Challenge[] = []
  const participants: ChallengeParticipant[] = []
  const joinedEmployees = employees.filter((e) => ["active", "registered", "inactive"].includes(e.status))
  const demoIds = new Set(employees.filter((e) => ["Priya", "Rahul", "Sneha"].includes(e.firstName) && ["Sharma", "Verma", "Kapoor"].includes(e.lastName)).map((e) => e.id))

  const dailyAmount = (metric: ChallengeMetric, e: Employee) => {
    const steps = e.stats.stepsMonth / 30 || 3000
    switch (metric) {
      case "steps":
        return steps * float(0.8, 1.2)
      case "distance":
        return (steps * 0.00075) * float(0.8, 1.2)
      case "calories":
        return steps * 0.04 * float(0.8, 1.2)
      case "active_minutes":
        return (steps / 160) * float(0.7, 1.2)
      case "water":
        return float(1400, 2600, 0)
      case "meditation":
        return chance(0.55) ? int(5, 20) : 0
      case "workouts":
        return chance(Math.min(0.75, e.stats.workoutsMonth / 30 + 0.1)) ? 1 : 0
      case "custom":
        return chance(0.75) ? 1 : 0
    }
  }

  challengeSeeds.forEach((s, ci) => {
    const id = `chl_${String(ci + 1).padStart(3, "0")}`
    const template = challengeTemplates.find((t) => t.id === s.templateId)
    const eligible = joinedEmployees.filter((e) => {
      if (s.audienceType === "departments") return s.audienceIds.includes(e.departmentId)
      if (s.audienceType === "teams") return s.audienceIds.includes(e.teamId)
      return true
    })
    const ch: Challenge = {
      id,
      companyId: DEMO_COMPANY_ID,
      templateId: s.templateId,
      name: s.name,
      description: s.description,
      type: s.type,
      metric: s.metric,
      customMetricLabel: s.customMetricLabel,
      target: s.target,
      teamUnit: s.teamUnit,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
      audienceType: s.audienceType,
      audienceIds: s.audienceIds,
      points: s.points,
      rewardId: s.rewardId,
      coverEmoji: s.coverEmoji,
      coverColor: s.coverColor,
      rules: s.rules ?? template?.rules ?? ["Progress syncs automatically from your phone or wearable.", "Manual entries are reviewed and may not count."],
      createdBy: pick(["Sneha Kapoor", "Vikram Mehta", "Sneha Kapoor"]),
      createdAt: new Date(Date.now() - (Math.max(s.startAgo, 0) + int(3, 10)) * DAY_MS).toISOString(),
      participantsCount: 0,
      eligibleCount: eligible.length,
      completedCount: 0,
    }
    challenges.push(ch)
    if (s.status !== "active" && s.status !== "completed") return

    const elapsed = s.status === "completed" ? Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / DAY_MS) + 1 : s.startAgo + 1
    const rate = s.status === "completed" ? float(0.62, 0.78) : float(0.55, 0.74)
    const joiners = eligible.filter((e) => demoIds.has(e.id) || (e.status === "active" ? chance(rate) : chance(rate * 0.3)))
    // Priya skips "Fit Fridays" so the employee app shows a joinable active challenge
    const finalJoiners = joiners.filter((e) => !(ch.name.startsWith("Fit Fridays") && e.firstName === "Priya"))
    const rows = finalJoiners.map((e) => {
      const daily = Array.from({ length: Math.min(elapsed, 31) }, () => Math.round(dailyAmount(s.metric, e) * (e.status === "inactive" ? 0.1 : 1)))
      const progress = daily.reduce((a, b) => a + b, 0)
      const completed = s.type !== "collaborative" && s.type !== "team" && progress >= s.target
      return {
        id: makeId("cpt"),
        challengeId: id,
        employeeId: e.id,
        joinedAt: new Date(new Date(s.startDate).getTime() + int(0, 2) * DAY_MS).toISOString(),
        progress,
        completed,
        completedAt: completed ? new Date(new Date(s.endDate).getTime() - int(0, 5) * DAY_MS).toISOString() : undefined,
        rank: 0,
        daily,
      }
    })
    rows.sort((a, b) => b.progress - a.progress).forEach((r, i) => (r.rank = i + 1))
    participants.push(...rows)
    ch.participantsCount = rows.length
    ch.completedCount = s.type === "collaborative" ? (rows.reduce((a, r) => a + r.progress, 0) >= s.target ? rows.length : 0) : rows.filter((r) => r.completed).length
  })

  // ── Orders ──
  const orders: RedemptionOrder[] = []
  const visibleRewards = rewards.filter((r) => (r.companyId === null || r.companyId === DEMO_COMPANY_ID) && r.status !== "archived")
  const orderStatusFlow: OrderStatus[] = ["pending_approval", "approved", "processing", "shipped", "delivered"]
  const activeEmployees = employees.filter((e) => e.status === "active")
  const priya = employees.find((e) => e.firstName === "Priya" && e.lastName === "Sharma")!
  for (let i = 0; i < 46; i++) {
    const emp = i < 3 ? priya : pick(activeEmployees)
    const reward = i === 0 ? rewards.find((r) => r.id === "rwd_g01")! : i === 1 ? rewards.find((r) => r.id === "rwd_g06")! : i === 2 ? rewards.find((r) => r.id === "rwd_g10")! : pick(visibleRewards)
    const ageDays = i < 3 ? [24, 6, 1][i]! : int(0, 60)
    let status: OrderStatus
    if (i < 3) status = (["delivered", "shipped", "pending_approval"] as const)[i]!
    else if (ageDays > 20) status = chance(0.1) ? pick(["cancelled", "rejected"] as const) : "delivered"
    else if (ageDays > 8) status = pick(["shipped", "delivered", "processing"] as const)
    else status = pick(["pending_approval", "pending_approval", "approved", "processing"] as const)
    if (reward.delivery !== "physical" && status === "shipped") status = "delivered"
    const created = new Date(Date.now() - ageDays * DAY_MS - int(1, 10) * 3_600_000)
    const timeline: RedemptionOrder["timeline"] = [{ status: "pending_approval", at: created.toISOString(), note: "Order placed", by: `${emp.firstName} ${emp.lastName}` }]
    if (status === "rejected") timeline.push({ status: "rejected", at: new Date(created.getTime() + DAY_MS).toISOString(), note: "Monthly reward budget reached — points refunded.", by: "Vikram Mehta" })
    else if (status === "cancelled") timeline.push({ status: "cancelled", at: new Date(created.getTime() + 3_600_000 * 5).toISOString(), note: "Cancelled by employee — points refunded.", by: `${emp.firstName} ${emp.lastName}` })
    else {
      const idx = orderStatusFlow.indexOf(status)
      for (let s = 1; s <= idx; s++) {
        const st = orderStatusFlow[s]!
        if (reward.delivery !== "physical" && st === "shipped") continue
        timeline.push({ status: st, at: new Date(created.getTime() + s * DAY_MS * float(0.4, 1.5)).toISOString(), by: st === "approved" ? "Vikram Mehta" : "HealthX Fulfilment" })
      }
    }
    orders.push({
      id: `ord_${String(i + 1).padStart(4, "0")}`,
      orderNumber: `HX-${(24810 + i).toString()}`,
      companyId: DEMO_COMPANY_ID,
      employeeId: emp.id,
      rewardId: reward.id,
      points: reward.pointsCost,
      quantity: 1,
      status,
      delivery: {
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        phone: emp.phone,
        address: reward.delivery === "physical" ? `${int(1, 300)}, ${faker.location.street()}, ${pick(["Bengaluru 560038", "Pune 411014", "Gurugram 122002"])}` : undefined,
      },
      voucherCode: reward.delivery === "digital_voucher" && status === "delivered" ? `HX${faker.string.alphanumeric(10).toUpperCase()}` : undefined,
      trackingNumber: status === "shipped" || (status === "delivered" && reward.delivery === "physical") ? `DL${int(100000000, 999999999)}IN` : undefined,
      timeline,
      createdAt: created.toISOString(),
      updatedAt: timeline[timeline.length - 1]!.at,
    })
  }
  // A few orders from other companies for the platform-wide order view
  const otherActive = companies.filter((c) => c.id !== DEMO_COMPANY_ID && c.status === "active").slice(0, 8)
  for (let i = 0; i < 30; i++) {
    const c = pick(otherActive)
    const reward = pick(rewards.filter((r) => r.companyId === null))
    const ageDays = int(0, 45)
    const status: OrderStatus = ageDays > 15 ? "delivered" : pick(["approved", "processing", "shipped", "pending_approval"] as const)
    const created = new Date(Date.now() - ageDays * DAY_MS)
    const name = faker.person.fullName()
    orders.push({
      id: `ord_x${String(i + 1).padStart(3, "0")}`,
      orderNumber: `HX-${(23900 + i).toString()}`,
      companyId: c.id,
      employeeId: `ext_${i}`,
      rewardId: reward.id,
      points: reward.pointsCost,
      quantity: 1,
      status,
      delivery: { name, email: `${name.split(" ")[0]!.toLowerCase()}@${c.emailDomains[0]}` },
      timeline: [{ status: "pending_approval", at: created.toISOString(), note: "Order placed" }, ...(status !== "pending_approval" ? [{ status, at: new Date(created.getTime() + 2 * DAY_MS).toISOString() }] : [])],
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    })
  }

  // ── Announcements ──
  const ann = (a: Omit<Announcement, "id" | "companyId" | "createdAt" | "stats" | "audienceIds"> & { ago: number; audienceIds?: string[] }): Announcement => {
    const recipients = a.audienceType === "all" ? nimbus.registeredCount : int(20, 90)
    const delivered = Math.round(recipients * float(0.93, 0.99))
    return {
      id: makeId("ann"),
      companyId: DEMO_COMPANY_ID,
      createdAt: new Date(Date.now() - (a.ago + 1) * DAY_MS).toISOString(),
      audienceIds: a.audienceIds ?? [],
      stats: a.status === "sent" ? { recipients, delivered, opened: Math.round(delivered * float(0.38, 0.81)) } : { recipients: 0, delivered: 0, opened: 0 },
      ...a,
    }
  }
  const announcements: Announcement[] = [
    ann({ title: "October Step Up is live! 👟", body: "Our biggest challenge of the year has started. Walk 300,000 steps by the end of the month and earn 150 points plus a Nimbus hoodie. Open the HealthX app and tap Join.", type: "challenge", audienceType: "all", channels: ["push", "in_app", "email"], status: "sent", sentAt: new Date(Date.now() - 12 * DAY_MS).toISOString(), pinned: true, author: "Sneha Kapoor", ago: 12, link: { label: "View challenge", href: "/employee-app/challenges/chl_001" } }),
    ann({ title: "Department Step Battle — who will win?", body: "Engineering leads after day 4, but Customer Success is catching up fast. Every step you take helps your department average.", type: "challenge", audienceType: "all", channels: ["push", "in_app"], status: "sent", sentAt: new Date(Date.now() - 1 * DAY_MS).toISOString(), pinned: false, author: "Sneha Kapoor", ago: 1 }),
    ann({ title: "New rewards in the catalogue 🎁", body: "You can now redeem an Extra Day Off, a Work From Anywhere Week and Team Lunch vouchers with your points.", type: "reward", audienceType: "all", channels: ["in_app", "push"], status: "sent", sentAt: new Date(Date.now() - 6 * DAY_MS).toISOString(), pinned: false, author: "Ananya Iyer", ago: 6 }),
    ann({ title: "Wellness tip: take the stairs", body: "Taking the stairs twice a day adds about 600 steps and strengthens your legs. Try it this week!", type: "wellness_tip", audienceType: "all", channels: ["in_app"], status: "sent", sentAt: new Date(Date.now() - 3 * DAY_MS).toISOString(), pinned: false, author: "Sneha Kapoor", ago: 3 }),
    ann({ title: "Yoga session at Bengaluru HQ — Friday 8 AM", body: "Join our certified instructor for a 45-minute yoga session on the 4th-floor terrace. Mats provided.", type: "event", audienceType: "all", channels: ["in_app", "email"], status: "sent", sentAt: new Date(Date.now() - 8 * DAY_MS).toISOString(), pinned: false, author: "Vikram Mehta", ago: 8 }),
    ann({ title: "Mobile team: plank-off this Thursday", body: "Rahul is challenging the Mobile team to a plank-off after stand-up. Winner picks the next team lunch!", type: "general", audienceType: "teams", audienceIds: [teamByName.get("Mobile")!.id], channels: ["in_app"], status: "sent", sentAt: new Date(Date.now() - 2 * DAY_MS).toISOString(), pinned: false, author: "Vikram Mehta", ago: 2 }),
    ann({ title: "Weekend Warrior starts Saturday", body: "Get ready — the top 10 step-takers this weekend win bonus points.", type: "challenge", audienceType: "all", channels: ["push", "in_app"], status: "scheduled", scheduledAt: new Date(Date.now() + 3 * DAY_MS).toISOString(), pinned: false, author: "Sneha Kapoor", ago: 0 }),
    ann({ title: "Diwali Fitness Fiesta (draft)", body: "Stay active through the festive season with 600 active minutes. Details coming soon.", type: "challenge", audienceType: "all", channels: ["push", "in_app", "email"], status: "draft", pinned: false, author: "Sneha Kapoor", ago: 0 }),
    ann({ title: "Hydration reminder 💧", body: "Monsoon or not, your body needs water. Aim for 2–3 litres today and log it in the app.", type: "wellness_tip", audienceType: "all", channels: ["push"], status: "sent", sentAt: new Date(Date.now() - 15 * DAY_MS).toISOString(), pinned: false, author: "Sneha Kapoor", ago: 15 }),
    ann({ title: "Welcome to Nimbus Wellness!", body: "We're excited to launch HealthX for everyone at Nimbus. Track steps, join challenges and earn rewards for healthy habits.", type: "general", audienceType: "all", channels: ["push", "in_app", "email"], status: "sent", sentAt: "2026-03-25T09:00:00.000Z", pinned: false, author: "Ananya Iyer", ago: 200 }),
  ]

  // ── Content & programs ──
  const content: ContentItem[] = CONTENT.map((c, i) => ({
    ...c,
    id: `cnt_${String(i + 1).padStart(3, "0")}`,
    companyId: null,
    status: i === CONTENT.length - 1 ? "draft" : "published",
    publishedAt: i === CONTENT.length - 1 ? undefined : isoBetweenDaysAgo(90, 1),
    views: int(200, 9000),
  }))
  content.push(
    { id: "cnt_n01", companyId: DEMO_COMPANY_ID, title: "Nimbus wellness room is open", summary: "A quiet space for meditation and stretching on the 4th floor.", body: "Book a 30-minute slot through the facilities desk. Yoga mats, foam rollers and a meditation corner are available.", type: "article", category: "general", coverColor: "#0ea5e9", coverEmoji: "🏢", author: "Sneha Kapoor", readMinutes: 2, status: "published", publishedAt: isoBetweenDaysAgo(20, 10), views: 412, tags: ["office"] },
    { id: "cnt_n02", companyId: DEMO_COMPANY_ID, title: "Our EAP: free, confidential counselling", summary: "How to access 6 free counselling sessions through our Employee Assistance Programme.", body: "All Nimbus employees and their families can access six free, confidential counselling sessions a year. Call the 24x7 helpline or book online.", type: "article", category: "mindfulness", coverColor: "#8b5cf6", coverEmoji: "💬", author: "Vikram Mehta", readMinutes: 3, status: "published", publishedAt: isoBetweenDaysAgo(40, 25), views: 288, tags: ["mental health", "eap"] },
    { id: "cnt_n03", companyId: DEMO_COMPANY_ID, title: "Healthy cafeteria menu — November", summary: "Draft of next month's healthier cafeteria options.", body: "We are adding millet bowls, a salad bar and fresh fruit to the cafeteria from November.", type: "article", category: "nutrition", coverColor: "#84cc16", coverEmoji: "🥗", author: "Sneha Kapoor", readMinutes: 2, status: "draft", views: 0, tags: ["food"] },
  )
  const programs: WellnessProgram[] = [
    ...PROGRAMS.map((p, i) => ({ ...p, id: `prg_t${i + 1}`, companyId: null, enrolledCount: int(300, 2400), completionRate: float(0.35, 0.62, 2) })),
    { ...PROGRAMS[0]!, id: "prg_n1", companyId: DEMO_COMPANY_ID, isTemplate: false, startDate: localDaysAgo(10), status: "active", enrolledCount: 118, completionRate: 0.18 },
    { ...PROGRAMS[1]!, id: "prg_n2", companyId: DEMO_COMPANY_ID, isTemplate: false, startDate: localDaysFromNow(20), status: "draft", enrolledCount: 0, completionRate: 0 },
  ]

  // ── Subscriptions & invoices ──
  for (const c of companies) {
    const plan = plans.find((p) => p.id === c.planId)!
    const status: Subscription["status"] = c.status === "trial" ? "trial" : c.status === "suspended" ? "past_due" : c.status === "onboarding" ? "active" : chance(0.08) ? "past_due" : "active"
    const activeSeats = Math.max(c.activeCount, Math.round(c.employeeCount * 0.4))
    const sub: Subscription = {
      id: c.subscriptionId,
      companyId: c.id,
      planId: plan.id,
      status,
      seats: c.employeeCount,
      activeSeats,
      billingCycle: plan.billingCycle,
      startDate: c.createdAt.slice(0, 10),
      renewalDate: localDaysFromNow(int(10, 300)),
      trialEndsAt: status === "trial" ? localDaysFromNow(int(5, 25)) : undefined,
      mrr: status === "trial" ? 0 : activeSeats * plan.pricePerEmployee,
      currency: "INR",
    }
    subscriptions.push(sub)
    plan.companiesCount++
    if (status === "trial") continue
    const months = Math.min(6, Math.max(1, Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (30 * DAY_MS))))
    for (let m = months - 1; m >= 0; m--) {
      const start = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 0)
      const amount = Math.round(sub.activeSeats * plan.pricePerEmployee * float(0.92, 1.04))
      const isCurrent = m === 0
      const st: Invoice["status"] = isCurrent ? (status === "past_due" ? "overdue" : "due") : status === "past_due" && m === 1 ? "overdue" : "paid"
      invoices.push({
        id: makeId("invc"),
        number: `INV-${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, "0")}-${String(invoices.length + 101).padStart(4, "0")}`,
        companyId: c.id,
        subscriptionId: sub.id,
        periodStart: start.toISOString().slice(0, 10),
        periodEnd: end.toISOString().slice(0, 10),
        seats: sub.activeSeats,
        amount,
        tax: Math.round(amount * 0.18),
        currency: "INR",
        status: st,
        issuedAt: start.toISOString(),
        dueAt: new Date(start.getTime() + 15 * DAY_MS).toISOString(),
        paidAt: st === "paid" ? new Date(start.getTime() + int(2, 14) * DAY_MS).toISOString() : undefined,
      })
    }
  }

  // ── Points ledger (company-wide sample; employee app adds more per user) ──
  const pointsTransactions: PointsTransaction[] = []
  const sources: { source: PointsTransaction["source"]; label: string; pts: () => number }[] = [
    { source: "steps", label: "Daily steps", pts: () => int(40, 150) },
    { source: "workout", label: "Completed workout", pts: () => 50 },
    { source: "water", label: "Hit daily water goal", pts: () => 20 },
    { source: "meditation", label: "Meditation session", pts: () => 20 },
    { source: "streak", label: "7-day streak bonus", pts: () => 100 },
    { source: "habit", label: "Completed habit", pts: () => 5 },
  ]
  for (let i = 0; i < 220; i++) {
    const e = pick(activeEmployees)
    const s = pick(sources)
    const pts = s.pts()
    pointsTransactions.push({ id: makeId("ptx"), employeeId: e.id, type: "earn", source: s.source, points: pts, description: s.label, balanceAfter: e.stats.pointsBalance, createdAt: isoBetweenDaysAgo(30, 0) })
  }
  for (let i = 0; i < 6; i++) {
    const e = pick(activeEmployees)
    const pts = pick([50, 100, 200, -50])
    pointsTransactions.push({ id: makeId("ptx"), employeeId: e.id, type: "adjust", source: "manual_adjustment", points: pts, description: pts > 0 ? "Bonus for organising the office yoga session" : "Correction: duplicate step sync", balanceAfter: e.stats.pointsBalance, createdAt: isoBetweenDaysAgo(30, 1), createdBy: "Vikram Mehta" })
  }
  pointsTransactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // Badges earned counts (platform-wide figure)
  badges.forEach((b) => (b.earnedCount = Math.round((b.rarity === "common" ? 0.6 : b.rarity === "rare" ? 0.3 : b.rarity === "epic" ? 0.1 : 0.02) * 41_000 * float(0.7, 1.2))))

  // ── Audit logs ──
  const auditLogs: AuditLog[] = []
  const nimbusAdmins = [
    { name: "Ananya Iyer", role: "Company Owner" },
    { name: "Vikram Mehta", role: "HR Admin" },
    { name: "Sneha Kapoor", role: "Wellness Manager" },
  ]
  const companyActions = [
    ["Invited employee", "Employee"],
    ["Imported employees (CSV)", "Import"],
    ["Updated employee team", "Employee"],
    ["Created challenge", "Challenge"],
    ["Published challenge", "Challenge"],
    ["Sent announcement", "Announcement"],
    ["Approved redemption", "Order"],
    ["Rejected redemption", "Order"],
    ["Updated company settings", "Settings"],
    ["Updated branding", "Branding"],
    ["Deactivated employee", "Employee"],
    ["Exported analytics (CSV)", "Report"],
    ["Created reward", "Reward"],
    ["Signed in", "Session"],
  ] as const
  for (let i = 0; i < 90; i++) {
    const actor = pick(nimbusAdmins)
    const [action, entityType] = pick(companyActions)
    const target =
      entityType === "Employee" ? `${pick(employees).firstName} ${pick(employees).lastName}` : entityType === "Challenge" ? pick(challenges).name : entityType === "Order" ? pick(orders).orderNumber : entityType === "Reward" ? pick(rewards).name : entityType === "Announcement" ? pick(announcements).title : entityType === "Import" ? "new-joiners-september.csv" : "Nimbus Technologies"
    auditLogs.push({
      id: makeId("aud"),
      companyId: DEMO_COMPANY_ID,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityName: target,
      ip: `49.${int(30, 250)}.${int(0, 255)}.${int(1, 254)}`,
      createdAt: isoBetweenDaysAgo(45, 0),
      severity: action.startsWith("Deactivated") || action.startsWith("Rejected") ? "warning" : "info",
    })
  }
  const platformActions = [
    ["Created company", "Company", "info"],
    ["Suspended company", "Company", "critical"],
    ["Updated plan pricing", "Plan", "warning"],
    ["Changed wellness score weights", "Score config", "warning"],
    ["Published challenge template", "Template", "info"],
    ["Updated points rule", "Points rule", "warning"],
    ["Added reward to global catalogue", "Reward", "info"],
    ["Revoked user sessions", "User", "warning"],
    ["Updated system setting", "System", "warning"],
    ["Signed in", "Session", "info"],
    ["Viewed company as support", "Company", "warning"],
  ] as const
  for (let i = 0; i < 70; i++) {
    const actor = pick(platformAdmins.filter((a) => a.status === "active"))
    const [action, entityType, severity] = pick(platformActions)
    const comp = pick(companies)
    auditLogs.push({
      id: makeId("aud"),
      companyId: null,
      actorName: actor.name,
      actorRole: actor.role === "super_admin" ? "Super Admin" : actor.role === "support_admin" ? "Support Admin" : "Content Admin",
      action,
      entityType,
      entityName: entityType === "Company" ? comp.name : entityType === "Plan" ? pick(plans).name : entityType === "Template" ? pick(challengeTemplates).name : entityType === "Reward" ? pick(rewards).name : entityType === "Points rule" ? pick(pointsRules).label : entityType === "System" ? pick(systemSettings).label : entityType === "User" ? faker.person.fullName() : "HealthX Platform",
      ip: `103.${int(10, 250)}.${int(0, 255)}.${int(1, 254)}`,
      createdAt: isoBetweenDaysAgo(60, 0),
      severity,
    })
  }
  auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  // ── Support tickets ──
  const ticketSubjects: [string, SupportTicket["category"]][] = [
    ["Steps not syncing from Health Connect", "technical"],
    ["Invoice shows wrong number of seats", "billing"],
    ["Employee cannot accept invitation (link expired)", "account"],
    ["Reward voucher code not received", "rewards"],
    ["How do we add a new office location?", "other"],
    ["Request to change company owner", "account"],
    ["Leaderboard shows former employee", "technical"],
    ["CSV import fails with encoding error", "technical"],
    ["Need GST details on invoice", "billing"],
    ["Apple Health permission denied after iOS update", "technical"],
    ["Bulk resend invitations", "account"],
    ["Fitness band delivery delayed", "rewards"],
    ["Can managers see individual steps?", "other"],
    ["Upgrade to Enterprise plan", "billing"],
  ]
  const supportTickets: SupportTicket[] = ticketSubjects.map(([subject, category], i) => {
    const c = i % 3 === 0 ? nimbus : pick(companies)
    const createdAt = isoBetweenDaysAgo(20, 0)
    const status: SupportTicket["status"] = i < 4 ? "open" : i < 7 ? "pending" : i < 12 ? "resolved" : "closed"
    const requester = c.id === DEMO_COMPANY_ID ? "Vikram Mehta" : faker.person.fullName()
    return {
      id: `tkt_${i + 1}`,
      number: `SUP-${3100 + i}`,
      companyId: c.id,
      subject,
      requester,
      priority: pick(["low", "medium", "medium", "high", "urgent"] as const),
      status,
      category,
      createdAt,
      updatedAt: isoBetweenDaysAgo(Math.max(0, (Date.now() - new Date(createdAt).getTime()) / DAY_MS - 1), 0),
      messages: [
        { from: requester, body: `Hi team, ${subject.toLowerCase()}. Could you please help?`, at: createdAt },
        ...(status !== "open" ? [{ from: "Meera Joshi", body: "Thanks for reaching out — we're looking into this and will update you shortly.", at: new Date(new Date(createdAt).getTime() + 3 * 3_600_000).toISOString() }] : []),
        ...(status === "resolved" || status === "closed" ? [{ from: "Meera Joshi", body: "This has been fixed. Please let us know if you still see the issue.", at: new Date(new Date(createdAt).getTime() + 26 * 3_600_000).toISOString() }] : []),
      ],
    }
  })

  // ── Integrations (Nimbus) ──
  const integrations: Integration[] = [
    { id: "int_slack", companyId: DEMO_COMPANY_ID, provider: "slack", name: "Slack", description: "Post challenge updates and leaderboard highlights to a Slack channel.", status: "connected", connectedAt: isoBetweenDaysAgo(80, 60), lastSyncAt: isoBetweenDaysAgo(1, 0), config: { channel: "#nimbus-wellness" } },
    { id: "int_teams", companyId: DEMO_COMPANY_ID, provider: "microsoft_teams", name: "Microsoft Teams", description: "Share announcements and challenge results in a Teams channel.", status: "disconnected" },
    { id: "int_hrms_api", companyId: DEMO_COMPANY_ID, provider: "hrms_api", name: "HRMS — REST API", description: "Sync employees, departments and managers from your HRMS automatically.", status: "disconnected" },
    { id: "int_hrms_csv", companyId: DEMO_COMPANY_ID, provider: "hrms_csv", name: "HRMS — Scheduled CSV", description: "Upload a CSV export on a schedule to keep people data in sync.", status: "connected", connectedAt: isoBetweenDaysAgo(30, 25), lastSyncAt: isoBetweenDaysAgo(7, 6), config: { schedule: "Weekly (Monday 6 AM)" } },
    { id: "int_hrms_sftp", companyId: DEMO_COMPANY_ID, provider: "hrms_sftp", name: "HRMS — SFTP", description: "Pick up employee files from your SFTP server.", status: "disconnected" },
    { id: "int_hrms_webhook", companyId: DEMO_COMPANY_ID, provider: "hrms_webhook", name: "HRMS — Webhook", description: "Receive joiner/leaver events in real time.", status: "error", connectedAt: isoBetweenDaysAgo(12, 10), lastSyncAt: isoBetweenDaysAgo(3, 2), config: { lastError: "401 Unauthorized — check the signing secret" } },
    { id: "int_gws", companyId: DEMO_COMPANY_ID, provider: "google_workspace", name: "Google Workspace SSO", description: "Employees sign in with their Google Workspace account (Phase 3).", status: "coming_soon" },
    { id: "int_entra", companyId: DEMO_COMPANY_ID, provider: "microsoft_entra", name: "Microsoft Entra ID SSO", description: "Employees sign in with Microsoft work accounts (Phase 3).", status: "coming_soon" },
  ]

  return {
    version: SEED_VERSION,
    seededAt: nowIso,
    companies,
    plans,
    subscriptions,
    invoices,
    platformAdmins,
    departments,
    teams,
    locations,
    employees,
    invitations,
    importJobs,
    settings,
    rewardSettings,
    challenges,
    participants,
    challengeTemplates,
    pointsRules,
    pointsTransactions,
    badges,
    rewardCategories,
    rewards,
    orders,
    announcements,
    content,
    programs,
    exercises,
    workouts,
    habits,
    foods,
    scoreConfigs,
    systemSettings,
    auditLogs,
    supportTickets,
    integrations,
    private: {},
    extra: {},
  }
}
