/**
 * Business Portal — challenge add-ons shown on the challenge detail page:
 * join codes / QR (#356, P1), mini-challenges (#350, P2), completion certificates (#355, P2)
 * and walking-journey progress (#374, P2).
 *
 * Data lives in feature-owned extra keys shared with the Employee App:
 *   "challenge-join-codes"   Record<challengeId, { code }>
 *   "challenge-mini"         Record<challengeId, MiniChallenge[]>
 *   "challenge-certificates" Record<challengeId, { emailedAt?, emailedCount?, emailedBy? }>
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge, ChallengeMetric, ChallengeParticipant, Employee } from "@/lib/types"
import { CHALLENGE_METRIC_UNIT } from "@/lib/types"
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { audit, badRequest, endpoint, forbidden, newId, notFound } from "../core"
import { audienceMembers, challengeSettings, ensureJoinCode, notifyEmployees, STEPS_PER_KM, type WalkingJourney } from "./challenges"
import { companyEmployees, companySettings, requireRole, suppressed, type BusinessCtx } from "./common"

const MANAGE_ROLES: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]
export const CHALLENGE_MINI_KEY = "challenge-mini"
export const CHALLENGE_CERTIFICATES_KEY = "challenge-certificates"

// ─── Types ──────────────────────────────────────────────────────────────

export interface JoinInfo {
  challengeId: string
  code: string
  /** App path employees open (QR code / share link). */
  path: string
  available: boolean
}

export interface MiniChallenge {
  id: string
  challengeId: string
  title: string
  description?: string
  /** race = first N to reach the target win; leaderboard = top N at the end win. */
  kind: "race" | "leaderboard"
  metric: ChallengeMetric
  target?: number
  startDate: string
  endDate: string
  bonusPoints: number
  winnerSlots: number
  announce: boolean
  cancelled?: boolean
  createdAt: string
  createdBy: string
}

export interface MiniChallengeRow extends MiniChallenge {
  status: "scheduled" | "active" | "completed" | "cancelled"
  unit: string
  /** Participants of the parent challenge with progress in the window. */
  taking: number
  /** Race: people who reached the target (winners are the first `winnerSlots`). */
  reached: number
  slotsLeft: number
  leaders: { name: string; value: number }[]
}

export type MiniChallengeInput = Omit<MiniChallenge, "id" | "challengeId" | "createdAt" | "createdBy" | "cancelled"> & { challengeId: string }

export interface CertificateRow {
  id: string
  number: string
  name: string
  department: string
  completedOn: string
  path: string
}

export interface CertificateSummary {
  available: boolean
  /** Why certificates aren't available yet. */
  reason?: string
  rule: string
  items: CertificateRow[]
  emailedAt?: string
  emailedCount?: number
  challengeName: string
  companyName: string
  endDate: string
}

export interface JourneyProgress {
  journey: WalkingJourney
  participants: number
  averageKm: number
  leaderKm: number
  milestones: (WalkingJourney["milestones"][number] & { reached: number | null })[]
  minGroupSize: number
}

// ─── Helpers ────────────────────────────────────────────────────────────

const today = () => toLocalDate(new Date())
const dayDiff = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / DAY_MS)
const miniStore = (ctx: BusinessCtx) => ctx.extra<Record<string, MiniChallenge[]>>(CHALLENGE_MINI_KEY, () => seedMini(ctx))
const certStore = (ctx: BusinessCtx) => ctx.extra<Record<string, { emailedAt?: string; emailedCount?: number; emailedBy?: string }>>(CHALLENGE_CERTIFICATES_KEY, () => ({}))

function seedMini(ctx: BusinessCtx): Record<string, MiniChallenge[]> {
  const c = ctx.db.challenges.find((x) => x.id === "chl_001")
  if (!c) return {}
  const start = toLocalDate(new Date(Date.now() - 2 * DAY_MS))
  const end = toLocalDate(new Date(Date.now() + 2 * DAY_MS))
  return {
    chl_001: [
      { id: "mini_001", challengeId: "chl_001", title: "Weekend 25K sprint", description: "First 10 people to log 25,000 steps over the weekend win bonus points.", kind: "race", metric: "steps", target: 25000, startDate: start, endDate: end, bonusPoints: 50, winnerSlots: 10, announce: true, createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString(), createdBy: "Sneha Kapoor" },
      { id: "mini_002", challengeId: "chl_001", title: "Week 1 top steppers", kind: "leaderboard", metric: "steps", startDate: c.startDate, endDate: toLocalDate(new Date(new Date(`${c.startDate}T00:00:00`).getTime() + 6 * DAY_MS)), bonusPoints: 30, winnerSlots: 5, announce: false, createdAt: c.createdAt, createdBy: c.createdBy },
    ],
  }
}

