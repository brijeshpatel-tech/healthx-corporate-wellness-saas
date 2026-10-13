/** Business Portal — help & admin video tutorials (#373, Phase 2). */
import type { BusinessSession } from "@/lib/auth/session"
import type { BusinessRole } from "@/lib/types"
import { endpoint, notFound } from "../core"

export type TutorialCategory = "Getting started" | "People" | "Challenges" | "Rewards" | "Analytics" | "Settings"

export interface Tutorial {
  id: string
  title: string
  description: string
  durationSec: number
  category: TutorialCategory
  gradient: [string, string]
  emoji: string
  chapters: { at: number; label: string }[]
  roles?: BusinessRole[]
  watched: boolean
}

export interface Faq {
  id: string
  category: TutorialCategory
  question: string
  answer: string
}

const O: BusinessRole = "company_owner"
const H: BusinessRole = "hr_admin"
const W: BusinessRole = "wellness_manager"
const T: BusinessRole = "team_manager"

const TUTORIALS: Omit<Tutorial, "watched">[] = [
  { id: "tut_welcome", title: "Welcome to the Business Portal", description: "A 3-minute tour of the dashboard, menus and where everything lives.", durationSec: 192, category: "Getting started", gradient: ["#10b981", "#0ea5e9"], emoji: "👋", chapters: [{ at: 0, label: "The dashboard" }, { at: 70, label: "Menus by role" }, { at: 140, label: "Privacy rules" }] },
  { id: "tut_setup", title: "Set up your organisation in 10 minutes", description: "Branding, departments, teams and company settings — in the right order.", durationSec: 548, category: "Getting started", gradient: ["#6366f1", "#8b5cf6"], emoji: "🏢", roles: [O, H], chapters: [{ at: 0, label: "Organisation profile" }, { at: 120, label: "Branding" }, { at: 260, label: "Departments & teams" }, { at: 420, label: "Company settings" }] },
  { id: "tut_invite", title: "Invite employees one by one or by CSV", description: "Send invitations, import a spreadsheet and fix rows that need attention.", durationSec: 305, category: "People", gradient: ["#0ea5e9", "#14b8a6"], emoji: "✉️", roles: [O, H], chapters: [{ at: 0, label: "Invite one person" }, { at: 95, label: "Import a CSV" }, { at: 210, label: "Resend & revoke" }] },
  { id: "tut_sync", title: "Help employees fix tracker and sync issues", description: "Use Tracker & sync to find people who haven't connected, and send reminders.", durationSec: 236, category: "People", gradient: ["#f59e0b", "#f97316"], emoji: "🔄", roles: [O, H], chapters: [{ at: 0, label: "Issue filters" }, { at: 90, label: "Send reminders" }, { at: 170, label: "Excused dates" }] },
  { id: "tut_challenge", title: "Create your first challenge", description: "Pick a template, set the target and audience, and attach points and prizes.", durationSec: 412, category: "Challenges", gradient: ["#8b5cf6", "#ec4899"], emoji: "🏆", roles: [O, H, W], chapters: [{ at: 0, label: "Templates" }, { at: 110, label: "Metric & target" }, { at: 230, label: "Participants" }, { at: 330, label: "Points & prizes" }] },
  { id: "tut_leaderboards", title: "Leaderboards and name privacy", description: "How rankings work and how to choose full names, initials or anonymous.", durationSec: 178, category: "Challenges", gradient: ["#14b8a6", "#10b981"], emoji: "🥇", chapters: [{ at: 0, label: "Company, department & team boards" }, { at: 100, label: "Name privacy" }] },
  { id: "tut_rewards", title: "Approve and fulfil reward orders", description: "Review pending orders, add voucher codes and notify employees.", durationSec: 264, category: "Rewards", gradient: ["#f43f5e", "#f97316"], emoji: "🎁", roles: [O, H], chapters: [{ at: 0, label: "Pending approval" }, { at: 120, label: "Fulfilment" }, { at: 200, label: "Cancel & refund" }] },
  { id: "tut_analytics", title: "Read your analytics without seeing health data", description: "Adoption, participation and low-participation alerts — all aggregated.", durationSec: 331, category: "Analytics", gradient: ["#0ea5e9", "#6366f1"], emoji: "📊", roles: [O, H, W], chapters: [{ at: 0, label: "Definitions" }, { at: 120, label: "Departments" }, { at: 230, label: "Exports" }] },
  { id: "tut_myteam", title: "Your team at a glance (Team Managers)", description: "Track your team's participation, challenge progress and leaderboard position.", durationSec: 156, category: "Analytics", gradient: ["#84cc16", "#10b981"], emoji: "👥", roles: [T], chapters: [{ at: 0, label: "Team KPIs" }, { at: 80, label: "Team leaderboard" }] },
  { id: "tut_integrations", title: "Connect your HRMS, Slack or Teams", description: "Automate joiners and leavers, and share wellness wins in your channels.", durationSec: 389, category: "Settings", gradient: ["#334155", "#0ea5e9"], emoji: "🔌", roles: [O, H], chapters: [{ at: 0, label: "HRMS methods" }, { at: 200, label: "Slack & Teams" }] },
]

