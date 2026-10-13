// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * HealthX Business — shared domain types for all three web apps.
 * Names follow the data model in docs (sheet 13), in camelCase.
 * Dates are ISO strings (UTC). Local calendar days use "YYYY-MM-DD".
 */

export type ID = string
export type ISODate = string // 2026-10-12T09:30:00.000Z
export type LocalDate = string // 2026-10-12

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
  order?: "asc" | "desc"
}

// ─── Roles ──────────────────────────────────────────────────────────────

export type PlatformRole = "super_admin" | "support_admin" | "content_admin"
export type CompanyAdminRole = "company_owner" | "hr_admin" | "wellness_manager"
/** Roles that can sign in to the Business Portal. */
export type BusinessRole = CompanyAdminRole | "team_manager"
export type EmployeeAppRole = "employee" | "team_manager"

export const BUSINESS_ROLE_LABEL: Record<BusinessRole, string> = {
  company_owner: "Company Owner",
  hr_admin: "HR Admin",
  wellness_manager: "Wellness Manager",
  team_manager: "Team Manager",
}

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
  content_admin: "Content Admin",
}

// ─── Platform: companies, plans, billing ─────────────────────────────────

export type CompanyStatus = "active" | "onboarding" | "trial" | "suspended"
export type CompanySegment = "smb" | "mid_market" | "enterprise"

export interface Branding {
  primaryColor: string
  accentColor: string
  logoUrl?: string
  logoInitials: string
  appDisplayName?: string
}

export interface Company {
  id: ID
  name: string
  legalName: string
  slug: string
  /** Code employees type in the app to find their company. */
  companyCode: string
  industry: string
  segment: CompanySegment
  status: CompanyStatus
  country: string
  city: string
  timezone: string
  emailDomains: string[]
  planId: ID
  subscriptionId: ID
  employeeCount: number
  registeredCount: number
  activeCount: number
  ownerName: string
  ownerEmail: string
  branding: Branding
  modules: ModuleCode[]
  createdAt: ISODate
  lastActivityAt: ISODate
}

export type ModuleCode =
  | "activity"
  | "water"
  | "workouts"
  | "habits"
  | "challenges"
  | "leaderboards"
  | "rewards"
  | "announcements"
  | "analytics"
  | "sleep"
  | "nutrition"
  | "programs"
  | "content"
  | "ai_coach"
  | "integrations"

export const MODULE_LABEL: Record<ModuleCode, string> = {
  activity: "Activity & Steps",
  water: "Water",
  workouts: "Workouts",
  habits: "Habits",
  challenges: "Challenges",
  leaderboards: "Leaderboards",
  rewards: "Rewards",
  announcements: "Announcements",
  analytics: "Analytics",
  sleep: "Sleep",
  nutrition: "Nutrition",
  programs: "Wellness Programs",
  content: "Wellness Feed & Content",
  ai_coach: "AI Wellness Coach",
  integrations: "Integrations (HRMS, Slack, Teams)",
}

export type BillingCycle = "monthly" | "annual"

export interface Plan {
  id: ID
  name: string
  code: "starter" | "growth" | "enterprise" | string
  description: string
  pricePerEmployee: number
  currency: "INR" | "USD"
  billingCycle: BillingCycle
  minEmployees: number
  maxEmployees: number | null
  modules: ModuleCode[]
  supportLevel: "standard" | "priority" | "dedicated"
  status: "active" | "draft" | "archived"
  companiesCount: number
  createdAt: ISODate
}

export type SubscriptionStatus = "active" | "trial" | "past_due" | "cancelled" | "paused"

export interface Subscription {
  id: ID
  companyId: ID
  planId: ID
  status: SubscriptionStatus
  seats: number
  activeSeats: number
  billingCycle: BillingCycle
  startDate: LocalDate
  renewalDate: LocalDate
  trialEndsAt?: LocalDate
  mrr: number
  currency: "INR" | "USD"
}

