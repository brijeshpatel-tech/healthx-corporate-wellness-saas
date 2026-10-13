/**
 * Business Portal — "My team" for Team Managers (SCR-M-079 content, web version).
 * Team Managers only ever see their own teams. Members show participation and points only (no health data);
 * team aggregates are hidden when the team is smaller than the company's minimum group size.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { Challenge, Employee, EmployeeStatus, LeaderboardEntry } from "@/lib/types"
import { displayName } from "@/lib/format"
import { dailySeries } from "@/lib/mock/series"
import { endpoint, forbidden, notFound } from "../core"
import { companyEmployees, companySettings, isJoined, ratio, type BusinessCtx } from "./common"

export type TeamPeriod = "week" | "month"

export interface MyTeamSummary {
  teams: { id: string; name: string; departmentName: string }[]
  team: { id: string; name: string; departmentName: string; memberCount: number; joinedCount: number }
  suppressed: boolean
  minGroupSize: number
  kpis: {
    activeMembers: number
    participation: number | null
    avgStepsPerDay: number | null
    pointsEarned: number | null
    challengeParticipation: number | null
  }
  rank: { position: number; total: number; companyParticipation: number }
  trend: { date: string; active: number }[] | null
  challenges: {
    id: string
    name: string
    coverEmoji: string
    coverColor: string
    endDate: string
    type: Challenge["type"]
    joined: number
    eligible: number
    avgProgress: number | null
    teamRank?: { position: number; total: number }
  }[]
}

export interface MyTeamMember {
  id: string
  name: string
  jobTitle: string
  avatarColor: string
  status: EmployeeStatus
  lastActiveAt?: string
  pointsThisMonth: number
  activeChallenges: number
  challengesJoined: number
  isManager: boolean
}

export interface MyTeamLeaderboard {
  members: LeaderboardEntry[]
  teams: LeaderboardEntry[]
  nameDisplay: "full_name" | "first_name_initial" | "anonymous"
  minGroupSize: number
}

function managerScope(ctx: BusinessCtx, teamId?: string) {
  const session = ctx.session() as BusinessSession
  if (session.role !== "team_manager") throw forbidden("My team is only available to Team Managers.")
  // Use live team data in case assignments changed since sign-in.
  const managed = ctx.db.teams.filter((t) => t.companyId === session.companyId && (t.managerIds.includes(session.user.id) || session.teamIds.includes(t.id)))
  if (managed.length === 0) throw notFound("Team")
  const team = teamId ? managed.find((t) => t.id === teamId) : managed[0]
  if (!team) throw forbidden("You can only view teams you manage.")
  return { session, managed, team }
}

const departmentName = (ctx: BusinessCtx, id: string) => ctx.db.departments.find((d) => d.id === id)?.name ?? ""

function eligibleFor(c: Challenge, e: Employee) {
  if (c.audienceType === "departments") return c.audienceIds.includes(e.departmentId)
  if (c.audienceType === "teams") return c.audienceIds.includes(e.teamId)
  if (c.audienceType === "selected") return c.audienceIds.includes(e.id)
  return true
}

export const myTeamApi = {
  summary: endpoint<{ period: TeamPeriod; teamId?: string }, MyTeamSummary, "business">("business", "GET", "/me/team/summary", ({ period, teamId }, ctx) => {
    const { managed, team } = managerScope(ctx, teamId)
    const settings = companySettings(ctx)
    const all = companyEmployees(ctx)
    const members = all.filter((e) => e.teamId === team.id)
    const joined = members.filter(isJoined)
    const suppressed = members.length < settings.minAnalyticsGroupSize
    const days = period === "week" ? 7 : 30
    const activeInPeriod = (e: Employee) => e.status === "active" && (period === "month" ? e.stats.activeDaysMonth > 0 : e.stats.stepsWeek > 0)
    const active = members.filter(activeInPeriod)

    // Rank teams (of at least min size) by participation.
    const teams = ctx.db.teams.filter((t) => t.companyId === team.companyId)
    const scored = teams
      .map((t) => {
        const m = all.filter((e) => e.teamId === t.id)
        return { id: t.id, size: m.length, participation: ratio(m.filter(activeInPeriod).length, m.filter(isJoined).length) }
      })
      .filter((t) => t.size >= settings.minAnalyticsGroupSize || t.id === team.id)
      .sort((a, b) => b.participation - a.participation)
    const position = scored.findIndex((t) => t.id === team.id) + 1

    const challenges = ctx.db.challenges
      .filter((c) => c.companyId === team.companyId && c.status === "active" && members.some((e) => eligibleFor(c, e)))
      .map((c) => {
        const eligible = joined.filter((e) => eligibleFor(c, e))
        const parts = ctx.db.participants.filter((p) => p.challengeId === c.id && eligible.some((e) => e.id === p.employeeId))
        const avg = c.type === "collaborative" ? ratio(parts.reduce((a, p) => a + p.progress, 0), c.target) : ratio(parts.reduce((a, p) => a + Math.min(1, p.progress / c.target), 0), parts.length)
        let teamRank: { position: number; total: number } | undefined
        if (c.type === "team" && c.teamUnit === "team") {
          const totals = teams
            .map((t) => ({ id: t.id, total: ctx.db.participants.filter((p) => p.challengeId === c.id && all.find((e) => e.id === p.employeeId)?.teamId === t.id).reduce((a, p) => a + p.progress, 0) }))
            .filter((t) => t.total > 0)
            .sort((a, b) => b.total - a.total)
          const idx = totals.findIndex((t) => t.id === team.id)
          if (idx >= 0) teamRank = { position: idx + 1, total: totals.length }
        }
        return {
          id: c.id,
          name: c.name,
          coverEmoji: c.coverEmoji,
          coverColor: c.coverColor,
          endDate: c.endDate,
          type: c.type,
          joined: parts.length,
          eligible: eligible.length,
          avgProgress: suppressed ? null : Math.min(1, avg),
          teamRank,
        }
      })

    const pointsEarned = members.reduce((a, e) => a + e.stats.pointsMonth, 0) * (period === "week" ? 0.25 : 1)
    const withChallenge = joined.filter((e) => ctx.db.participants.some((p) => p.employeeId === e.id && challenges.some((c) => c.id === p.challengeId))).length
    const companyJoined = all.filter(isJoined)

    return {
      teams: managed.map((t) => ({ id: t.id, name: t.name, departmentName: departmentName(ctx, t.departmentId) })),
      team: { id: team.id, name: team.name, departmentName: departmentName(ctx, team.departmentId), memberCount: members.length, joinedCount: joined.length },
      suppressed,
      minGroupSize: settings.minAnalyticsGroupSize,
      kpis: {
        activeMembers: active.length,
        participation: suppressed ? null : ratio(active.length, joined.length),
        avgStepsPerDay: suppressed ? null : Math.round(active.reduce((a, e) => a + (period === "week" ? e.stats.stepsWeek / 7 : e.stats.stepsMonth / 30), 0) / Math.max(1, active.length)),
        pointsEarned: suppressed ? null : Math.round(pointsEarned),
        challengeParticipation: suppressed ? null : ratio(withChallenge, joined.length),
      },
      rank: { position: Math.max(1, position), total: scored.length, companyParticipation: ratio(companyJoined.filter(activeInPeriod).length, companyJoined.length) },
      trend: suppressed ? null : dailySeries(`myteam:${team.id}:${period}`, days, { base: Math.max(1, active.length * 0.8), variance: 0.15, weekendDip: 0.35, max: joined.length }).map((p) => ({ date: p.date, active: Math.round(p.value) })),
      challenges,
    }
  }),

  members: endpoint<{ teamId?: string }, MyTeamMember[], "business">("business", "GET", "/me/team/members", ({ teamId }, ctx) => {
    const { team } = managerScope(ctx, teamId)
    return companyEmployees(ctx)
      .filter((e) => e.teamId === team.id)
      .map((e) => {
        const parts = ctx.db.participants.filter((p) => p.employeeId === e.id)
        return {
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          jobTitle: e.jobTitle,
          avatarColor: e.avatarColor,
          status: e.status,
          lastActiveAt: e.lastActiveAt,
          pointsThisMonth: e.stats.pointsMonth,
          challengesJoined: parts.length,
          activeChallenges: parts.filter((p) => ctx.db.challenges.find((c) => c.id === p.challengeId)?.status === "active").length,
          isManager: team.managerIds.includes(e.id),
        }
      })
      .sort((a, b) => Number(b.isManager) - Number(a.isManager) || a.name.localeCompare(b.name))
  }),

  /** Leaderboards follow the company's name-privacy setting, exactly as in the app. */
  leaderboard: endpoint<{ teamId?: string; metric: "points" | "steps"; period: TeamPeriod }, MyTeamLeaderboard, "business">(
    "business",
    "GET",
    "/me/team/leaderboard",
    ({ teamId, metric, period }, ctx) => {
      const { session, team } = managerScope(ctx, teamId)
      const settings = companySettings(ctx)
      const all = companyEmployees(ctx).filter((e) => e.status === "active")
      const value = (e: Employee) => (metric === "points" ? (period === "week" ? Math.round(e.stats.pointsMonth / 4) : e.stats.pointsMonth) : period === "week" ? e.stats.stepsWeek : e.stats.stepsMonth)
      const members = all
        .filter((e) => e.teamId === team.id)
        .sort((a, b) => value(b) - value(a))
        .map((e, i) => ({
          rank: i + 1,
          id: e.id,
          name: e.id === session.user.id ? `${e.firstName} ${e.lastName} (you)` : displayName(e, settings.leaderboardNameDisplay, `Teammate ${i + 1}`),
          subtitle: settings.leaderboardNameDisplay === "anonymous" ? undefined : e.jobTitle,
          avatarColor: e.avatarColor,
          value: value(e),
          isMe: e.id === session.user.id,
        }))
      const teams = ctx.db.teams
        .filter((t) => t.companyId === team.companyId)
        .map((t) => {
          const m = all.filter((e) => e.teamId === t.id)
          return { t, size: m.length, avg: Math.round(m.reduce((a, e) => a + value(e), 0) / Math.max(1, m.length)) }
        })
        .filter((x) => x.size >= settings.minAnalyticsGroupSize || x.t.id === team.id)
        .sort((a, b) => b.avg - a.avg)
        .map((x, i) => ({
          rank: i + 1,
          id: x.t.id,
          name: x.t.name,
          subtitle: departmentName(ctx, x.t.departmentId),
          avatarColor: ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#14b8a6"][i % 6]!,
          value: x.avg,
          isMe: x.t.id === team.id,
          memberCount: x.size,
        }))
      return { members, teams, nameDisplay: settings.leaderboardNameDisplay, minGroupSize: settings.minAnalyticsGroupSize }
    },
  ),
}
