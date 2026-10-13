/**
 * Platform Admin — Help centre (feature #347): FAQs and troubleshooting articles shown in the
 * employee app's Help centre. Stored in `extra["help-centre"]`, which the employee app reads too.
 * Shape (shared with the employee app — keep in sync): { id, category, title, body, status, order, updatedAt }.
 */
import { audit, badRequest, endpoint, matchesSearch, notFound } from "../core"
import { requireAdmin, type AdminCtx } from "./common"

export interface HelpArticle {
  id: string
  category: string
  title: string
  body: string
  status: "published" | "draft"
  /** Position within its category (1 = first). */
  order: number
  updatedAt: string
}

export const HELP_CATEGORIES = ["Getting started", "Account", "Steps & sync", "Challenges", "Rewards", "Privacy"] as const

export interface HelpQuery {
  search?: string
  category?: string
  status?: HelpArticle["status"] | "all"
}

export interface HelpArticleInput {
  category: string
  title: string
  body: string
  status: HelpArticle["status"]
}

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const SEED: Omit<HelpArticle, "id" | "order" | "updatedAt">[] = [
  { category: "Getting started", title: "How do I join my company on HealthX?", body: "Open the invitation email from your company and tap Join, or choose “Find my company” in the app and enter your company code or work email.\n\nIf your invitation has expired, ask your HR team to resend it.", status: "published" },
  { category: "Getting started", title: "What does HealthX track?", body: "HealthX reads steps, distance, active minutes and workouts from Apple Health or Health Connect once you allow it. You can also log water, habits and workouts in the app.\n\nYour company only ever sees combined figures for groups of 5 or more people.", status: "published" },
  { category: "Account", title: "I didn't receive my invitation or the link has expired", body: "- Check your spam or promotions folder for an email from no-reply@healthx.life.\n- Invitations are valid for 14 days.\n- Ask your HR admin to resend the invitation from the Business Portal.", status: "published" },
  { category: "Account", title: "How do I reset my password?", body: "On the sign-in screen tap “Forgot password?” and enter your work email. We'll send a reset link that works for 30 minutes.\n\nAfter 5 wrong attempts your account is locked for 30 minutes — contact support if you need it unlocked sooner.", status: "published" },
  { category: "Account", title: "How do I delete my account?", body: "Go to Profile → Settings → Privacy & consent → Delete account. Your data is removed after a 30-day grace period. Points you haven't redeemed are lost.", status: "published" },
  { category: "Steps & sync", title: "My steps are missing or not updating", body: "1. Open HealthX and tap “Sync now” on the Activity screen.\n2. Make sure HealthX still has permission to read Steps in Apple Health (Settings → Health → Data Access) or Health Connect (App permissions).\n3. Turn on Background App Refresh (iPhone) or allow background activity (Android).\n4. Check that your phone or wearable is syncing to Apple Health / Health Connect first.\n5. Still missing after 24 hours? Raise a support ticket from Help centre.", status: "published" },
  { category: "Steps & sync", title: "Connecting Apple Health on iPhone", body: "Go to Profile → Health connections → Apple Health and tap Connect. Allow Steps, Distance, Active energy and Workouts.\n\nIf you denied access earlier, open iPhone Settings → Health → Data Access & Devices → HealthX and turn the categories on.", status: "published" },
  { category: "Steps & sync", title: "Connecting Health Connect on Android", body: "Install Health Connect from the Play Store (built in on Android 14+). In HealthX go to Profile → Health connections → Health Connect, tap Connect and allow the requested data types.\n\nMake sure your fitness app (e.g. Google Fit, Samsung Health) also writes to Health Connect.", status: "published" },
  { category: "Steps & sync", title: "Why do my steps differ from my watch?", body: "HealthX uses the combined total from Apple Health or Health Connect, which removes duplicates between your phone and watch. Small differences of a few hundred steps are normal.", status: "draft" },
  { category: "Challenges", title: "How do I join a challenge?", body: "Open Challenges, choose an active or upcoming challenge and tap Join. Some challenges can also be joined with a QR code or short code shared by your HR team.", status: "published" },
  { category: "Challenges", title: "Why can't I see a challenge my colleague joined?", body: "Challenges can be limited to certain departments or teams. If you think you should be included, contact your Wellness Manager or HR.", status: "published" },
  { category: "Rewards", title: "How do points work?", body: "You earn points for steps, workouts, meditation, hitting your water goal, completing challenges and keeping streaks. Daily caps stop unrealistic totals. Points don't expire.", status: "published" },
  { category: "Rewards", title: "My reward voucher hasn't arrived", body: "Most orders need approval from your company first. Track the status in Rewards → My orders. Digital vouchers are emailed within 48 hours of approval. If it's been longer, raise a support ticket with your order number.", status: "published" },
  { category: "Privacy", title: "Can my manager see my steps or health data?", body: "No. Managers and HR only see combined figures for groups of 5 or more people. Your individual health data is never shared with your company.", status: "published" },
  { category: "Privacy", title: "How do I change what I share?", body: "Go to Profile → Privacy & consent. You can withdraw consent for health data, wearable connections, analytics participation and notifications at any time.", status: "published" },
]

/** All help-centre articles (seeded on first use). Other services may read these. */
export function helpArticles(ctx: Pick<AdminCtx, "extra">): HelpArticle[] {
  return ctx.extra<HelpArticle[]>("help-centre", () => {
    const counters: Record<string, number> = {}
    return SEED.map((a, i) => {
      counters[a.category] = (counters[a.category] ?? 0) + 1
      return { ...a, id: `help_${String(i + 1).padStart(3, "0")}`, order: counters[a.category]!, updatedAt: at(60 - i * 3) }
    })
  })
}