export type InvoiceStatus = "paid" | "due" | "overdue" | "void"

export interface Invoice {
  id: ID
  number: string
  companyId: ID
  subscriptionId: ID
  periodStart: LocalDate
  periodEnd: LocalDate
  seats: number
  amount: number
  tax: number
  currency: "INR" | "USD"
  status: InvoiceStatus
  issuedAt: ISODate
  dueAt: ISODate
  paidAt?: ISODate
}

export interface PlatformAdmin {
  id: ID
  name: string
  email: string
  role: PlatformRole
  status: "active" | "invited" | "disabled"
  mfaEnabled: boolean
  lastLoginAt?: ISODate
  createdAt: ISODate
  avatarColor: string
}

// ─── Organisation ────────────────────────────────────────────────────────

export interface Department {
  id: ID
  companyId: ID
  name: string
  description?: string
  headEmployeeId?: ID
  locationId?: ID
  createdAt: ISODate
}

export interface Team {
  id: ID
  companyId: ID
  departmentId: ID
  name: string
  description?: string
  managerIds: ID[]
  createdAt: ISODate
}

export interface Location {
  id: ID
  companyId: ID
  name: string
  city: string
  country: string
  address: string
  timezone: string
}

export type EmployeeStatus = "invited" | "registered" | "active" | "inactive" | "deactivated"
export type HealthProvider = "apple_health" | "health_connect" | "fitbit" | "garmin"

/** Employee record as seen by company admins — contains NO individual health data. */
export interface Employee {
  id: ID
  companyId: ID
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle: string
  departmentId: ID
  teamId: ID
  locationId?: ID
  appRole: EmployeeAppRole
  adminRole?: CompanyAdminRole
  status: EmployeeStatus
  invitedAt: ISODate
  joinedAt?: ISODate
  lastActiveAt?: ISODate
  healthConnected: boolean
  avatarColor: string
  gender?: "female" | "male" | "other" | "undisclosed"
  /** Leaderboard figures (shown on leaderboards, governed by name-display setting). */
  stats: EmployeeStats
}

export interface EmployeeStats {
  stepsToday: number
  stepsWeek: number
  stepsMonth: number
  pointsBalance: number
  pointsLifetime: number
  pointsMonth: number
  workoutsMonth: number
  activeDaysMonth: number
  badgesCount: number
  currentStreak: number
}

export interface Invitation {
  id: ID
  companyId: ID
  employeeId: ID
  email: string
  token: string
  status: "pending" | "accepted" | "expired" | "revoked"
  sentAt: ISODate
  expiresAt: ISODate
  resentCount: number
}

export interface ImportJob {
  id: ID
  companyId: ID
  fileName: string
  status: "processing" | "completed" | "failed"
  totalRows: number
  createdRows: number
  skippedRows: number
  errors: { row: number; message: string }[]
  createdAt: ISODate
  createdBy: string
}

export type LeaderboardNameDisplay = "full_name" | "first_name_initial" | "anonymous"

export interface CompanySettings {
  companyId: ID
  defaultLanguage: string
  timezone: string
  weekStartsOn: "monday" | "sunday"
  leaderboardNameDisplay: LeaderboardNameDisplay
  allowLeaderboardOptOut: boolean
  allowManualActivity: boolean
  manualActivityEarnsPoints: boolean
  redemptionApprovalRequired: boolean
  minAnalyticsGroupSize: number
  defaultStepGoal: number
  defaultWaterGoalMl: number
  pointsExpiryMonths: number | null
  notifications: {
    challengeReminders: boolean
    weeklySummary: boolean
    rewardUpdates: boolean
    inactivityNudges: boolean
    quietHoursStart: string
    quietHoursEnd: string
  }
  aiCoachEnabled: boolean
  aiInsightsEnabled: boolean
}

// ─── Challenges & leaderboards ──────────────────────────────────────────

