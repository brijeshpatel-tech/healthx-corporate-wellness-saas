/**
 * Business Portal — challenges (SCR-B-013..015) plus shared engagement helpers
 * (audience resolution, employee notifications) used by announcements, programs and orders.
 *
 * Company admins only ever see aggregated figures. The only individual values shown are
 * challenge leaderboard totals, under the company's name-display setting.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type {
  AppNotification,
  AudienceType,
  Challenge,
  ChallengeMetric,
  ChallengeParticipant,
  ChallengeStatus,
  ChallengeTemplate,
  ChallengeType,
  Employee,
  LeaderboardEntry,
  LeaderboardNameDisplay,
  NotificationPreferences,
  Reward,
} from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { DAY_MS, toLocalDate } from "@/lib/mock/series"
import { ApiError, audit, badRequest, endpoint, forbidden, matchesSearch, newId, notFound } from "../core"
import { companyEmployees, companySettings, isJoined, ratio, requireRole, suppressed, type BusinessCtx } from "./common"

// ─── Shared engagement helpers (mock side) ──────────────────────────────

export interface AudienceInput {
  audienceType: AudienceType
  audienceIds: string[]
}

export interface AudiencePerson {
  id: string
  name: string
  subtitle: string
  avatarColor: string
  status: Employee["status"]
}

export interface AudienceEstimate {
  /** Everyone in the audience (not deactivated). */
  total: number
  /** People who have joined the app and can take part / receive notifications. */
  joined: number
  label: string
}

const MANAGE_ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]

/** Employees in an audience (deactivated people are never included). */
export function audienceMembers(ctx: BusinessCtx, a: AudienceInput, joinedOnly = false): Employee[] {
  const ids = new Set(a.audienceIds ?? [])
  const list = companyEmployees(ctx).filter((e) => {
    if (a.audienceType === "departments") return ids.has(e.departmentId)
    if (a.audienceType === "teams") return ids.has(e.teamId)
    if (a.audienceType === "selected") return ids.has(e.id)
    return true
  })
  return joinedOnly ? list.filter(isJoined) : list
}

/** Short human label, e.g. "Everyone", "Engineering, Sales", "3 teams", "12 selected employees". */
export function describeAudience(ctx: BusinessCtx, a: AudienceInput): string {
  const ids = a.audienceIds ?? []
  if (a.audienceType === "all") return "Everyone"
  if (a.audienceType === "selected") return `${ids.length} selected ${ids.length === 1 ? "employee" : "employees"}`
  const names =
    a.audienceType === "departments"
      ? ids.map((id) => ctx.db.departments.find((d) => d.id === id)?.name).filter(Boolean)
      : ids.map((id) => ctx.db.teams.find((t) => t.id === id)?.name).filter(Boolean)
  if (names.length === 0) return a.audienceType === "departments" ? "No departments" : "No teams"
  if (names.length <= 2) return names.join(", ")
  return `${names.length} ${a.audienceType}`
}

export function audienceNames(ctx: BusinessCtx, a: AudienceInput): string[] {
  const ids = a.audienceIds ?? []
  if (a.audienceType === "departments") return ids.map((id) => ctx.db.departments.find((d) => d.id === id)?.name ?? "Unknown department")
  if (a.audienceType === "teams") return ids.map((id) => ctx.db.teams.find((t) => t.id === id)?.name ?? "Unknown team")
  if (a.audienceType === "selected")
    return ids.map((id) => {
      const e = ctx.db.employees.find((x) => x.id === id)
      return e ? `${e.firstName} ${e.lastName}` : "Former employee"
    })
  return []
}

export function validateAudience(ctx: BusinessCtx, a: AudienceInput): string | null {
  if (a.audienceType === "all") return null
  if (!a.audienceIds?.length)
    return a.audienceType === "departments" ? "Choose at least one department" : a.audienceType === "teams" ? "Choose at least one team" : "Choose at least one employee"
  if (audienceMembers(ctx, a).length === 0) return "No one is in this audience yet"
  return null
}

/**
 * Push an in-app notification to employees who already use the app (have private data).
 * `preference` skips people who turned that notification category off.
 */
export function notifyEmployees(
  ctx: BusinessCtx,
  employeeIds: Iterable<string>,
  n: Omit<AppNotification, "id" | "createdAt" | "read">,
  preference?: keyof Pick<NotificationPreferences, "challenges" | "announcements" | "rewards" | "reminders">,
) {
  let delivered = 0
  for (const id of employeeIds) {
    const p = ctx.db.private[id]
    if (!p) continue
    if (preference && p.notificationPreferences && p.notificationPreferences[preference] === false) continue
    p.notifications.unshift({ ...n, id: newId("ntf"), createdAt: new Date().toISOString(), read: false })
    delivered++
  }
  return delivered
}

// ─── Challenge types ────────────────────────────────────────────────────

export interface ChallengeQuery {
  status?: ChallengeStatus | "all"
  type?: ChallengeType | "all"
  search?: string
}

/** 1st/2nd/3rd place prize (#359). A text prize, a reward from the catalogue, bonus points — or a mix. */
export interface PlacePrize {
  place: 1 | 2 | 3
  text?: string
  rewardId?: string
  points?: number
}

export type ScoringMethod = "total" | "best_days" | "bands"

/** Custom scoring rules (#369, Phase 2). */
export interface ScoringRule {
  method: ScoringMethod
  /** best_days: count the best N days … */
  bestDays?: number
  /** … in every M-day window. */
  ofDays?: number
  /** bands: a day's value earns the points of the highest band it reaches. */
  bands?: { min: number; points: number }[]
}

export interface JourneyMilestone {
  id: string
  name: string
  km: number
  points?: number
}

/** Walking journey (#374, Phase 2): a virtual route for steps/distance challenges. */
export interface WalkingJourney {
  name: string
  totalKm: number
  milestones: JourneyMilestone[]
}

/**
 * Extra challenge configuration that isn't on the shared `Challenge` type.
 * Stored in `ctx.extra("challenge-settings")` keyed by challenge id (the Employee App reads the same key).
 */
