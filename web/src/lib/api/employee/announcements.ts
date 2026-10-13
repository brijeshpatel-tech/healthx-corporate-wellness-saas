/**
 * Employee app — company announcements (SCR-M-059 list, SCR-M-060 detail).
 * An employee only sees sent announcements of their own company whose audience includes them.
 * Read state lives in the employee's private data (`readAnnouncementIds`).
 */
import type { Announcement, AnnouncementType, AudienceType, Challenge, ChallengeStatus, Employee } from "@/lib/types"
import { AVATAR_COLORS, DAY_MS, hash } from "@/lib/mock/series"
import { endpoint, notFound, paginate, type MockContext } from "../core"

export type AnnouncementTypeFilter = AnnouncementType | "all"

export interface AnnouncementListItem {
  id: string
  title: string
  /** First ~160 characters of the message. */
  excerpt: string
  type: AnnouncementType
  sentAt: string
  pinned: boolean
  author: string
  read: boolean
  hasLink: boolean
}

export interface AnnouncementList {
  items: AnnouncementListItem[]
  total: number
  page: number
  pageSize: number
  /** Visible announcements per type (ignores the type filter) — for the filter chips. */
  counts: Record<AnnouncementTypeFilter, number>
  unread: number
  companyName: string
}

export interface AnnouncementChallenge {
  id: string
  name: string
  emoji: string
  color: string
  status: ChallengeStatus
  startDate: string
  endDate: string
  points: number
  joined: boolean
}

export interface AnnouncementDetail {
  id: string
  title: string
  body: string
  type: AnnouncementType
  sentAt: string
  pinned: boolean
  author: string
  /** Sender's avatar colour and job title when the author is a colleague. */
  authorColor: string
  authorTitle: string | null
  read: boolean
  companyName: string
  /** Call-to-action: the announcement's own link, else a sensible default for its type. */
  cta: { label: string; href: string } | null
  /** Challenge the announcement is about (from its link, or named in the text). */
  challenge: AnnouncementChallenge | null
  /** Other recent announcements for "More from <company>". */
  more: AnnouncementListItem[]
}

type Ctx = MockContext<"employee">

// ─── Internals ──────────────────────────────────────────────────────────

const READ_SEED_KEY = "emp-announcements-read-seed"

const sentAtOf = (a: Announcement) => a.sentAt ?? a.scheduledAt ?? a.createdAt

function currentEmployee(ctx: Ctx): Employee {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw notFound("Employee")
  return emp
}

function inAudience(target: { audienceType: AudienceType; audienceIds: string[] }, emp: Employee) {
  switch (target.audienceType) {
    case "all":
      return true
    case "departments":
      return target.audienceIds.includes(emp.departmentId)
    case "teams":
      return target.audienceIds.includes(emp.teamId)
    case "selected":
      return target.audienceIds.includes(emp.id)
    default:
      return false
  }
}

/** Sent announcements targeted to the signed-in employee — pinned first, then newest first. */
function visibleAnnouncements(ctx: Ctx) {
  const emp = currentEmployee(ctx)
  const now = Date.now()
  return ctx.db.announcements
    .filter((a) => a.companyId === emp.companyId && a.status === "sent" && new Date(sentAtOf(a)).getTime() <= now && inAudience(a, emp))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || sentAtOf(b).localeCompare(sentAtOf(a)))
}

/**
 * Sample data: an employee who has used the app for a while has already read the older
 * announcements. Runs once per employee so the demo shows a realistic read/unread mix.
 */
function ensureReadSeed(ctx: Ctx) {
  const me = ctx.me()
  const seeded = ctx.extra<Record<string, true>>(READ_SEED_KEY, () => ({}))
  if (seeded[me.employeeId]) return
  seeded[me.employeeId] = true
  const cutoff = Date.now() - 7 * DAY_MS
  for (const a of visibleAnnouncements(ctx)) {
    if (new Date(sentAtOf(a)).getTime() < cutoff && !me.readAnnouncementIds.includes(a.id)) me.readAnnouncementIds.push(a.id)
  }
  ctx.save()
}

function toItem(a: Announcement, readIds: Set<string>): AnnouncementListItem {
  const flat = a.body.replace(/\s+/g, " ").trim()
  return {
    id: a.id,
    title: a.title,
    excerpt: flat.length > 160 ? `${flat.slice(0, 157).trimEnd()}…` : flat,
    type: a.type,
    sentAt: sentAtOf(a),
    pinned: a.pinned,
    author: a.author,
    read: readIds.has(a.id),
    hasLink: Boolean(a.link),
  }
}

