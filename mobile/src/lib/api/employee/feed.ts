// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — Wellness Feed & Content (SCR-M-062, SCR-M-063). Phase 2.
 * The feed is built from real sample data: content library, workouts, the
 * employee's joined challenges, company announcements and earned badges.
 */
import type { Announcement, ContentItem, ContentType, Employee, WellnessProfile } from "@/lib/types"
import { DAY_MS, startOfToday, toLocalDate } from "@/lib/mock/series"
import { ApiError, endpoint, type MockContext } from "../core"

type Ctx = MockContext<"employee">

export type ContentCategory = ContentItem["category"]

export const CONTENT_CATEGORY_LABEL: Record<ContentCategory, string> = {
  movement: "Movement",
  nutrition: "Nutrition",
  sleep: "Sleep",
  mindfulness: "Mindfulness",
  hydration: "Hydration",
  general: "General",
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = { article: "Article", video: "Video", tip: "Tip", link: "Link" }

/** Content summary used by feed cards, lists and "related" rows. */
export interface ContentCard {
  id: string
  type: ContentType
  category: ContentCategory
  title: string
  summary: string
  coverEmoji: string
  coverColor: string
  author: string
  readMinutes: number
  publishedAt?: string
  tags: string[]
  saved: boolean
  /** Published by the employee's company (not HealthX). */
  fromCompany: boolean
  companyName?: string
}

export type ContentBlock = { type: "lead" | "p"; text: string } | { type: "list"; intro?: string; items: string[] }

export interface ContentDetail extends ContentCard {
  body: string
  blocks: ContentBlock[]
  url?: string
  views: number
  /** Video length in seconds (videos only). */
  durationSec?: number
  related: ContentCard[]
}

export interface FeedWorkout {
  id: string
  name: string
  description: string
  durationMin: number
  calories: number
  points: number
  level: string
  location: string
  coverEmoji: string
  coverColor: string
  reason: string
}

export interface FeedChallenge {
  id: string
  name: string
  emoji: string
  color: string
  progress: number
  target: number
  unit: string
  points: number
  rank: number
  participants: number
  daysLeft: number
}

export interface FeedAnnouncement {
  id: string
  title: string
  body: string
  type: Announcement["type"]
  author: string
  sentAt: string
  pinned: boolean
  unread: boolean
}

export interface FeedAchievement {
  badgeId: string
  name: string
  description: string
  icon: string
  color: string
  rarity: string
  points: number
  earnedAt: string
  earnedCount: number
}

export type FeedCard =
  | { kind: "tip"; id: string; content: ContentCard }
  | { kind: "workout"; id: string; workout: FeedWorkout }
  | { kind: "challenge"; id: string; challenge: FeedChallenge }
  | { kind: "announcement"; id: string; announcement: FeedAnnouncement }
  | { kind: "article"; id: string; content: ContentCard }
  | { kind: "achievement"; id: string; achievement: FeedAchievement }

export interface WellnessFeed {
  date: string
  generatedAt: string
  firstName: string
  goalLabel: string
  cards: FeedCard[]
  savedCount: number
}

export interface ContentQuery {
  category?: ContentCategory | "all"
  type?: ContentType | "all"
  q?: string
}

const GOAL_CATEGORIES: Record<WellnessProfile["mainGoal"], ContentCategory[]> = {
  lose_weight: ["nutrition", "movement"],
  stay_active: ["movement", "hydration"],
  build_strength: ["movement", "nutrition"],
  reduce_stress: ["mindfulness", "sleep"],
  sleep_better: ["sleep", "mindfulness"],
  eat_healthier: ["nutrition", "hydration"],
}

export const GOAL_LABEL: Record<WellnessProfile["mainGoal"], string> = {
  lose_weight: "Lose weight",
  stay_active: "Stay active",
  build_strength: "Build strength",
  reduce_stress: "Reduce stress",
  sleep_better: "Sleep better",
  eat_healthier: "Eat healthier",
}

const UNIT: Record<string, string> = { steps: "steps", distance: "km", calories: "kcal", active_minutes: "min", workouts: "workouts", water: "ml", meditation: "min", custom: "check-ins" }

// ─── Helpers ────────────────────────────────────────────────────────────

function myEmployee(ctx: Ctx): Employee {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw new ApiError("Your session has expired. Please sign in again.", 401, "unauthorized")
  return emp
}

/** Day number used to rotate picks once a day. */
const dayNumber = () => Math.round(startOfToday().getTime() / DAY_MS)

function rotate<T>(items: T[], by: number) {
  if (!items.length) return items
  const k = ((by % items.length) + items.length) % items.length
  return [...items.slice(k), ...items.slice(0, k)]
}

/** Published content this employee may see (HealthX library + own company). */
function visibleContent(ctx: Ctx) {
  const emp = myEmployee(ctx)
  return ctx.db.content.filter((c) => c.status === "published" && (c.companyId === null || c.companyId === emp.companyId))
}

function toCard(ctx: Ctx, c: ContentItem): ContentCard {
  const me = ctx.me()
  const company = c.companyId ? ctx.db.companies.find((x) => x.id === c.companyId) : undefined
  return {
    id: c.id,
    type: c.type,
    category: c.category,
    title: c.title,
    summary: c.summary,
    coverEmoji: c.coverEmoji,
    coverColor: c.coverColor,
    author: c.author,
    readMinutes: c.readMinutes,
    publishedAt: c.publishedAt,
    tags: c.tags,
    saved: me.bookmarks.includes(c.id),
    fromCompany: c.companyId !== null,
    companyName: company?.name,
  }
}

const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/**
 * Turns plain body text into readable blocks: a lead sentence, short paragraphs,
 * and "X: a, b, c and d." sentences as bullet lists.
 */
export function toBlocks(body: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  paragraphs.forEach((para, pi) => {
    const sentences = para.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).filter(Boolean)
    let buffer: string[] = []
    const flush = () => {
      if (buffer.length) blocks.push({ type: "p", text: buffer.join(" ") })
      buffer = []
    }
    sentences.forEach((s, si) => {
      const list = /^(.{8,}?):\s*(.+?)[.!]?$/.exec(s)
      if (list && /,/.test(list[2]!) && / and | or /.test(list[2]!)) {
        flush()
        const items = list[2]!
          .split(/,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/)
          .map((x) => capitalise(x.trim()))
          .filter(Boolean)
        blocks.push({ type: "list", intro: `${list[1]}:`, items })
        return
      }
      if (pi === 0 && si === 0) {
        blocks.push({ type: "lead", text: s })
        return
      }
      buffer.push(s)
      if (buffer.length === 2) flush()
    })
    flush()
  })
  return blocks
}

