// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Employee app — Help centre & support tickets (SCR-M-080, scope #347) and app status (SCR-M-081).
 * Articles are public; support tickets are scoped to the signed-in employee.
 */
import type { SupportTicket } from "@/lib/types"
import { badRequest, endpoint, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Help-centre article (FAQ or troubleshooting guide). Shared with the Platform Admin
 * help-centre manager through `ctx.extra("help-centre")` — employees only see `published` ones.
 */
export interface HelpArticle {
  id: string
  category: string
  title: string
  /** Plain text. Blank lines separate paragraphs; lines starting "1." … form numbered steps. */
  body: string
  status: "published" | "draft"
  order: number
  updatedAt: string
}

/** Display order and icons of the standard categories (unknown categories follow, A–Z). */
export const HELP_CATEGORIES: { value: string; emoji: string }[] = [
  { value: "Account", emoji: "👤" },
  { value: "Steps & sync", emoji: "👟" },
  { value: "Challenges", emoji: "🏆" },
  { value: "Rewards", emoji: "🎁" },
  { value: "Privacy", emoji: "🔒" },
]

export type SupportCategory = SupportTicket["category"]

export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: "account", label: "Account & sign-in" },
  { value: "technical", label: "Steps, syncing or a bug" },
  { value: "rewards", label: "Points, rewards & orders" },
  { value: "other", label: "Something else" },
]

export interface CreateTicketInput {
  subject: string
  category: SupportCategory
  description: string
  screenshotName?: string
}

export interface TicketMessage {
  from: string
  body: string
  at: string
  /** true when sent by the employee. */
  mine: boolean
}

export interface MyTicket {
  id: string
  number: string
  subject: string
  category: SupportCategory
  status: SupportTicket["status"]
  createdAt: string
  updatedAt: string
  /** Latest reply from the support team, if any. */
  lastReply?: { from: string; body: string; at: string }
  replies: number
  /** Full thread (internal notes excluded). */
  messages: TicketMessage[]
}

export interface AppConfig {
  maintenance: boolean
  /** Local time maintenance ends, e.g. "02:00". */
  maintenanceUntil: string
  latestVersion: string
  minVersion: string
  supportEmail: string
}

// ─── Default help-centre content ───────────────────────────────────────