export interface ChallengeSettings {
  prizes: PlacePrize[]
  /** Warm-up (#358, Phase 2): people can join and connect trackers from this date; scoring starts on startDate. */
  warmupStartDate?: string
  scoring: ScoringRule
  journey?: WalkingJourney | null
}

export const CHALLENGE_SETTINGS_KEY = "challenge-settings"
export const CHALLENGE_JOIN_CODES_KEY = "challenge-join-codes"
/** Average stride used to turn steps into kilometres on a walking journey. */
export const STEPS_PER_KM = 1320

export interface ChallengeRow extends Challenge {
  /** Average share of the target reached by participants (0..1). Collaborative: company total ÷ target. */
  avgProgress: number
  participationRate: number
  completionRate: number
  durationDays: number
  /** Days until the end (active) or until the start (scheduled). */
  daysLeft: number | null
  daysToStart: number | null
  rewardName?: string
  audienceLabel: string
  /** Published, warm-up has started and scoring hasn't (#358). */
  warmup: boolean
  warmupStartDate?: string
}

export interface ChallengeListResult {
  items: ChallengeRow[]
  counts: Record<ChallengeStatus | "all", number>
  /** Figures are limited to the Team Manager's teams. */
  scopedToTeams: boolean
}

export interface ChallengeDetail extends ChallengeRow {
  reward?: Pick<Reward, "id" | "name" | "imageEmoji" | "imageColor" | "pointsCost">
  template?: { id: string; name: string }
  audienceNames: string[]
  settings: Omit<ChallengeSettings, "prizes"> & { prizes: (PlacePrize & { rewardName?: string; rewardEmoji?: string; rewardColor?: string })[] }
  /** Why editing is disabled (fairness lock #357 / client decision #21). */
  lockReason?: string
  canEdit: boolean
  canPublish: boolean
  canCancel: boolean
  canEndEarly: boolean
  canDelete: boolean
  cancelReason?: string
  scopedToTeams: boolean
}

export interface ChallengeInput extends AudienceInput {
  name: string
  description: string
  type: ChallengeType
  teamUnit?: "department" | "team"
  metric: ChallengeMetric
  customMetricLabel?: string
  target: number
  startDate: string
  endDate: string
  points: number
  rewardId?: string
  coverEmoji: string
  coverColor: string
  rules: string[]
  templateId?: string
  prizes?: PlacePrize[]
  warmupStartDate?: string
  scoring?: ScoringRule
  journey?: WalkingJourney | null
  /** Save and publish in one step (Scheduled or Active depending on the start date). */
  publish?: boolean
}

export interface ChallengeAnalytics {
  started: boolean
  scopeLabel: string
  unit: string
  kpis: {
    participants: number
    eligible: number
    participationRate: number
    completed: number
    completionRate: number
    avgProgress: number
    totalMetric: number
    avgPerParticipant: number
    /** Company-wide total (collaborative shared goal). */
    sharedTotal: number
  }
  daily: { date: string; total: number; active: number; cumulative: number }[]
  standings: { id: string; name: string; members: number; participants: number; total: number | null; average: number | null; rank: number | null; hidden: boolean }[] | null
  departments: { id: string; name: string; eligible: number; participants: number; participationRate: number | null; completionRate: number | null; hidden: boolean }[]
  minGroupSize: number
}

export interface ChallengeLeaderboard {
  entries: (LeaderboardEntry & { completed: boolean; progress: number })[]
  total: number
  nameDisplay: LeaderboardNameDisplay
  unit: string
  /** The value is a score from a custom scoring rule, not the raw metric. */
  scored: boolean
  scoringLabel: string
}

export interface RewardOption {
  id: string
  name: string
  imageEmoji: string
  imageColor: string
  pointsCost: number
  source: "company" | "healthx"
}

// ─── Internals ──────────────────────────────────────────────────────────

const today = () => toLocalDate(new Date())
const dayDiff = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / DAY_MS)
const meta = (ctx: BusinessCtx) => ctx.extra<Record<string, { cancelReason?: string; endedEarly?: boolean }>>("biz-challenge-meta", () => ({}))
const settingsStore = (ctx: BusinessCtx) => ctx.extra<Record<string, ChallengeSettings>>(CHALLENGE_SETTINGS_KEY, () => seedSettings(ctx))

/** Sample prizes, a walking journey and a warm-up for the demo company's challenges. */
function seedSettings(ctx: BusinessCtx): Record<string, ChallengeSettings> {
  const byId = (id: string) => ctx.db.challenges.find((c) => c.id === id)
  const out: Record<string, ChallengeSettings> = {}
  if (byId("chl_001")) {
    out.chl_001 = {
      prizes: [
        { place: 1, text: "Fitness band", points: 300 },
        { place: 2, text: "Premium yoga mat", points: 200 },
        { place: 3, points: 100, text: "Coffee voucher" },
      ],
      scoring: { method: "total" },
      journey: {
        name: "Bengaluru to Coorg trail",
        totalKm: 230,
        milestones: [
          { id: "ms_1", name: "Ramanagara", km: 50, points: 20 },
          { id: "ms_2", name: "Mandya", km: 100, points: 20 },
          { id: "ms_3", name: "Mysuru Palace", km: 145, points: 30 },
          { id: "ms_4", name: "Hunsur", km: 190, points: 30 },
          { id: "ms_5", name: "Madikeri, Coorg", km: 230, points: 50 },
        ],
      },
    }
  }
  if (byId("chl_002")) out.chl_002 = { prizes: [{ place: 1, text: "Team lunch on the company", points: 150 }, { place: 2, points: 100 }, { place: 3, points: 50 }], scoring: { method: "total" }, journey: null }
  if (byId("chl_006")) out.chl_006 = { prizes: [{ place: 1, points: 300, text: "Weekend Warrior trophy" }, { place: 2, points: 200 }, { place: 3, points: 100 }], scoring: { method: "total" }, journey: null }
  const sugar = byId("chl_007")
  if (sugar) {
    const warm = new Date(`${sugar.startDate}T00:00:00`)
    warm.setDate(warm.getDate() - 3)
    out.chl_007 = { prizes: [], warmupStartDate: toLocalDate(warm), scoring: { method: "total" }, journey: null }
  }
  return out
}

