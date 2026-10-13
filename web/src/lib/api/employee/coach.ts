/**
 * Employee app — AI Wellness Coach (SCR-M-066 consent, SCR-M-067 chat, SCR-M-068 7-day plan). Phase 2.
 *
 * Mock mode: answers are rule-based but personalised from the employee's OWN data
 * (ctx.me()). Nothing here is ever visible to HR or colleagues. The coach never
 * diagnoses or gives medical advice — medical topics get a safe redirect.
 */
import type { AIMessage, AIWellnessPlanDay, ConsentKey, ContentItem, Employee, Workout, WellnessScoreWeights } from "@/lib/types"
import { DAY_MS, noise, toLocalDate } from "@/lib/mock/series"
import { ApiError, badRequest, endpoint, forbidden, newId, notFound, type MockContext } from "../core"

type Ctx = MockContext<"employee">

// ─── Types ──────────────────────────────────────────────────────────────

export const COACH_DAILY_LIMIT = 30
export const COACH_MAX_CHARS = 1000

export const COACH_SUGGESTIONS = [
  "How can I improve my wellness score?",
  "Give me a 20-minute workout.",
  "What should I eat for lunch?",
  "How can I improve my sleep?",
  "Create a 7-day wellness plan.",
]

export interface CoachAccess {
  /** The company has switched the AI coach on. */
  enabled: boolean
  /** AI personalisation consent granted. */
  granted: boolean
  version: string
  updatedAt?: string
  firstName: string
  companyName: string
  dailyLimit: number
  usedToday: number
  hasPlan: boolean
}

export type CoachLinkIcon = "steps" | "water" | "sleep" | "habits" | "score" | "nutrition" | "article" | "workouts"

export type CoachCard =
  | { type: "workout"; id: string; name: string; durationMin: number; level: string; location: string; calories: number; emoji: string; color: string }
  | { type: "plan"; title: string; summary: string; days: number }
  | { type: "link"; label: string; description: string; href: string; icon: CoachLinkIcon }

export interface CoachMessage extends AIMessage {
  cards: CoachCard[]
  safety?: "medical" | "crisis"
  feedback: "up" | "down" | null
  followUps: string[]
}

export interface CoachConversation {
  id: string
  messages: CoachMessage[]
  suggestions: string[]
  dailyLimit: number
  usedToday: number
}

export interface SendResult {
  user: CoachMessage
  reply: CoachMessage
  usedToday: number
  dailyLimit: number
}

export type PlanKind = AIWellnessPlanDay["items"][number]["kind"]

export interface CoachPlanItem {
  id: string
  time: string
  label: string
  kind: PlanKind
  detail?: string
  href: string
  done: boolean
}

export interface CoachPlanDay {
  day: number
  date: string
  title: string
  items: CoachPlanItem[]
  doneCount: number
}

export interface CoachPlan {
  id: string
  createdAt: string
  savedAt?: string
  version: number
  /** Plan day that is "today" (1–7; 0 before start, 8+ after the plan ended). */
  todayDay: number
  days: CoachPlanDay[]
  basedOn: { label: string; value: string }[]
  doneCount: number
  totalCount: number
}

// ─── Feature-owned sample data (ctx.extra) ──────────────────────────────

interface MessageMeta {
  cards?: CoachCard[]
  safety?: "medical" | "crisis"
  feedback?: "up" | "down" | null
  followUps?: string[]
}

interface PlanMeta {
  id: string
  createdAt: string
  savedAt?: string
  version: number
  details: Record<string, { href: string; detail?: string }>
  done: Record<string, boolean>
}

interface CoachMeta {
  conversationId: string
  messages: Record<string, MessageMeta>
  plan?: PlanMeta
  planCounter: number
}

export interface ConsentHistoryEntry {
  key: string
  granted: boolean
  at: string
  version: string
  source?: string
}

const metaStore = (ctx: Ctx) => ctx.extra<Record<string, CoachMeta>>("emp-ai-coach", () => ({}))
const consentHistory = (ctx: Ctx) => ctx.extra<Record<string, ConsentHistoryEntry[]>>("emp-consent-history", () => ({}))

function myMeta(ctx: Ctx): CoachMeta {
  const store = metaStore(ctx)
  const id = ctx.me().employeeId
  if (!store[id]) store[id] = { conversationId: newId("conv"), messages: {}, planCounter: 0 }
  return store[id]
}

// ─── Helpers ────────────────────────────────────────────────────────────

const AI_KEY: ConsentKey = "ai_personalisation"

function myEmployee(ctx: Ctx): Employee {
  const me = ctx.me()
  const emp = ctx.db.employees.find((e) => e.id === me.employeeId)
  if (!emp) throw new ApiError("Your session has expired. Please sign in again.", 401, "unauthorized")
  return emp
}

const companyEnabled = (ctx: Ctx) => ctx.db.settings[myEmployee(ctx).companyId]?.aiCoachEnabled ?? false

/** Consent counts only when both the coach flag and the versioned consent record agree. */
function hasConsent(ctx: Ctx) {
  const me = ctx.me()
  const entry = me.consents.find((c) => c.key === AI_KEY)
  return me.aiConsent && (entry ? entry.granted : true)
}

function usedToday(ctx: Ctx) {
  const today = toLocalDate(new Date())
  return ctx.me().aiMessages.filter((m) => m.role === "user" && toLocalDate(new Date(m.at)) === today).length
}

function requireCoach(ctx: Ctx) {
  if (!companyEnabled(ctx)) throw forbidden("The AI coach isn't available for your company.")
  if (!hasConsent(ctx)) throw new ApiError("Turn on AI personalisation to use the coach.", 403, "consent_required")
}

