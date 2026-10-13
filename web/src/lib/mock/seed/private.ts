/**
 * Private, employee-only data for the employee app (activity, water, sleep,
 * habits, wallet...). Generated the first time an employee signs in.
 * Company admins never see this data — only aggregates.
 */
import type {
  AIMessage,
  AIWellnessPlanDay,
  ActivitySession,
  AppNotification,
  Consent,
  DailyActivity,
  Employee,
  EmployeePreferences,
  HealthConnection,
  Meal,
  NotificationPreferences,
  PointsTransaction,
  ProgramEnrollment,
  SleepRecord,
  UserBadge,
  UserHabit,
  WaterLog,
  WaterSettings,
  WeeklySummary,
  WellnessProfile,
  WellnessScore,
  WorkoutSession,
} from "@/lib/types"
import {
  DAY_MS,
  chance,
  daysAgo,
  float,
  hash,
  int,
  isoAt,
  makeId,
  pick,
  seedRandom,
  toLocalDate,
} from "../random"
import type { MockDB } from "./index"

export interface EmployeePrivate {
  employeeId: string
  profile: WellnessProfile
  preferences: EmployeePreferences
  notificationPreferences: NotificationPreferences
  onboardingCompleted: boolean
  termsAcceptedAt?: string
  consents: Consent[]
  healthConnections: HealthConnection[]
  daily: DailyActivity[]
  sessions: ActivitySession[]
  water: WaterLog[]
  waterDaily: { date: string; totalMl: number; goalMl: number }[]
  waterSettings: WaterSettings
  sleep: SleepRecord[]
  workoutSessions: WorkoutSession[]
  habits: UserHabit[]
  scores: WellnessScore[]
  weeklySummaries: WeeklySummary[]
  meals: Meal[]
  badges: UserBadge[]
  notifications: AppNotification[]
  transactions: PointsTransaction[]
  aiConsent: boolean
  aiMessages: AIMessage[]
  aiPlan: AIWellnessPlanDay[] | null
  enrollments: ProgramEnrollment[]
  bookmarks: string[]
  readAnnouncementIds: string[]
  leaderboardOptOut: boolean
  homeCards: string[]
  customChallengeCheckIns: Record<string, string[]>
  deletionRequestedAt?: string
  dataExportRequestedAt?: string
}

export const DEFAULT_HOME_CARDS = ["score", "steps", "challenge", "water", "habits", "rank", "workout", "summary"]

const CONSENTS: Omit<Consent, "granted" | "updatedAt">[] = [
  { key: "health_data", title: "Health data", description: "Allow HealthX to store the steps, activity, water and sleep data you track so we can show your progress.", required: true, version: "2026.1" },
  { key: "wearable_connection", title: "Health app & wearable connection", description: "Allow HealthX to read data from Apple Health, Health Connect or connected wearables.", required: false, version: "2026.1" },
  { key: "data_sharing", title: "Share aggregated data with my company", description: "Your company only ever sees combined figures for groups of 5 or more people — never your individual health data.", required: false, version: "2026.1" },
  { key: "notifications", title: "Notifications", description: "Receive reminders, challenge updates and announcements.", required: false, version: "2026.1" },
  { key: "ai_personalisation", title: "AI personalisation", description: "Let the AI Wellness Coach use your wellness data to give personal tips. You can turn this off at any time.", required: false, version: "2026.1" },
  { key: "analytics", title: "Product analytics", description: "Help us improve HealthX with anonymous usage data.", required: false, version: "2026.1" },
]