export const DEFAULT_SCORING: ScoringRule = { method: "total" }

/** Settings for a challenge, with defaults. */
export function challengeSettings(ctx: BusinessCtx, challengeId: string): ChallengeSettings {
  const s = settingsStore(ctx)[challengeId]
  return { prizes: s?.prizes ?? [], warmupStartDate: s?.warmupStartDate, scoring: s?.scoring ?? DEFAULT_SCORING, journey: s?.journey ?? null }
}

/** Human description of a scoring rule. */
export function describeScoring(rule: ScoringRule, unit: string) {
  if (rule.method === "best_days") return `Best ${rule.bestDays} of every ${rule.ofDays} days count`
  if (rule.method === "bands") {
    const bands = [...(rule.bands ?? [])].sort((a, b) => a.min - b.min)
    return `Score bands per day: ${bands.map((b) => `${b.min.toLocaleString("en-IN")}+ ${unit} = ${b.points} pt${b.points === 1 ? "" : "s"}`).join(", ")}`
  }
  return `Total ${unit} over the challenge`
}

/** A participant's score under the challenge's scoring rule (raw total by default). */
export function scoreOf(p: Pick<ChallengeParticipant, "progress" | "daily">, rule: ScoringRule) {
  if (rule.method === "best_days" && rule.bestDays && rule.ofDays) {
    let total = 0
    for (let i = 0; i < p.daily.length; i += rule.ofDays) {
      total += [...p.daily.slice(i, i + rule.ofDays)]
        .sort((a, b) => b - a)
        .slice(0, rule.bestDays)
        .reduce((a, v) => a + v, 0)
    }
    return total
  }
  if (rule.method === "bands" && rule.bands?.length) {
    const bands = [...rule.bands].sort((a, b) => b.min - a.min)
    return p.daily.reduce((a, v) => a + (bands.find((b) => v >= b.min)?.points ?? 0), 0)
  }
  return p.progress
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const joinCodes = (ctx: BusinessCtx) => ctx.extra<Record<string, { code: string; createdAt?: string }>>(CHALLENGE_JOIN_CODES_KEY, () => ({}))

/** 6-character join code (#356) for a published challenge — created on first use. */
export function ensureJoinCode(ctx: BusinessCtx, challengeId: string, regenerate = false) {
  const store = joinCodes(ctx)
  if (store[challengeId] && !regenerate) return store[challengeId]!.code
  const taken = new Set(Object.values(store).map((v) => v.code))
  let code = ""
  do {
    code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("")
  } while (taken.has(code))
  store[challengeId] = { code, createdAt: new Date().toISOString() }
  return code
}

export function inWarmup(c: Challenge, settings: ChallengeSettings) {
  return c.status === "scheduled" && !!settings.warmupStartDate && settings.warmupStartDate <= today() && c.startDate > today()
}

/** Fairness lock (#357, client decision #21): nothing can change once a challenge has started. */
function lockReasonOf(c: Challenge, settings: ChallengeSettings): string | undefined {
  if (c.status === "active") return "This challenge has started, so its rules, dates and goals are locked to keep it fair for everyone. You can still cancel it or end it early."
  if (c.status === "completed") return "This challenge has finished. Results are final and can't be changed."
  if (c.status === "cancelled") return "This challenge was cancelled and can't be changed."
  if (inWarmup(c, settings)) return "The warm-up has started and people are joining, so the challenge is locked to keep it fair. You can still cancel it."
  return undefined
}

/** What a real backend scheduler would do: start scheduled challenges and close finished ones. */
function syncStatuses(ctx: BusinessCtx) {
  const t = today()
  let changed = false
  for (const c of ctx.db.challenges) {
    if (c.companyId !== ctx.companyId()) continue
    if (c.status === "scheduled" && c.startDate <= t) {
      c.status = "active"
      changed = true
    }
    if (c.status === "active" && c.endDate < t) {
      c.status = "completed"
      changed = true
    }
  }
  if (changed) ctx.save()
}

function findChallenge(ctx: BusinessCtx, id: string) {
  const c = ctx.db.challenges.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!c) throw notFound("Challenge")
  return c
}

/** Team Manager: the member ids they may see. Others: null (everyone). */
function teamScope(ctx: BusinessCtx): Set<string> | null {
  const s = ctx.session() as BusinessSession
  if (s.role !== "team_manager") return null
  return new Set(companyEmployees(ctx).filter((e) => s.teamIds.includes(e.teamId)).map((e) => e.id))
}

function eligibleFor(ctx: BusinessCtx, c: Challenge, scope: Set<string> | null) {
  const list = audienceMembers(ctx, c, true)
  return scope ? list.filter((e) => scope.has(e.id)) : list
}

function participantsFor(ctx: BusinessCtx, c: Challenge, scope: Set<string> | null) {
  const list = ctx.db.participants.filter((p) => p.challengeId === c.id)
  return scope ? list.filter((p) => scope.has(p.employeeId)) : list
}

function progressOf(c: Challenge, parts: ChallengeParticipant[]) {
  if (parts.length === 0) return 0
  if (c.type === "collaborative") return Math.min(1, ratio(parts.reduce((a, p) => a + p.progress, 0), c.target))
  return parts.reduce((a, p) => a + Math.min(1, p.progress / c.target), 0) / parts.length
}