const fmt = (n: number, digits = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: digits })
const litres = (ml: number) => `${fmt(ml / 1000, 1)} L`
const hoursMin = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`
const dayOf = (iso: string) => toLocalDate(new Date(iso))
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}
const weekdayName = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" })

const COMPONENT_LABEL: Record<keyof WellnessScoreWeights, string> = {
  activity: "Activity",
  sleep: "Sleep",
  hydration: "Hydration",
  exercise: "Exercise",
  habits: "Habits",
  mindfulness: "Mindfulness",
}

const LOCATION_LABEL: Record<string, string> = { home: "at home", gym: "at the gym", outdoor: "outdoors", office: "at the office", any: "anywhere" }

function visibleWorkouts(ctx: Ctx) {
  const emp = myEmployee(ctx)
  return ctx.db.workouts.filter((w) => w.status === "published" && (w.companyId === null || w.companyId === emp.companyId))
}

function workoutCard(w: Workout): CoachCard {
  return { type: "workout", id: w.id, name: w.name, durationMin: w.durationMin, level: w.level, location: w.location, calories: w.calories, emoji: w.coverEmoji, color: w.coverColor }
}

function findContent(ctx: Ctx, test: (c: ContentItem) => boolean) {
  const emp = myEmployee(ctx)
  return ctx.db.content.find((c) => c.status === "published" && (c.companyId === null || c.companyId === emp.companyId) && test(c))
}

/** Picks workouts for a target duration / location, freshest first. */
function pickWorkouts(ctx: Ctx, opts: { minutes: number; location: string; count: number; category?: RegExp }) {
  const me = ctx.me()
  const all = visibleWorkouts(ctx)
  const recent = new Set(me.workoutSessions.filter((s) => s.completed && Date.now() - new Date(s.completedAt ?? s.startedAt).getTime() < 3 * DAY_MS).map((s) => s.workoutId))
  const level = me.profile.fitnessLevel
  const levelOk = (w: Workout) => level === "advanced" || (level === "intermediate" ? w.level !== "advanced" : w.level === "beginner" || w.level === "intermediate")
  let pool = all.filter((w) => (opts.location === "any" || w.location === opts.location || (opts.location === "outdoor" && w.location === "home")) && levelOk(w))
  if (opts.category) pool = pool.filter((w) => opts.category!.test(`${w.category} ${w.name}`))
  if (!pool.length) pool = all.filter(levelOk)
  if (!pool.length) pool = all
  return [...pool]
    .sort((a, b) => Number(recent.has(a.id)) - Number(recent.has(b.id)) || Math.abs(a.durationMin - opts.minutes) - Math.abs(b.durationMin - opts.minutes))
    .slice(0, opts.count)
}

// ─── Safety ─────────────────────────────────────────────────────────────

const CRISIS = /suicid|kill (my ?self|myself)|end (my|it all)|want to die|self[- ]?harm|hurt(ing)? myself|no reason to live|cut myself/i
const MEDICAL =
  /symptom|diagnos|medicat|medicine|tablet|\bpills?\b|dosage|\bdose\b|prescri|\bpain|ache\b|aches\b|aching|chest|heart attack|palpitation|blood pressure|\bbp\b|hypertension|diabet|blood sugar|sugar level|insulin|pregnan|injur|sprain|fracture|depress|panic attack|fever|cough|infection|\brash\b|dizz|faint|cholesterol|thyroid|asthma|cancer|disease|allerg|migraine|bleed|surgery|breathless|short of breath|vomit|nausea|swelling|lump/i

// ─── Reply engine ───────────────────────────────────────────────────────

interface Reply {
  content: string
  cards: CoachCard[]
  safety?: "medical" | "crisis"
  followUps: string[]
}

function medicalReply(): Reply {
  return {
    safety: "medical",
    content: [
      "I'm not able to give medical advice, diagnose symptoms or suggest medication — please speak to a doctor or a qualified professional about this.",
      "",
      "- **In an emergency, call 112** straight away.",
      "- If it isn't urgent, book an appointment with your doctor and mention what you've noticed.",
      "",
      "Once you've checked with your doctor, I'm happy to help with everyday wellness — gentle activity, sleep routines, hydration or healthy meals.",
    ].join("\n"),
    cards: [],
    followUps: ["How can I improve my sleep?", "Help me drink more water."],
  }
}

function crisisReply(): Reply {
  return {
    safety: "crisis",
    content: [
      "I'm really sorry you're feeling this way. You don't have to go through it alone.",
      "",
      "- **If you're in danger or might act on these thoughts, call 112 now.**",
      "- Call **Tele-MANAS on 14416** (free, 24×7, confidential) to talk to a trained counsellor.",
      "- Please speak to a doctor or a qualified mental-health professional as soon as you can.",
      "- Reach out to someone you trust and tell them how you're feeling.",
      "",
      "I'm an AI coach and can't provide crisis support — but the people above can help right now.",
    ].join("\n"),
    cards: [],
    followUps: [],
  }
}

function scoreReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const latest = me.scores[me.scores.length - 1]
  if (!latest) return { content: "I don't have a wellness score for you yet. Keep tracking steps, water and sleep for a few days and I'll show you where to focus.", cards: [], followUps: ["Give me a 20-minute workout."] }
  const weekAgo = me.scores[me.scores.length - 8] ?? latest
  const change = latest.total - weekAgo.total
  const comps = (Object.entries(latest.components) as [keyof WellnessScoreWeights, number][]).sort((a, b) => a[1] - b[1])
  const [weakest, second] = comps
  const strongest = comps[comps.length - 1]!
  const tips: Record<keyof WellnessScoreWeights, string> = {
    activity: `**Activity:** add a 15-minute walk after lunch — about 1,800 steps towards your ${fmt(me.profile.dailyStepGoal)} goal.`,
    sleep: `**Sleep:** keep the same lights-out time every night and aim for ${me.profile.sleepGoalHours} hours.`,
    hydration: `**Hydration:** keep a 1-litre bottle at your desk and finish it twice before 5 PM (goal ${litres(me.waterSettings.goalMl)}).`,
    exercise: `**Exercise:** fit in 3 short workouts this week — even ${me.preferences.workoutDurationMin} minutes counts.`,
    habits: "**Habits:** tick off your easiest habit first thing each morning to build momentum.",
    mindfulness: "**Mindfulness:** try 5 minutes of box breathing or meditation a day — it all counts.",
  }
  const cards: CoachCard[] = [{ type: "link", label: "See my score breakdown", description: "How each area adds up to your score.", href: "/employee-app/wellness-score", icon: "score" }]
  if (weakest![0] === "exercise") pickWorkouts(ctx, { minutes: me.preferences.workoutDurationMin, location: me.preferences.workoutLocation, count: 1 }).forEach((w) => cards.push(workoutCard(w)))
  if (weakest![0] === "sleep") cards.push({ type: "link", label: "Sleep", description: "See your nights and set a bedtime reminder.", href: "/employee-app/sleep", icon: "sleep" })
  if (weakest![0] === "hydration") cards.push({ type: "link", label: "Log water", description: "Track glasses and hit today's goal.", href: "/employee-app/water", icon: "water" })
  if (weakest![0] === "activity") cards.push({ type: "link", label: "Activity", description: "See today's steps and your week.", href: "/employee-app/activity", icon: "steps" })
  return {
    content: [
      `Your HealthX Wellness Score is **${latest.total}/100**${change ? ` (${change > 0 ? "+" : ""}${change} vs last week)` : " (same as last week)"}.`,
      "",
      `Your strongest area is **${COMPONENT_LABEL[strongest[0]]} (${strongest[1]})** and your biggest opportunity is **${COMPONENT_LABEL[weakest![0]]} (${weakest![1]})**, followed by ${COMPONENT_LABEL[second![0]]} (${second![1]}).`,
      "",
      "What would move your score fastest this week:",
      `- ${tips[weakest![0]]}`,
      `- ${tips[second![0]]}`,
      `- Keep doing what works for ${COMPONENT_LABEL[strongest[0]].toLowerCase()} — consistency matters more than intensity.`,
    ].join("\n"),
    cards,
    followUps: ["Create a 7-day wellness plan.", weakest![0] === "sleep" ? "How can I improve my sleep?" : "Give me a 20-minute workout."],
  }
}

function sleepReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const goalMin = me.profile.sleepGoalHours * 60
  const last = me.sleep.slice(-7)
  const prev = me.sleep.slice(-14, -7)
  const cards: CoachCard[] = []
  const wind = visibleWorkouts(ctx).find((w) => /wind-down/i.test(w.name))
  const article = findContent(ctx, (c) => c.category === "sleep")
  if (!last.length) {
    return {
      content: `I don't have any sleep data for you yet. Log a few nights (or connect Apple Health / Health Connect) and I'll spot patterns.\n\nFor now, aim for **${me.profile.sleepGoalHours} hours** with a regular bedtime and no screens for the last 30 minutes.`,
      cards: [{ type: "link", label: "Log sleep", description: "Add last night's sleep.", href: "/employee-app/sleep", icon: "sleep" }],
      followUps: ["Create a 7-day wellness plan."],
    }
  }
  const avg = last.reduce((a, s) => a + s.durationMin, 0) / last.length
  const prevAvg = prev.length ? prev.reduce((a, s) => a + s.durationMin, 0) / prev.length : avg
  const onGoal = last.filter((s) => s.durationMin >= goalMin).length
  const bedMins = last.map((s) => {
    const d = new Date(s.bedtime)
    const m = d.getHours() * 60 + d.getMinutes()
    return m < 12 * 60 ? m + 24 * 60 : m
  })
  const avgBed = bedMins.reduce((a, m) => a + m, 0) / bedMins.length
  const bedH = Math.floor(avgBed / 60) % 24
  const bedM = Math.round(avgBed % 60)
  const bedLabel = `${bedH % 12 || 12}:${String(bedM).padStart(2, "0")} ${bedH >= 12 && bedH < 24 ? "PM" : "AM"}`
  const short = onGoal < 4
  const diff = Math.round(avg - prevAvg)
  const targetBed = new Date(2000, 0, 1, 6, 30)
  targetBed.setMinutes(targetBed.getMinutes() - goalMin)
  const targetLabel = targetBed.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  if (wind) cards.push(workoutCard(wind))
  if (article) cards.push({ type: "link", label: article.title, description: `${article.readMinutes}-min read`, href: `/employee-app/feed/${article.id}`, icon: "article" })
  cards.push({ type: "link", label: "Sleep", description: "Your nights, trends and bedtime reminder.", href: "/employee-app/sleep", icon: "sleep" })
  return {
    content: [
      `Over your last ${last.length} nights you averaged **${hoursMin(avg)}** of sleep${diff ? ` (${diff > 0 ? "+" : "−"}${Math.abs(diff)} min vs the week before)` : ""}, and reached your ${me.profile.sleepGoalHours}-hour goal on **${onGoal} of ${last.length} nights**. Your usual bedtime is around **${bedLabel}**.`,
      "",
      short ? "A few changes that usually help most:" : "You're doing well — to keep it going:",
      `- Aim for lights-out by **${targetLabel}** to give yourself ${me.profile.sleepGoalHours} hours before a 6:30 AM alarm.`,
      "- Dim screens 30–60 minutes before bed; try a short stretch or breathing instead.",
      "- No caffeine after 2 PM, and keep your room cool, dark and quiet.",
      "- Get 10 minutes of daylight soon after waking to set your body clock.",
    ].join("\n"),
    cards,
    followUps: ["Help me manage stress.", "Create a 7-day wellness plan."],
  }
}

function waterReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const today = toLocalDate(new Date())
  const goal = me.waterSettings.goalMl
  const todayMl = me.water.filter((w) => dayOf(w.at) === today).reduce((a, w) => a + w.amountMl, 0)
  const past = me.waterDaily.filter((d) => d.date < today).slice(-7)
  const hits = past.filter((d) => d.totalMl >= d.goalMl).length
  const avg = past.length ? past.reduce((a, d) => a + d.totalMl, 0) / past.length : 0
  const left = Math.max(0, goal - todayMl)
  const glasses = Math.ceil(left / 250)
  return {
    content: [
      `You reached your **${litres(goal)}** water goal on **${hits} of the last ${past.length || 7} days**, averaging **${litres(avg)}** a day.`,
      "",
      left > 0 ? `Today you're at **${litres(todayMl)}** — about **${glasses} more glass${glasses === 1 ? "" : "es"}** (250 ml) to go.` : `Today you've already hit your goal with **${litres(todayMl)}** — brilliant! 💧`,
      "",
      "Easy ways to drink more:",
      "- Start the day with a full glass before tea or coffee.",
      "- Keep a bottle on your desk and refill it at every break.",
      "- Have a glass with every meal, and one after each workout.",
      "- Turn on water reminders so the app nudges you during work hours.",
    ].join("\n"),
    cards: [{ type: "link", label: "Log water", description: left > 0 ? `${litres(left)} left today` : "Goal reached today", href: "/employee-app/water", icon: "water" }],
    followUps: ["What should I eat for lunch?", "How can I improve my wellness score?"],
  }
}

type FoodPref = ReturnType<Ctx["me"]>["preferences"]["foodPreference"]

const MEAL_IDEAS: Record<"breakfast" | "lunch" | "dinner" | "snack", Record<"veg" | "egg" | "nonveg" | "vegan" | "jain", { name: string; foods: [string, number][]; note: string }[]>> = {
  lunch: {
    veg: [
      { name: "Classic thali", foods: [["Roti (whole wheat)", 2], ["Dal tadka", 1], ["Mixed vegetable sabzi", 1], ["Green salad", 1], ["Curd (plain)", 1]], note: "protein from dal + curd, fibre from sabzi and salad" },
      { name: "Rajma-rice bowl", foods: [["Rajma", 1], ["Steamed rice", 1], ["Green salad", 1]], note: "a filling, high-fibre classic — keep the rice to one cup" },
      { name: "Paneer & roti", foods: [["Paneer bhurji", 1], ["Roti (whole wheat)", 2], ["Green salad", 1]], note: "high in protein to keep you full all afternoon" },
    ],
    egg: [
      { name: "Egg & dal plate", foods: [["Boiled eggs", 1], ["Dal tadka", 1], ["Roti (whole wheat)", 2], ["Green salad", 1]], note: "a protein boost from eggs plus dal" },
      { name: "Classic thali", foods: [["Roti (whole wheat)", 2], ["Dal tadka", 1], ["Mixed vegetable sabzi", 1], ["Curd (plain)", 1]], note: "balanced and light" },
      { name: "Chole bowl", foods: [["Chole", 1], ["Steamed rice", 1], ["Green salad", 1]], note: "plant protein and fibre" },
    ],
    nonveg: [
      { name: "Grilled chicken plate", foods: [["Grilled chicken breast", 1], ["Roti (whole wheat)", 2], ["Green salad", 1]], note: "lean protein with complex carbs" },
      { name: "Fish curry & rice", foods: [["Fish curry", 1], ["Steamed rice", 1], ["Mixed vegetable sabzi", 1]], note: "omega-3s from fish, fibre from sabzi" },
      { name: "Chicken curry thali", foods: [["Chicken curry", 1], ["Roti (whole wheat)", 2], ["Green salad", 1], ["Curd (plain)", 1]], note: "satisfying — go easy on the gravy" },
    ],
    vegan: [
      { name: "Rajma-rice bowl", foods: [["Rajma", 1], ["Steamed rice", 1], ["Green salad", 1]], note: "plant protein and fibre — fully vegan" },
      { name: "Chole & roti", foods: [["Chole", 1], ["Roti (whole wheat)", 2], ["Green salad", 1]], note: "hearty and dairy-free" },
      { name: "Sprouts power bowl", foods: [["Sprouts chaat", 1], ["Roti (whole wheat)", 1], ["Mixed vegetable sabzi", 1]], note: "light, crunchy and protein-rich" },
    ],
    jain: [
      { name: "Jain thali", foods: [["Roti (whole wheat)", 2], ["Dal tadka", 1], ["Green salad", 1], ["Curd (plain)", 1]], note: "made without onion, garlic or root vegetables" },
      { name: "Paneer & roti", foods: [["Paneer bhurji", 1], ["Roti (whole wheat)", 2]], note: "ask for it without onion and garlic" },
      { name: "Moong dal khichdi", foods: [["Dal tadka", 1], ["Steamed rice", 1], ["Curd (plain)", 1]], note: "gentle and filling" },
    ],
  },
  breakfast: {
    veg: [
      { name: "Poha + fruit", foods: [["Poha", 1], ["Banana", 1]], note: "light carbs and potassium" },
      { name: "Idli-sambar", foods: [["Idli", 1], ["Sambar", 1]], note: "steamed, filling and low in fat" },
      { name: "Oats bowl", foods: [["Oats with milk", 1], ["Apple", 1]], note: "slow-release energy" },
    ],
    egg: [
      { name: "Eggs + oats", foods: [["Boiled eggs", 1], ["Oats with milk", 1]], note: "protein-packed start" },
      { name: "Poha + eggs", foods: [["Poha", 1], ["Boiled eggs", 1]], note: "carbs plus protein" },
      { name: "Idli-sambar", foods: [["Idli", 1], ["Sambar", 1]], note: "steamed and light" },
    ],
    nonveg: [
      { name: "Eggs + oats", foods: [["Boiled eggs", 1], ["Oats with milk", 1]], note: "protein-packed start" },
      { name: "Upma + eggs", foods: [["Upma", 1], ["Boiled eggs", 1]], note: "balanced and quick" },
      { name: "Idli-sambar", foods: [["Idli", 1], ["Sambar", 1]], note: "steamed and light" },
    ],
    vegan: [
      { name: "Poha + fruit", foods: [["Poha", 1], ["Banana", 1]], note: "dairy-free and light" },
      { name: "Idli-sambar", foods: [["Idli", 1], ["Sambar", 1]], note: "naturally vegan" },
      { name: "Sprouts chaat", foods: [["Sprouts chaat", 1], ["Apple", 1]], note: "protein and fibre" },
    ],
    jain: [
      { name: "Oats bowl", foods: [["Oats with milk", 1], ["Apple", 1]], note: "slow-release energy" },
      { name: "Upma (no onion)", foods: [["Upma", 1]], note: "ask for it without onion" },
      { name: "Idli-sambar", foods: [["Idli", 1], ["Sambar", 1]], note: "steamed and light" },
    ],
  },
  dinner: {
    veg: [
      { name: "Light khichdi", foods: [["Dal tadka", 1], ["Steamed rice", 1], ["Curd (plain)", 1]], note: "easy to digest before bed" },
      { name: "Roti + sabzi", foods: [["Roti (whole wheat)", 2], ["Mixed vegetable sabzi", 1], ["Dal tadka", 1]], note: "simple and balanced" },
      { name: "Paneer & salad", foods: [["Paneer bhurji", 1], ["Green salad", 1], ["Roti (whole wheat)", 1]], note: "protein-rich, low carb" },
    ],
    egg: [
      { name: "Egg bhurji + roti", foods: [["Boiled eggs", 1], ["Roti (whole wheat)", 2], ["Mixed vegetable sabzi", 1]], note: "light protein" },
      { name: "Light khichdi", foods: [["Dal tadka", 1], ["Steamed rice", 1], ["Curd (plain)", 1]], note: "easy on the stomach" },
      { name: "Roti + sabzi", foods: [["Roti (whole wheat)", 2], ["Mixed vegetable sabzi", 1], ["Dal tadka", 1]], note: "simple and balanced" },
    ],
    nonveg: [
      { name: "Grilled fish + veg", foods: [["Fish curry", 1], ["Mixed vegetable sabzi", 1], ["Roti (whole wheat)", 1]], note: "lean and light" },
      { name: "Chicken & salad", foods: [["Grilled chicken breast", 1], ["Green salad", 1]], note: "high protein, low carb" },
      { name: "Light khichdi", foods: [["Dal tadka", 1], ["Steamed rice", 1], ["Curd (plain)", 1]], note: "easy to digest" },
    ],
    vegan: [
      { name: "Dal + roti", foods: [["Dal tadka", 1], ["Roti (whole wheat)", 2], ["Green salad", 1]], note: "plant protein" },
      { name: "Chole bowl", foods: [["Chole", 1], ["Green salad", 1]], note: "filling, dairy-free" },
      { name: "Veg sabzi + rice", foods: [["Mixed vegetable sabzi", 1], ["Steamed rice", 1]], note: "light and simple" },
    ],
    jain: [
      { name: "Dal + roti", foods: [["Dal tadka", 1], ["Roti (whole wheat)", 2]], note: "no onion or garlic" },
      { name: "Light khichdi", foods: [["Dal tadka", 1], ["Steamed rice", 1], ["Curd (plain)", 1]], note: "gentle before bed" },
      { name: "Paneer & roti", foods: [["Paneer bhurji", 1], ["Roti (whole wheat)", 1]], note: "protein-rich" },
    ],
  },
  snack: {
    veg: [
      { name: "Roasted chana", foods: [["Roasted chana", 1]], note: "crunchy protein" },
      { name: "Fruit + nuts", foods: [["Apple", 1], ["Mixed nuts", 1]], note: "fibre and healthy fats" },
      { name: "Makhana", foods: [["Makhana (roasted)", 1]], note: "light and satisfying" },
    ],
    egg: [
      { name: "Boiled eggs", foods: [["Boiled eggs", 1]], note: "pure protein" },
      { name: "Roasted chana", foods: [["Roasted chana", 1]], note: "crunchy protein" },
      { name: "Fruit + nuts", foods: [["Apple", 1], ["Mixed nuts", 1]], note: "fibre and healthy fats" },
    ],
    nonveg: [
      { name: "Boiled eggs", foods: [["Boiled eggs", 1]], note: "pure protein" },
      { name: "Sprouts chaat", foods: [["Sprouts chaat", 1]], note: "fibre and protein" },
      { name: "Fruit + nuts", foods: [["Banana", 1], ["Mixed nuts", 1]], note: "quick energy" },
    ],
    vegan: [
      { name: "Roasted chana", foods: [["Roasted chana", 1]], note: "crunchy protein" },
      { name: "Fruit + nuts", foods: [["Apple", 1], ["Mixed nuts", 1]], note: "fibre and healthy fats" },
      { name: "Makhana", foods: [["Makhana (roasted)", 1]], note: "light and satisfying" },
    ],
    jain: [
      { name: "Makhana", foods: [["Makhana (roasted)", 1]], note: "light and satisfying" },
      { name: "Fruit + nuts", foods: [["Apple", 1], ["Mixed nuts", 1]], note: "fibre and healthy fats" },
      { name: "Roasted chana", foods: [["Roasted chana", 1]], note: "crunchy protein" },
    ],
  },
}

const FOOD_LABEL: Record<FoodPref, string> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  eggetarian: "eggetarian",
  non_vegetarian: "non-vegetarian",
  jain: "Jain",
  no_preference: "no-preference",
}

function prefGroup(pref: FoodPref): "veg" | "egg" | "nonveg" | "vegan" | "jain" {
  return pref === "vegan" ? "vegan" : pref === "jain" ? "jain" : pref === "eggetarian" ? "egg" : pref === "non_vegetarian" || pref === "no_preference" ? "nonveg" : "veg"
}

function foodReply(ctx: Ctx, text: string): Reply {
  const me = ctx.me()
  const meal: keyof typeof MEAL_IDEAS = /breakfast|morning/i.test(text) ? "breakfast" : /dinner|night|evening/i.test(text) ? "dinner" : /snack|hungry|craving/i.test(text) ? "snack" : "lunch"
  const pref = me.preferences.foodPreference
  const ideas = MEAL_IDEAS[meal][prefGroup(pref)]
  const kcal = (foods: [string, number][]) =>
    foods.reduce((a, [name, servings]) => a + (ctx.db.foods.find((f) => f.name === name)?.calories ?? 0) * servings, 0)
  const lines = ideas.map((i) => `- **${i.name}** — ${i.foods.map(([n, s]) => (s > 1 ? `${s} × ${n.toLowerCase()}` : n.toLowerCase())).join(", ")} (≈ ${fmt(kcal(i.foods))} kcal): ${i.note}.`)
  const today = toLocalDate(new Date())
  const logged = me.meals.find((m) => m.date === today && m.type === meal)
  const loggedKcal = logged ? logged.items.reduce((a, it) => a + (ctx.db.foods.find((f) => f.id === it.foodId)?.calories ?? 0) * it.servings, 0) : 0
  const goalLine =
    me.profile.mainGoal === "lose_weight"
      ? "Since your goal is to lose weight, fill half the plate with vegetables and keep rice or roti to one portion."
      : me.profile.mainGoal === "build_strength"
        ? "Since you're building strength, include a palm-sized protein portion at every meal."
        : "Aim for half a plate of vegetables, a quarter protein and a quarter grains."
  const thali = findContent(ctx, (c) => c.category === "nutrition" && /thali|snack/i.test(c.title))
  const cards: CoachCard[] = [{ type: "link", label: `Log your ${meal}`, description: "Track meals and calories in Nutrition.", href: "/employee-app/nutrition", icon: "nutrition" }]
  if (thali) cards.push({ type: "link", label: thali.title, description: `${thali.readMinutes}-min read`, href: `/employee-app/feed/${thali.id}`, icon: "article" })
  return {
    content: [
      `Here are ${meal} ideas that match your **${FOOD_LABEL[pref]}** preference:`,
      "",
      ...lines,
      "",
      goalLine,
      logged ? `\nYou've already logged ${meal} today (≈ ${fmt(loggedKcal)} kcal) — nice tracking!` : "",
    ]
      .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
      .join("\n")
      .trim(),
    cards,
    followUps: [meal === "lunch" ? "What's a healthy snack?" : "What should I eat for lunch?", "Help me drink more water."],
  }
}

