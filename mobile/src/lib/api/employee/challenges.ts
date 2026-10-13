// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — challenges (SCR-M-042 … SCR-M-047).
 * Only the signed-in employee's own progress is exposed in detail; rankings follow the
 * company's leaderboard name-display setting and each person's leaderboard opt-out.
 */
import { defaultCompanySettings } from "@/lib/mock/defaults"
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { displayName, formatMl, formatNumber, fullName } from "@/lib/format"
import type { AudienceType, Challenge, ChallengeMetric, ChallengeParticipant, ChallengeStatus, ChallengeType, CompanySettings, Employee, LeaderboardEntry, LeaderboardNameDisplay } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { ApiError, badRequest, endpoint, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

// ─── Shared helpers (also used by leaderboards / gamification / team) ────

/** Leaderboard row: a person or a group, with privacy masking applied. */
export interface RankedEntry extends LeaderboardEntry {
  masked?: boolean
  group?: boolean
}

export const GRACE_DAYS = 3

export const CHALLENGE_TYPE_LABEL: Record<ChallengeType, string> = {
  individual: "Individual",
  leaderboard: "Leaderboard",
  team: "Team",
  company: "Company-wide",
  collaborative: "Collaborative",
}

export const CHALLENGE_TYPE_HELP: Record<ChallengeType, string> = {
  individual: "Reach the target on your own. Everyone who hits it earns the points.",
  leaderboard: "Compete with colleagues — the highest totals climb the leaderboard.",
  team: "Your activity counts towards your group. The group with the best average per person wins.",
  company: "Open to everyone in the company. Hit your target and help the company total grow.",
  collaborative: "Everyone works together towards one shared company goal.",
}

export function todayLocal() {
  return toLocalDate(new Date())
}

/** Whole days from a → b (YYYY-MM-DD, local). */
export function dayDiff(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY_MS)
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}

export function meEmployee(ctx: Ctx) {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return { me, emp }
}

export function companySettings(ctx: Ctx, companyId: string): CompanySettings {
  return ctx.db.settings[companyId] ?? defaultCompanySettings(companyId)
}

export function inAudience(target: { audienceType: AudienceType; audienceIds: string[] }, emp: Employee) {
  switch (target.audienceType) {
    case "all":
      return true
    case "departments":
      return target.audienceIds.includes(emp.departmentId)
    case "teams":
      return target.audienceIds.includes(emp.teamId)
    case "selected":
      return target.audienceIds.includes(emp.id)
  }
}

/** Name shown on rankings — the viewer always sees their own name. */
export function rankName(ctx: Ctx, person: Employee, viewerId: string, mode: LeaderboardNameDisplay): { name: string; masked: boolean } {
  if (person.id === viewerId) return { name: fullName(person), masked: !!ctx.db.private[person.id]?.leaderboardOptOut }
  // #158 leaderboard opt-out: the person appears as "Anonymous".
  if (ctx.db.private[person.id]?.leaderboardOptOut) return { name: "Anonymous", masked: true }
  if (mode === "anonymous") return { name: "Anonymous colleague", masked: true }
  return { name: displayName(person, mode), masked: false }
}

/** Deterministic "rank last refresh" movement so arrows look plausible. */
export function previousRankFor(key: string, rank: number, total: number) {
  const shift = Math.round((noise(key, Number(todayLocal().replace(/-/g, ""))) - 0.5) * 6)
  return Math.min(total, Math.max(1, rank + shift))
}

/** Leaderboards refresh about every 15 minutes (MVP assumption). */
export function lastRefreshIso() {
  const step = 15 * 60_000
  return new Date(Math.floor(Date.now() / step) * step).toISOString()
}

export const metricUnit = (metric: ChallengeMetric) => CHALLENGE_METRIC_UNIT[metric]

/** Human value for a challenge metric (water in litres, distance in km…). */
export function formatMetricValue(value: number, metric: ChallengeMetric, withUnit = true) {
  if (metric === "water") return withUnit ? formatMl(value) : formatNumber(value / 1000, 1)
  if (metric === "distance") return `${formatNumber(value, 1)}${withUnit ? " km" : ""}`
  return `${formatNumber(Math.round(value))}${withUnit ? ` ${CHALLENGE_METRIC_UNIT[metric]}` : ""}`
}

export function rerank(ctx: Ctx, challengeId: string) {
  ctx.db.participants
    .filter((p) => p.challengeId === challengeId)
    .sort((a, b) => b.progress - a.progress || a.joinedAt.localeCompare(b.joinedAt))
    .forEach((p, i) => (p.rank = i + 1))
}

// ─── Optional challenge settings configured in the Business Portal ──────
// (#356 join codes, #359 prizes, #350 mini-challenges, #358 warm-up, #374 walking journey)
// These are read defensively: the Business Portal may store them on the challenge or in ctx.extra.

type AnyRec = Record<string, unknown>
const isRec = (v: unknown): v is AnyRec => !!v && typeof v === "object" && !Array.isArray(v)
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : undefined)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined)
const label = (v: unknown) => str(v) ?? (isRec(v) ? str(v.label ?? v.name ?? v.title ?? v.prize ?? v.reward) : undefined)

export interface ChallengePrizes {
  /** 1st, 2nd, 3rd (empty string = not configured). */
  individual: string[]
  team: string[]
}

export function readPrizes(c: Challenge): ChallengePrizes | null {
  const raw = (c as unknown as AnyRec).prizes ?? (c as unknown as AnyRec).winnerPrizes
  const list = (v: unknown) => (Array.isArray(v) ? v.slice(0, 3).map((x) => label(x) ?? "") : isRec(v) ? ["first", "second", "third"].map((k) => label(v[k] ?? v[k === "first" ? "1" : k === "second" ? "2" : "3"]) ?? "") : [])
  const individual = Array.isArray(raw) ? list(raw) : isRec(raw) ? list(raw.individual) : []
  const team = isRec(raw) ? list(raw.team) : []
  return individual.some(Boolean) || team.some(Boolean) ? { individual, team } : null
}

export interface MiniChallengeView {
  id: string
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  bonusPoints: number
  winnerSlots: number | null
  status: "upcoming" | "live" | "ended"
  joined: boolean
  joinedCount: number
}