function linkedChallenge(ctx: Ctx, a: Announcement, emp: Employee): Challenge | undefined {
  const visible = (c: Challenge) => c.companyId === emp.companyId && c.status !== "draft" && c.status !== "cancelled" && inAudience(c, emp)
  const match = a.link?.href.match(/\/employee-app\/challenges\/([^/?#]+)/)
  if (match) return ctx.db.challenges.find((c) => c.id === decodeURIComponent(match[1]!) && visible(c))
  if (a.type !== "challenge") return undefined
  const text = `${a.title} ${a.body}`.toLowerCase()
  return ctx.db.challenges.filter((c) => visible(c) && (c.status === "active" || c.status === "scheduled")).find((c) => text.includes(c.name.toLowerCase()))
}

const DEFAULT_CTA: Partial<Record<AnnouncementType, { label: string; href: string }>> = {
  challenge: { label: "Browse challenges", href: "/employee-app/challenges" },
  reward: { label: "Browse rewards", href: "/employee-app/rewards" },
  wellness_tip: { label: "More wellness tips", href: "/employee-app/feed" },
}

function unreadCount(ctx: Ctx) {
  const read = new Set(ctx.me().readAnnouncementIds)
  return visibleAnnouncements(ctx).filter((a) => !read.has(a.id)).length
}

// ─── Service ────────────────────────────────────────────────────────────

export const announcementsApi = {
  list: endpoint<{ type?: AnnouncementTypeFilter; page?: number; pageSize?: number } | void, AnnouncementList, "employee">(
    "employee",
    "GET",
    "/announcements",
    (input, ctx) => {
      ensureReadSeed(ctx)
      const emp = currentEmployee(ctx)
      const type = (input && input.type) || "all"
      const all = visibleAnnouncements(ctx)
      const read = new Set(ctx.me().readAnnouncementIds)
      const counts: Record<AnnouncementTypeFilter, number> = { all: all.length, general: 0, wellness_tip: 0, challenge: 0, reward: 0, event: 0 }
      for (const a of all) counts[a.type]++
      const filtered = type === "all" ? all : all.filter((a) => a.type === type)
      const pageSize = Math.min(100, Math.max(1, (input && input.pageSize) || 20))
      const page = Math.max(1, (input && input.page) || 1)
      const paged = paginate(filtered, page, pageSize)
      return {
        items: paged.items.map((a) => toItem(a, read)),
        total: paged.total,
        page,
        pageSize,
        counts,
        unread: all.filter((a) => !read.has(a.id)).length,
        companyName: ctx.db.companies.find((c) => c.id === emp.companyId)?.name ?? "your company",
      }
    },
  ),

  get: endpoint<{ id: string }, AnnouncementDetail, "employee">("employee", "GET", "/announcements/:id", ({ id }, ctx) => {
    ensureReadSeed(ctx)
    const emp = currentEmployee(ctx)
    const all = visibleAnnouncements(ctx)
    const a = all.find((x) => x.id === id)
    if (!a) throw notFound("Announcement")
    const read = new Set(ctx.me().readAnnouncementIds)
    const challenge = linkedChallenge(ctx, a, emp)
    const sender = ctx.db.employees.find((e) => e.companyId === emp.companyId && `${e.firstName} ${e.lastName}` === a.author)
    const cta = a.link
      ? { label: a.link.label, href: a.link.href }
      : challenge
        ? { label: "View challenge", href: `/employee-app/challenges/${challenge.id}` }
        : (DEFAULT_CTA[a.type] ?? null)
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      type: a.type,
      sentAt: sentAtOf(a),
      pinned: a.pinned,
      author: a.author,
      authorColor: sender?.avatarColor ?? AVATAR_COLORS[hash(a.author) % AVATAR_COLORS.length]!,
      authorTitle: sender?.jobTitle ?? null,
      read: read.has(a.id),
      companyName: ctx.db.companies.find((c) => c.id === emp.companyId)?.name ?? "your company",
      cta,
      challenge: challenge
        ? {
            id: challenge.id,
            name: challenge.name,
            emoji: challenge.coverEmoji,
            color: challenge.coverColor,
            status: challenge.status,
            startDate: challenge.startDate,
            endDate: challenge.endDate,
            points: challenge.points,
            joined: ctx.db.participants.some((p) => p.challengeId === challenge.id && p.employeeId === emp.id),
          }
        : null,
      more: all
        .filter((x) => x.id !== a.id)
        .sort((x, y) => sentAtOf(y).localeCompare(sentAtOf(x)))
        .slice(0, 3)
        .map((x) => toItem(x, read)),
    }
  }),

  /** Idempotent. Also clears the push/in-app notification that pointed to this announcement. */
  markRead: endpoint<{ id: string }, { ok: true; unread: number }, "employee">("employee", "POST", "/announcements/:id/read", ({ id }, ctx) => {
    ensureReadSeed(ctx)
    if (!visibleAnnouncements(ctx).some((a) => a.id === id)) throw notFound("Announcement")
    const me = ctx.me()
    if (!me.readAnnouncementIds.includes(id)) me.readAnnouncementIds.push(id)
    const href = `/employee-app/announcements/${id}`
    me.notifications.forEach((n) => {
      if (n.type === "announcement" && n.href === href) n.read = true
    })
    ctx.save()
    return { ok: true, unread: unreadCount(ctx) }
  }),

  markAllRead: endpoint<void, { ok: true; marked: number }, "employee">("employee", "POST", "/announcements/read-all", (_i, ctx) => {
    ensureReadSeed(ctx)
    const me = ctx.me()
    let marked = 0
    for (const a of visibleAnnouncements(ctx)) {
      if (me.readAnnouncementIds.includes(a.id)) continue
      me.readAnnouncementIds.push(a.id)
      marked++
      const href = `/employee-app/announcements/${a.id}`
      me.notifications.forEach((n) => {
        if (n.type === "announcement" && n.href === href) n.read = true
      })
    }
    ctx.save()
    return { ok: true, marked }
  }),

  unreadCount: endpoint<void, { count: number }, "employee">("employee", "GET", "/announcements/unread-count", (_i, ctx) => {
    ensureReadSeed(ctx)
    return { count: unreadCount(ctx) }
  }),
}