export type ChallengeType = "individual" | "leaderboard" | "team" | "company" | "collaborative"
export type ChallengeMetric =
  | "steps"
  | "distance"
  | "calories"
  | "active_minutes"
  | "workouts"
  | "water"
  | "meditation"
  | "custom"
export type ChallengeStatus = "draft" | "scheduled" | "active" | "completed" | "cancelled"
export type AudienceType = "all" | "departments" | "teams" | "selected"

export const CHALLENGE_METRIC_UNIT: Record<ChallengeMetric, string> = {
  steps: "steps",
  distance: "km",
  calories: "kcal",
  active_minutes: "min",
  workouts: "workouts",
  water: "ml",
  meditation: "min",
  custom: "check-ins",
}

export interface Challenge {
  id: ID
  companyId: ID | null // null = global template-based platform challenge
  templateId?: ID
  name: string
  description: string
  type: ChallengeType
  metric: ChallengeMetric
  customMetricLabel?: string
  target: number
  /** For team challenges: what competes. */
  teamUnit?: "department" | "team"
  startDate: LocalDate
  endDate: LocalDate
  status: ChallengeStatus
  audienceType: AudienceType
  audienceIds: ID[]
  points: number
  rewardId?: ID
  coverEmoji: string
  coverColor: string
  rules: string[]
  createdBy: string
  createdAt: ISODate
  participantsCount: number
  eligibleCount: number
  completedCount: number
}

export interface ChallengeParticipant {
  id: ID
  challengeId: ID
  employeeId: ID
  joinedAt: ISODate
  progress: number
  completed: boolean
  completedAt?: ISODate
  rank: number
  /** Daily progress values (oldest → newest) for sparkline charts. */
  daily: number[]
}

export interface ChallengeTemplate {
  id: ID
  name: string
  description: string
  category: "movement" | "hydration" | "mindfulness" | "fitness" | "habits" | "team"
  type: ChallengeType
  metric: ChallengeMetric
  target: number
  durationDays: number
  points: number
  coverEmoji: string
  coverColor: string
  rules: string[]
  status: "published" | "draft" | "archived"
  usageCount: number
  updatedAt: ISODate
}

export type LeaderboardScope = "company" | "department" | "team" | "challenge"
export type LeaderboardPeriod = "today" | "week" | "month" | "challenge"
export type LeaderboardMetric = "steps" | "points" | "workouts" | "active_days"

export interface LeaderboardEntry {
  rank: number
  previousRank?: number
  id: ID
  name: string
  subtitle?: string
  avatarColor: string
  value: number
  isMe?: boolean
  memberCount?: number
}

// ─── Gamification ───────────────────────────────────────────────────────

export type PointsSource =
  | "steps"
  | "workout"
  | "meditation"
  | "water"
  | "challenge"
  | "streak"
  | "badge"
  | "habit"
  | "manual_adjustment"
  | "redemption"
  | "refund"
  | "expiry"

export interface PointsRule {
  id: ID
  eventType: PointsSource
  label: string
  description: string
  points: number
  per?: string
  dailyCap: number | null
  active: boolean
  version: number
  updatedAt: ISODate
}

export interface PointsTransaction {
  id: ID
  employeeId: ID
  type: "earn" | "redeem" | "adjust" | "refund" | "expire"
  source: PointsSource
  points: number
  description: string
  balanceAfter: number
  createdAt: ISODate
  createdBy?: string
}

export type BadgeRarity = "common" | "rare" | "epic" | "legendary"

export interface Badge {
  id: ID
  name: string
  description: string
  icon: string // emoji
  color: string
  criteria: string
  criteriaType: "first_workout" | "streak" | "steps_total" | "water_goal" | "early_activity" | "challenge" | "custom"
  threshold: number
  rarity: BadgeRarity
  points: number
  status: "active" | "draft" | "archived"
  earnedCount: number
}

export interface UserBadge {
  badgeId: ID
  earnedAt?: ISODate
  progress: number // 0..1
}