const ARTICLES: Omit<HelpArticle, "id" | "status" | "updatedAt">[] = [
  // Account
  { category: "Account", order: 1, title: "How do I change my email or phone number?", body: "Go to Profile → Basic details and enter the new email or number. We'll send a one-time code to confirm it's yours before anything changes." },
  { category: "Account", order: 2, title: "I can't sign in", body: "1. Check you're using your work email or the company code from your invitation.\n2. Use 'Email me a sign-in link' if you've forgotten your password.\n3. Still stuck? Raise a support ticket below and tell us the email you use." },
  { category: "Account", order: 3, title: "What happens if I leave my company?", body: "Your company deactivates your HealthX account. Your personal data is then deleted or anonymised according to the retention policy." },
  { category: "Account", order: 4, title: "How do I delete my account?", body: "Go to Settings → Delete account. Your account is deactivated straight away and your personal data is deleted within 30 days." },
  // Steps & sync (incl. troubleshooting guides)
  { category: "Steps & sync", order: 1, title: "Troubleshooting: my steps are missing or too low", body: "1. Open Settings → Connected apps and tap 'Sync now'.\n2. Make sure HealthX is allowed to read Steps in Apple Health or Health Connect.\n3. Open the Health app on your phone once — some phones only update when it's opened.\n4. Turn off battery-saver mode, which can pause background syncing.\n\nSteps from the last 7 days are picked up automatically once syncing works again." },
  { category: "Steps & sync", order: 2, title: "Troubleshooting: my tracker won't connect", body: "1. Update the HealthX app and your phone's software.\n2. In Settings → Connected apps, tap 'Connect' and allow every data type on the permission screen.\n3. If you denied access before, open your phone's Health settings → Apps → HealthX and turn the permissions back on.\n4. Disconnect and reconnect if the status still shows 'Sync error'." },
  { category: "Steps & sync", order: 3, title: "Troubleshooting: 'Sync error' or data stopped updating", body: "1. Check you're online, then tap 'Sync now'.\n2. If it shows 'Sync failed – tap to reconnect', tap it and confirm the permissions.\n3. Still not working after an hour? Raise a support ticket — include your phone model and the app you use." },
  { category: "Steps & sync", order: 4, title: "Which apps and devices can I connect?", body: "Apple Health on iPhone and Health Connect on Android. You can also connect a Fitbit or Garmin account." },
  { category: "Steps & sync", order: 5, title: "Can I add an activity manually?", body: "Yes — go to Activity and tap 'Log activity'. Your company may need to approve manual entries before they earn points." },
  // Challenges
  { category: "Challenges", order: 1, title: "How do I join a challenge?", body: "Open the Challenges tab, pick a challenge and tap 'Join'. You can also join with a code or link from your company. Your progress counts from the moment you join." },
  { category: "Challenges", order: 2, title: "How are leaderboards calculated?", body: "Leaderboards rank people or teams on the challenge metric (for example total steps) for the challenge period. They refresh every few minutes." },
  { category: "Challenges", order: 3, title: "Can I appear anonymously on leaderboards?", body: "If your company allows it, go to Settings → Privacy & consent and turn on 'Appear as Anonymous on leaderboards'. You'll still see your own rank." },
  // Rewards
  { category: "Rewards", order: 1, title: "How do I earn points?", body: "You earn points for steps, reaching your water goal, finishing workouts, streaks, badges and challenges. The same activity never earns points twice." },
  { category: "Rewards", order: 2, title: "Do my points expire?", body: "No — your points never expire." },
  { category: "Rewards", order: 3, title: "How do I redeem a reward?", body: "Go to Rewards, choose an item and tap 'Redeem'. Your company approves the order, then you can follow it in My orders." },
  { category: "Rewards", order: 4, title: "My reward hasn't arrived", body: "Check the status in My orders. If it's been more than 10 working days since it was approved, raise a support ticket with your order number." },
  // Privacy
  { category: "Privacy", order: 1, title: "Can HR or my manager see my health data?", body: "No. HR can see whether your account is active and which challenges you joined, but never your individual steps, water, sleep, weight or workouts — only combined figures for groups of 5 or more people." },
  { category: "Privacy", order: 2, title: "How do I download my data?", body: "Go to Settings → Privacy & consent → Download my data. We'll prepare a file with everything we hold about you." },
  { category: "Privacy", order: 3, title: "How do I withdraw a consent?", body: "Open Settings → Privacy & consent and switch the consent off. The change takes effect immediately and is saved in your consent history." },
]

function defaultArticles(): HelpArticle[] {
  const updatedAt = "2026-10-01T09:00:00.000Z"
  return ARTICLES.map((a, i) => ({ ...a, id: `help_${i + 1}`, status: "published", updatedAt }))
}

/** Help-centre articles shared with the Platform Admin manager (seeded with defaults when missing or empty). */
function articles(ctx: Ctx): HelpArticle[] {
  const list = ctx.extra<HelpArticle[]>("help-centre", defaultArticles)
  if (!Array.isArray(list) || list.length === 0) {
    const seeded = defaultArticles()
    ctx.db.extra["help-centre"] = seeded
    ctx.save()
    return seeded
  }
  return list
}

const categoryRank = (c: string) => {
  const i = HELP_CATEGORIES.findIndex((x) => x.value.toLowerCase() === c.toLowerCase())
  return i === -1 ? HELP_CATEGORIES.length : i
}

// ─── Helpers ────────────────────────────────────────────────────────────

function requester(ctx: Ctx) {
  const s = ctx.session()
  const emp = ctx.db.employees.find((e) => e.id === s.user.id)
  if (!emp) throw notFound("Employee")
  return { emp, name: `${emp.firstName} ${emp.lastName}` }
}

const toMine = (t: SupportTicket, me: string): MyTicket => {
  const visible = t.messages.filter((m) => !m.internal)
  const replies = visible.filter((m) => m.from !== me)
  const reply = replies[replies.length - 1]
  return {
    id: t.id,
    number: t.number,
    subject: t.subject,
    category: t.category,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastReply: reply ? { from: reply.from, body: reply.body, at: reply.at } : undefined,
    replies: replies.length,
    messages: visible.map((m) => ({ from: m.from, body: m.body, at: m.at, mine: m.from === me })),
  }
}