function rawMinis(ctx: Ctx, c: Challenge): AnyRec[] {
  const own = (c as unknown as AnyRec).miniChallenges ?? (c as unknown as AnyRec).minis
  const store = ctx.db.extra["mini-challenges"]
  const fromStore = Array.isArray(store) ? store.filter((m) => isRec(m) && m.challengeId === c.id) : isRec(store) && Array.isArray(store[c.id]) ? (store[c.id] as unknown[]) : []
  return [...(Array.isArray(own) ? own : []), ...fromStore].filter(isRec).filter((m) => m.status !== "draft" && m.status !== "cancelled")
}

function miniJoins(ctx: Ctx) {
  return ctx.extra("emp-mini-joins", () => ({}) as Record<string, string[]>)
}

export function readMinis(ctx: Ctx, c: Challenge, employeeId: string): MiniChallengeView[] {
  const today = todayLocal()
  const joins = ctx.db.extra["emp-mini-joins"] as Record<string, string[]> | undefined
  return rawMinis(ctx, c).map((m, i) => {
    const id = str(m.id) ?? `${c.id}-mini-${i + 1}`
    const start = str(m.startDate) ?? null
    const end = str(m.endDate) ?? null
    const joinedBy = Object.values(joins ?? {}).filter((ids) => ids.includes(id)).length
    return {
      id,
      title: str(m.title ?? m.name) ?? "Mini-challenge",
      description: str(m.description) ?? null,
      startDate: start,
      endDate: end,
      bonusPoints: num(m.bonusPoints ?? m.points ?? m.bonus) ?? 0,
      winnerSlots: num(m.winnerSlots ?? m.slots ?? m.winners) ?? null,
      status: start && today < start ? "upcoming" : end && today > end ? "ended" : "live",
      joined: !!joins?.[employeeId]?.includes(id),
      joinedCount: (num(m.participantsCount ?? m.joinedCount) ?? 0) + joinedBy,
    }
  })
}

export interface WarmUp {
  days: number
  warmUpStart: string
  scoringStart: string
}

export function readWarmUp(c: Challenge): WarmUp | null {
  const r = c as unknown as AnyRec
  const w = isRec(r.warmUp) ? r.warmUp : isRec(r.warmup) ? r.warmup : {}
  const days = num(r.warmUpDays ?? r.warmupDays ?? w.days)
  const scoringStart = str(r.scoringStartDate ?? r.scoringStartsOn ?? w.scoringStartDate ?? w.endDate) ?? c.startDate
  const explicitStart = str(r.warmUpStartDate ?? w.startDate)
  if (!days && !explicitStart) return null
  const warmUpStart = explicitStart ?? addDays(scoringStart, -(days ?? 0))
  return { days: days ?? Math.max(1, dayDiff(warmUpStart, scoringStart)), warmUpStart, scoringStart }
}

export interface JourneyView {
  name: string
  totalKm: number
  doneKm: number
  pct: number
  milestones: { name: string; km: number; reached: boolean; reward: string | null }[]
  next: { name: string; kmToGo: number } | null
}

const KM_PER_STEP = 0.00076

export function readJourney(c: Challenge, progress: number): JourneyView | null {
  const r = c as unknown as AnyRec
  const j = isRec(r.journey) ? r.journey : isRec(r.walkingJourney) ? r.walkingJourney : isRec(r.route) ? r.route : null
  if (!j) return null
  const rawMilestones = Array.isArray(j.milestones) ? j.milestones : Array.isArray(j.stops) ? j.stops : []
  const milestones = rawMilestones
    .filter(isRec)
    .map((m) => {
      const pts = num(m.points ?? m.bonusPoints)
      return { name: str(m.name ?? m.title ?? m.label) ?? "Milestone", km: num(m.km ?? m.distanceKm ?? m.atKm) ?? 0, reward: str(m.reward ?? m.rewardLabel) ?? (pts ? `+${pts} pts` : null) }
    })
    .sort((a, b) => a.km - b.km)
  const totalKm = num(j.totalKm ?? j.distanceKm ?? j.lengthKm) ?? milestones[milestones.length - 1]?.km ?? 0
  if (!totalKm) return null
  const doneKm = Math.min(totalKm, c.metric === "distance" ? progress : c.metric === "steps" ? progress * KM_PER_STEP : c.target ? (progress / c.target) * totalKm : 0)
  const withState = milestones.map((m) => ({ ...m, reached: doneKm >= m.km }))
  const next = withState.find((m) => !m.reached)
  return {
    name: str(j.name ?? j.title) ?? "Walking journey",
    totalKm,
    doneKm: Math.round(doneKm * 10) / 10,
    pct: Math.min(1, doneKm / totalKm),
    milestones: withState,
    next: next ? { name: next.name, kmToGo: Math.round((next.km - doneKm) * 10) / 10 } : null,
  }
}

/** Short join code (#356): the Business Portal's code if it created one, else a stable derived code. */
export function joinCodeFor(ctx: Ctx, challengeId: string) {
  const store = ctx.db.extra["challenge-join-codes"]
  const entry = isRec(store) ? store[challengeId] : undefined
  const stored = typeof entry === "string" ? entry : isRec(entry) ? str(entry.code ?? entry.shortCode) : undefined
  return (stored ?? (noise(`join:${challengeId}`, 1).toString(36).slice(2, 5) + noise(`join:${challengeId}`, 2).toString(36).slice(2, 5)).padEnd(6, "7")).toUpperCase()
}

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "")

// ─── #348 Rank-change alerts ────────────────────────────────────────────

/**
 * Compares the viewer's rank with the last one we told them about and adds a notification when it
 * changed (moved up, dropped out of the top 3, slipped). Respects the "Rank-change alerts" preference.
 * In production this runs server-side when leaderboards refresh.
 */