function workoutReply(ctx: Ctx, text: string): Reply {
  const me = ctx.me()
  const m = /(\d{1,3})\s*-?\s*(?:min|minute|mins)/i.exec(text)
  const minutes = m ? Math.min(90, Math.max(5, Number(m[1]))) : me.preferences.workoutDurationMin
  const location = /\bgym\b/i.test(text) ? "gym" : /\b(office|desk)\b/i.test(text) ? "office" : /\bhome\b/i.test(text) ? "home" : me.preferences.workoutLocation
  const category = /yoga|stretch/i.test(text) ? /yoga|stretch|wind/i : /strength|muscle/i.test(text) ? /strength|builder|leg/i : /cardio|hiit|burn/i.test(text) ? /cardio|hiit|burn/i : undefined
  const picks = pickWorkouts(ctx, { minutes, location, count: 3, category })
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const thisWeek = me.workoutSessions.filter((s) => s.completed && new Date(s.completedAt ?? s.startedAt) >= monday).length
  const close = picks.filter((w) => Math.abs(w.durationMin - minutes) <= 5)
  const combo = !close.length && picks.length >= 2 && picks[0]!.durationMin + picks[1]!.durationMin <= minutes + 8 ? `\nTip: pair **${picks[0]!.name}** and **${picks[1]!.name}** back-to-back for about ${picks[0]!.durationMin + picks[1]!.durationMin} minutes.` : ""
  return {
    content: [
      `Here are workouts for about **${minutes} minutes ${LOCATION_LABEL[location] ?? ""}** at your **${me.profile.fitnessLevel}** level. You've completed **${thisWeek} workout${thisWeek === 1 ? "" : "s"}** this week${thisWeek >= 3 ? " — great consistency! 💪" : " — one more today keeps the momentum going."}`,
      "",
      "- Warm up for 2–3 minutes and keep water nearby.",
      "- Stop if anything hurts — move at a pace where you can still talk.",
      combo,
    ]
      .join("\n")
      .trim(),
    cards: picks.map(workoutCard),
    followUps: ["How can I improve my wellness score?", "Create a 7-day wellness plan."],
  }
}

function stressReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const weekAgo = Date.now() - 7 * DAY_MS
  const medMin = me.sessions.filter((s) => s.type === "meditation" && new Date(s.startedAt).getTime() >= weekAgo).reduce((a, s) => a + s.durationMin, 0)
  const lastSleep = me.sleep.slice(-7)
  const avgSleep = lastSleep.length ? lastSleep.reduce((a, s) => a + s.durationMin, 0) / lastSleep.length : 0
  const breathing = visibleWorkouts(ctx).find((w) => /breathing|stress/i.test(w.name))
  const article = findContent(ctx, (c) => c.category === "mindfulness" && /stress|breath/i.test(`${c.title} ${c.tags.join(" ")}`) && c.companyId === null)
  const cards: CoachCard[] = []
  if (breathing) cards.push(workoutCard(breathing))
  if (article) cards.push({ type: "link", label: article.title, description: `${article.readMinutes}-min ${article.type === "video" ? "video" : "read"}`, href: `/employee-app/feed/${article.id}`, icon: "article" })
  return {
    content: [
      `Stress is a normal part of busy weeks — small resets help a lot. In the last 7 days you've logged **${medMin} minutes** of meditation${avgSleep ? ` and averaged **${hoursMin(avgSleep)}** of sleep` : ""}.`,
      "",
      "Try this right now — **box breathing**:",
      "- Breathe in for 4 counts, hold for 4.",
      "- Breathe out for 4 counts, hold for 4.",
      "- Repeat 4 times.",
      "",
      "Through the day: take a 5-minute walk between meetings, protect your sleep, and break big tasks into small steps. If stress feels heavy or lasts for weeks, please speak to a doctor or a qualified professional.",
    ].join("\n"),
    cards,
    followUps: ["How can I improve my sleep?", "Give me a 10-minute workout."],
  }
}

function stepsReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const goal = me.profile.dailyStepGoal
  const today = toLocalDate(new Date())
  const todayRow = me.daily.find((d) => d.date === today)
  const week = me.daily.filter((d) => d.date < today).slice(-7)
  const avg = week.length ? week.reduce((a, d) => a + d.steps, 0) / week.length : 0
  const met = week.filter((d) => d.steps >= goal).length
  const best = [...week].sort((a, b) => b.steps - a.steps)[0]
  const left = Math.max(0, goal - (todayRow?.steps ?? 0))
  return {
    content: [
      `Over the last 7 days you averaged **${fmt(avg)} steps** a day and reached your **${fmt(goal)}** goal on **${met} of ${week.length || 7} days**.${best ? ` Your best day was ${weekdayName(best.date)} with ${fmt(best.steps)} steps.` : ""}`,
      "",
      left > 0 ? `Today you're at **${fmt(todayRow?.steps ?? 0)}** — about **${fmt(left)} steps** (≈ ${Math.max(5, Math.round(left / 110))} minutes of brisk walking) to go.` : `You've already hit today's goal with **${fmt(todayRow?.steps ?? 0)} steps** — amazing! 🎉`,
      "",
      "Ways to add steps without extra time:",
      "- Take calls and 1:1s as walking meetings.",
      "- Use the stairs and the farthest water cooler.",
      "- A 10-minute walk after lunch adds about 1,200 steps.",
    ].join("\n"),
    cards: [{ type: "link", label: "Activity", description: "Today's steps, distance and your week.", href: "/employee-app/activity", icon: "steps" }],
    followUps: ["Give me a 20-minute workout.", "How can I improve my wellness score?"],
  }
}

function habitsReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const active = me.habits.filter((h) => h.active)
  if (!active.length) {
    return {
      content: "You're not tracking any habits yet. Start with one tiny habit — like a glass of water after waking — and tick it off daily. Small wins build streaks.",
      cards: [{ type: "link", label: "Browse habits", description: "Pick a habit to start today.", href: "/employee-app/habits", icon: "habits" }],
      followUps: ["Create a 7-day wellness plan."],
    }
  }
  const rows = active.map((h) => {
    const def = ctx.db.habits.find((d) => d.id === h.habitId)
    const name = h.custom?.name ?? def?.name ?? "Habit"
    const icon = h.custom?.icon ?? def?.icon ?? "✅"
    return { name, icon, done: h.todayValue >= h.target, streak: h.currentStreak, best: h.bestStreak }
  })
  const done = rows.filter((r) => r.done).length
  const top = [...rows].sort((a, b) => b.streak - a.streak)[0]!
  return {
    content: [
      `You've completed **${done} of ${rows.length} habits** today.`,
      "",
      ...rows.map((r) => `- ${r.icon} ${r.name} — ${r.done ? "done ✅" : "not yet"} · ${r.streak}-day streak (best ${r.best})`),
      "",
      `Your longest current streak is **${top.name}** at ${top.streak} days. Stack the others onto it — do them right after, at the same time each day.`,
    ].join("\n"),
    cards: [{ type: "link", label: "Habits", description: "Tick off today's habits.", href: "/employee-app/habits", icon: "habits" }],
    followUps: ["Create a 7-day wellness plan."],
  }
}

function planReply(ctx: Ctx): Reply {
  const me = ctx.me()
  const meta = myMeta(ctx)
  const existed = !!me.aiPlan && !!meta.plan
  if (!existed) generatePlan(ctx, false)
  const plan = planView(ctx)!
  const firstDay = plan.days[0]!
  return {
    content: existed
      ? `You already have a 7-day plan (created ${new Date(plan.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}). Open it to tick off today's items, or regenerate it for fresh ideas.`
      : [
          "Here's your personal 7-day wellness plan, built from your own goals and preferences:",
          "",
          ...plan.basedOn.map((b) => `- **${b.label}:** ${b.value}`),
          "",
          `Day 1 starts with “${firstDay.title}”. Open the plan to save it and tick items off as you go.`,
        ].join("\n"),
    cards: [{ type: "plan", title: "Your 7-day wellness plan", summary: `${plan.totalCount} activities across 7 days · ${plan.savedAt ? "saved" : "not saved yet"}`, days: 7 }],
    followUps: ["Give me a 20-minute workout.", "What should I eat for lunch?"],
  }
}

function buildReply(ctx: Ctx, text: string): Reply {
  const emp = myEmployee(ctx)
  const t = text.toLowerCase()
  if (CRISIS.test(t)) return crisisReply()
  if (MEDICAL.test(t)) return medicalReply()
  if (/\b(7|seven)[- ]?day\b|\bplan\b|\bschedule\b|\broutine\b/.test(t)) return planReply(ctx)
  if (/score/.test(t)) return scoreReply(ctx)
  if (/workout|exercise|\btrain|\bgym\b|strength|cardio|hiit|yoga|stretch|\d+\s*-?\s*min/.test(t)) return workoutReply(ctx, text)
  if (/sleep|insomnia|tired|bedtime|\bnap\b/.test(t)) return sleepReply(ctx)
  if (/water|hydrat|\bdrink|thirst/.test(t)) return waterReply(ctx)
  if (/\beat\b|eating|lunch|breakfast|dinner|snack|food|diet|meal|nutrition|protein|calorie|hungry/.test(t)) return foodReply(ctx, text)
  if (/stress|anxious|anxiety|overwhelm|burn ?out|calm|relax|meditat|breath|focus|mood/.test(t)) return stressReply(ctx)
  if (/step|walk|activ|move more|sitting|sedentary/.test(t)) return stepsReply(ctx)
  if (/habit|streak/.test(t)) return habitsReply(ctx)
  if (/^(hi|hello|hey|hii+|namaste|good (morning|afternoon|evening))\b/.test(t)) {
    return {
      content: `Hi ${emp.firstName}! 👋 I'm your HealthX coach. I can look at your own steps, sleep, water, workouts and habits and suggest simple next steps. What would you like to work on today?`,
      cards: [],
      followUps: COACH_SUGGESTIONS.slice(0, 3),
    }
  }
  if (/thank|thanks|thx|great|awesome|cool|nice|helpful/.test(t)) {
    return { content: `You're welcome, ${emp.firstName}! Small steps every day add up. Anything else I can help with?`, cards: [], followUps: ["Create a 7-day wellness plan.", "How can I improve my wellness score?"] }
  }
  return {
    content: [
      "I'm not sure I understood that one. I can help with things like:",
      "",
      "- your **wellness score** and where to focus",
      "- **workouts** that fit your time and place",
      "- **sleep**, **water**, **steps** and **habits**",
      "- **meal ideas** that match your food preference",
      "- a **7-day wellness plan**",
      "",
      "Try asking in a different way, or tap a suggestion below.",
    ].join("\n"),
    cards: [],
    followUps: COACH_SUGGESTIONS.slice(0, 3),
  }
}

// ─── Plan generator ─────────────────────────────────────────────────────

const DAY_TITLES = [
  ["Strong start", "Fresh start", "Kick-off day"],
  ["Move more", "Step it up", "Walk & talk"],
  ["Hydration focus", "Refresh & refuel", "Water first"],
  ["Active recovery", "Easy day", "Recharge"],
  ["Strength day", "Power up", "Build strength"],
  ["Weekend adventure", "Get outside", "Fun & active"],
  ["Rest & reset", "Reflect & plan", "Recovery Sunday"],
]