function ownTicket(ctx: Ctx, id: string) {
  const { emp, name } = requester(ctx)
  const t = ctx.db.supportTickets.find((x) => x.id === id && x.companyId === emp.companyId && x.requester === name)
  if (!t) throw notFound("Support ticket")
  return { t, name }
}

// ─── Service ────────────────────────────────────────────────────────────

export const supportApi = {
  /** Published help-centre articles (FAQs + troubleshooting guides), grouped by category order. */
  articles: endpoint<void, HelpArticle[], "employee">("employee", "GET", "/help/articles", (_i, ctx) =>
    articles(ctx)
      .filter((a) => a.status === "published")
      .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.category.localeCompare(b.category) || a.order - b.order),
  ),

  /** The signed-in employee's own support tickets. */
  myTickets: endpoint<void, MyTicket[], "employee">("employee", "GET", "/support/tickets", (_i, ctx) => {
    const { emp, name } = requester(ctx)
    return ctx.db.supportTickets
      .filter((t) => t.companyId === emp.companyId && t.requester === name)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => toMine(t, name))
  }),

  ticket: endpoint<{ id: string }, MyTicket, "employee">("employee", "GET", "/support/tickets/:id", ({ id }, ctx) => {
    const { t, name } = ownTicket(ctx, id)
    return toMine(t, name)
  }),

  /** Raise a support ticket (FRM-68). */
  createTicket: endpoint<CreateTicketInput, MyTicket, "employee">("employee", "POST", "/support/tickets", (input, ctx) => {
    const errors: Record<string, string> = {}
    const subject = (input.subject ?? "").trim()
    const description = (input.description ?? "").trim()
    if (subject.length < 5) errors.subject = "Add a short subject (at least 5 characters)"
    else if (subject.length > 120) errors.subject = "Use 120 characters or fewer"
    if (!SUPPORT_CATEGORIES.some((c) => c.value === input.category)) errors.category = "Choose a category"
    if (description.length < 20) errors.description = "Tell us a little more (at least 20 characters)"
    else if (description.length > 2000) errors.description = "Use 2,000 characters or fewer"
    if (Object.keys(errors).length) throw badRequest(Object.values(errors)[0]!, errors)
    const { emp, name } = requester(ctx)
    const max = ctx.db.supportTickets.reduce((m, t) => Math.max(m, Number(t.number.replace(/\D/g, "")) || 0), 3100)
    const now = new Date().toISOString()
    const ticket: SupportTicket = {
      id: newId("tkt"),
      number: `SUP-${max + 1}`,
      companyId: emp.companyId,
      subject,
      requester: name,
      priority: "medium",
      status: "open",
      category: input.category,
      createdAt: now,
      updatedAt: now,
      messages: [
        { from: name, body: description, at: now },
        ...(input.screenshotName ? [{ from: name, body: `Screenshot attached: ${input.screenshotName}`, at: now }] : []),
      ],
    }
    ctx.db.supportTickets.unshift(ticket)
    ctx.save()
    return toMine(ticket, name)
  }),

  /** Add a message to one of the employee's tickets (re-opens resolved tickets). */
  reply: endpoint<{ id: string; body: string }, MyTicket, "employee">("employee", "POST", "/support/tickets/:id/messages", ({ id, body }, ctx) => {
    const text = (body ?? "").trim()
    if (text.length < 2) throw badRequest("Write a message first.", { body: "Write a message first" })
    if (text.length > 2000) throw badRequest("Use 2,000 characters or fewer.", { body: "Use 2,000 characters or fewer" })
    const { t, name } = ownTicket(ctx, id)
    if (t.status === "closed") throw badRequest("This ticket is closed. Raise a new ticket if you still need help.")
    const now = new Date().toISOString()
    t.messages.push({ from: name, body: text, at: now })
    t.updatedAt = now
    if (t.status === "resolved" || t.status === "pending") t.status = "open"
    ctx.save()
    return toMine(t, name)
  }),

  /** App configuration incl. the maintenance flag (SCR-M-081). Works signed out. */
  appConfig: endpoint<void, AppConfig, "employee">("employee", "GET", "/app/config", () => ({
    maintenance: false,
    maintenanceUntil: "02:00",
    latestVersion: "1.0.0",
    minVersion: "1.0.0",
    supportEmail: "support@healthx.life",
  })),
}