function audienceIncludes(a: Pick<Announcement, "audienceType" | "audienceIds">, emp: Employee) {
  switch (a.audienceType) {
    case "all":
      return true
    case "departments":
      return a.audienceIds.includes(emp.departmentId)
    case "teams":
      return a.audienceIds.includes(emp.teamId)
    case "selected":
      return a.audienceIds.includes(emp.id)
    default:
      return false
  }
}

function contentDetail(ctx: Ctx, id: string): ContentDetail {
  const all = visibleContent(ctx)
  const item = all.find((c) => c.id === id)
  if (!item) throw new ApiError("This content is unavailable.", 404, "not_found")
  const sameCategory = all.filter((c) => c.id !== id && c.category === item.category && c.type !== "tip")
  const others = rotate(
    all.filter((c) => c.id !== id && c.category !== item.category && c.type !== "tip"),
    dayNumber(),
  )
  const related = [...sameCategory, ...others].slice(0, 3).map((c) => toCard(ctx, c))
  return {
    ...toCard(ctx, item),
    body: item.body,
    blocks: toBlocks(item.body),
    url: item.url,
    views: item.views,
    durationSec: item.type === "video" ? Math.max(60, item.readMinutes * 60) : undefined,
    related,
  }
}

// ─── Feed builder ───────────────────────────────────────────────────────