export function rankAlert(ctx: Ctx, key: string, scopeLabel: string, rank: number, href: string, fallbackPrevious?: number): string | null {
  const { me, emp } = meEmployee(ctx)
  const store = ctx.extra("emp-rank-snapshots", () => ({}) as Record<string, number>)
  const k = `${emp.id}|${key}`
  const prev = store[k] ?? fallbackPrevious
  store[k] = rank
  const prefs = (ctx.db.extra["emp-notification-extra"] as Record<string, { rankChangeAlerts?: boolean }> | undefined)?.[emp.id]
  if (prev === undefined || prev === rank || prefs?.rankChangeAlerts === false || me.leaderboardOptOut) {
    ctx.save()
    return null
  }
  const up = rank < prev
  const title = up ? `You moved up to #${rank} 🎉` : prev <= 3 && rank > 3 ? "You've dropped out of the top 3" : `You slipped to #${rank}`
  const body = up ? `${scopeLabel} — up ${prev - rank} place${prev - rank === 1 ? "" : "s"}. Keep it going!` : `${scopeLabel} — you're now #${rank}. A short walk could win it back.`
  me.notifications.unshift({ id: newId("ntf"), type: "challenge", title, body, createdAt: new Date().toISOString(), read: false, href })
  ctx.save()
  return title
}

// ─── Types ──────────────────────────────────────────────────────────────

export type ChallengeTab = "available" | "active" | "completed"
export type ChallengePhase = "upcoming" | "warmup" | "live" | "finalising" | "ended"

/** Joining (and leaving) is possible before the start, during warm-up and while live. */
export const isOpenPhase = (p: ChallengePhase) => p === "upcoming" || p === "warmup" || p === "live"

export interface ChallengeSummary {
  id: string
  name: string
  description: string
  type: ChallengeType
  typeLabel: string
  metric: ChallengeMetric
  customMetricLabel?: string
  unit: string
  target: number
  teamUnit?: "department" | "team"
  startDate: string
  endDate: string
  status: ChallengeStatus
  phase: ChallengePhase
  coverEmoji: string
  coverColor: string
  points: number
  reward: { id: string; name: string; emoji: string; color: string } | null
  participantsCount: number
  eligibleCount: number
  joined: boolean
  myProgress: number | null
  myRank: number | null
  targetReached: boolean
  daysLeft: number
  daysToStart: number
  totalDays: number
  audienceLabel: string
  /** #358 warm-up before scoring starts (null = none configured). */
  warmUp: WarmUp | null
  /** Days until scoring starts (after warm-up). */
  daysToScoring: number
  hasPrizes: boolean
}

export interface ChallengeDetail extends ChallengeSummary {
  rules: string[]
  typeHelp: string
  createdBy: string
  eligible: boolean
  canJoin: boolean
  joinBlockedReason: string | null
  canLeave: boolean
  joinedAt: string | null
  graceDays: number
  finalisingUntil: string | null
  rewardDetail: { id: string; name: string; emoji: string; color: string; description: string; delivery: string } | null
  faces: { name: string; color: string; masked: boolean }[]
  prizes: ChallengePrizes | null
  minis: MiniChallengeView[]
  journey: JourneyView | null
  joinCode: string
  trackerConnected: boolean
}

export interface ChallengeProgress {
  challenge: ChallengeSummary
  joined: boolean
  progress: number
  target: number
  pct: number
  rank: number | null
  participants: number
  daily: { date: string; value: number }[]
  lastSyncedAt: string | null
  targetReached: boolean
  canSync: boolean
  team: { unit: "department" | "team"; rows: { id: string; name: string; average: number; total: number; members: number; isMine: boolean }[] } | null
  company: { total: number; goal: number; pct: number; myContribution: number; contributionPct: number; contributors: number } | null
  checkIn: { label: string; todayDone: boolean; total: number; canCheckIn: boolean; reason: string | null } | null
  journey: JourneyView | null
  minis: MiniChallengeView[]
}

export interface CheckInState {
  challengeId: string
  name: string
  label: string
  coverEmoji: string
  coverColor: string
  target: number
  total: number
  today: string
  todayDone: boolean
  open: boolean
  closedReason: string | null
  startDate: string
  endDate: string
  /** Every day from the start until today (or the end), newest first. */
  history: { date: string; done: boolean; canUndo: boolean }[]
}

export interface ChallengeLeaderboard {
  challenge: { id: string; name: string; type: ChallengeType; metric: ChallengeMetric; unit: string; coverEmoji: string; coverColor: string; phase: ChallengePhase; teamUnit?: "department" | "team" }
  view: "individual" | "groups"
  hasGroups: boolean
  entries: RankedEntry[]
  me: RankedEntry | null
  total: number
  updatedAt: string
  nameDisplay: LeaderboardNameDisplay
  /** #348 — set when the viewer's rank changed since they last looked. */
  rankAlert: string | null
}

export interface ChallengeResults {
  challenge: ChallengeSummary
  finalising: boolean
  finalisingUntil: string | null
  joined: boolean
  outcome: "completed" | "not_completed" | "won" | "ranked" | "not_joined"
  headline: string
  finalRank: number | null
  participants: number
  finalTotal: number
  pointsEarned: number
  reward: { id: string; name: string; emoji: string; color: string; earned: boolean } | null
  podium: RankedEntry[]
  group: { name: string; rank: number; total: number } | null
  collaborative: { total: number; goal: number; reached: boolean } | null
  suggestions: ChallengeSummary[]
  prizes: ChallengePrizes | null
  /** #355 — completion certificate (only when the employee completed / won). */
  certificate: { employeeName: string; companyName: string; challengeName: string; completedOn: string; achievement: string; certificateNo: string } | null
}

// ─── Internals ──────────────────────────────────────────────────────────

function visibleChallenges(ctx: Ctx, emp: Employee) {
  return ctx.db.challenges.filter((c) => (c.companyId === emp.companyId || c.companyId === null) && c.status !== "draft" && c.status !== "cancelled")
}

function phaseOf(c: Challenge, today: string): ChallengePhase {
  const w = readWarmUp(c)
  if (w && c.status !== "completed" && c.status !== "cancelled" && today >= w.warmUpStart && today < w.scoringStart) return "warmup"
  if (c.status === "scheduled" || c.startDate > today) return "upcoming"
  if (c.status === "active" && today <= c.endDate) return "live"
  return dayDiff(c.endDate, today) <= GRACE_DAYS ? "finalising" : "ended"
}