// ─── Rewards ────────────────────────────────────────────────────────────

export interface RewardCategory {
  id: ID
  name: string
  icon: string
}

export type RewardDelivery = "physical" | "digital_voucher" | "experience" | "donation" | "company_perk"

export interface Reward {
  id: ID
  companyId: ID | null // null = global HealthX catalogue
  categoryId: ID
  name: string
  description: string
  terms: string
  pointsCost: number
  delivery: RewardDelivery
  imageEmoji: string
  imageColor: string
  stock: number | null // null = unlimited
  perEmployeeLimit: number | null
  status: "active" | "draft" | "out_of_stock" | "archived"
  featured: boolean
  provider?: string
  redemptionsCount: number
  createdAt: ISODate
}

export type OrderStatus = "pending_approval" | "approved" | "processing" | "shipped" | "delivered" | "cancelled" | "rejected"

export interface RedemptionOrder {
  id: ID
  orderNumber: string
  companyId: ID
  employeeId: ID
  rewardId: ID
  points: number
  quantity: number
  status: OrderStatus
  delivery: {
    name: string
    email: string
    phone?: string
    address?: string
    notes?: string
  }
  voucherCode?: string
  trackingNumber?: string
  timeline: { status: OrderStatus; at: ISODate; note?: string; by?: string }[]
  createdAt: ISODate
  updatedAt: ISODate
}

// ─── Communication ──────────────────────────────────────────────────────

export type AnnouncementType = "general" | "wellness_tip" | "challenge" | "reward" | "event"
export type Channel = "push" | "in_app" | "email"

export interface Announcement {
  id: ID
  companyId: ID
  title: string
  body: string
  type: AnnouncementType
  audienceType: AudienceType
  audienceIds: ID[]
  channels: Channel[]
  status: "draft" | "scheduled" | "sent"
  scheduledAt?: ISODate
  sentAt?: ISODate
  pinned: boolean
  author: string
  createdAt: ISODate
  stats: { recipients: number; delivered: number; opened: number }
  link?: { label: string; href: string }
}

export type NotificationType =
  | "challenge"
  | "reward"
  | "badge"
  | "announcement"
  | "reminder"
  | "points"
  | "insight"
  | "system"

export interface AppNotification {
  id: ID
  type: NotificationType
  title: string
  body: string
  createdAt: ISODate
  read: boolean
  href?: string
}

// ─── Content, programs, AI ──────────────────────────────────────────────

export type ContentType = "article" | "video" | "tip" | "link"

export interface ContentItem {
  id: ID
  companyId: ID | null
  title: string
  summary: string
  body: string
  type: ContentType
  category: "movement" | "nutrition" | "sleep" | "mindfulness" | "hydration" | "general"
  coverColor: string
  coverEmoji: string
  author: string
  readMinutes: number
  url?: string
  status: "draft" | "published" | "archived"
  publishedAt?: ISODate
  views: number
  tags: string[]
}

export interface ProgramWeek {
  week: number
  title: string
  goals: { id: ID; label: string; metric: ChallengeMetric | "habit"; target: number }[]
}

export interface WellnessProgram {
  id: ID
  companyId: ID | null
  name: string
  description: string
  coverEmoji: string
  coverColor: string
  durationWeeks: number
  weeks: ProgramWeek[]
  startDate?: LocalDate
  status: "draft" | "scheduled" | "active" | "completed" | "archived"
  audienceType: AudienceType
  audienceIds: ID[]
  enrolledCount: number
  completionRate: number
  isTemplate: boolean
}

// ─── Platform content: workouts, habits, score ──────────────────────────

export type FitnessLevel = "beginner" | "intermediate" | "advanced"

export interface Exercise {
  id: ID
  name: string
  instructions: string[]
  muscleGroups: string[]
  equipment: string[]
  level: FitnessLevel
  defaultDurationSec: number
  defaultReps?: number
  mediaEmoji: string
  status: "published" | "draft"
}