function buildFeed(ctx: Ctx): WellnessFeed {
  const me = ctx.me()
  const emp = myEmployee(ctx)
  const now = new Date()
  const today = toLocalDate(now)
  const day = dayNumber()
  const content = visibleContent(ctx)
  const cards: FeedCard[] = []

  // 1. Today's tip — a published tip, rotated by day
  const tips = content.filter((c) => c.type === "tip")
  const tip = tips.length ? tips[day % tips.length]! : undefined
  if (tip) cards.push({ kind: "tip", id: `tip-${tip.id}`, content: toCard(ctx, tip) })

  // 2. Today's workout — matches the workout location preference, not done in the last 7 days
  const weekAgo = now.getTime() - 7 * DAY_MS
  const recent = new Set(me.workoutSessions.filter((s) => s.completed && new Date(s.completedAt ?? s.startedAt).getTime() >= weekAgo).map((s) => s.workoutId))
  const published = ctx.db.workouts.filter((w) => w.status === "published" && (w.companyId === null || w.companyId === emp.companyId))
  const pref = me.preferences.workoutLocation
  const byLocation = published.filter((w) => pref === "any" || w.location === pref)
  const pool = (byLocation.length ? byLocation : published).filter((w) => !recent.has(w.id))
  const ranked = [...(pool.length ? pool : byLocation.length ? byLocation : published)].sort(
    (a, b) => Math.abs(a.durationMin - me.preferences.workoutDurationMin) - Math.abs(b.durationMin - me.preferences.workoutDurationMin),
  )
  const workout = rotate(ranked.slice(0, 4), day)[0]
  if (workout) {
    const where = pref === "any" ? "anywhere" : pref === "gym" ? "the gym" : pref
    cards.push({
      kind: "workout",
      id: `workout-${workout.id}`,
      workout: {
        id: workout.id,
        name: workout.name,
        description: workout.description,
        durationMin: workout.durationMin,
        calories: workout.calories,
        points: workout.points,
        level: workout.level,
        location: workout.location,
        coverEmoji: workout.coverEmoji,
        coverColor: workout.coverColor,
        reason: [
          pref === "any" ? "Picked for you" : `Matches your ${where === "the gym" ? "gym" : where} workouts`,
          Math.abs(workout.durationMin - me.preferences.workoutDurationMin) <= 5 ? `about your usual ${me.preferences.workoutDurationMin} min` : null,
          recent.has(workout.id) ? null : "not done this week",
        ]
          .filter(Boolean)
          .join(" · "),
      },
    })
  }

  // 3. Current challenge — best active challenge the employee has joined
  const joined = ctx.db.participants
    .filter((p) => p.employeeId === emp.id)
    .map((p) => ({ p, c: ctx.db.challenges.find((c) => c.id === p.challengeId) }))
    .filter((x): x is { p: (typeof x)["p"]; c: NonNullable<(typeof x)["c"]> } => !!x.c && x.c.status === "active")
    .sort((a, b) => b.p.progress / b.c.target - a.p.progress / a.c.target)
  const best = joined[0]
  if (best) {
    cards.push({
      kind: "challenge",
      id: `challenge-${best.c.id}`,
      challenge: {
        id: best.c.id,
        name: best.c.name,
        emoji: best.c.coverEmoji,
        color: best.c.coverColor,
        progress: best.p.progress,
        target: best.c.target,
        unit: best.c.customMetricLabel ?? UNIT[best.c.metric] ?? "",
        points: best.c.points,
        rank: best.p.rank,
        participants: best.c.participantsCount,
        daysLeft: Math.max(0, Math.round((new Date(best.c.endDate).getTime() - new Date(today).getTime()) / DAY_MS)),
      },
    })
  }

  // 4. Company announcement — latest sent announcement for this employee's audience
  const announcement = ctx.db.announcements
    .filter((a) => a.companyId === emp.companyId && a.status === "sent" && audienceIncludes(a, emp))
    .sort((a, b) => (b.sentAt ?? b.createdAt).localeCompare(a.sentAt ?? a.createdAt))[0]
  if (announcement) {
    cards.push({
      kind: "announcement",
      id: `announcement-${announcement.id}`,
      announcement: {
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        type: announcement.type,
        author: announcement.author,
        sentAt: announcement.sentAt ?? announcement.createdAt,
        pinned: announcement.pinned,
        unread: !me.readAnnouncementIds.includes(announcement.id),
      },
    })
  }

  // 5. Wellness articles — prefer categories that match the main goal, rotated daily
  const preferred = GOAL_CATEGORIES[me.profile.mainGoal] ?? []
  const readable = content.filter((c) => c.type !== "tip")
  const matching = rotate(
    readable.filter((c) => preferred.includes(c.category)),
    day,
  )
  const rest = rotate(
    readable.filter((c) => !preferred.includes(c.category)),
    day,
  )
  const articles = [...matching.slice(0, 2), ...rest.slice(0, 1), ...matching.slice(2), ...rest.slice(1)].slice(0, 3)

  // 6. Achievement — latest earned badge
  const earned = me.badges
    .filter((b) => b.earnedAt)
    .sort((a, b) => b.earnedAt!.localeCompare(a.earnedAt!))
    .map((b) => ({ ub: b, def: ctx.db.badges.find((d) => d.id === b.badgeId) }))
    .find((x) => x.def)

  // Order: tip, workout, challenge, announcement, article, achievement, more articles
  const [firstArticle, ...moreArticles] = articles
  if (firstArticle) cards.push({ kind: "article", id: `article-${firstArticle.id}`, content: toCard(ctx, firstArticle) })
  if (earned?.def) {
    cards.push({
      kind: "achievement",
      id: `badge-${earned.def.id}`,
      achievement: {
        badgeId: earned.def.id,
        name: earned.def.name,
        description: earned.def.description,
        icon: earned.def.icon,
        color: earned.def.color,
        rarity: earned.def.rarity,
        points: earned.def.points,
        earnedAt: earned.ub.earnedAt!,
        earnedCount: earned.def.earnedCount,
      },
    })
  }
  moreArticles.forEach((a) => cards.push({ kind: "article", id: `article-${a.id}`, content: toCard(ctx, a) }))

  return {
    date: today,
    generatedAt: now.toISOString(),
    firstName: emp.firstName,
    goalLabel: GOAL_LABEL[me.profile.mainGoal] ?? "Stay active",
    cards,
    savedCount: me.bookmarks.filter((id) => content.some((c) => c.id === id)).length,
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export const feedApi = {
  /** SCR-M-062 — personalised cards, refreshed daily. */
  feed: endpoint<void, WellnessFeed, "employee">("employee", "GET", "/me/feed", (_i, ctx) => buildFeed(ctx)),

  /** Content library (published only) for the Explore tab. */
  library: endpoint<ContentQuery, ContentCard[], "employee">("employee", "GET", "/content", (q, ctx) => {
    const search = q.q?.trim().toLowerCase()
    return visibleContent(ctx)
      .filter((c) => !q.category || q.category === "all" || c.category === q.category)
      .filter((c) => !q.type || q.type === "all" || c.type === q.type)
      .filter((c) => !search || c.title.toLowerCase().includes(search) || c.summary.toLowerCase().includes(search) || c.tags.some((t) => t.toLowerCase().includes(search)))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((c) => toCard(ctx, c))
  }),

  /** SCR-M-063 — one published item. Drafts / archived / other companies → 'This content is unavailable.' */
  content: endpoint<{ id: string }, ContentDetail, "employee">("employee", "GET", "/content/:id", ({ id }, ctx) => contentDetail(ctx, id)),

  saved: endpoint<void, ContentCard[], "employee">("employee", "GET", "/me/saved-content", (_i, ctx) => {
    const me = ctx.me()
    const content = visibleContent(ctx)
    // Most recently saved first (bookmarks are appended).
    return [...me.bookmarks]
      .reverse()
      .map((id) => content.find((c) => c.id === id))
      .filter((c): c is ContentItem => !!c)
      .map((c) => toCard(ctx, c))
  }),

  save: endpoint<{ id: string }, { id: string; saved: true }, "employee">("employee", "POST", "/me/saved-content/:id", ({ id }, ctx) => {
    if (!visibleContent(ctx).some((c) => c.id === id)) throw new ApiError("This content is unavailable.", 404, "not_found")
    const me = ctx.me()
    if (!me.bookmarks.includes(id)) me.bookmarks.push(id)
    ctx.save()
    return { id, saved: true }
  }),

  unsave: endpoint<{ id: string }, { id: string; saved: false }, "employee">("employee", "DELETE", "/me/saved-content/:id", ({ id }, ctx) => {
    const me = ctx.me()
    me.bookmarks = me.bookmarks.filter((b) => b !== id)
    ctx.save()
    return { id, saved: false }
  }),
}