function toRow(ctx: BusinessCtx, c: Challenge, scope: Set<string> | null): ChallengeRow {
  const parts = participantsFor(ctx, c, scope)
  const eligible = scope ? eligibleFor(ctx, c, scope).length : c.eligibleCount
  const completed = c.type === "collaborative" ? (progressOf(c, parts) >= 1 ? parts.length : 0) : parts.filter((p) => p.completed).length
  const t = today()
  const reward = c.rewardId ? ctx.db.rewards.find((r) => r.id === c.rewardId) : undefined
  return {
    ...c,
    participantsCount: parts.length,
    eligibleCount: eligible,
    completedCount: completed,
    // The shared goal of a collaborative challenge is company-wide, even for a Team Manager's view.
    avgProgress: c.type === "collaborative" ? progressOf(c, participantsFor(ctx, c, null)) : progressOf(c, parts),
    participationRate: ratio(parts.length, eligible),
    completionRate: ratio(completed, parts.length),
    durationDays: dayDiff(c.startDate, c.endDate) + 1,
    daysLeft: c.status === "active" ? Math.max(0, dayDiff(t, c.endDate)) : null,
    daysToStart: c.status === "scheduled" || c.status === "draft" ? dayDiff(t, c.startDate) : null,
    rewardName: reward?.name,
    audienceLabel: describeAudience(ctx, c),
    warmup: inWarmup(c, challengeSettings(ctx, c.id)),
    warmupStartDate: challengeSettings(ctx, c.id).warmupStartDate,
  }
}

function visibleTo(ctx: BusinessCtx, c: Challenge, scope: Set<string> | null) {
  if (!scope) return true
  if (c.status === "draft") return false
  return audienceMembers(ctx, c).some((e) => scope.has(e.id))
}

function validateInput(ctx: BusinessCtx, input: ChallengeInput, existing?: Challenge) {
  const errors: Record<string, string> = {}
  const t = today()
  const name = input.name?.trim() ?? ""
  if (name.length < 3) errors.name = "Name must be at least 3 characters"
  else if (name.length > 80) errors.name = "Keep the name under 80 characters"
  if ((input.description ?? "").length > 600) errors.description = "Keep the description under 600 characters"
  if (!(input.target > 0)) errors.target = "Target must be greater than 0"
  if (input.metric === "custom" && !input.customMetricLabel?.trim()) errors.customMetricLabel = "Name what people check in for"
  if (input.type === "team" && !input.teamUnit) errors.teamUnit = "Choose what competes"
  if (!input.startDate) errors.startDate = "Choose a start date"
  if (!input.endDate) errors.endDate = "Choose an end date"
  if (input.startDate && (!existing || existing.status === "draft" || existing.status === "scheduled") && input.startDate < t) errors.startDate = "Start date can't be in the past"
  if (input.startDate && input.endDate && input.endDate <= input.startDate) errors.endDate = "End date must be after start date."
  else if (input.startDate && input.endDate && dayDiff(input.startDate, input.endDate) > 365) errors.endDate = "Challenges can run for up to a year"
  if (!(input.points >= 0) || input.points > 10000) errors.points = "Points must be between 0 and 10,000"
  const audienceError = validateAudience(ctx, input)
  if (audienceError) errors.audienceIds = audienceError
  if (input.rewardId && !availableRewards(ctx).some((r) => r.id === input.rewardId)) errors.rewardId = "This reward is no longer available"
  if ((input.rules ?? []).some((r) => r.length > 200)) errors.rules = "Keep each rule under 200 characters"
  // Winner prizes (#359)
  const rewardIds = new Set(availableRewards(ctx).map((r) => r.id))
  for (const prize of input.prizes ?? []) {
    if ((prize.text ?? "").length > 80) errors[`prizes.${prize.place - 1}.text`] = "Keep the prize under 80 characters"
    else if (prize.rewardId && !rewardIds.has(prize.rewardId)) errors[`prizes.${prize.place - 1}.rewardId`] = "This reward is no longer available"
    else if (prize.points !== undefined && (prize.points < 0 || prize.points > 10000)) errors[`prizes.${prize.place - 1}.points`] = "Bonus points must be between 0 and 10,000"
  }
  // Warm-up (#358)
  if (input.warmupStartDate) {
    if (input.startDate && input.warmupStartDate >= input.startDate) errors.warmupStartDate = "Warm-up must start before scoring starts"
    else if (input.warmupStartDate < t) errors.warmupStartDate = "Warm-up can't start in the past"
    else if (input.startDate && dayDiff(input.warmupStartDate, input.startDate) > 14) errors.warmupStartDate = "Keep the warm-up to 14 days or less"
  }
  // Custom scoring (#369)
  const sc = input.scoring
  if (sc && sc.method !== "total") {
    if (input.type === "collaborative") errors.scoring = "Collaborative challenges always use the combined total"
    else if (sc.method === "best_days") {
      const duration = input.startDate && input.endDate ? dayDiff(input.startDate, input.endDate) + 1 : 0
      if (!sc.bestDays || !sc.ofDays || sc.bestDays < 1 || sc.ofDays < 2 || sc.bestDays >= sc.ofDays) errors.scoring = "Use a smaller N than M, e.g. best 5 of 7 days"
      else if (duration && sc.ofDays > duration) errors.scoring = "The window can't be longer than the challenge"
    } else if (sc.method === "bands") {
      const bands = sc.bands ?? []
      if (bands.length === 0 || bands.length > 6) errors.scoring = "Add between 1 and 6 bands"
      else if (bands.some((b) => !(b.min > 0) || !(b.points > 0))) errors.scoring = "Each band needs a minimum and points above 0"
      else if (new Set(bands.map((b) => b.min)).size !== bands.length) errors.scoring = "Each band needs a different minimum"
    }
  }
  // Walking journey (#374)
  const j = input.journey
  if (j) {
    if (input.metric !== "steps" && input.metric !== "distance") errors.journey = "Walking journeys need the steps or distance metric"
    else if ((j.name ?? "").trim().length < 3) errors.journey = "Give the route a name"
    else if (!(j.totalKm > 0) || j.totalKm > 10000) errors.journey = "Route length must be between 1 and 10,000 km"
    else if (j.milestones.some((m) => !m.name.trim() || !(m.km > 0) || m.km > j.totalKm)) errors.journey = "Each milestone needs a name and a distance within the route"
  }
  return errors
}