function audienceLabel(ctx: Ctx, c: Challenge, companyName: string) {
  if (c.audienceType === "all") return `Everyone at ${companyName}`
  if (c.audienceType === "departments") return ctx.db.departments.filter((d) => c.audienceIds.includes(d.id)).map((d) => d.name).join(", ")
  if (c.audienceType === "teams") return `Teams: ${ctx.db.teams.filter((t) => c.audienceIds.includes(t.id)).map((t) => t.name).join(", ")}`
  return "Selected employees"
}

function participantOf(ctx: Ctx, challengeId: string, employeeId: string) {
  return ctx.db.participants.find((p) => p.challengeId === challengeId && p.employeeId === employeeId)
}

function isTargetReached(c: Challenge, p: ChallengeParticipant | undefined) {
  return !!p && c.type !== "collaborative" && p.progress >= c.target
}

function summarize(ctx: Ctx, c: Challenge, emp: Employee): ChallengeSummary {
  const today = todayLocal()
  const p = participantOf(ctx, c.id, emp.id)
  const reward = c.rewardId ? ctx.db.rewards.find((r) => r.id === c.rewardId) : undefined
  const company = ctx.db.companies.find((x) => x.id === emp.companyId)
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    type: c.type,
    typeLabel: CHALLENGE_TYPE_LABEL[c.type],
    metric: c.metric,
    customMetricLabel: c.customMetricLabel,
    unit: c.metric === "custom" ? (c.customMetricLabel ?? "check-ins").toLowerCase() : metricUnit(c.metric),
    target: c.target,
    teamUnit: c.teamUnit,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    phase: phaseOf(c, today),
    coverEmoji: c.coverEmoji,
    coverColor: c.coverColor,
    points: c.points,
    reward: reward ? { id: reward.id, name: reward.name, emoji: reward.imageEmoji, color: reward.imageColor } : null,
    participantsCount: c.participantsCount,
    eligibleCount: c.eligibleCount,
    joined: !!p,
    myProgress: p ? p.progress : null,
    myRank: p ? p.rank : null,
    targetReached: isTargetReached(c, p),
    daysLeft: Math.max(0, dayDiff(today, c.endDate)),
    daysToStart: Math.max(0, dayDiff(today, c.startDate)),
    totalDays: dayDiff(c.startDate, c.endDate) + 1,
    audienceLabel: audienceLabel(ctx, c, company?.name ?? "your company"),
    warmUp: readWarmUp(c),
    daysToScoring: Math.max(0, dayDiff(today, readWarmUp(c)?.scoringStart ?? c.startDate)),
    hasPrizes: !!readPrizes(c),
  }
}

function tabOf(s: ChallengeSummary, eligible: boolean): ChallengeTab | null {
  if (s.joined) return isOpenPhase(s.phase) ? "active" : "completed"
  if (eligible && isOpenPhase(s.phase)) return "available"
  return null
}

function getChallenge(ctx: Ctx, id: string, emp: Employee) {
  const c = visibleChallenges(ctx, emp).find((x) => x.id === id)
  if (!c) throw new ApiError("This challenge is no longer available.", 404, "not_found")
  return c
}

/** Value of a metric on one day from the employee's own synced/logged data. */
function myDailyValue(ctx: Ctx, metric: ChallengeMetric, date: string) {
  const me = ctx.me()
  const day = me.daily.find((d) => d.date === date)
  switch (metric) {
    case "steps":
      return day?.steps ?? 0
    case "distance":
      return day?.distanceKm ?? 0
    case "calories":
      return day?.activeCalories ?? 0
    case "active_minutes":
      return day?.activeMinutes ?? 0
    case "water":
      return date === todayLocal()
        ? me.water.filter((w) => toLocalDate(new Date(w.at)) === date).reduce((a, w) => a + w.amountMl, 0)
        : (me.waterDaily.find((w) => w.date === date)?.totalMl ?? 0)
    case "workouts":
      return me.workoutSessions.filter((w) => w.completed && toLocalDate(new Date(w.completedAt ?? w.startedAt)) === date).length
    case "meditation":
      return me.sessions.filter((s) => s.type === "meditation" && toLocalDate(new Date(s.startedAt)) === date).reduce((a, s) => a + s.durationMin, 0)
    case "custom":
      return 0
  }
}

function checkInDates(ctx: Ctx, c: Challenge, p: ChallengeParticipant | undefined) {
  const set = new Set(ctx.me().customChallengeCheckIns[c.id] ?? [])
  // Seeded check-ins live in the participant's daily array (index 0 = start date).
  p?.daily.forEach((v, i) => {
    if (v > 0) set.add(addDays(c.startDate, i))
  })
  return set
}

function syncStore(ctx: Ctx) {
  return ctx.extra("emp-challenge-sync", () => ({}) as Record<string, string>)
}

// ─── API ────────────────────────────────────────────────────────────────