function findChallenge(ctx: BusinessCtx, id: string) {
  const c = ctx.db.challenges.find((x) => x.id === id && x.companyId === ctx.companyId())
  if (!c) throw notFound("Challenge")
  const s = ctx.session() as BusinessSession
  if (s.role === "team_manager") {
    const mine = new Set(companyEmployees(ctx).filter((e) => s.teamIds.includes(e.teamId)).map((e) => e.id))
    if (c.status === "draft" || !audienceMembers(ctx, c).some((e) => mine.has(e.id))) throw forbidden("This challenge isn't open to your team.")
  }
  return c
}

const unitOf = (metric: ChallengeMetric, c?: Challenge) => (metric === "custom" ? c?.customMetricLabel ?? "check-ins" : CHALLENGE_METRIC_UNIT[metric])

/** Typical daily amount per metric — used when a mini-challenge measures a different metric than its parent. */
const TYPICAL: Record<ChallengeMetric, number> = { steps: 8000, distance: 6, calories: 320, active_minutes: 45, workouts: 0.4, water: 2000, meditation: 8, custom: 0.7 }

/** A participant's value inside a date window (participants' daily arrays end on the parent's last counted day). */
function windowValue(p: ChallengeParticipant, c: Challenge, m: Pick<MiniChallenge, "startDate" | "endDate" | "metric" | "id">) {
  const last = c.endDate < today() ? c.endDate : today()
  const from = m.startDate
  const to = m.endDate < last ? m.endDate : last
  if (to < from) return 0
  let total = 0
  for (let d = 0; d <= dayDiff(from, to); d++) {
    const date = toLocalDate(new Date(new Date(`${from}T00:00:00`).getTime() + d * DAY_MS))
    const idx = p.daily.length - 1 - dayDiff(date, last)
    if (m.metric === c.metric) total += idx >= 0 ? (p.daily[idx] ?? 0) : 0
    else total += TYPICAL[m.metric] * (0.4 + noise(`${m.id}:${p.employeeId}`, d) * 1.2)
  }
  return m.metric === "workouts" || m.metric === "custom" ? Math.round(total) : Math.round(total * 10) / 10
}

function displayName(ctx: BusinessCtx, e: Employee | undefined) {
  const settings = companySettings(ctx)
  if (!e) return "Former employee"
  const optedOut = settings.allowLeaderboardOptOut && !!ctx.db.private[e.id]?.leaderboardOptOut
  const mode = optedOut ? "anonymous" : settings.leaderboardNameDisplay
  return mode === "full_name" ? `${e.firstName} ${e.lastName}` : mode === "first_name_initial" ? `${e.firstName} ${e.lastName[0]}.` : "Anonymous colleague"
}

function miniRow(ctx: BusinessCtx, c: Challenge, m: MiniChallenge): MiniChallengeRow {
  const t = today()
  const status: MiniChallengeRow["status"] = m.cancelled || c.status === "cancelled" ? "cancelled" : m.startDate > t ? "scheduled" : m.endDate < t || c.status === "completed" ? "completed" : "active"
  const parts = ctx.db.participants.filter((p) => p.challengeId === c.id)
  const values = status === "scheduled" ? [] : parts.map((p) => ({ p, v: windowValue(p, c, m) })).filter((x) => x.v > 0)
  values.sort((a, b) => b.v - a.v)
  const reached = m.kind === "race" && m.target ? values.filter((x) => x.v >= m.target!).length : 0
  const byId = new Map(ctx.db.employees.map((e) => [e.id, e]))
  return {
    ...m,
    status,
    unit: unitOf(m.metric, c),
    taking: values.length,
    reached,
    slotsLeft: m.kind === "race" ? Math.max(0, m.winnerSlots - reached) : m.winnerSlots,
    leaders: values.slice(0, 3).map((x) => ({ name: displayName(ctx, byId.get(x.p.employeeId)), value: x.v })),
  }
}

function certificateEligible(c: Challenge, parts: ChallengeParticipant[]) {
  if (c.type === "team" || c.type === "collaborative") return c.status === "completed" ? parts.filter((p) => p.progress > 0) : []
  return parts.filter((p) => p.completed)
}

// ─── Endpoints ──────────────────────────────────────────────────────────