function availableRewards(ctx: BusinessCtx): RewardOption[] {
  const companyId = ctx.companyId()
  const hidden = new Set(ctx.db.rewardSettings[companyId]?.hiddenGlobalRewardIds ?? [])
  return ctx.db.rewards
    .filter((r) => (r.companyId === companyId || (r.companyId === null && !hidden.has(r.id))) && (r.status === "active" || r.status === "out_of_stock"))
    .sort((a, b) => (a.companyId === b.companyId ? a.pointsCost - b.pointsCost : a.companyId ? -1 : 1))
    .map((r) => ({ id: r.id, name: r.name, imageEmoji: r.imageEmoji, imageColor: r.imageColor, pointsCost: r.pointsCost, source: r.companyId ? "company" : "healthx" }))
}

function applySettings(ctx: BusinessCtx, c: Challenge, input: ChallengeInput) {
  const competitive = c.type !== "collaborative"
  settingsStore(ctx)[c.id] = {
    prizes: competitive
      ? (input.prizes ?? [])
          .filter((p) => p.text?.trim() || p.rewardId || (p.points ?? 0) > 0)
          .map((p) => ({ place: p.place, text: p.text?.trim() || undefined, rewardId: p.rewardId || undefined, points: p.points ? Math.round(p.points) : undefined }))
          .sort((a, b) => a.place - b.place)
      : [],
    warmupStartDate: input.warmupStartDate || undefined,
    scoring: competitive && input.scoring ? input.scoring : DEFAULT_SCORING,
    journey:
      input.journey && (c.metric === "steps" || c.metric === "distance")
        ? {
            name: input.journey.name.trim(),
            totalKm: input.journey.totalKm,
            milestones: [...input.journey.milestones].sort((a, b) => a.km - b.km).map((m) => ({ ...m, id: m.id || newId("ms"), name: m.name.trim() })),
          }
        : null,
  }
}

function applyInput(c: Challenge, input: ChallengeInput) {
  const set = <K extends keyof ChallengeInput & keyof Challenge>(k: K, v: Challenge[K]) => {
    c[k] = v
  }
  set("name", input.name.trim())
  set("description", input.description?.trim() ?? "")
  set("type", input.type)
  set("teamUnit", input.type === "team" ? input.teamUnit : undefined)
  set("metric", input.metric)
  set("customMetricLabel", input.metric === "custom" ? input.customMetricLabel?.trim() : undefined)
  set("target", Math.round(input.target * 100) / 100)
  set("startDate", input.startDate)
  set("endDate", input.endDate)
  set("audienceType", input.audienceType)
  set("audienceIds", input.audienceType === "all" ? [] : input.audienceIds)
  set("points", Math.round(input.points))
  set("rewardId", input.rewardId || undefined)
  set("coverEmoji", input.coverEmoji || "🏆")
  set("coverColor", input.coverColor || "#10b981")
  set("rules", (input.rules ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 12))
}