export function createEmployeePrivate(db: MockDB, employee: Employee): EmployeePrivate {
  seedRandom(hash(employee.id))
  const onboarded = employee.status !== "invited"
  const baseSteps = Math.max(2500, Math.round(employee.stats.stepsMonth / 30) || 7000)
  const stepGoal = pick([8000, 10000, 10000])
  const waterGoal = pick([2000, 2500, 2500, 3000])
  const now = new Date()

  // Activity — 90 days
  const daily: DailyActivity[] = []
  for (let i = 89; i >= 0; i--) {
    const d = daysAgo(i)
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const fraction = i === 0 ? Math.min(1, Math.max(0.2, (now.getHours() - 6) / 15)) : 1
    const steps = !onboarded ? 0 : Math.round(baseSteps * (weekend ? float(0.55, 1.1) : float(0.75, 1.3)) * fraction)
    daily.push({
      date: toLocalDate(d),
      steps,
      distanceKm: Number((steps * 0.00076).toFixed(2)),
      activeCalories: Math.round(steps * 0.042),
      activeMinutes: Math.round(steps / 150),
      goalSteps: stepGoal,
    })
  }

  // Sessions — last 30 days
  const sessions: ActivitySession[] = []
  if (onboarded) {
    for (let i = 0; i < 34; i++) {
      const type = pick(["walking", "walking", "running", "cycling", "yoga", "meditation", "strength", "walking"] as const)
      const durationMin = type === "meditation" ? pick([5, 10, 15]) : int(15, 65)
      const dAgo = int(0, 29)
      sessions.push({
        id: makeId("act"),
        type,
        startedAt: isoAt(dAgo, pick([6, 7, 8, 12, 13, 18, 19, 20]), pick([0, 15, 30, 45])),
        durationMin,
        distanceKm: ["walking", "running", "cycling"].includes(type) ? Number((durationMin * (type === "cycling" ? 0.32 : type === "running" ? 0.16 : 0.08)).toFixed(2)) : undefined,
        calories: Math.round(durationMin * (type === "running" ? 11 : type === "cycling" ? 8 : type === "meditation" ? 1.2 : 5)),
        steps: type === "walking" ? durationMin * 105 : type === "running" ? durationMin * 160 : undefined,
        source: chance(0.85) ? "apple_health" : "manual",
        points: type === "meditation" ? 20 : 0,
      })
    }
    sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  // Water
  const water: WaterLog[] = []
  if (onboarded) {
    const amounts = [250, 500, 250, 750, 250, 500]
    const hours = [8, 10, 12, 14, 16, 18]
    const count = Math.max(1, Math.min(hours.filter((h) => h <= now.getHours()).length, 5))
    for (let i = 0; i < count; i++) water.push({ id: makeId("wat"), amountMl: amounts[i]!, at: isoAt(0, hours[i]!, int(0, 50)) })
  }
  const waterDaily = Array.from({ length: 30 }, (_, k) => {
    const i = 29 - k
    const total = i === 0 ? water.reduce((a, w) => a + w.amountMl, 0) : onboarded ? int(1200, 3300) : 0
    return { date: toLocalDate(daysAgo(i)), totalMl: total, goalMl: waterGoal }
  })

  // Sleep — 30 nights
  const sleep: SleepRecord[] = []
  if (onboarded) {
    for (let i = 30; i >= 1; i--) {
      const bedH = pick([22, 23, 23, 23, 0])
      const bed = daysAgo(bedH === 0 ? i - 1 : i)
      bed.setHours(bedH, pick([0, 15, 30, 45]))
      const durationMin = int(330, 495)
      const wake = new Date(bed.getTime() + durationMin * 60_000)
      sleep.push({
        id: makeId("slp"),
        date: toLocalDate(wake),
        bedtime: bed.toISOString(),
        wakeTime: wake.toISOString(),
        durationMin,
        quality: pick([3, 4, 4, 5, 2] as const),
        source: chance(0.7) ? "apple_health" : "manual",
        score: Math.min(100, Math.round((durationMin / 480) * 80 + int(5, 18))),
      })
    }
  }

  // Workouts
  const published = db.workouts.filter((w) => w.status === "published" && (w.companyId === null || w.companyId === employee.companyId))
  const workoutSessions: WorkoutSession[] = []
  if (onboarded) {
    for (let i = 0; i < 16; i++) {
      const w = pick(published)
      const start = isoAt(int(0, 44), pick([7, 13, 18, 19]), int(0, 59))
      workoutSessions.push({
        id: makeId("wss"),
        workoutId: w.id,
        startedAt: start,
        completedAt: new Date(new Date(start).getTime() + w.durationMin * 60_000).toISOString(),
        durationMin: w.durationMin,
        calories: w.calories,
        points: 50,
        completed: chance(0.9),
      })
    }
    workoutSessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  // Habits
  const habitDefs = db.habits.filter((h) => h.status === "active")
  const chosen = onboarded ? [habitDefs[0]!, habitDefs[1]!, habitDefs[3]!, habitDefs[4]!] : []
  const habits: UserHabit[] = chosen.map((h) => {
    const history = Array.from({ length: 35 }, () => (chance(0.72) ? h.defaultTarget : Math.round(h.defaultTarget * float(0, 0.8))))
    let streak = 0
    for (let i = history.length - 2; i >= 0 && history[i]! >= h.defaultTarget; i--) streak++
    const todayValue = h.unit === "steps" ? daily[daily.length - 1]!.steps : h.unit === "glasses" ? Math.round(water.reduce((a, w) => a + w.amountMl, 0) / 250) : Math.round(h.defaultTarget * pick([0, 0.5, 1]))
    history[history.length - 1] = todayValue
    return {
      id: makeId("uhb"),
      habitId: h.id,
      target: h.defaultTarget,
      reminderTime: pick(["08:00", "13:00", "18:30", undefined]),
      active: true,
      history,
      todayValue,
      currentStreak: streak,
      bestStreak: Math.max(streak, int(streak, streak + 15)),
    }
  })

  // Wellness score — 90 days
  const scores: WellnessScore[] = daily.map((d, idx) => {
    const activity = Math.min(100, Math.round((d.steps / stepGoal) * 85 + int(0, 10)))
    const s = {
      activity,
      sleep: int(55, 92),
      hydration: int(50, 98),
      exercise: int(35, 90),
      habits: int(40, 95),
      mindfulness: int(20, 85),
    }
    const total = Math.round(s.activity * 0.25 + s.sleep * 0.2 + s.hydration * 0.15 + s.exercise * 0.2 + s.habits * 0.1 + s.mindfulness * 0.1 + idx * 0.05)
    return { date: d.date, total: onboarded ? Math.min(100, total) : 0, components: s }
  })

  // Weekly summaries — last 4 weeks
  const weeklySummaries: WeeklySummary[] = Array.from({ length: 4 }, (_, w) => {
    const days = daily.slice(daily.length - 7 * (w + 1), daily.length - 7 * w || undefined)
    const steps = days.reduce((a, d) => a + d.steps, 0)
    return {
      weekStart: days[0]?.date ?? toLocalDate(daysAgo(7 * (w + 1))),
      workouts: int(1, 5),
      steps,
      hydrationGoalsHit: int(3, 7),
      activeDays: days.filter((d) => d.steps >= 5000).length,
      avgSleepHours: float(6.2, 7.8),
      scoreChange: int(-4, 7),
      opportunity: pick([
        "Your activity dropped 18% on weekends.",
        "You hit your water goal on only 3 of 7 days.",
        "You slept less than 6.5 hours on 3 nights.",
        "Most of your steps happen after 6 PM.",
      ]),
      recommendation: pick([
        "Try a 30-minute Saturday walk.",
        "Keep a 1-litre bottle at your desk and refill it twice.",
        "Set a wind-down reminder for 10:30 PM.",
        "Add a 10-minute walk after lunch.",
      ]),
      highlights: [`${steps.toLocaleString("en-IN")} steps`, `${int(1, 5)} workouts completed`, `${int(3, 7)}/7 hydration goals`],
    }
  })

  // Badges
  const lifetimeSteps = daily.reduce((a, d) => a + d.steps, 0) * 2.2
  const badges: UserBadge[] = db.badges
    .filter((b) => b.status === "active")
    .map((b) => {
      let progress = 0
      switch (b.criteriaType) {
        case "first_workout":
          progress = workoutSessions.length > 0 ? 1 : 0
          break
        case "streak":
          progress = Math.min(1, employee.stats.currentStreak / b.threshold)
          break
        case "steps_total":
          progress = Math.min(1, lifetimeSteps / b.threshold)
          break
        case "water_goal":
          progress = Math.min(1, waterDaily.filter((w) => w.totalMl >= w.goalMl).length / b.threshold)
          break
        default:
          progress = onboarded ? float(0, 1, 2) : 0
      }
      if (!onboarded) progress = 0
      return { badgeId: b.id, progress, earnedAt: progress >= 1 ? new Date(Date.now() - int(1, 60) * DAY_MS).toISOString() : undefined }
    })

  // Points ledger (consistent with employee.stats)
  const transactions: PointsTransaction[] = []
  if (onboarded) {
    const recent = daily.slice(-45)
    recent.forEach((d, idx) => {
      const daysBack = recent.length - 1 - idx
      const stepPts = Math.min(150, Math.floor(d.steps / 1000) * 10)
      const stepsAt = daysBack === 0 ? new Date(Date.now() - 10 * 60_000).toISOString() : isoAt(daysBack, 23, 30)
      if (stepPts > 0) transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "steps", points: stepPts, description: `${d.steps.toLocaleString("en-IN")} steps`, balanceAfter: 0, createdAt: stepsAt })
      if (daysBack > 0 && chance(0.5)) transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "water", points: 20, description: "Hit daily water goal", balanceAfter: 0, createdAt: isoAt(daysBack, 17, 10) })
    })
    workoutSessions.filter((w) => w.completed).forEach((w) => {
      const wk = db.workouts.find((x) => x.id === w.workoutId)
      transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "workout", points: 50, description: `Workout: ${wk?.name ?? "Workout"}`, balanceAfter: 0, createdAt: w.completedAt ?? w.startedAt })
    })
    for (let i = 0; i < 4; i++) transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "streak", points: 100, description: "7-day streak bonus", balanceAfter: 0, createdAt: isoAt(int(1, 40), 21, 0) })
    badges.filter((b) => b.earnedAt).forEach((b) => {
      const def = db.badges.find((x) => x.id === b.badgeId)!
      transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "badge", points: def.points, description: `Badge unlocked: ${def.name}`, balanceAfter: 0, createdAt: b.earnedAt! })
    })
    db.orders
      .filter((o) => o.employeeId === employee.id)
      .forEach((o) => {
        const reward = db.rewards.find((r) => r.id === o.rewardId)
        transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "redeem", source: "redemption", points: -o.points, description: `Redeemed: ${reward?.name ?? "Reward"}`, balanceAfter: 0, createdAt: o.createdAt })
        if (o.status === "cancelled" || o.status === "rejected")
          transactions.push({ id: makeId("ptx"), employeeId: employee.id, type: "refund", source: "refund", points: o.points, description: `Refund: ${reward?.name ?? "Reward"}`, balanceAfter: 0, createdAt: o.updatedAt })
      })
    transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    // Opening balance so the running balance never goes negative
    const opening = Math.max(2400, -Math.min(0, ...transactions.reduce<number[]>((acc, t) => [...acc, (acc[acc.length - 1] ?? 0) + t.points], [])))
    let balance = opening
    transactions.unshift({ id: makeId("ptx"), employeeId: employee.id, type: "earn", source: "challenge", points: opening, description: "Points earned before this period", balanceAfter: opening, createdAt: new Date(Date.now() - 46 * DAY_MS).toISOString() })
    for (let i = 1; i < transactions.length; i++) {
      balance += transactions[i]!.points
      transactions[i]!.balanceAfter = balance
    }
    transactions.reverse()
    employee.stats.pointsBalance = balance
    employee.stats.pointsLifetime = transactions.filter((t) => t.points > 0 && t.type !== "refund").reduce((a, t) => a + t.points, 0)
    employee.stats.stepsToday = daily[daily.length - 1]!.steps
    employee.stats.stepsWeek = daily.slice(-7).reduce((a, d) => a + d.steps, 0)
    employee.stats.stepsMonth = daily.slice(-30).reduce((a, d) => a + d.steps, 0)
    employee.stats.badgesCount = badges.filter((b) => b.earnedAt).length
  }

  // Notifications
  const notifications: AppNotification[] = onboarded
    ? [
        { id: makeId("ntf"), type: "challenge", title: "You moved up to #12 🎉", body: "You passed 3 colleagues in October Step Up. Keep going!", createdAt: isoAt(0, now.getHours() > 9 ? 9 : 0, 5), read: false, href: "/employee-app/challenges/chl_001" },
        { id: makeId("ntf"), type: "reminder", title: "Time for a glass of water 💧", body: "You're at 60% of your water goal today.", createdAt: isoAt(0, Math.max(0, now.getHours() - 1), 0), read: false, href: "/employee-app/water" },
        { id: makeId("ntf"), type: "badge", title: "Badge unlocked: 7-Day Streak 🔥", body: "You were active 7 days in a row. +50 points.", createdAt: isoAt(1, 21, 2), read: false, href: "/employee-app/badges" },
        { id: makeId("ntf"), type: "announcement", title: "Department Step Battle — who will win?", body: "Engineering leads after day 4...", createdAt: isoAt(1, 10, 0), read: true, href: "/employee-app/announcements" },
        { id: makeId("ntf"), type: "reward", title: "Your order has shipped 📦", body: "Insulated Steel Bottle is on its way.", createdAt: isoAt(2, 15, 30), read: true, href: "/employee-app/orders" },
        { id: makeId("ntf"), type: "insight", title: "Your weekly summary is ready", body: "52,300 steps, 4 workouts and 6/7 hydration goals last week.", createdAt: isoAt(3, 8, 0), read: true, href: "/employee-app/weekly-summary" },
        { id: makeId("ntf"), type: "points", title: "+150 points for your steps", body: "You walked 15,240 steps yesterday.", createdAt: isoAt(4, 23, 30), read: true, href: "/employee-app/wallet" },
        { id: makeId("ntf"), type: "challenge", title: "New challenge: 21-Day Hydration Habit", body: "Drink 2 litres a day for 21 days.", createdAt: isoAt(9, 9, 0), read: true, href: "/employee-app/challenges/chl_003" },
      ]
    : [{ id: makeId("ntf"), type: "system", title: "Welcome to HealthX 👋", body: "Finish setting up your profile to start earning points.", createdAt: new Date().toISOString(), read: false }]

  // Meals (today + yesterday)
  const foods = db.foods
  const meals: Meal[] = onboarded
    ? [
        { id: makeId("meal"), date: toLocalDate(daysAgo(0)), type: "breakfast", items: [{ foodId: foods[9]!.id, servings: 1 }, { foodId: foods[21]!.id, servings: 1 }] },
        { id: makeId("meal"), date: toLocalDate(daysAgo(0)), type: "lunch", items: [{ foodId: foods[0]!.id, servings: 2 }, { foodId: foods[2]!.id, servings: 1 }, { foodId: foods[5]!.id, servings: 1 }, { foodId: foods[12]!.id, servings: 1 }] },
        { id: makeId("meal"), date: toLocalDate(daysAgo(1)), type: "breakfast", items: [{ foodId: foods[6]!.id, servings: 1 }, { foodId: foods[7]!.id, servings: 1 }] },
        { id: makeId("meal"), date: toLocalDate(daysAgo(1)), type: "dinner", items: [{ foodId: foods[1]!.id, servings: 1 }, { foodId: foods[23]!.id, servings: 1 }, { foodId: foods[20]!.id, servings: 1 }] },
      ]
    : []

  const activeProgram = db.programs.find((p) => p.companyId === employee.companyId && p.status === "active")

  return {
    employeeId: employee.id,
    profile: {
      heightCm: int(152, 186),
      weightKg: int(52, 92),
      dateOfBirth: `${int(1982, 2001)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}`,
      gender: employee.gender ?? "undisclosed",
      mainGoal: pick(["stay_active", "lose_weight", "reduce_stress", "build_strength", "sleep_better"] as const),
      activityLevel: pick(["light", "moderate", "moderate", "very_active"] as const),
      fitnessLevel: pick(["beginner", "intermediate", "intermediate", "advanced"] as const),
      dailyStepGoal: stepGoal,
      dailyWaterGoalMl: waterGoal,
      sleepGoalHours: 8,
    },
    preferences: {
      activities: ["walking", "yoga", "running"].slice(0, int(1, 3)),
      workoutLocation: pick(["home", "gym", "any"] as const),
      workoutDurationMin: pick([10, 20, 30]),
      foodPreference: pick(["vegetarian", "non_vegetarian", "eggetarian", "no_preference"] as const),
      language: "English",
      units: "metric",
      theme: "system",
    },
    notificationPreferences: {
      push: true,
      email: true,
      reminders: true,
      challenges: true,
      announcements: true,
      rewards: true,
      weeklySummary: true,
      waterReminders: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    },
    onboardingCompleted: onboarded,
    termsAcceptedAt: onboarded ? employee.joinedAt : undefined,
    consents: CONSENTS.map((c) => ({ ...c, granted: onboarded ? c.key !== "ai_personalisation" && c.key !== "analytics" ? true : chance(0.4) : c.required, updatedAt: employee.joinedAt ?? new Date().toISOString() })),
    healthConnections: [
      { provider: "apple_health", status: onboarded && employee.healthConnected ? "connected" : "disconnected", connectedAt: onboarded && employee.healthConnected ? employee.joinedAt : undefined, lastSyncAt: onboarded && employee.healthConnected ? new Date(Date.now() - int(5, 55) * 60_000).toISOString() : undefined, dataTypes: ["Steps", "Distance", "Active energy", "Workouts", "Sleep"] },
      { provider: "health_connect", status: "disconnected", dataTypes: ["Steps", "Distance", "Active calories", "Exercise", "Sleep"] },
      { provider: "fitbit", status: "not_available", dataTypes: ["Steps", "Heart rate", "Sleep"] },
      { provider: "garmin", status: "not_available", dataTypes: ["Steps", "Workouts", "Sleep"] },
    ],
    daily,
    sessions,
    water,
    waterDaily,
    waterSettings: { goalMl: waterGoal, remindersEnabled: true, reminderStart: "09:00", reminderEnd: "19:00", reminderEveryMin: 90, quickAmounts: [250, 500, 750, 1000] },
    sleep,
    workoutSessions,
    habits,
    scores,
    weeklySummaries,
    meals,
    badges,
    notifications,
    transactions,
    aiConsent: false,
    aiMessages: [],
    aiPlan: null,
    enrollments: onboarded && activeProgram ? [{ programId: activeProgram.id, enrolledAt: new Date(Date.now() - 9 * DAY_MS).toISOString(), currentWeek: 2, completedGoalIds: ["g1", "g2"] }] : [],
    bookmarks: [],
    readAnnouncementIds: [],
    leaderboardOptOut: false,
    homeCards: DEFAULT_HOME_CARDS,
    customChallengeCheckIns: {},
  }
}
