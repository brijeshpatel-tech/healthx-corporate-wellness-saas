/**
 * Employee app — My Team for Team Managers (SCR-M-079).
 * Aggregated team figures only: participation, team averages (groups ≥ minAnalyticsGroupSize),
 * challenge progress and the normal team leaderboard (company name-privacy setting applies).
 * Never returns individual health data (water, sleep, weight, workouts…).
 */
import { CHALLENGE_METRIC_UNIT, type AudienceType, type Challenge, type ChallengeMetric, type ChallengeType, type Employee, type LeaderboardEntry, type LeaderboardNameDisplay, type Team } from "@/lib/types"
import { DAY_MS, dailySeries, toLocalDate } from "@/lib/mock/series"
import { forbidden, notFound, endpoint, type MockContext } from "../core"
import { rankName } from "./challenges"

export type TeamPeriod = "week" | "month"

/** Leaderboard row (same shape as the engage kit's RankEntry). */
export interface TeamRankEntry extends LeaderboardEntry {
  masked?: boolean
  group?: boolean
}

export interface TeamStanding {
  id: string
  name: string
  rank: number | null
  members: number
  participants: number
  /** Average per participant — null when the group is below the privacy threshold. */
  average: number | null
  total: number | null
  hidden: boolean
  isMine: boolean
}

export interface TeamChallengeProgress {
  id: string
  name: string
  emoji: string
  color: string
  type: ChallengeType
  teamUnit?: "department" | "team"
  metric: ChallengeMetric
  unit: string
  target: number
  startDate: string
  endDate: string
  daysLeft: number
  points: number
  /** Team members taking part / team members eligible for the challenge. */
  joined: number
  eligible: number
  completed: number
  /** Team aggregates hidden because fewer than minGroupSize team members joined. */
  hidden: boolean
  total: number | null
  average: number | null
  /** Team progress gained in the selected period. */
  periodTotal: number | null
  /** Collaborative challenges: company-wide progress towards the shared target. */
  companyTotal: number | null
  /** Team challenges: standings of the competing groups (manager's group flagged). */
  standings: TeamStanding[] | null
}

export interface TeamSummary {
  teams: { id: string; name: string }[]
  team: { id: string; name: string; departmentName: string; members: number; invited: number }
  period: TeamPeriod
  minGroupSize: number
  nameDisplay: LeaderboardNameDisplay
  /** Rank among the company's teams by average steps per member (teams ≥ minGroupSize only). */
  rank: { position: number | null; of: number; leaderName: string | null }
  participation: { active: number; members: number; rate: number }
  steps: {
    suppressed: boolean
    averagePerMember: number | null
    averagePerDay: number | null
    total: number | null
    companyAveragePerMember: number | null
    /** Average steps per member per day for the period. */
    trend: { date: string; value: number }[] | null
  }
  challenges: TeamChallengeProgress[]
  hasActivity: boolean
}

export interface TeamLeaderboard {
  period: TeamPeriod
  unit: string
  nameDisplay: LeaderboardNameDisplay
  entries: TeamRankEntry[]
  me: TeamRankEntry | null
  members: number
  /** Members with no steps in the period (not listed). */
  noActivity: number
}

type Ctx = MockContext<"employee">

// ─── Internals ──────────────────────────────────────────────────────────

const APP_USER_STATUSES = new Set<Employee["status"]>(["active", "registered", "inactive"])
const PERIOD_DAYS: Record<TeamPeriod, number> = { week: 7, month: 30 }

const stepsFor = (e: Employee, period: TeamPeriod) => (period === "week" ? e.stats.stepsWeek : e.stats.stepsMonth)

function isActive(e: Employee, period: TeamPeriod, now: number) {
  if (e.status !== "active") return false
  const recent = e.lastActiveAt ? now - new Date(e.lastActiveAt).getTime() <= PERIOD_DAYS[period] * DAY_MS : false
  return stepsFor(e, period) > 0 || recent
}

function inAudience(target: { audienceType: AudienceType; audienceIds: string[] }, e: Employee) {
  if (target.audienceType === "departments") return target.audienceIds.includes(e.departmentId)
  if (target.audienceType === "teams") return target.audienceIds.includes(e.teamId)
  if (target.audienceType === "selected") return target.audienceIds.includes(e.id)
  return true
}