export interface WorkoutExercise {
  exerciseId: ID
  durationSec?: number
  reps?: number
  restSec: number
}

export interface Workout {
  id: ID
  companyId: ID | null
  name: string
  description: string
  category: string
  level: FitnessLevel
  location: "home" | "gym" | "outdoor" | "office"
  equipment: string[]
  muscleGroups: string[]
  durationMin: number
  calories: number
  points: number
  coverEmoji: string
  coverColor: string
  exercises: WorkoutExercise[]
  status: "published" | "draft" | "archived"
  completions: number
  updatedAt: ISODate
}

export interface HabitDefinition {
  id: ID
  name: string
  description: string
  icon: string
  category: "movement" | "hydration" | "sleep" | "mindfulness" | "nutrition" | "productivity"
  unit: "times" | "minutes" | "glasses" | "hours" | "steps" | "check"
  defaultTarget: number
  points: number
  status: "active" | "draft" | "archived"
  usersCount: number
  autoCompleteFrom?: "steps" | "water" | "sleep" | "workout"
}

export interface WellnessScoreWeights {
  activity: number
  sleep: number
  hydration: number
  exercise: number
  habits: number
  mindfulness: number
}

export interface WellnessScoreConfig {
  version: number
  weights: WellnessScoreWeights
  updatedAt: ISODate
  updatedBy: string
  note?: string
}

export interface SystemSetting {
  key: string
  label: string
  description: string
  group: "app" | "security" | "notifications" | "data" | "integrations"
  type: "text" | "number" | "boolean" | "select"
  value: string | number | boolean
  options?: string[]
  updatedAt: ISODate
}

export interface AuditLog {
  id: ID
  companyId: ID | null
  actorName: string
  actorRole: string
  action: string
  entityType: string
  entityName: string
  ip: string
  createdAt: ISODate
  details?: string
  severity: "info" | "warning" | "critical"
}

export interface SupportTicket {
  id: ID
  number: string
  companyId: ID
  subject: string
  requester: string
  priority: "low" | "medium" | "high" | "urgent"
  status: "open" | "pending" | "resolved" | "closed"
  category: "account" | "billing" | "technical" | "rewards" | "other"
  createdAt: ISODate
  updatedAt: ISODate
  messages: { from: string; body: string; at: ISODate; internal?: boolean }[]
}

export interface Integration {
  id: ID
  companyId: ID
  provider: "slack" | "microsoft_teams" | "hrms_api" | "hrms_csv" | "hrms_sftp" | "hrms_webhook" | "google_workspace" | "microsoft_entra"
  name: string
  description: string
  status: "connected" | "disconnected" | "error" | "coming_soon"
  connectedAt?: ISODate
  lastSyncAt?: ISODate
  config?: Record<string, string>
}

// ─── Employee app (own data only) ───────────────────────────────────────

export interface WellnessProfile {
  heightCm: number
  weightKg: number
  dateOfBirth?: LocalDate
  gender: "female" | "male" | "other" | "undisclosed"
  mainGoal: "lose_weight" | "stay_active" | "build_strength" | "reduce_stress" | "sleep_better" | "eat_healthier"
  activityLevel: "sedentary" | "light" | "moderate" | "very_active"
  fitnessLevel: FitnessLevel
  dailyStepGoal: number
  dailyWaterGoalMl: number
  sleepGoalHours: number
}

export interface EmployeePreferences {
  activities: string[]
  workoutLocation: "home" | "gym" | "outdoor" | "any"
  workoutDurationMin: number
  foodPreference: "vegetarian" | "vegan" | "eggetarian" | "non_vegetarian" | "jain" | "no_preference"
  language: string
  units: "metric" | "imperial"
  theme: "system" | "light" | "dark"
}

export interface NotificationPreferences {
  push: boolean
  email: boolean
  reminders: boolean
  challenges: boolean
  announcements: boolean
  rewards: boolean
  weeklySummary: boolean
  waterReminders: boolean
  quietHoursStart: string
  quietHoursEnd: string
}