function hhmm(totalMin: number) {
  const m = ((totalMin % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function generatePlan(ctx: Ctx, regenerate: boolean) {
  const me = ctx.me()
  const emp = myEmployee(ctx)
  const meta = myMeta(ctx)
  meta.planCounter = (meta.planCounter ?? 0) + (regenerate || meta.plan ? 1 : 0)
  const version = meta.planCounter
  const seed = `${emp.id}:plan:${version}`
  let k = 0
  const pick = <T,>(arr: T[]) => arr[Math.floor(noise(seed, k++) * arr.length)]!

  const stepGoal = me.profile.dailyStepGoal
  const waterGoal = me.waterSettings.goalMl
  const sleepH = me.profile.sleepGoalHours
  const minutes = me.preferences.workoutDurationMin
  const location = me.preferences.workoutLocation
  const foods = prefGroup(me.preferences.foodPreference)
  const wakeMin = 6 * 60 + 30
  const bedMin = wakeMin - sleepH * 60 + 1440
  const workouts = pickWorkouts(ctx, { minutes, location, count: 6 })
  const strength = pickWorkouts(ctx, { minutes, location, count: 2, category: /strength|builder|leg|core/i })
  const calm = visibleWorkouts(ctx).filter((w) => /yoga|mindful|wind/i.test(`${w.category} ${w.name}`))
  const mindIdeas = ["Box breathing — 4 rounds", "5-minute guided meditation", "Write 3 things you're grateful for", "10 minutes screen-free, just stretch", "Mindful walk — notice 5 things around you"]
  const windDown = ["Screens off — read or stretch", "Wind-down: dim lights, no screens", "Evening stretch & breathing"]

  const details: PlanMeta["details"] = {}
  const days: AIWellnessPlanDay[] = []

  for (let d = 1; d <= 7; d++) {
    const draft: { time: string; label: string; kind: PlanKind; href: string; detail?: string }[] = []
    const add = (time: string, label: string, kind: PlanKind, href: string, detail?: string) => draft.push({ time, label, kind, href, detail })

    add("07:00", "Drink a glass of water after waking", "hydrate", "/employee-app/water", `250–500 ml to start your ${litres(waterGoal)} day`)
    const bf = pick(MEAL_IDEAS.breakfast[foods])
    add("08:30", `Breakfast: ${bf.name}`, "eat", "/employee-app/nutrition", bf.note)
    const walkSteps = Math.round((stepGoal * 0.18) / 100) * 100
    add("11:00", d === 2 ? "Walking meeting or 15-minute walk" : "10-minute walk break", "move", "/employee-app/activity", `≈ ${fmt(walkSteps)} steps towards your ${fmt(stepGoal)} goal`)
    const lunch = pick(MEAL_IDEAS.lunch[foods])
    add("13:00", `Lunch: ${lunch.name}`, "eat", "/employee-app/nutrition", lunch.note)
    if (d === 3) add("15:00", `Water check — reach ${litres(waterGoal * 0.6)} by 3 PM`, "hydrate", "/employee-app/water", "Refill your bottle now")
    else add("16:00", `Refill your bottle — aim for ${litres(waterGoal * 0.7)} by 4 PM`, "hydrate", "/employee-app/water")
    if (d === 1 || d === 4 || d === 6) add("16:30", pick(mindIdeas), "mind", "/employee-app/habits", "A 5-minute reset for focus")

    if (d === 4) {
      const c = calm[version % Math.max(1, calm.length)]
      if (c) add("18:30", `Active recovery: ${c.name} (${c.durationMin} min)`, "move", `/employee-app/workouts/${c.id}`, "Gentle movement to recover")
      else add("18:30", "Active recovery: 20-minute easy walk", "move", "/employee-app/activity")
    } else if (d === 7) {
      add("10:00", "Long, easy walk with family or friends (30 min)", "move", "/employee-app/activity", "Enjoy it — no pace targets today")
    } else {
      const w = d === 5 && strength[0] ? strength[0] : d === 2 && strength[1] ? strength[1] : workouts.length ? workouts[(d + version) % workouts.length] : undefined
      if (w) add(d === 6 ? "09:00" : "18:30", `Workout: ${w.name} (${w.durationMin} min)`, "move", `/employee-app/workouts/${w.id}`, `${fmt(w.calories)} kcal · ${w.level}`)
    }

    const dn = pick(MEAL_IDEAS.dinner[foods])
    add("20:00", `Dinner: ${dn.name}`, "eat", "/employee-app/nutrition", "Finish eating 2–3 hours before bed")
    add(hhmm(bedMin - 30), d === 7 ? "Plan next week & wind down" : pick(windDown), "mind", "/employee-app/habits")
    add(hhmm(bedMin), `Lights out — ${sleepH} hours of sleep`, "rest", "/employee-app/sleep", `Wake at ${hhmm(wakeMin)}`)

    draft.sort((a, b) => a.time.localeCompare(b.time))
    draft.forEach((it, idx) => (details[`d${d}-${idx}`] = { href: it.href, detail: it.detail }))
    days.push({ day: d, title: pick(DAY_TITLES[d - 1]!), items: draft.map(({ time, label, kind }) => ({ time, label, kind })) })
  }

  me.aiPlan = days
  meta.plan = { id: newId("plan"), createdAt: new Date().toISOString(), version, details, done: {} }
  ctx.save()
}

function hrefForKind(kind: PlanKind, label: string) {
  if (kind === "move") return /workout/i.test(label) ? "/employee-app/workouts" : "/employee-app/activity"
  if (kind === "eat") return "/employee-app/nutrition"
  if (kind === "hydrate") return "/employee-app/water"
  if (kind === "rest") return "/employee-app/sleep"
  return "/employee-app/habits"
}

function planView(ctx: Ctx): CoachPlan | null {
  const me = ctx.me()
  if (!me.aiPlan || !me.aiPlan.length) return null
  const meta = myMeta(ctx)
  if (!meta.plan) {
    // A plan without metadata (e.g. created elsewhere) — attach fresh metadata.
    meta.plan = { id: newId("plan"), createdAt: new Date().toISOString(), version: meta.planCounter ?? 0, details: {}, done: {} }
    ctx.save()
  }
  const p = meta.plan
  const start = toLocalDate(new Date(p.createdAt))
  const today = toLocalDate(new Date())
  const todayDay = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / DAY_MS) + 1
  const days: CoachPlanDay[] = me.aiPlan.map((d) => {
    const items = d.items.map((it, idx) => {
      const id = `d${d.day}-${idx}`
      const info = p.details[id] ?? { href: hrefForKind(it.kind, it.label) }
      return { id, time: it.time, label: it.label, kind: it.kind, detail: info.detail, href: info.href || hrefForKind(it.kind, it.label), done: !!p.done[id] }
    })
    return { day: d.day, date: addDays(start, d.day - 1), title: d.title, items, doneCount: items.filter((i) => i.done).length }
  })
  const pref = me.preferences
  return {
    id: p.id,
    createdAt: p.createdAt,
    savedAt: p.savedAt,
    version: p.version,
    todayDay,
    days,
    basedOn: [
      { label: "Steps", value: `${fmt(me.profile.dailyStepGoal)} a day` },
      { label: "Workouts", value: `${pref.workoutDurationMin} min ${LOCATION_LABEL[pref.workoutLocation] ?? ""}`.trim() },
      { label: "Food", value: FOOD_LABEL[pref.foodPreference].replace(/^./, (c) => c.toUpperCase()) },
      { label: "Water", value: `${litres(me.waterSettings.goalMl)} a day` },
      { label: "Sleep", value: `${me.profile.sleepGoalHours} hours a night` },
    ],
    doneCount: days.reduce((a, d) => a + d.doneCount, 0),
    totalCount: days.reduce((a, d) => a + d.items.length, 0),
  }
}

// ─── Conversation helpers ───────────────────────────────────────────────

function toCoachMessage(m: AIMessage, meta: CoachMeta): CoachMessage {
  const extra = meta.messages[m.id] ?? {}
  return { ...m, cards: extra.cards ?? [], safety: extra.safety, feedback: extra.feedback ?? null, followUps: extra.followUps ?? [] }
}

function conversation(ctx: Ctx): CoachConversation {
  const meta = myMeta(ctx)
  return {
    id: meta.conversationId,
    messages: ctx.me().aiMessages.map((m) => toCoachMessage(m, meta)),
    suggestions: COACH_SUGGESTIONS,
    dailyLimit: COACH_DAILY_LIMIT,
    usedToday: usedToday(ctx),
  }
}

function access(ctx: Ctx): CoachAccess {
  const me = ctx.me()
  const emp = myEmployee(ctx)
  const company = ctx.db.companies.find((c) => c.id === emp.companyId)
  const entry = me.consents.find((c) => c.key === AI_KEY)
  return {
    enabled: companyEnabled(ctx),
    granted: hasConsent(ctx),
    version: entry?.version ?? "2026.1",
    updatedAt: entry?.updatedAt,
    firstName: emp.firstName,
    companyName: company?.name ?? "your company",
    dailyLimit: COACH_DAILY_LIMIT,
    usedToday: usedToday(ctx),
    hasPlan: !!me.aiPlan?.length,
  }
}

// ─── Service ────────────────────────────────────────────────────────────

export const coachApi = {
  /** SCR-M-066 — is the coach on for my company, and have I consented? */
  access: endpoint<void, CoachAccess, "employee">("employee", "GET", "/me/consents/ai_personalization", (_i, ctx) => access(ctx)),

  /** Records the versioned AI-personalisation consent (grant or withdraw). */
  setConsent: endpoint<{ granted: boolean; source?: string }, CoachAccess, "employee">("employee", "PUT", "/me/consents/ai_personalization", ({ granted, source }, ctx) => {
    if (typeof granted !== "boolean") throw badRequest("Couldn't save your choice.")
    if (granted && !companyEnabled(ctx)) throw forbidden("The AI coach isn't available for your company.")
    const me = ctx.me()
    const now = new Date().toISOString()
    me.aiConsent = granted
    let entry = me.consents.find((c) => c.key === AI_KEY)
    if (!entry) {
      entry = { key: AI_KEY, title: "AI personalisation", description: "Let the AI Wellness Coach use your wellness data to give personal tips. You can turn this off at any time.", required: false, version: "2026.1", granted, updatedAt: now }
      me.consents.push(entry)
    }
    entry.granted = granted
    entry.updatedAt = now
    const history = consentHistory(ctx)
    ;(history[me.employeeId] ??= []).push({ key: AI_KEY, granted, at: now, version: entry.version, source: source ?? "ai_coach" })
    ctx.save()
    return access(ctx)
  }),

  /** SCR-M-067 — current conversation (own messages only; never visible to HR). */
  conversation: endpoint<void, CoachConversation, "employee">("employee", "GET", "/me/ai-coach/conversations", (_i, ctx) => {
    requireCoach(ctx)
    return conversation(ctx)
  }),

  /** Sends a message; the real API streams the answer, the client reveals it progressively. */
  send: endpoint<{ message: string }, SendResult, "employee">("employee", "POST", "/me/ai-coach/messages", ({ message }, ctx) => {
    requireCoach(ctx)
    const text = (message ?? "").trim()
    if (!text) throw badRequest("Type a message first.", { message: "Type a message first." })
    if (text.length > COACH_MAX_CHARS) throw badRequest(`Keep your message under ${fmt(COACH_MAX_CHARS)} characters.`, { message: `Max ${fmt(COACH_MAX_CHARS)} characters` })
    if (usedToday(ctx) >= COACH_DAILY_LIMIT) throw new ApiError("You've reached today's question limit.", 429, "limit_reached")
    const me = ctx.me()
    const meta = myMeta(ctx)
    const now = Date.now()
    const user: AIMessage = { id: newId("aim"), role: "user", content: text, at: new Date(now).toISOString() }
    me.aiMessages.push(user)
    const r = buildReply(ctx, text)
    const reply: AIMessage = { id: newId("aim"), role: "assistant", content: r.content, at: new Date(now + 1200).toISOString() }
    me.aiMessages.push(reply)
    meta.messages[reply.id] = { cards: r.cards, safety: r.safety, feedback: null, followUps: r.followUps }
    ctx.save()
    return { user: toCoachMessage(user, meta), reply: toCoachMessage(reply, meta), usedToday: usedToday(ctx), dailyLimit: COACH_DAILY_LIMIT }
  }),

  feedback: endpoint<{ id: string; value: "up" | "down" | null }, { id: string; value: "up" | "down" | null }, "employee">(
    "employee",
    "POST",
    "/me/ai-coach/messages/:id/feedback",
    ({ id, value }, ctx) => {
      const msg = ctx.me().aiMessages.find((m) => m.id === id && m.role === "assistant")
      if (!msg) throw notFound("Message")
      const meta = myMeta(ctx)
      meta.messages[id] = { ...(meta.messages[id] ?? {}), feedback: value }
      ctx.save()
      return { id, value }
    },
  ),

  clear: endpoint<{ id: string }, { ok: true }, "employee">("employee", "DELETE", "/me/ai-coach/conversations/:id", (_i, ctx) => {
    const me = ctx.me()
    const meta = myMeta(ctx)
    me.aiMessages.forEach((m) => delete meta.messages[m.id])
    me.aiMessages = []
    meta.conversationId = newId("conv")
    ctx.save()
    return { ok: true }
  }),

  /** SCR-M-068 — my current 7-day plan (null when none). */
  plan: endpoint<void, CoachPlan | null, "employee">("employee", "GET", "/me/plans/current", (_i, ctx) => {
    requireCoach(ctx)
    return planView(ctx)
  }),

  createPlan: endpoint<{ regenerate?: boolean } | void, CoachPlan, "employee">("employee", "POST", "/me/ai-coach/plans", (input, ctx) => {
    requireCoach(ctx)
    generatePlan(ctx, !!(input && input.regenerate))
    const view = planView(ctx)
    if (!view) throw new ApiError("Couldn't create a plan right now.", 500, "plan_failed")
    return view
  }),

  savePlan: endpoint<{ id: string }, CoachPlan, "employee">("employee", "PATCH", "/me/plans/:id", ({ id }, ctx) => {
    requireCoach(ctx)
    const meta = myMeta(ctx)
    if (!meta.plan || meta.plan.id !== id) throw notFound("Plan")
    meta.plan.savedAt = new Date().toISOString()
    ctx.save()
    return planView(ctx)!
  }),

  setItemDone: endpoint<{ id: string; itemId: string; done: boolean }, CoachPlan, "employee">("employee", "PATCH", "/me/plans/:id/items/:itemId", ({ id, itemId, done }, ctx) => {
    requireCoach(ctx)
    const meta = myMeta(ctx)
    if (!meta.plan || meta.plan.id !== id) throw notFound("Plan")
    if (done) meta.plan.done[itemId] = true
    else delete meta.plan.done[itemId]
    ctx.save()
    return planView(ctx)!
  }),

  deletePlan: endpoint<{ id: string }, { ok: true }, "employee">("employee", "DELETE", "/me/plans/:id", ({ id }, ctx) => {
    const meta = myMeta(ctx)
    if (!meta.plan || meta.plan.id !== id) throw notFound("Plan")
    ctx.me().aiPlan = null
    meta.plan = undefined
    ctx.save()
    return { ok: true }
  }),
}