/** Throws 403 unless the signed-in employee is an assigned Team Manager. */
function managerContext(ctx: Ctx, teamId?: string) {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  if (emp.appRole !== "team_manager") throw forbidden("My Team is only available to Team Managers.")
  const teams = ctx.db.teams.filter((t) => t.companyId === emp.companyId && t.managerIds.includes(emp.id)).sort((a, b) => a.name.localeCompare(b.name))
  if (!teams.length) throw forbidden("You aren't assigned as the manager of a team yet. Ask your HR team to assign you.")
  const team = teamId ? teams.find((t) => t.id === teamId) : teams[0]
  if (!team) throw forbidden("You can only view teams you manage.")
  const settings = ctx.db.settings[emp.companyId]
  const companyMembers = ctx.db.employees.filter((e) => e.companyId === emp.companyId && APP_USER_STATUSES.has(e.status))
  return {
    emp,
    team,
    teams,
    minGroupSize: settings?.minAnalyticsGroupSize ?? 5,
    nameDisplay: settings?.leaderboardNameDisplay ?? "first_name_initial",
    companyMembers,
    members: companyMembers.filter((e) => e.teamId === team.id),
  }
}

const unitOf = (c: Challenge) => (c.metric === "custom" ? (c.customMetricLabel ?? "check-ins") : CHALLENGE_METRIC_UNIT[c.metric])