export const challengesApi = {
  /** SCR-M-042 — grouped by Available / Active / Completed. */
  list: endpoint<{ status: ChallengeTab; type?: ChallengeType | "all" }, { items: ChallengeSummary[]; counts: Record<ChallengeTab, number> }, "employee">(
    "employee",
    "GET",
    "/challenges",
    ({ status, type }, ctx) => {
      const { emp } = meEmployee(ctx)
      const counts: Record<ChallengeTab, number> = { available: 0, active: 0, completed: 0 }
      const items: ChallengeSummary[] = []
      for (const c of visibleChallenges(ctx, emp)) {
        const s = summarize(ctx, c, emp)
        const tab = tabOf(s, inAudience(c, emp))
        if (!tab) continue
        counts[tab]++
        if (tab === status && (!type || type === "all" || c.type === type)) items.push(s)
      }
      items.sort((a, b) =>
        status === "completed" ? b.endDate.localeCompare(a.endDate) : status === "active" ? a.endDate.localeCompare(b.endDate) : a.startDate.localeCompare(b.startDate),
      )
      return { items, counts }
    },
  ),

  /** SCR-M-043 */
  detail: endpoint<{ id: string }, ChallengeDetail, "employee">("employee", "GET", "/challenges/:id", ({ id }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const s = summarize(ctx, c, emp)
    const eligible = inAudience(c, emp)
    const p = participantOf(ctx, c.id, emp.id)
    const settings = companySettings(ctx, emp.companyId)
    const open = isOpenPhase(s.phase)
    const reward = c.rewardId ? ctx.db.rewards.find((r) => r.id === c.rewardId) : undefined
    const faces = ctx.db.participants
      .filter((x) => x.challengeId === c.id && x.employeeId !== emp.id)
      .slice(0, 5)
      .map((x) => {
        const person = ctx.db.employees.find((e) => e.id === x.employeeId)
        if (!person) return null
        const n = rankName(ctx, person, emp.id, settings.leaderboardNameDisplay)
        return { name: n.name, color: n.masked ? "#94a3b8" : person.avatarColor, masked: n.masked }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
    return {
      ...s,
      rules: c.rules,
      typeHelp: CHALLENGE_TYPE_HELP[c.type],
      createdBy: c.createdBy,
      eligible,
      canJoin: !p && eligible && open,
      joinBlockedReason: p ? null : !eligible ? "You're not eligible for this challenge." : !open ? "This challenge is no longer open to join." : null,
      canLeave: !!p && open,
      joinedAt: p?.joinedAt ?? null,
      graceDays: GRACE_DAYS,
      finalisingUntil: s.phase === "finalising" ? addDays(c.endDate, GRACE_DAYS) : null,
      rewardDetail: reward ? { id: reward.id, name: reward.name, emoji: reward.imageEmoji, color: reward.imageColor, description: reward.description, delivery: reward.delivery } : null,
      faces,
      prizes: readPrizes(c),
      minis: readMinis(ctx, c, emp.id),
      journey: readJourney(c, p?.progress ?? 0),
      joinCode: joinCodeFor(ctx, c.id),
      trackerConnected: ctx.me().healthConnections.some((h) => h.status === "connected"),
    }
  }),

  /** SCR-M-043 — join (challenge_joined). Progress starts counting now. */
  join: endpoint<{ id: string }, { challengeId: string; rank: number; participantsCount: number }, "employee">("employee", "POST", "/challenges/:id/join", ({ id }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    if (!inAudience(c, emp)) throw new ApiError("You're not eligible for this challenge.", 403, "not_eligible")
    const phase = phaseOf(c, todayLocal())
    if (!isOpenPhase(phase)) throw badRequest("This challenge is no longer open to join.")
    if (participantOf(ctx, c.id, emp.id)) throw badRequest("You've already joined this challenge.")
    const row: ChallengeParticipant = { id: newId("cpt"), challengeId: c.id, employeeId: emp.id, joinedAt: new Date().toISOString(), progress: 0, completed: false, rank: 0, daily: [] }
    ctx.db.participants.push(row)
    c.participantsCount = ctx.db.participants.filter((p) => p.challengeId === c.id).length
    rerank(ctx, c.id)
    // Start tracking rank changes from the joining position (no alert for joining itself).
    rankAlert(ctx, `chl:${c.id}`, c.name, row.rank, `/employee-app/challenges/${c.id}/leaderboard`, row.rank)
    ctx.save()
    return { challengeId: c.id, rank: row.rank, participantsCount: c.participantsCount }
  }),

  /** SCR-M-043 — leave (with confirmation in the UI). */
  leave: endpoint<{ id: string }, { ok: true }, "employee">("employee", "POST", "/challenges/:id/leave", ({ id }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const p = participantOf(ctx, c.id, emp.id)
    if (!p) throw badRequest("You haven't joined this challenge.")
    const phase = phaseOf(c, todayLocal())
    if (!isOpenPhase(phase)) throw badRequest("This challenge has ended — you can't leave it now.")
    ctx.db.participants = ctx.db.participants.filter((x) => x !== p)
    c.participantsCount = ctx.db.participants.filter((x) => x.challengeId === c.id).length
    delete me.customChallengeCheckIns[c.id]
    rerank(ctx, c.id)
    ctx.save()
    return { ok: true }
  }),

  /** SCR-M-044 */
  progress: endpoint<{ id: string }, ChallengeProgress, "employee">("employee", "GET", "/challenges/:id/progress", ({ id }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const s = summarize(ctx, c, emp)
    const p = participantOf(ctx, c.id, emp.id)
    const all = ctx.db.participants.filter((x) => x.challengeId === c.id)
    const today = todayLocal()

    const daily = (p?.daily ?? []).map((value, i) => ({ date: addDays(c.startDate, i), value })).filter((d) => d.date <= today)

    let team: ChallengeProgress["team"] = null
    if (c.type === "team") {
      const unit = c.teamUnit ?? "department"
      const groups = new Map<string, { total: number; members: number }>()
      for (const x of all) {
        const person = ctx.db.employees.find((e) => e.id === x.employeeId)
        if (!person) continue
        const gid = unit === "team" ? person.teamId : person.departmentId
        const g = groups.get(gid) ?? { total: 0, members: 0 }
        g.total += x.progress
        g.members++
        groups.set(gid, g)
      }
      const myGroup = unit === "team" ? emp.teamId : emp.departmentId
      team = {
        unit,
        rows: [...groups.entries()]
          .map(([gid, g]) => ({
            id: gid,
            name: (unit === "team" ? ctx.db.teams.find((t) => t.id === gid)?.name : ctx.db.departments.find((d) => d.id === gid)?.name) ?? "Group",
            average: Math.round(g.total / g.members),
            total: g.total,
            members: g.members,
            isMine: gid === myGroup,
          }))
          .sort((a, b) => b.average - a.average),
      }
    }

    let company: ChallengeProgress["company"] = null
    if (c.type === "collaborative" || c.type === "company") {
      const total = all.reduce((a, x) => a + x.progress, 0)
      const goal = c.type === "collaborative" ? c.target : c.target * Math.max(1, all.length)
      const mine = p?.progress ?? 0
      company = { total, goal, pct: goal ? Math.min(1, total / goal) : 0, myContribution: mine, contributionPct: total ? mine / total : 0, contributors: all.length }
    }

    let checkIn: ChallengeProgress["checkIn"] = null
    if (c.metric === "custom") {
      const dates = checkInDates(ctx, c, p)
      const open = s.phase === "live"
      checkIn = {
        label: c.customMetricLabel ?? "Check-ins",
        todayDone: dates.has(today),
        total: dates.size,
        canCheckIn: !!p && open && !dates.has(today),
        reason: !p ? "Join the challenge to check in." : s.phase === "upcoming" || s.phase === "warmup" ? `Check-ins open when scoring starts.` : !open ? "This challenge has ended." : null,
      }
    }

    const fallbackSync = me.healthConnections.find((h) => h.status === "connected")?.lastSyncAt ?? null
    const progress = p?.progress ?? 0
    return {
      challenge: s,
      joined: !!p,
      progress,
      target: c.target,
      pct: c.target ? Math.min(1, progress / c.target) : 0,
      rank: p?.rank ?? null,
      participants: all.length,
      daily,
      lastSyncedAt: c.metric === "custom" ? null : (syncStore(ctx)[`${emp.id}:${c.id}`] ?? fallbackSync),
      targetReached: isTargetReached(c, p),
      canSync: !!p && c.metric !== "custom" && (s.phase === "live" || s.phase === "finalising"),
      team,
      company,
      checkIn,
      journey: readJourney(c, progress),
      minis: readMinis(ctx, c, emp.id),
    }
  }),

  /** SCR-M-044 "Sync now" — recalculates my progress from my own synced / logged data since I joined. */
  sync: endpoint<{ id: string }, { progress: number; rank: number; targetReached: boolean; syncedAt: string }, "employee">("employee", "POST", "/challenges/:id/sync", ({ id }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const p = participantOf(ctx, c.id, emp.id)
    if (!p) throw badRequest("Join the challenge to track progress.")
    if (c.metric === "custom") throw badRequest("Custom challenges are tracked with daily check-ins.")
    const today = todayLocal()
    const joinDay = toLocalDate(new Date(p.joinedAt))
    // Scoring starts after any warm-up period (#358) and only counts days after joining.
    const scoringStart = readWarmUp(c)?.scoringStart ?? c.startDate
    const from = [joinDay, c.startDate, scoringStart].sort().at(-1)!
    const to = today < c.endDate ? today : c.endDate
    const days = Math.max(0, dayDiff(c.startDate, to) + 1)
    const daily: number[] = []
    for (let i = 0; i < days; i++) {
      const date = addDays(c.startDate, i)
      daily.push(date < from ? 0 : Math.round(myDailyValue(ctx, c.metric, date) * (c.metric === "distance" ? 100 : 1)) / (c.metric === "distance" ? 100 : 1))
    }
    p.daily = daily
    p.progress = Math.round(daily.reduce((a, v) => a + v, 0) * 100) / 100
    const reached = isTargetReached(c, p)
    if (reached && !p.completed && c.type !== "team") {
      p.completed = true
      p.completedAt = new Date().toISOString()
      c.completedCount = ctx.db.participants.filter((x) => x.challengeId === c.id && x.completed).length
    }
    const before = p.rank
    rerank(ctx, c.id)
    rankAlert(ctx, `chl:${c.id}`, c.name, p.rank, `/employee-app/challenges/${c.id}/leaderboard`, before)
    const syncedAt = new Date().toISOString()
    syncStore(ctx)[`${emp.id}:${c.id}`] = syncedAt
    me.healthConnections.forEach((h) => {
      if (h.status === "connected") h.lastSyncAt = syncedAt
    })
    ctx.save()
    return { progress: p.progress, rank: p.rank, targetReached: reached, syncedAt }
  }),

  /** SCR-M-046 — check-in state and history. */
  checkIns: endpoint<{ id: string }, CheckInState, "employee">("employee", "GET", "/challenges/:id/check-ins", ({ id }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    if (c.metric !== "custom") throw badRequest("This challenge is tracked automatically — no check-ins needed.")
    const p = participantOf(ctx, c.id, emp.id)
    const today = todayLocal()
    const phase = phaseOf(c, today)
    const dates = checkInDates(ctx, c, p)
    const own = new Set(ctx.me().customChallengeCheckIns[c.id] ?? [])
    const last = today < c.endDate ? today : c.endDate
    const history: CheckInState["history"] = []
    if (c.startDate <= last) {
      for (let d = last; d >= c.startDate; d = addDays(d, -1)) history.push({ date: d, done: dates.has(d), canUndo: d === today && own.has(d) && phase === "live" })
    }
    return {
      challengeId: c.id,
      name: c.name,
      label: c.customMetricLabel ?? "Check-ins",
      coverEmoji: c.coverEmoji,
      coverColor: c.coverColor,
      target: c.target,
      total: dates.size,
      today,
      todayDone: dates.has(today),
      open: !!p && phase === "live",
      closedReason: !p ? "Join this challenge to start checking in." : phase === "upcoming" || phase === "warmup" ? "Check-ins open when scoring starts." : phase !== "live" ? "This challenge has ended — check-ins are closed." : null,
      startDate: c.startDate,
      endDate: c.endDate,
      history,
    }
  }),

  /** SCR-M-046 — one self-reported check-in per day, within the challenge dates, not in the future (FRM-20). */
  checkIn: endpoint<{ id: string; date?: string }, { total: number; date: string }, "employee">("employee", "POST", "/challenges/:id/check-ins", ({ id, date }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    if (c.metric !== "custom") throw badRequest("This challenge doesn't use check-ins.")
    const p = participantOf(ctx, c.id, emp.id)
    if (!p) throw badRequest("Join the challenge to check in.")
    const today = todayLocal()
    if (phaseOf(c, today) !== "live") throw badRequest("Check-ins are closed for this challenge.")
    const day = date ?? today
    if (day > today) throw badRequest("You can't check in for a future date.", { date: "Not in the future" })
    if (day < c.startDate || day > c.endDate) throw badRequest("Pick a date within the challenge dates.", { date: "Outside the challenge dates" })
    const dates = checkInDates(ctx, c, p)
    if (dates.has(day)) throw badRequest(day === today ? "You've already checked in today." : "You've already checked in for that day.")
    me.customChallengeCheckIns[c.id] = [...(me.customChallengeCheckIns[c.id] ?? []), day]
    const idx = dayDiff(c.startDate, day)
    while (p.daily.length <= idx) p.daily.push(0)
    p.daily[idx] = 1
    p.progress = p.daily.reduce((a, v) => a + v, 0)
    if (p.progress >= c.target && !p.completed) {
      p.completed = true
      p.completedAt = new Date().toISOString()
      c.completedCount = ctx.db.participants.filter((x) => x.challengeId === c.id && x.completed).length
    }
    const before = p.rank
    rerank(ctx, c.id)
    rankAlert(ctx, `chl:${c.id}`, c.name, p.rank, `/employee-app/challenges/${c.id}/leaderboard`, before)
    ctx.save()
    return { total: p.progress, date: day }
  }),

  /** SCR-M-046 — undo today's check-in (same day only). */
  undoCheckIn: endpoint<{ id: string; date: string }, { total: number }, "employee">("employee", "DELETE", "/challenges/:id/check-ins/:date", ({ id, date }, ctx) => {
    const { me, emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const p = participantOf(ctx, c.id, emp.id)
    if (!p) throw badRequest("Join the challenge to check in.")
    if (date !== todayLocal()) throw badRequest("You can only undo today's check-in.")
    const own = me.customChallengeCheckIns[c.id] ?? []
    if (!own.includes(date)) throw badRequest("There's no check-in to undo for today.")
    me.customChallengeCheckIns[c.id] = own.filter((d) => d !== date)
    const idx = dayDiff(c.startDate, date)
    if (idx >= 0 && idx < p.daily.length) p.daily[idx] = 0
    p.progress = p.daily.reduce((a, v) => a + v, 0)
    if (p.progress < c.target) {
      p.completed = false
      p.completedAt = undefined
    }
    rerank(ctx, c.id)
    ctx.save()
    return { total: p.progress }
  }),

  /** SCR-M-045 — challenge-only ranking (people, or groups for team challenges). */
  leaderboard: endpoint<{ id: string; view?: "individual" | "groups" }, ChallengeLeaderboard, "employee">("employee", "GET", "/challenges/:id/leaderboard", ({ id, view }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const s = summarize(ctx, c, emp)
    const settings = companySettings(ctx, emp.companyId)
    const rows = ctx.db.participants.filter((p) => p.challengeId === c.id).sort((a, b) => a.rank - b.rank || b.progress - a.progress)
    const hasGroups = c.type === "team"
    const mode = hasGroups && view !== "individual" ? "groups" : "individual"
    const base = { id: c.id, name: c.name, type: c.type, metric: c.metric, unit: s.unit, coverEmoji: c.coverEmoji, coverColor: c.coverColor, phase: s.phase, teamUnit: c.teamUnit }

    if (mode === "groups") {
      const unit = c.teamUnit ?? "department"
      const groups = new Map<string, { total: number; members: number }>()
      for (const r of rows) {
        const person = ctx.db.employees.find((e) => e.id === r.employeeId)
        if (!person) continue
        const gid = unit === "team" ? person.teamId : person.departmentId
        const g = groups.get(gid) ?? { total: 0, members: 0 }
        g.total += r.progress
        g.members++
        groups.set(gid, g)
      }
      const myGroup = unit === "team" ? emp.teamId : emp.departmentId
      const entries: RankedEntry[] = [...groups.entries()]
        .map(([gid, g]) => ({ gid, avg: Math.round(g.total / g.members), members: g.members }))
        .sort((a, b) => b.avg - a.avg)
        .map((g, i, arr) => ({
          rank: i + 1,
          previousRank: previousRankFor(`${c.id}:${g.gid}`, i + 1, arr.length),
          id: g.gid,
          name: (unit === "team" ? ctx.db.teams.find((t) => t.id === g.gid)?.name : ctx.db.departments.find((d) => d.id === g.gid)?.name) ?? "Group",
          subtitle: `${formatNumber(g.members)} participants · average per person`,
          avatarColor: ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"][i % 7]!,
          value: g.avg,
          memberCount: g.members,
          isMe: g.gid === myGroup,
          group: true,
        }))
      return { challenge: base, view: "groups", hasGroups, entries, me: entries.find((e) => e.isMe) ?? null, total: entries.length, updatedAt: lastRefreshIso(), nameDisplay: settings.leaderboardNameDisplay, rankAlert: null }
    }

    const entries: RankedEntry[] = []
    for (const r of rows) {
      const person = ctx.db.employees.find((e) => e.id === r.employeeId)
      if (!person) continue
      const n = rankName(ctx, person, emp.id, settings.leaderboardNameDisplay)
      const dept = ctx.db.departments.find((d) => d.id === person.departmentId)
      entries.push({
        rank: r.rank,
        previousRank: previousRankFor(`${c.id}:${person.id}`, r.rank, rows.length),
        id: person.id,
        name: n.name,
        subtitle: n.masked && person.id !== emp.id ? undefined : dept?.name,
        avatarColor: person.avatarColor,
        value: r.progress,
        isMe: person.id === emp.id,
        masked: n.masked,
      })
    }
    const meEntry = entries.find((e) => e.isMe) ?? null
    const alert = meEntry && isOpenPhase(s.phase) ? rankAlert(ctx, `chl:${c.id}`, c.name, meEntry.rank, `/employee-app/challenges/${c.id}/leaderboard`, meEntry.previousRank) : null
    return { challenge: base, view: "individual", hasGroups, entries: entries.slice(0, 100), me: meEntry, total: entries.length, updatedAt: lastRefreshIso(), nameDisplay: settings.leaderboardNameDisplay, rankAlert: alert }
  }),

  /** SCR-M-047 — final outcome. */
  results: endpoint<{ id: string }, ChallengeResults, "employee">("employee", "GET", "/challenges/:id/results", ({ id }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    const s = summarize(ctx, c, emp)
    if (isOpenPhase(s.phase)) throw new ApiError("Results are available once the challenge ends.", 409, "not_finished")
    const settings = companySettings(ctx, emp.companyId)
    const rows = ctx.db.participants.filter((p) => p.challengeId === c.id).sort((a, b) => a.rank - b.rank)
    const p = rows.find((r) => r.employeeId === emp.id)
    const podium: RankedEntry[] = rows.slice(0, 3).flatMap((r) => {
      const person = ctx.db.employees.find((e) => e.id === r.employeeId)
      if (!person) return []
      const n = rankName(ctx, person, emp.id, settings.leaderboardNameDisplay)
      return [{ rank: r.rank, id: person.id, name: n.name, avatarColor: person.avatarColor, value: r.progress, isMe: person.id === emp.id, masked: n.masked }]
    })
    const reward = c.rewardId ? ctx.db.rewards.find((r) => r.id === c.rewardId) : undefined

    let outcome: ChallengeResults["outcome"] = "not_joined"
    let group: ChallengeResults["group"] = null
    let collaborative: ChallengeResults["collaborative"] = null
    let earned = false
    if (p) {
      if (c.type === "team") {
        const unit = c.teamUnit ?? "department"
        const groups = new Map<string, { total: number; n: number }>()
        rows.forEach((r) => {
          const person = ctx.db.employees.find((e) => e.id === r.employeeId)
          if (!person) return
          const gid = unit === "team" ? person.teamId : person.departmentId
          const g = groups.get(gid) ?? { total: 0, n: 0 }
          g.total += r.progress
          g.n++
          groups.set(gid, g)
        })
        const ranked = [...groups.entries()].sort((a, b) => b[1].total / b[1].n - a[1].total / a[1].n)
        const myGid = unit === "team" ? emp.teamId : emp.departmentId
        const idx = ranked.findIndex(([gid]) => gid === myGid)
        const name = (unit === "team" ? ctx.db.teams.find((t) => t.id === myGid)?.name : ctx.db.departments.find((d) => d.id === myGid)?.name) ?? "Your group"
        group = { name, rank: idx + 1, total: ranked.length }
        earned = idx === 0
        outcome = earned ? "won" : "ranked"
      } else if (c.type === "collaborative") {
        const total = rows.reduce((a, r) => a + r.progress, 0)
        collaborative = { total, goal: c.target, reached: total >= c.target }
        earned = collaborative.reached
        outcome = earned ? "completed" : "not_completed"
      } else if (c.type === "leaderboard") {
        earned = p.rank <= 10
        outcome = "ranked"
      } else {
        earned = p.progress >= c.target
        outcome = earned ? "completed" : "not_completed"
      }
    }
    const finalising = s.phase === "finalising"
    const headline = !p
      ? "This challenge has finished."
      : outcome === "won"
        ? `Your ${c.teamUnit ?? "department"} won! You finished #${p.rank} overall.`
        : outcome === "completed"
          ? `Challenge complete! You finished #${p.rank}.`
          : outcome === "ranked"
            ? `You finished #${p.rank} of ${rows.length}.`
            : `So close! You finished #${p.rank} of ${rows.length}.`

    const suggestions = visibleChallenges(ctx, emp)
      .filter((x) => x.id !== c.id && inAudience(x, emp) && !participantOf(ctx, x.id, emp.id))
      .map((x) => summarize(ctx, x, emp))
      .filter((x) => isOpenPhase(x.phase))
      .slice(0, 3)

    return {
      challenge: s,
      finalising,
      finalisingUntil: finalising ? addDays(c.endDate, GRACE_DAYS) : null,
      joined: !!p,
      outcome,
      headline,
      finalRank: p?.rank ?? null,
      participants: rows.length,
      finalTotal: p?.progress ?? 0,
      pointsEarned: p && earned ? c.points : 0,
      reward: reward ? { id: reward.id, name: reward.name, emoji: reward.imageEmoji, color: reward.imageColor, earned: !!p && earned } : null,
      podium,
      group,
      collaborative,
      suggestions,
      prizes: readPrizes(c),
      certificate:
        p && earned && !finalising
          ? {
              employeeName: `${emp.firstName} ${emp.lastName}`,
              companyName: ctx.db.companies.find((x) => x.id === emp.companyId)?.name ?? "",
              challengeName: c.name,
              completedOn: p.completedAt ?? `${c.endDate}T18:00:00.000Z`,
              achievement:
                outcome === "won"
                  ? `Member of the winning ${c.teamUnit ?? "department"} · finished #${p.rank} of ${rows.length}`
                  : c.type === "collaborative"
                    ? `Helped reach the company goal of ${formatMetricValue(c.target, c.metric)}`
                    : c.type === "leaderboard"
                      ? `Finished #${p.rank} of ${rows.length}`
                      : `Reached ${formatMetricValue(p.progress, c.metric)} of a ${formatMetricValue(c.target, c.metric)} target · #${p.rank} of ${rows.length}`,
              certificateNo: `HX-${c.id.replace(/\W/g, "").toUpperCase()}-${emp.employeeCode}`,
            }
          : null,
    }
  }),

  /** #356 — resolve a QR / short code / share link to a challenge. */
  resolveJoinCode: endpoint<{ code: string }, { challengeId: string; name: string }, "employee">("employee", "GET", "/challenges/join-codes/:code", ({ code }, ctx) => {
    const { emp } = meEmployee(ctx)
    const wanted = normalizeCode(code ?? "")
    if (wanted.length < 4) throw badRequest("Enter the code from the poster or message.", { code: "At least 4 characters" })
    const match = visibleChallenges(ctx, emp).find((c) => normalizeCode(joinCodeFor(ctx, c.id)) === wanted || normalizeCode(c.id) === wanted)
    if (!match) throw new ApiError("We couldn't find a challenge with that code. Check it and try again.", 404, "not_found")
    if (!inAudience(match, emp)) throw new ApiError("You're not eligible for this challenge.", 403, "not_eligible")
    return { challengeId: match.id, name: match.name }
  }),

  /** #350 — join an optional mini-challenge inside a challenge you've joined. */
  joinMini: endpoint<{ id: string; miniId: string }, { ok: true }, "employee">("employee", "POST", "/challenges/:id/mini-challenges/:miniId/join", ({ id, miniId }, ctx) => {
    const { emp } = meEmployee(ctx)
    const c = getChallenge(ctx, id, emp)
    if (!participantOf(ctx, c.id, emp.id)) throw badRequest("Join the main challenge first.")
    const mini = readMinis(ctx, c, emp.id).find((m) => m.id === miniId)
    if (!mini) throw notFound("Mini-challenge")
    if (mini.status === "ended") throw badRequest("This mini-challenge has finished.")
    const joins = miniJoins(ctx)
    joins[emp.id] = [...new Set([...(joins[emp.id] ?? []), miniId])]
    ctx.save()
    return { ok: true }
  }),
}
