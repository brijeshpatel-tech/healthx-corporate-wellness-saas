/**
 * Public / TV leaderboards (#351, Phase 2): admins share a read-only leaderboard link for office
 * screens or Slack. Privacy controls can only make names MORE private than the company setting.
 * Shares live in `ctx.extra("board-shares")`.
 */
import type { BusinessSession } from "@/lib/auth/session"
import type { LeaderboardNameDisplay } from "@/lib/types"
import { audit, badRequest, endpoint, notFound } from "../core"
import { requireRole, type BusinessCtx } from "./common"
import { computeLeaderboard, stricterName, type LeaderboardQuery, type LeaderboardResult } from "./leaderboards"

export const BOARD_SHARES_KEY = "board-shares"

export interface BoardShare {
  token: string
  companyId: string
  title: string
  query: LeaderboardQuery
  nameDisplay: LeaderboardNameDisplay
  showDepartments: boolean
  /** How many places are shown on the screen. */
  limit: number
  createdAt: string
  createdBy: string
  revokedAt?: string
  views: number
  lastViewedAt?: string
}

export interface BoardShareInput {
  title: string
  query: LeaderboardQuery
  nameDisplay: LeaderboardNameDisplay
  showDepartments: boolean
  limit: number
}

export interface PublicBoard {
  title: string
  companyName: string
  logoInitials: string
  primaryColor: string
  board: Pick<LeaderboardResult, "kind" | "unit" | "valueKind" | "challengeMetric" | "challengeCustomLabel" | "entries" | "total" | "periodLabel" | "title" | "minGroupSize" | "hiddenGroups">
  nameDisplay: LeaderboardNameDisplay
  updatedAt: string
}

const MANAGE: BusinessSession["role"][] = ["company_owner", "hr_admin", "wellness_manager"]
const shares = (ctx: BusinessCtx) => ctx.extra<BoardShare[]>(BOARD_SHARES_KEY, () => [])
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20)

export const boardsApi = {
  list: endpoint<void, BoardShare[], "business">("business", "GET", "/organization/leaderboards/shares", (_i, ctx) => {
    requireRole(ctx, MANAGE)
    return shares(ctx)
      .filter((s) => s.companyId === ctx.companyId())
      .sort((a, b) => Number(!!a.revokedAt) - Number(!!b.revokedAt) || b.createdAt.localeCompare(a.createdAt))
  }),

  create: endpoint<BoardShareInput, BoardShare, "business">("business", "POST", "/organization/leaderboards/shares", (input, ctx) => {
    const session = requireRole(ctx, MANAGE)
    const title = input.title?.trim() ?? ""
    if (title.length < 3 || title.length > 60) throw badRequest("Please fix the highlighted fields.", { title: "Use 3–60 characters" })
    if (![10, 20, 30].includes(input.limit)) throw badRequest("Please fix the highlighted fields.", { limit: "Show 10, 20 or 30 places" })
    // Validate the query (also checks the challenge exists and belongs to the company).
    computeLeaderboard(ctx, { ...input.query, limit: 1 })
    const share: BoardShare = {
      token: token(),
      companyId: ctx.companyId(),
      title,
      query: { ...input.query, limit: undefined },
      nameDisplay: input.nameDisplay,
      showDepartments: input.showDepartments,
      limit: input.limit,
      createdAt: new Date().toISOString(),
      createdBy: session.user.name,
      views: 0,
    }
    shares(ctx).unshift(share)
    audit(ctx, { action: "Shared public leaderboard link", entityType: "Leaderboard", entityName: title, companyId: share.companyId, severity: "warning" })
    ctx.save()
    return share
  }),

  revoke: endpoint<{ token: string }, BoardShare, "business">("business", "POST", "/organization/leaderboards/shares/:token/revoke", ({ token: t }, ctx) => {
    requireRole(ctx, MANAGE)
    const share = shares(ctx).find((s) => s.token === t && s.companyId === ctx.companyId())
    if (!share) throw notFound("Shared board")
    share.revokedAt = new Date().toISOString()
    audit(ctx, { action: "Revoked public leaderboard link", entityType: "Leaderboard", entityName: share.title, companyId: share.companyId })
    ctx.save()
    return share
  }),
}

/** Read-only public endpoint used by `/board/[token]` — no sign-in. */
export const publicBoardApi = {
  get: endpoint<{ token: string }, PublicBoard, "business">("business", "GET", "/public/boards/:token", ({ token: t }, ctx) => {
    const share = shares(ctx).find((s) => s.token === t)
    if (!share || share.revokedAt) throw notFound("Leaderboard")
    const company = ctx.db.companies.find((c) => c.id === share.companyId)
    // Compute as an anonymous viewer of that company (no "you" highlight, company-wide scope).
    const viewer = {
      ...ctx,
      companyId: () => share.companyId,
      session: () =>
        ({
          role: "company_owner",
          teamIds: [],
          companyId: share.companyId,
          companyName: company?.name ?? "",
          accessToken: "",
          expiresAt: "",
          user: { id: "public-board", name: "Public board", email: "", avatarColor: "#94a3b8" },
        }) as BusinessSession,
    } as BusinessCtx
    const nameDisplay = stricterName(share.nameDisplay, ctx.db.settings[share.companyId]?.leaderboardNameDisplay ?? "first_name_initial")
    const result = computeLeaderboard(viewer, { ...share.query, limit: share.limit }, { nameDisplay, showDepartments: share.showDepartments })
    share.views++
    share.lastViewedAt = new Date().toISOString()
    ctx.save()
    return {
      title: share.title,
      companyName: company?.name ?? "",
      logoInitials: company?.branding.logoInitials ?? "",
      primaryColor: company?.branding.primaryColor ?? "#10b981",
      board: {
        kind: result.kind,
        unit: result.unit,
        valueKind: result.valueKind,
        challengeMetric: result.challengeMetric,
        challengeCustomLabel: result.challengeCustomLabel,
        entries: result.entries.map((e) => ({ ...e, isMe: false, highlight: false })),
        total: result.total,
        periodLabel: result.periodLabel,
        title: result.title,
        minGroupSize: result.minGroupSize,
        hiddenGroups: result.hiddenGroups,
      },
      nameDisplay: result.nameDisplay,
      updatedAt: new Date().toISOString(),
    }
  }),
}