export type ConsentKey =
  | "health_data"
  | "wearable_connection"
  | "data_sharing"
  | "notifications"
  | "ai_personalisation"
  | "analytics"

export interface Consent {
  key: ConsentKey
  title: string
  description: string
  granted: boolean
  required: boolean
  updatedAt: ISODate
  version: string
}

export interface HealthConnection {
  provider: HealthProvider
  status: "connected" | "disconnected" | "error" | "not_available"
  connectedAt?: ISODate
  lastSyncAt?: ISODate
  dataTypes: string[]
}

export interface DailyActivity {
  date: LocalDate
  steps: number
  distanceKm: number
  activeCalories: number
  activeMinutes: number
  goalSteps: number
}

export type ActivityType = "walking" | "running" | "cycling" | "swimming" | "yoga" | "meditation" | "strength" | "sports" | "other"

export interface ActivitySession {
  id: ID
  type: ActivityType
  startedAt: ISODate
  durationMin: number
  distanceKm?: number
  calories?: number
  steps?: number
  source: "apple_health" | "health_connect" | "manual" | "workout"
  notes?: string
  points: number
}

export interface WaterLog {
  id: ID
  amountMl: number
  at: ISODate
}

export interface WaterSettings {
  goalMl: number
  remindersEnabled: boolean
  reminderStart: string
  reminderEnd: string
  reminderEveryMin: number
  quickAmounts: number[]
}

export interface SleepRecord {
  id: ID
  date: LocalDate
  bedtime: ISODate
  wakeTime: ISODate
  durationMin: number
  quality: 1 | 2 | 3 | 4 | 5
  source: "manual" | "apple_health" | "health_connect"
  score: number
}

export interface WorkoutSession {
  id: ID
  workoutId: ID
  startedAt: ISODate
  completedAt?: ISODate
  durationMin: number
  calories: number
  points: number
  completed: boolean
}

export interface UserHabit {
  id: ID
  habitId: ID
  target: number
  reminderTime?: string
  active: boolean
  custom?: { name: string; icon: string; unit: HabitDefinition["unit"] }
  /** last 35 days completion values, oldest → newest */
  history: number[]
  todayValue: number
  currentStreak: number
  bestStreak: number
}

export interface WellnessScore {
  date: LocalDate
  total: number
  components: Record<keyof WellnessScoreWeights, number>
}

export interface WeeklySummary {
  weekStart: LocalDate
  workouts: number
  steps: number
  hydrationGoalsHit: number
  activeDays: number
  avgSleepHours: number
  scoreChange: number
  opportunity: string
  recommendation: string
  highlights: string[]
}

export interface FoodItem {
  id: ID
  name: string
  serving: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  tags: string[]
}

export interface Meal {
  id: ID
  date: LocalDate
  type: "breakfast" | "lunch" | "snack" | "dinner"
  items: { foodId: ID; servings: number }[]
}

export interface AIMessage {
  id: ID
  role: "user" | "assistant"
  content: string
  at: ISODate
}

export interface AIWellnessPlanDay {
  day: number
  title: string
  items: { time: string; label: string; kind: "move" | "eat" | "hydrate" | "rest" | "mind" }[]
}

export interface ProgramEnrollment {
  programId: ID
  enrolledAt: ISODate
  currentWeek: number
  completedGoalIds: ID[]
}

export interface Me {
  employee: Employee
  company: Company
  profile: WellnessProfile
  preferences: EmployeePreferences
  notificationPreferences: NotificationPreferences
  onboardingCompleted: boolean
  termsAcceptedAt?: ISODate
}

// ─── Analytics ──────────────────────────────────────────────────────────

export interface TimePoint {
  date: LocalDate
  value: number
}

export interface MultiTimePoint {
  date: LocalDate
  [series: string]: number | string
}