/** Link to an article in the employee app (for "Share help article"). */
export const helpArticleLink = (id: string) => `/employee-app/help?article=${encodeURIComponent(id)}`

const categoryRank = (c: string) => {
  const i = (HELP_CATEGORIES as readonly string[]).indexOf(c)
  return i === -1 ? 99 : i
}

const sorted = (list: HelpArticle[]) => [...list].sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category) || a.order - b.order)

/** Renumber `order` 1..n inside one category. */
function renumber(list: HelpArticle[], category: string) {
  sorted(list.filter((a) => a.category === category)).forEach((a, i) => (a.order = i + 1))
}

function validate(ctx: AdminCtx, input: HelpArticleInput, id?: string) {
  const errors: Record<string, string> = {}
  const title = input.title.trim()
  if (title.length < 5) errors.title = "Write a question or title (at least 5 characters)"
  else if (title.length > 140) errors.title = "Keep the title under 140 characters"
  else if (helpArticles(ctx).some((a) => a.id !== id && a.title.trim().toLowerCase() === title.toLowerCase())) errors.title = "An article with this title already exists"
  if (!input.category.trim()) errors.category = "Choose a category"
  if (input.body.trim().length < 20) errors.body = "Write the answer (at least 20 characters)"
  else if (input.body.length > 4000) errors.body = "Keep the answer under 4,000 characters"
  if (Object.keys(errors).length) throw badRequest("Please fix the highlighted fields.", errors)
}

function find(ctx: AdminCtx, id: string) {
  const a = helpArticles(ctx).find((x) => x.id === id)
  if (!a) throw notFound("Article")
  return a
}

export const helpApi = {
  list: endpoint<HelpQuery, HelpArticle[], "admin">("admin", "GET", "/platform/help/articles", (q, ctx) => {
    requireAdmin(ctx)
    return sorted(
      helpArticles(ctx).filter(
        (a) => (!q.category || q.category === "all" || a.category === q.category) && (!q.status || q.status === "all" || a.status === q.status) && matchesSearch(q.search, a.title, a.body, a.category),
      ),
    )
  }),

  create: endpoint<HelpArticleInput, HelpArticle, "admin">("admin", "POST", "/platform/help/articles", (input, ctx) => {
    requireAdmin(ctx, "help.manage")
    validate(ctx, input)
    const list = helpArticles(ctx)
    const article: HelpArticle = {
      id: `help_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      category: input.category.trim(),
      title: input.title.trim(),
      body: input.body.trim(),
      status: input.status,
      order: list.filter((a) => a.category === input.category.trim()).length + 1,
      updatedAt: new Date().toISOString(),
    }
    list.push(article)
    audit(ctx, { action: input.status === "published" ? "Published help article" : "Created help article", entityType: "Help article", entityName: article.title })
    ctx.save()
    return article
  }),

  update: endpoint<HelpArticleInput & { id: string }, HelpArticle, "admin">("admin", "PATCH", "/platform/help/articles/:id", (input, ctx) => {
    requireAdmin(ctx, "help.manage")
    const a = find(ctx, input.id)
    validate(ctx, input, a.id)
    const list = helpArticles(ctx)
    const prevCategory = a.category
    const published = a.status === "draft" && input.status === "published"
    a.title = input.title.trim()
    a.body = input.body.trim()
    a.status = input.status
    if (input.category.trim() !== prevCategory) {
      a.category = input.category.trim()
      a.order = list.filter((x) => x.category === a.category && x.id !== a.id).length + 1
      renumber(list, prevCategory)
    }
    a.updatedAt = new Date().toISOString()
    audit(ctx, { action: published ? "Published help article" : "Updated help article", entityType: "Help article", entityName: a.title })
    ctx.save()
    return a
  }),

  setStatus: endpoint<{ id: string; status: HelpArticle["status"] }, HelpArticle, "admin">("admin", "POST", "/platform/help/articles/:id/status", ({ id, status }, ctx) => {
    requireAdmin(ctx, "help.manage")
    const a = find(ctx, id)
    a.status = status
    a.updatedAt = new Date().toISOString()
    audit(ctx, { action: status === "published" ? "Published help article" : "Unpublished help article", entityType: "Help article", entityName: a.title })
    ctx.save()
    return a
  }),

  move: endpoint<{ id: string; direction: "up" | "down" }, { ok: true }, "admin">("admin", "POST", "/platform/help/articles/:id/move", ({ id, direction }, ctx) => {
    requireAdmin(ctx, "help.manage")
    const a = find(ctx, id)
    const siblings = sorted(helpArticles(ctx).filter((x) => x.category === a.category))
    const i = siblings.findIndex((x) => x.id === a.id)
    const j = direction === "up" ? i - 1 : i + 1
    const other = siblings[j]
    if (!other) return { ok: true }
    ;[a.order, other.order] = [other.order, a.order]
    audit(ctx, { action: "Reordered help articles", entityType: "Help article", entityName: a.category })
    ctx.save()
    return { ok: true }
  }),

  remove: endpoint<{ id: string }, { ok: true }, "admin">("admin", "DELETE", "/platform/help/articles/:id", ({ id }, ctx) => {
    requireAdmin(ctx, "help.manage")
    const a = find(ctx, id)
    const list = helpArticles(ctx)
    list.splice(list.indexOf(a), 1)
    renumber(list, a.category)
    audit(ctx, { action: "Deleted help article", entityType: "Help article", entityName: a.title, severity: "warning" })
    ctx.save()
    return { ok: true }
  }),
}