function doPublish(ctx: BusinessCtx, c: Challenge) {
  const t = today()
  if (c.startDate < t) throw badRequest("The start date is in the past. Choose a new start date before publishing.", { startDate: "Start date can't be in the past" })
  c.status = c.startDate > t ? "scheduled" : "active"
  c.eligibleCount = audienceMembers(ctx, c, true).length
  ensureJoinCode(ctx, c.id)
  const warm = inWarmup(c, challengeSettings(ctx, c.id))
  const unit = c.metric === "custom" ? c.customMetricLabel ?? "check-ins" : CHALLENGE_METRIC_UNIT[c.metric]
  const startLabel = new Date(`${c.startDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
  const next = c.status === "active" ? "Join now in the Challenges tab." : warm ? `Join now and connect your tracker — scoring starts ${startLabel}.` : `Starts ${startLabel}.`
  notifyEmployees(
    ctx,
    audienceMembers(ctx, c, true).map((e) => e.id),
    {
      type: "challenge",
      title: c.status === "active" ? `New challenge: ${c.name} ${c.coverEmoji}` : warm ? `Warm-up open: ${c.name} ${c.coverEmoji}` : `Coming up: ${c.name} ${c.coverEmoji}`,
      body: `${c.target.toLocaleString("en-IN")} ${unit}${c.points ? ` · earn ${c.points} points` : ""}. ${next}`,
      href: `/employee-app/challenges/${c.id}`,
    },
    "challenges",
  )
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })

// ─── Endpoints ──────────────────────────────────────────────────────────

export const challengesApi = {
  list: endpoint<ChallengeQuery, ChallengeListResult, "business">("business", "GET", "/organization/challenges", (q, ctx) => {
    syncStatuses(ctx)
    const scope = teamScope(ctx)
    const base = ctx.db.challenges
      .filter((c) => c.companyId === ctx.companyId() && visibleTo(ctx, c, scope))
      .filter((c) => (!q.type || q.type === "all" || c.type === q.type) && matchesSearch(q.search, c.name, c.description))
    const counts = { all: base.length, draft: 0, scheduled: 0, active: 0, completed: 0, cancelled: 0 } as ChallengeListResult["counts"]
    base.forEach((c) => counts[c.status]++)
    const order: Record<ChallengeStatus, number> = { active: 0, scheduled: 1, draft: 2, completed: 3, cancelled: 4 }
    const items = base
      .filter((c) => !q.status || q.status === "all" || c.status === q.status)
      .sort((a, b) => order[a.status] - order[b.status] || (a.status === "completed" || a.status === "cancelled" ? b.endDate.localeCompare(a.endDate) : a.startDate.localeCompare(b.startDate)))
      .map((c) => toRow(ctx, c, scope))
    return { items, counts, scopedToTeams: !!scope }
  }),

  get: endpoint<{ id: string }, ChallengeDetail, "business">("business", "GET", "/organization/challenges/:id", ({ id }, ctx) => {
    syncStatuses(ctx)
    const scope = teamScope(ctx)
    const c = findChallenge(ctx, id)
    if (!visibleTo(ctx, c, scope)) throw forbidden("This challenge isn't open to your team.")
    return detailOf(ctx, c)
  }),

  analytics: endpoint<{ id: string }, ChallengeAnalytics, "business">("business", "GET", "/organization/challenges/:id/analytics", ({ id }, ctx) => {
    const scope = teamScope(ctx)
    const c = findChallenge(ctx, id)
    if (!visibleTo(ctx, c, scope)) throw forbidden("This challenge isn't open to your team.")
    const settings = companySettings(ctx)
    const session = ctx.session() as BusinessSession
    const unit = c.metric === "custom" ? c.customMetricLabel ?? "check-ins" : CHALLENGE_METRIC_UNIT[c.metric]
    const started = c.status === "active" || c.status === "completed" || (c.status === "cancelled" && ctx.db.participants.some((p) => p.challengeId === c.id))
    const parts = participantsFor(ctx, c, scope)
    const eligible = eligibleFor(ctx, c, scope)
    const allParts = scope ? participantsFor(ctx, c, null) : parts
    const sharedTotal = allParts.reduce((a, p) => a + p.progress, 0)
    const completed = c.type === "collaborative" ? (progressOf(c, allParts) >= 1 ? parts.length : 0) : parts.filter((p) => p.completed).length
    const totalMetric = parts.reduce((a, p) => a + p.progress, 0)

    // Daily series: participants' arrays are right-aligned to the last counted day.
    const t = today()
    const lastDay = c.endDate < t ? c.endDate : t
    const days = started ? Math.max(1, Math.min(dayDiff(c.startDate, lastDay) + 1, 62)) : 0
    const totals = new Array<number>(days).fill(0)
    const actives = new Array<number>(days).fill(0)
    for (const p of parts) {
      const d = p.daily.slice(-days)
      const offset = days - d.length
      d.forEach((v, i) => {
        totals[offset + i]! += v
        if (v > 0) actives[offset + i]!++
      })
    }
    let cum = 0
    const lastDate = new Date(`${lastDay}T00:00:00`)
    const daily = totals.map((v, i) => {
      cum += v
      return { date: toLocalDate(new Date(lastDate.getTime() - (days - 1 - i) * DAY_MS)), total: Math.round(v * 100) / 100, active: actives[i]!, cumulative: Math.round(cum * 100) / 100 }
    })

    const employeesById = new Map(companyEmployees(ctx, true).map((e) => [e.id, e]))
    // Team standings: average per participant so groups of different sizes compete fairly.
    let standings: ChallengeAnalytics["standings"] = null
    if (c.type === "team") {
      const unitKey = c.teamUnit === "team" ? "teamId" : "departmentId"
      const groups = c.teamUnit === "team" ? ctx.db.teams.filter((x) => x.companyId === c.companyId) : ctx.db.departments.filter((x) => x.companyId === c.companyId)
      const eligibleAll = audienceMembers(ctx, c, true)
      const rows = groups
        .map((g) => {
          const members = eligibleAll.filter((e) => e[unitKey] === g.id)
          const gp = ctx.db.participants.filter((p) => p.challengeId === c.id && employeesById.get(p.employeeId)?.[unitKey] === g.id)
          const total = gp.reduce((a, p) => a + p.progress, 0)
          const hidden = suppressed(gp.length, ctx)
          return { id: g.id, name: g.name, members: members.length, participants: gp.length, total: hidden ? null : Math.round(total), average: hidden ? null : Math.round(total / Math.max(1, gp.length)), rank: null as number | null, hidden }
        })
        .filter((r) => r.members > 0)
      rows
        .filter((r) => !r.hidden)
        .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
        .forEach((r, i) => (r.rank = i + 1))
      standings = rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    }

    const departments =
      session.role === "team_manager"
        ? []
        : ctx.db.departments
            .filter((d) => d.companyId === c.companyId)
            .map((d) => {
              const el = eligible.filter((e) => e.departmentId === d.id)
              const dp = parts.filter((p) => employeesById.get(p.employeeId)?.departmentId === d.id)
              const hidden = suppressed(el.length, ctx)
              const done = dp.filter((p) => p.completed).length
              return {
                id: d.id,
                name: d.name,
                eligible: el.length,
                participants: hidden ? 0 : dp.length,
                participationRate: hidden ? null : ratio(dp.length, el.length),
                completionRate: hidden || c.type === "collaborative" || c.type === "team" ? null : ratio(done, dp.length),
                hidden,
              }
            })
            .filter((d) => d.eligible > 0)
            .sort((a, b) => (b.participationRate ?? -1) - (a.participationRate ?? -1))

    const teamNames = session.role === "team_manager" ? ctx.db.teams.filter((x) => session.teamIds.includes(x.id)).map((x) => x.name) : []
    return {
      started,
      scopeLabel: scope ? `${teamNames.join(", ") || "Your"} team only` : "Whole company",
      unit,
      kpis: {
        participants: parts.length,
        eligible: eligible.length,
        participationRate: ratio(parts.length, eligible.length),
        completed,
        completionRate: ratio(completed, parts.length),
        avgProgress: c.type === "collaborative" ? progressOf(c, allParts) : progressOf(c, parts),
        totalMetric: Math.round(totalMetric * 100) / 100,
        sharedTotal: Math.round(sharedTotal * 100) / 100,
        avgPerParticipant: Math.round(ratio(totalMetric, parts.length) * 10) / 10,
      },
      daily,
      standings,
      departments,
      minGroupSize: settings.minAnalyticsGroupSize,
    }
  }),

  leaderboard: endpoint<{ id: string; limit?: number }, ChallengeLeaderboard, "business">("business", "GET", "/organization/challenges/:id/leaderboard", ({ id, limit = 10 }, ctx) => {
    const scope = teamScope(ctx)
    const c = findChallenge(ctx, id)
    if (!visibleTo(ctx, c, scope)) throw forbidden("This challenge isn't open to your team.")
    const settings = companySettings(ctx)
    const session = ctx.session() as BusinessSession
    const rawUnit = c.metric === "custom" ? c.customMetricLabel ?? "check-ins" : CHALLENGE_METRIC_UNIT[c.metric]
    const rule = challengeSettings(ctx, c.id).scoring
    const scored = rule.method !== "total"
    const unit = rule.method === "bands" ? "pts" : rawUnit
    const parts = participantsFor(ctx, c, scope)
    const score = new Map(parts.map((p) => [p.id, scoreOf(p, rule)]))
    const prevScore = new Map(parts.map((p) => [p.id, scoreOf({ progress: p.progress - (p.daily.at(-1) ?? 0), daily: p.daily.slice(0, -1) }, rule)]))
    const ranked = [...parts].sort((a, b) => score.get(b.id)! - score.get(a.id)!)
    const previous = [...parts].sort((a, b) => prevScore.get(b.id)! - prevScore.get(a.id)!)
    const prevRank = new Map(previous.map((p, i) => [p.id, i + 1]))
    const entries = ranked.slice(0, Math.min(50, limit)).map((p, i) => {
      const e = ctx.db.employees.find((x) => x.id === p.employeeId)
      const optedOut = settings.allowLeaderboardOptOut && !!ctx.db.private[p.employeeId]?.leaderboardOptOut
      const mode = optedOut ? "anonymous" : settings.leaderboardNameDisplay
      const dept = e ? ctx.db.departments.find((d) => d.id === e.departmentId)?.name : undefined
      return {
        rank: i + 1,
        previousRank: prevRank.get(p.id),
        id: p.id,
        name: e ? (mode === "full_name" ? `${e.firstName} ${e.lastName}` : mode === "first_name_initial" ? `${e.firstName} ${e.lastName[0]}.` : "Anonymous colleague") : "Former employee",
        subtitle: mode === "anonymous" ? undefined : dept,
        avatarColor: mode === "anonymous" ? "#94a3b8" : e?.avatarColor ?? "#94a3b8",
        value: Math.round(score.get(p.id)! * 100) / 100,
        isMe: p.employeeId === session.user.id,
        completed: p.completed,
        progress: c.type === "collaborative" || c.target <= 0 ? 0 : Math.min(1, p.progress / c.target),
      }
    })
    return { entries, total: parts.length, nameDisplay: settings.leaderboardNameDisplay, unit, scored, scoringLabel: describeScoring(rule, rawUnit) }
  }),

  templates: endpoint<void, ChallengeTemplate[], "business">("business", "GET", "/challenge-templates", (_i, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    return ctx.db.challengeTemplates.filter((t) => t.status === "published").sort((a, b) => b.usageCount - a.usageCount)
  }),

  rewardOptions: endpoint<void, RewardOption[], "business">("business", "GET", "/organization/rewards/available", (_i, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    return availableRewards(ctx)
  }),

  create: endpoint<ChallengeInput, ChallengeDetail, "business">("business", "POST", "/organization/challenges", (input, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const errors = validateInput(ctx, input)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const c: Challenge = {
      id: newId("chl"),
      companyId: ctx.companyId(),
      templateId: input.templateId,
      name: "",
      description: "",
      type: input.type,
      metric: input.metric,
      target: input.target,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "draft",
      audienceType: input.audienceType,
      audienceIds: [],
      points: 0,
      coverEmoji: "🏆",
      coverColor: "#10b981",
      rules: [],
      createdBy: session.user.name,
      createdAt: new Date().toISOString(),
      participantsCount: 0,
      eligibleCount: 0,
      completedCount: 0,
    }
    applyInput(c, input)
    applySettings(ctx, c, input)
    c.eligibleCount = audienceMembers(ctx, c, true).length
    if (input.publish) doPublish(ctx, c)
    ctx.db.challenges.unshift(c)
    if (input.templateId) {
      const t = ctx.db.challengeTemplates.find((x) => x.id === input.templateId)
      if (t) t.usageCount++
    }
    audit(ctx, { action: input.publish ? "Published challenge" : "Created challenge", entityType: "Challenge", entityName: c.name, companyId: c.companyId })
    ctx.save()
    return detailOf(ctx, c)
  }),

  update: endpoint<ChallengeInput & { id: string }, ChallengeDetail, "business">("business", "PATCH", "/organization/challenges/:id", (input, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, input.id)
    const locked = lockReasonOf(c, challengeSettings(ctx, c.id))
    if (locked) throw new ApiError(locked, 409, "challenge_locked")
    const errors = validateInput(ctx, input, c)
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    applyInput(c, input)
    applySettings(ctx, c, input)
    c.eligibleCount = audienceMembers(ctx, c, true).length
    if (input.publish && c.status === "draft") doPublish(ctx, c)
    audit(ctx, { action: input.publish ? "Published challenge" : "Updated challenge", entityType: "Challenge", entityName: c.name, companyId: c.companyId })
    ctx.save()
    return detailOf(ctx, c)
  }),

  publish: endpoint<{ id: string }, ChallengeDetail & { message: string }, "business">("business", "POST", "/organization/challenges/:id/publish", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    if (c.status !== "draft") throw badRequest("Only draft challenges can be published.")
    const errors = validateInput(ctx, { ...c, ...challengeSettings(ctx, c.id), publish: true } as ChallengeInput, c)
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    doPublish(ctx, c)
    audit(ctx, { action: "Published challenge", entityType: "Challenge", entityName: c.name, companyId: c.companyId })
    ctx.save()
    return { ...detailOf(ctx, c), message: (c.status as ChallengeStatus) === "active" ? "Challenge published – it's live now." : `Challenge published – starts ${fmtDay(c.startDate)}.` }
  }),

  cancel: endpoint<{ id: string; reason: string }, ChallengeDetail, "business">("business", "POST", "/organization/challenges/:id/cancel", ({ id, reason }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    if (c.status !== "active" && c.status !== "scheduled") throw badRequest("Only scheduled or active challenges can be cancelled.")
    if (!reason?.trim()) throw badRequest("Tell participants why the challenge is cancelled.", { reason: "Enter a reason" })
    c.status = "cancelled"
    meta(ctx)[c.id] = { ...meta(ctx)[c.id], cancelReason: reason.trim() }
    const people = new Set([...ctx.db.participants.filter((p) => p.challengeId === c.id).map((p) => p.employeeId), ...audienceMembers(ctx, c, true).map((e) => e.id)])
    notifyEmployees(ctx, people, { type: "challenge", title: `${c.name} has been cancelled`, body: reason.trim(), href: `/employee-app/challenges/${c.id}` }, "challenges")
    audit(ctx, { action: "Cancelled challenge", entityType: "Challenge", entityName: c.name, companyId: c.companyId, severity: "warning" })
    ctx.save()
    return detailOf(ctx, c)
  }),

  endEarly: endpoint<{ id: string }, ChallengeDetail, "business">("business", "POST", "/organization/challenges/:id/end", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    if (c.status !== "active") throw badRequest("Only active challenges can be ended early.")
    c.status = "completed"
    c.endDate = today() < c.startDate ? c.startDate : today()
    meta(ctx)[c.id] = { ...meta(ctx)[c.id], endedEarly: true }
    notifyEmployees(
      ctx,
      ctx.db.participants.filter((p) => p.challengeId === c.id).map((p) => p.employeeId),
      { type: "challenge", title: `${c.name} has ended ${c.coverEmoji}`, body: "The challenge was closed early. See the final leaderboard and your result.", href: `/employee-app/challenges/${c.id}` },
      "challenges",
    )
    audit(ctx, { action: "Ended challenge early", entityType: "Challenge", entityName: c.name, companyId: c.companyId, severity: "warning" })
    ctx.save()
    return detailOf(ctx, c)
  }),

  /** Phase 2. Copies settings into a new draft starting tomorrow. */
  duplicate: endpoint<{ id: string }, ChallengeDetail, "business">("business", "POST", "/organization/challenges/:id/duplicate", ({ id }, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const src = findChallenge(ctx, id)
    const duration = dayDiff(src.startDate, src.endDate)
    const start = toLocalDate(new Date(Date.now() + DAY_MS))
    const c: Challenge = {
      ...src,
      id: newId("chl"),
      name: `Copy of ${src.name}`.slice(0, 80),
      status: "draft",
      startDate: start,
      endDate: toLocalDate(new Date(new Date(`${start}T00:00:00`).getTime() + duration * DAY_MS)),
      audienceIds: [...src.audienceIds],
      rules: [...src.rules],
      createdBy: session.user.name,
      createdAt: new Date().toISOString(),
      participantsCount: 0,
      completedCount: 0,
    }
    ctx.db.challenges.unshift(c)
    settingsStore(ctx)[c.id] = { ...challengeSettings(ctx, src.id), warmupStartDate: undefined }
    audit(ctx, { action: "Duplicated challenge", entityType: "Challenge", entityName: src.name, companyId: c.companyId })
    ctx.save()
    return detailOf(ctx, c)
  }),

  remove: endpoint<{ id: string }, { ok: true }, "business">("business", "DELETE", "/organization/challenges/:id", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    if (c.status !== "draft") throw badRequest("Only draft challenges can be deleted. Cancel it instead.")
    ctx.db.challenges = ctx.db.challenges.filter((x) => x.id !== id)
    audit(ctx, { action: "Deleted draft challenge", entityType: "Challenge", entityName: c.name, companyId: c.companyId })
    ctx.save()
    return { ok: true }
  }),
}

function detailOf(ctx: BusinessCtx, c: Challenge): ChallengeDetail {
  const scope = teamScope(ctx)
  const manage = MANAGE_ROLES.includes((ctx.session() as BusinessSession).role)
  const reward = c.rewardId ? ctx.db.rewards.find((r) => r.id === c.rewardId) : undefined
  const template = c.templateId ? ctx.db.challengeTemplates.find((t) => t.id === c.templateId) : undefined
  const settings = challengeSettings(ctx, c.id)
  const lockReason = lockReasonOf(c, settings)
  return {
    ...toRow(ctx, c, scope),
    reward: reward ? { id: reward.id, name: reward.name, imageEmoji: reward.imageEmoji, imageColor: reward.imageColor, pointsCost: reward.pointsCost } : undefined,
    template: template ? { id: template.id, name: template.name } : undefined,
    audienceNames: audienceNames(ctx, c),
    settings: {
      ...settings,
      prizes: settings.prizes.map((p) => {
        const r = p.rewardId ? ctx.db.rewards.find((x) => x.id === p.rewardId) : undefined
        return { ...p, rewardName: r?.name, rewardEmoji: r?.imageEmoji, rewardColor: r?.imageColor }
      }),
    },
    lockReason,
    canEdit: manage && !lockReason,
    canPublish: manage && c.status === "draft",
    canCancel: manage && (c.status === "scheduled" || c.status === "active"),
    canEndEarly: manage && c.status === "active",
    canDelete: manage && c.status === "draft",
    cancelReason: meta(ctx)[c.id]?.cancelReason,
    scopedToTeams: !!scope,
  }
}

// ─── Audience lookups (pickers & estimates, shared by every composer) ────

export const audienceApi = {
  employees: endpoint<{ search?: string; ids?: string[]; limit?: number }, AudiencePerson[], "business">("business", "GET", "/organization/audience/employees", (q, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const ids = q.ids?.length ? new Set(q.ids) : null
    const teams = new Map(ctx.db.teams.map((t) => [t.id, t.name]))
    return companyEmployees(ctx)
      .filter((e) => (ids ? ids.has(e.id) : matchesSearch(q.search, `${e.firstName} ${e.lastName}`, e.email, e.jobTitle, teams.get(e.teamId))))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
      .slice(0, ids ? 500 : q.limit ?? 30)
      .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, subtitle: `${e.jobTitle} · ${teams.get(e.teamId) ?? ""}`, avatarColor: e.avatarColor, status: e.status }))
  }),

  estimate: endpoint<AudienceInput, AudienceEstimate, "business">("business", "GET", "/organization/audience/estimate", (a, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const input = { audienceType: a.audienceType, audienceIds: Array.isArray(a.audienceIds) ? a.audienceIds : a.audienceIds ? [a.audienceIds as unknown as string] : [] }
    const members = audienceMembers(ctx, input)
    return { total: members.length, joined: members.filter(isJoined).length, label: describeAudience(ctx, input) }
  }),
}