function challengeProgress(ctx: Ctx, c: Challenge, team: Team, members: Employee[], companyMembers: Employee[], period: TeamPeriod, minGroupSize: number): TeamChallengeProgress | null {
  const memberIds = new Set(members.map((m) => m.id))
  const all = ctx.db.participants.filter((p) => p.challengeId === c.id)
  const mine = all.filter((p) => memberIds.has(p.employeeId))
  if (!mine.length) return null
  const hidden = mine.length < minGroupSize
  const total = mine.reduce((a, p) => a + p.progress, 0)
  const periodTotal = mine.reduce((a, p) => a + p.daily.slice(-PERIOD_DAYS[period]).reduce((s, v) => s + v, 0), 0)
  const today = toLocalDate(new Date())
  const daysLeft = Math.max(0, Math.round((new Date(`${c.endDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / DAY_MS))

  let standings: TeamStanding[] | null = null
  if (c.type === "team") {
    const byTeam = c.teamUnit === "team"
    const groups = byTeam ? ctx.db.teams.filter((t) => t.companyId === c.companyId) : ctx.db.departments.filter((d) => d.companyId === c.companyId)
    const empById = new Map(companyMembers.map((e) => [e.id, e]))
    const myGroupId = byTeam ? team.id : team.departmentId
    const rows = groups
      .map((g): TeamStanding => {
        const groupMembers = companyMembers.filter((e) => (byTeam ? e.teamId : e.departmentId) === g.id && inAudience(c, e))
        const gp = all.filter((p) => {
          const e = empById.get(p.employeeId)
          return e ? (byTeam ? e.teamId : e.departmentId) === g.id : false
        })
        const sum = gp.reduce((a, p) => a + p.progress, 0)
        const groupHidden = gp.length < minGroupSize
        return {
          id: g.id,
          name: g.name,
          rank: null,
          members: groupMembers.length,
          participants: gp.length,
          average: groupHidden ? null : Math.round(sum / gp.length),
          total: groupHidden ? null : Math.round(sum),
          hidden: groupHidden,
          isMine: g.id === myGroupId,
        }
      })
      .filter((r) => r.members > 0)
    rows
      .filter((r) => !r.hidden)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
      .forEach((r, i) => (r.rank = i + 1))
    standings = rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name))
  }

  return {
    id: c.id,
    name: c.name,
    emoji: c.coverEmoji,
    color: c.coverColor,
    type: c.type,
    teamUnit: c.teamUnit,
    metric: c.metric,
    unit: unitOf(c),
    target: c.target,
    startDate: c.startDate,
    endDate: c.endDate,
    daysLeft,
    points: c.points,
    joined: mine.length,
    eligible: members.filter((m) => inAudience(c, m)).length,
    completed: mine.filter((p) => p.completed).length,
    hidden,
    total: hidden ? null : Math.round(total),
    average: hidden ? null : Math.round(total / mine.length),
    periodTotal: hidden ? null : Math.round(periodTotal),
    companyTotal: c.type === "collaborative" ? Math.round(all.reduce((a, p) => a + p.progress, 0)) : null,
    standings,
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export const teamApi = {
  summary: endpoint<{ period?: TeamPeriod; teamId?: string }, TeamSummary, "employee">("employee", "GET", "/me/team/summary", (input, ctx) => {
    const period: TeamPeriod = input.period === "month" ? "month" : "week"
    const { team, teams, members, companyMembers, minGroupSize, nameDisplay } = managerContext(ctx, input.teamId)
    const now = Date.now()
    const days = PERIOD_DAYS[period]
    const department = ctx.db.departments.find((d) => d.id === team.departmentId)
    const invited = ctx.db.employees.filter((e) => e.teamId === team.id && e.status === "invited").length

    // Rank among teams by average steps per member (only teams big enough to be shown).
    const ranked = ctx.db.teams
      .filter((t) => t.companyId === team.companyId)
      .map((t) => {
        const tm = companyMembers.filter((e) => e.teamId === t.id)
        return { team: t, size: tm.length, avg: tm.length ? tm.reduce((a, e) => a + stepsFor(e, period), 0) / tm.length : 0 }
      })
      .filter((r) => r.size >= minGroupSize)
      .sort((a, b) => b.avg - a.avg)
    const position = ranked.findIndex((r) => r.team.id === team.id)

    const active = members.filter((e) => isActive(e, period, now)).length
    const suppressed = members.length < minGroupSize
    const total = members.reduce((a, e) => a + stepsFor(e, period), 0)
    const averagePerMember = members.length ? total / members.length : 0
    const companyAvg = companyMembers.length ? companyMembers.reduce((a, e) => a + stepsFor(e, period), 0) / companyMembers.length : 0

    // Daily shape for the team average (sample data), scaled so it adds up to the period average.
    let trend: TeamSummary["steps"]["trend"] = null
    if (!suppressed && averagePerMember > 0) {
      const raw = dailySeries(`team-steps-${team.id}-${period}`, days, { base: averagePerMember / days, variance: 0.18, weekendDip: 0.28 })
      const rawSum = raw.reduce((a, p) => a + p.value, 0) || 1
      trend = raw.map((p) => ({ date: p.date, value: Math.round((p.value / rawSum) * averagePerMember) }))
    }

    const challenges = ctx.db.challenges
      .filter((c) => c.companyId === team.companyId && c.status === "active")
      .map((c) => challengeProgress(ctx, c, team, members, companyMembers, period, minGroupSize))
      .filter((c): c is TeamChallengeProgress => c !== null)
      .sort((a, b) => b.joined - a.joined || a.daysLeft - b.daysLeft)

    return {
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      team: { id: team.id, name: team.name, departmentName: department?.name ?? "—", members: members.length, invited },
      period,
      minGroupSize,
      nameDisplay,
      rank: { position: position >= 0 ? position + 1 : null, of: ranked.length, leaderName: ranked[0]?.team.name ?? null },
      participation: { active, members: members.length, rate: members.length ? active / members.length : 0 },
      steps: {
        suppressed,
        averagePerMember: suppressed ? null : Math.round(averagePerMember),
        averagePerDay: suppressed ? null : Math.round(averagePerMember / days),
        total: suppressed ? null : total,
        companyAveragePerMember: companyMembers.length >= minGroupSize ? Math.round(companyAvg) : null,
        trend,
      },
      challenges,
      hasActivity: active > 0 || total > 0,
    }
  }),

  leaderboard: endpoint<{ period?: TeamPeriod; teamId?: string }, TeamLeaderboard, "employee">("employee", "GET", "/me/team/leaderboard", (input, ctx) => {
    const period: TeamPeriod = input.period === "month" ? "month" : "week"
    const { emp, members, nameDisplay } = managerContext(ctx, input.teamId)
    ctx.me() // make sure the manager's own private data (opt-out flag) exists
    const withSteps = members.filter((e) => stepsFor(e, period) > 0)
    // Movement (week only): rank by the pace of the weeks before this one.
    const previous = new Map<string, number>()
    if (period === "week") {
      ;[...withSteps]
        .sort((a, b) => Math.max(0, b.stats.stepsMonth - b.stats.stepsWeek) - Math.max(0, a.stats.stepsMonth - a.stats.stepsWeek))
        .forEach((e, i) => previous.set(e.id, i + 1))
    }

    const entries: TeamRankEntry[] = [...withSteps]
      .sort((a, b) => stepsFor(b, period) - stepsFor(a, period))
      .map((e, i) => {
        // Company name-display setting + personal opt-out (same masking as every other leaderboard).
        const { name, masked } = rankName(ctx, e, emp.id, nameDisplay)
        return {
          rank: i + 1,
          previousRank: previous.get(e.id),
          id: e.id,
          name,
          avatarColor: e.avatarColor,
          value: stepsFor(e, period),
          isMe: e.id === emp.id,
          masked,
        }
      })

    return {
      period,
      unit: "steps",
      nameDisplay,
      entries,
      me: entries.find((e) => e.isMe) ?? null,
      members: members.length,
      noActivity: members.length - withSteps.length,
    }
  }),
}