export const challengeExtrasApi = {
  /** #356 — join code, QR target and share link. Created when the challenge is published. */
  joinInfo: endpoint<{ id: string }, JoinInfo, "business">("business", "GET", "/organization/challenges/:id/join-code", ({ id }, ctx) => {
    const c = findChallenge(ctx, id)
    const available = c.status === "scheduled" || c.status === "active"
    const code = available ? ensureJoinCode(ctx, c.id) : ""
    if (available) ctx.save()
    return { challengeId: c.id, code, path: available ? `/employee-app/challenges/join/${code}` : "", available }
  }),

  regenerateJoinCode: endpoint<{ id: string }, JoinInfo, "business">("business", "POST", "/organization/challenges/:id/join-code/regenerate", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    if (c.status !== "scheduled" && c.status !== "active") throw badRequest("Join codes are only available for scheduled or active challenges.")
    const code = ensureJoinCode(ctx, c.id, true)
    audit(ctx, { action: "Regenerated challenge join code", entityType: "Challenge", entityName: c.name, companyId: c.companyId, severity: "warning" })
    ctx.save()
    return { challengeId: c.id, code, path: `/employee-app/challenges/join/${code}`, available: true }
  }),

  /** #350 — mini-challenges inside a challenge (Phase 2). */
  miniList: endpoint<{ id: string }, MiniChallengeRow[], "business">("business", "GET", "/organization/challenges/:id/mini-challenges", ({ id }, ctx) => {
    const c = findChallenge(ctx, id)
    return (miniStore(ctx)[c.id] ?? []).map((m) => miniRow(ctx, c, m)).sort((a, b) => a.startDate.localeCompare(b.startDate))
  }),

  miniCreate: endpoint<MiniChallengeInput, MiniChallengeRow, "business">("business", "POST", "/organization/challenges/:challengeId/mini-challenges", (input, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, input.challengeId)
    if (c.status !== "active" && c.status !== "scheduled") throw badRequest("Mini-challenges can only be added to scheduled or active challenges.")
    const errors: Record<string, string> = {}
    const title = input.title?.trim() ?? ""
    if (title.length < 3) errors.title = "Give it a short title"
    else if (title.length > 60) errors.title = "Keep the title under 60 characters"
    if (input.kind === "race" && !(Number(input.target) > 0)) errors.target = "Races need a target greater than 0"
    if (!input.startDate) errors.startDate = "Choose a start date"
    else if (input.startDate < c.startDate || input.startDate > c.endDate) errors.startDate = "Must be within the challenge dates"
    else if (input.startDate < today()) errors.startDate = "Can't start in the past"
    if (!input.endDate) errors.endDate = "Choose an end date"
    else if (input.endDate > c.endDate) errors.endDate = "Must end by the challenge end date"
    else if (input.startDate && input.endDate < input.startDate) errors.endDate = "End date must be on or after the start date"
    if (!(input.bonusPoints >= 0) || input.bonusPoints > 5000) errors.bonusPoints = "0–5,000 bonus points"
    if (!(input.winnerSlots >= 1) || input.winnerSlots > 100) errors.winnerSlots = "Between 1 and 100 winners"
    if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
    const m: MiniChallenge = {
      id: newId("mini"),
      challengeId: c.id,
      title,
      description: input.description?.trim() || undefined,
      kind: input.kind,
      metric: input.metric,
      target: input.kind === "race" ? Number(input.target) : undefined,
      startDate: input.startDate,
      endDate: input.endDate,
      bonusPoints: Math.round(input.bonusPoints),
      winnerSlots: Math.round(input.winnerSlots),
      announce: !!input.announce,
      createdAt: new Date().toISOString(),
      createdBy: session.user.name,
    }
    const store = miniStore(ctx)
    store[c.id] = [...(store[c.id] ?? []), m]
    if (m.announce) {
      const people = new Set([...ctx.db.participants.filter((p) => p.challengeId === c.id).map((p) => p.employeeId), ...audienceMembers(ctx, c, true).map((e) => e.id)])
      const unit = unitOf(m.metric, c)
      notifyEmployees(
        ctx,
        people,
        {
          type: "challenge",
          title: `Mini-challenge: ${m.title} ⚡`,
          body: `${m.kind === "race" ? `First ${m.winnerSlots} to reach ${m.target!.toLocaleString("en-IN")} ${unit}` : `Top ${m.winnerSlots} on ${unit}`} win +${m.bonusPoints} bonus points. Part of ${c.name}.`,
          href: `/employee-app/challenges/${c.id}`,
        },
        "challenges",
      )
    }
    audit(ctx, { action: "Created mini-challenge", entityType: "Challenge", entityName: `${c.name} — ${m.title}`, companyId: c.companyId })
    ctx.save()
    return miniRow(ctx, c, m)
  }),

  miniCancel: endpoint<{ id: string; miniId: string }, MiniChallengeRow, "business">("business", "POST", "/organization/challenges/:id/mini-challenges/:miniId/cancel", ({ id, miniId }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    const m = (miniStore(ctx)[c.id] ?? []).find((x) => x.id === miniId)
    if (!m) throw notFound("Mini-challenge")
    if (miniRow(ctx, c, m).status === "completed") throw badRequest("This mini-challenge has already finished.")
    m.cancelled = true
    audit(ctx, { action: "Cancelled mini-challenge", entityType: "Challenge", entityName: `${c.name} — ${m.title}`, companyId: c.companyId, severity: "warning" })
    ctx.save()
    return miniRow(ctx, c, m)
  }),

  /** #355 — completion certificates (Phase 2): issued automatically to people who complete. */
  certificates: endpoint<{ id: string }, CertificateSummary, "business">("business", "GET", "/organization/challenges/:id/certificates", ({ id }, ctx) => {
    requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    const parts = ctx.db.participants.filter((p) => p.challengeId === c.id)
    const eligible = certificateEligible(c, parts)
    const byId = new Map(ctx.db.employees.map((e) => [e.id, e]))
    const depts = new Map(ctx.db.departments.map((d) => [d.id, d.name]))
    const company = ctx.db.companies.find((x) => x.id === c.companyId)
    const rule = c.type === "team" || c.type === "collaborative" ? "Everyone who contributed gets a certificate when the challenge ends." : "Issued automatically when someone reaches the target."
    const stored = certStore(ctx)[c.id]
    return {
      available: eligible.length > 0,
      reason: eligible.length ? undefined : c.status === "active" && (c.type === "team" || c.type === "collaborative") ? "Certificates are issued when the challenge ends." : "Nobody has completed the challenge yet.",
      rule,
      items: eligible
        .map((p, i) => {
          const e = byId.get(p.employeeId)
          return {
            id: p.id,
            number: `HX-${c.id.slice(-3).toUpperCase()}-${String(i + 1).padStart(4, "0")}`,
            name: e ? `${e.firstName} ${e.lastName}` : "Former employee",
            department: e ? depts.get(e.departmentId) ?? "" : "",
            completedOn: (p.completedAt ?? (c.status === "completed" ? `${c.endDate}T18:00:00.000Z` : new Date().toISOString())).slice(0, 10),
            path: `/employee-app/challenges/${c.id}/certificate`,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      emailedAt: stored?.emailedAt,
      emailedCount: stored?.emailedCount,
      challengeName: c.name,
      companyName: company?.name ?? "",
      endDate: c.endDate,
    }
  }),

  emailCertificates: endpoint<{ id: string }, { sent: number }, "business">("business", "POST", "/organization/challenges/:id/certificates/email", ({ id }, ctx) => {
    const session = requireRole(ctx, MANAGE_ROLES)
    const c = findChallenge(ctx, id)
    const eligible = certificateEligible(
      c,
      ctx.db.participants.filter((p) => p.challengeId === c.id),
    )
    if (eligible.length === 0) throw badRequest("Nobody has earned a certificate yet.")
    notifyEmployees(ctx, eligible.map((p) => p.employeeId), { type: "badge", title: `Your certificate for ${c.name} 🎓`, body: "Well done! Your completion certificate is ready to download.", href: `/employee-app/challenges/${c.id}/certificate` })
    certStore(ctx)[c.id] = { emailedAt: new Date().toISOString(), emailedCount: eligible.length, emailedBy: session.user.name }
    audit(ctx, { action: "Emailed completion certificates", entityType: "Challenge", entityName: `${c.name} (${eligible.length})`, companyId: c.companyId })
    ctx.save()
    return { sent: eligible.length }
  }),

  /** #374 — walking-journey progress (aggregated: average, leader distance, people past each milestone). */
  journey: endpoint<{ id: string }, JourneyProgress | null, "business">("business", "GET", "/organization/challenges/:id/journey", ({ id }, ctx) => {
    const c = findChallenge(ctx, id)
    const journey = challengeSettings(ctx, c.id).journey
    if (!journey) return null
    const parts = ctx.db.participants.filter((p) => p.challengeId === c.id)
    const km = parts.map((p) => (c.metric === "steps" ? p.progress / STEPS_PER_KM : p.progress))
    const min = companySettings(ctx).minAnalyticsGroupSize
    return {
      journey,
      participants: parts.length,
      averageKm: km.length ? Math.round((km.reduce((a, v) => a + v, 0) / km.length) * 10) / 10 : 0,
      leaderKm: km.length ? Math.round(Math.max(...km) * 10) / 10 : 0,
      milestones: journey.milestones.map((m) => {
        const reached = km.filter((v) => v >= m.km).length
        return { ...m, reached: reached > 0 && suppressed(reached, ctx) && reached < parts.length ? null : reached }
      }),
      minGroupSize: min,
    }
  }),
}