const FAQS: Faq[] = [
  { id: "faq_1", category: "Getting started", question: "Can we see an individual employee's steps, sleep or water?", answer: "No. Company administrators only ever see combined figures for groups of 5 or more people. Individual totals appear only on leaderboards, under your name-privacy setting." },
  { id: "faq_2", category: "Analytics", question: "How do you define an active employee and participation?", answer: "An active employee has logged a wellness activity or signed in during the selected period. Participation = active employees ÷ eligible employees × 100." },
  { id: "faq_3", category: "People", question: "An employee says their steps are missing. What should I do?", answer: "Open Tracker & sync, find the person and check their health-app connection and last sync. Send a reminder — it asks them to open HealthX and tap “Sync now”. You can also mark sick days under Excused dates." },
  { id: "faq_4", category: "People", question: "What happens when I deactivate someone?", answer: "They can no longer sign in. Their points and history are kept, and you can reactivate them later. The Company Owner can't be deactivated — transfer ownership first." },
  { id: "faq_5", category: "Rewards", question: "Do points expire?", answer: "No. Points never expire, and every reward order needs approval by an HR Admin or the Company Owner before it's fulfilled." },
  { id: "faq_6", category: "Challenges", question: "Can I change a challenge after it starts?", answer: "No — to keep things fair, scoring rules, dates and targets lock once a challenge starts. You can still cancel or end it." },
  { id: "faq_7", category: "Settings", question: "How long is the free trial?", answer: "30 days, with every feature in the Growth plan. Contact HealthX from Subscription & invoices to choose a plan before it ends." },
  { id: "faq_8", category: "Settings", question: "Who can change company settings and branding?", answer: "Only the Company Owner. HR Admins manage people, notifications and integrations; Wellness Managers run challenges, programmes and content." },
]

const watchedStore = (ctx: { extra: <T>(key: string, init: () => T) => T }) => ctx.extra<Record<string, string[]>>("biz-help-watched", () => ({}))

export const helpApi = {
  content: endpoint<void, { tutorials: Tutorial[]; faqs: Faq[] }, "business">("business", "GET", "/help/admin", (_i, ctx) => {
    const session = ctx.session() as BusinessSession
    const watched = new Set(watchedStore(ctx)[session.user.id] ?? [])
    return {
      tutorials: TUTORIALS.filter((t) => !t.roles || t.roles.includes(session.role)).map((t) => ({ ...t, watched: watched.has(t.id) })),
      faqs: FAQS,
    }
  }),

  markWatched: endpoint<{ id: string }, { ok: true }, "business">("business", "POST", "/help/tutorials/:id/watched", ({ id }, ctx) => {
    const session = ctx.session() as BusinessSession
    if (!TUTORIALS.some((t) => t.id === id)) throw notFound("Tutorial")
    const store = watchedStore(ctx)
    store[session.user.id] = [...new Set([...(store[session.user.id] ?? []), id])]
    ctx.save()
    return { ok: true }
  }),
}
