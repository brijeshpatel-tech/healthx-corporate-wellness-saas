// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/**
 * Static catalogues used by the sample data: plans, gamification rules, rewards,
 * workouts, habits, templates, content and foods.
 */
import type {
  Badge,
  ChallengeTemplate,
  ContentItem,
  Exercise,
  FoodItem,
  HabitDefinition,
  ModuleCode,
  Plan,
  PointsRule,
  Reward,
  RewardCategory,
  SystemSetting,
  Workout,
  WellnessProgram,
} from "@/lib/types"

const CORE_MODULES: ModuleCode[] = [
  "activity",
  "water",
  "workouts",
  "habits",
  "challenges",
  "leaderboards",
  "rewards",
  "announcements",
  "analytics",
]

export const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    code: "starter",
    description: "For small teams getting started with workplace wellness.",
    pricePerEmployee: 99,
    currency: "INR",
    billingCycle: "monthly",
    minEmployees: 10,
    maxEmployees: 99,
    modules: CORE_MODULES,
    supportLevel: "standard",
    status: "active",
    companiesCount: 0,
    createdAt: "2026-01-10T08:00:00.000Z",
  },
  {
    id: "plan_growth",
    name: "Growth",
    code: "growth",
    description: "Full engagement suite for growing companies.",
    pricePerEmployee: 179,
    currency: "INR",
    billingCycle: "annual",
    minEmployees: 100,
    maxEmployees: 999,
    modules: [...CORE_MODULES, "sleep", "programs", "content"],
    supportLevel: "priority",
    status: "active",
    companiesCount: 0,
    createdAt: "2026-01-10T08:00:00.000Z",
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    code: "enterprise",
    description: "Advanced analytics, integrations and AI for large organisations.",
    pricePerEmployee: 249,
    currency: "INR",
    billingCycle: "annual",
    minEmployees: 1000,
    maxEmployees: null,
    modules: [...CORE_MODULES, "sleep", "nutrition", "programs", "content", "ai_coach", "integrations"],
    supportLevel: "dedicated",
    status: "active",
    companiesCount: 0,
    createdAt: "2026-01-10T08:00:00.000Z",
  },
]

export const POINTS_RULES: PointsRule[] = [
  { id: "rule_steps", eventType: "steps", label: "Every 1,000 steps", description: "Points for each 1,000 steps synced from the phone or wearable.", points: 10, per: "1,000 steps", dailyCap: 150, active: true, version: 3, updatedAt: "2026-09-02T10:00:00.000Z" },
  { id: "rule_workout", eventType: "workout", label: "Complete a workout", description: "Awarded when a guided workout is finished.", points: 50, per: "workout", dailyCap: 100, active: true, version: 2, updatedAt: "2026-08-15T10:00:00.000Z" },
  { id: "rule_meditation", eventType: "meditation", label: "Meditation session", description: "Awarded for a logged meditation of 5 minutes or more.", points: 20, per: "session", dailyCap: 40, active: true, version: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
  { id: "rule_water", eventType: "water", label: "Hit daily water goal", description: "Awarded once a day when the hydration goal is reached.", points: 20, per: "day", dailyCap: 20, active: true, version: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
  { id: "rule_challenge", eventType: "challenge", label: "Complete a challenge", description: "Default points for completing a challenge (admins can override per challenge).", points: 100, per: "challenge", dailyCap: null, active: true, version: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
  { id: "rule_streak", eventType: "streak", label: "7-day streak", description: "Bonus for staying active 7 days in a row.", points: 100, per: "streak", dailyCap: 100, active: true, version: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
  { id: "rule_habit", eventType: "habit", label: "Complete a habit", description: "Awarded for each daily habit completed.", points: 5, per: "habit", dailyCap: 25, active: true, version: 1, updatedAt: "2026-07-21T10:00:00.000Z" },
  { id: "rule_badge", eventType: "badge", label: "Unlock a badge", description: "Bonus defined on each badge.", points: 0, per: "badge", dailyCap: null, active: true, version: 1, updatedAt: "2026-06-01T10:00:00.000Z" },
]

export const BADGES: Badge[] = [
  { id: "badge_first_workout", name: "First Workout", description: "Complete your first guided workout.", icon: "💪", color: "#10b981", criteria: "Complete 1 workout", criteriaType: "first_workout", threshold: 1, rarity: "common", points: 25, status: "active", earnedCount: 0 },
  { id: "badge_streak_7", name: "7-Day Streak", description: "Stay active 7 days in a row.", icon: "🔥", color: "#f97316", criteria: "7 consecutive active days", criteriaType: "streak", threshold: 7, rarity: "common", points: 50, status: "active", earnedCount: 0 },
  { id: "badge_step_master", name: "Step Master", description: "Walk 100,000 steps in total.", icon: "👟", color: "#0ea5e9", criteria: "100,000 lifetime steps", criteriaType: "steps_total", threshold: 100000, rarity: "rare", points: 100, status: "active", earnedCount: 0 },
  { id: "badge_hydration_hero", name: "Hydration Hero", description: "Hit your water goal 14 days.", icon: "💧", color: "#06b6d4", criteria: "Reach water goal on 14 days", criteriaType: "water_goal", threshold: 14, rarity: "common", points: 50, status: "active", earnedCount: 0 },
  { id: "badge_early_bird", name: "Early Bird", description: "Log activity before 7 AM on 5 days.", icon: "🌅", color: "#f59e0b", criteria: "Activity before 7 AM on 5 days", criteriaType: "early_activity", threshold: 5, rarity: "rare", points: 75, status: "active", earnedCount: 0 },
  { id: "badge_challenge_champ", name: "Challenge Champion", description: "Complete 3 challenges.", icon: "🏆", color: "#eab308", criteria: "Complete 3 challenges", criteriaType: "challenge", threshold: 3, rarity: "epic", points: 150, status: "active", earnedCount: 0 },
  { id: "badge_streak_30", name: "Unstoppable", description: "Stay active 30 days in a row.", icon: "⚡", color: "#8b5cf6", criteria: "30 consecutive active days", criteriaType: "streak", threshold: 30, rarity: "epic", points: 200, status: "active", earnedCount: 0 },
  { id: "badge_marathoner", name: "Marathoner", description: "Cover 42.2 km in a single week.", icon: "🏃", color: "#ef4444", criteria: "42.2 km in 7 days", criteriaType: "custom", threshold: 42, rarity: "epic", points: 150, status: "active", earnedCount: 0 },
  { id: "badge_zen", name: "Zen Master", description: "Meditate for 300 minutes in total.", icon: "🧘", color: "#14b8a6", criteria: "300 meditation minutes", criteriaType: "custom", threshold: 300, rarity: "rare", points: 100, status: "active", earnedCount: 0 },
  { id: "badge_habit_builder", name: "Habit Builder", description: "Complete all habits for 21 days.", icon: "🌱", color: "#84cc16", criteria: "21 perfect habit days", criteriaType: "custom", threshold: 21, rarity: "rare", points: 100, status: "active", earnedCount: 0 },
  { id: "badge_team_player", name: "Team Player", description: "Help your team win a team challenge.", icon: "🤝", color: "#6366f1", criteria: "Be in a winning team", criteriaType: "challenge", threshold: 1, rarity: "rare", points: 75, status: "active", earnedCount: 0 },
  { id: "badge_million", name: "Million Stepper", description: "Walk 1,000,000 steps in total.", icon: "🌍", color: "#ec4899", criteria: "1,000,000 lifetime steps", criteriaType: "steps_total", threshold: 1000000, rarity: "legendary", points: 500, status: "active", earnedCount: 0 },
]

export const REWARD_CATEGORIES: RewardCategory[] = [
  { id: "rcat_vouchers", name: "Gift Vouchers", icon: "🎁" },
  { id: "rcat_gear", name: "Wellness Gear", icon: "🎽" },
  { id: "rcat_experiences", name: "Experiences", icon: "🎟️" },
  { id: "rcat_charity", name: "Give Back", icon: "💚" },
  { id: "rcat_perks", name: "Company Perks", icon: "⭐" },
  { id: "rcat_food", name: "Food & Drinks", icon: "🥗" },
]

type RewardSeed = Omit<Reward, "id" | "companyId" | "redemptionsCount" | "createdAt" | "status" | "featured"> & {
  featured?: boolean
}

export const GLOBAL_REWARDS: RewardSeed[] = [
  { categoryId: "rcat_vouchers", name: "Online Shopping Voucher ₹500", description: "Digital voucher usable across popular online stores.", terms: "Valid for 12 months. Code sent by email within 48 hours.", pointsCost: 1500, delivery: "digital_voucher", imageEmoji: "🛍️", imageColor: "#f59e0b", stock: null, perEmployeeLimit: 4, featured: true },
  { categoryId: "rcat_vouchers", name: "Coffee Voucher ₹250", description: "Enjoy a coffee on us at partner cafés.", terms: "Valid for 6 months at participating outlets.", pointsCost: 700, delivery: "digital_voucher", imageEmoji: "☕", imageColor: "#a16207", stock: null, perEmployeeLimit: null },
  { categoryId: "rcat_vouchers", name: "Movie Tickets for Two", description: "Two tickets for any 2D show at partner cinemas.", terms: "Weekdays and weekends. Excludes premium formats.", pointsCost: 2200, delivery: "digital_voucher", imageEmoji: "🎬", imageColor: "#ef4444", stock: 120, perEmployeeLimit: 2 },
  { categoryId: "rcat_gear", name: "Fitness Band", description: "Track steps, heart rate and sleep. Syncs with Apple Health and Health Connect.", terms: "Delivered within 7–10 working days. 1-year warranty.", pointsCost: 6500, delivery: "physical", imageEmoji: "⌚", imageColor: "#0ea5e9", stock: 25, perEmployeeLimit: 1, featured: true },
  { categoryId: "rcat_gear", name: "Premium Yoga Mat", description: "6 mm non-slip eco-friendly yoga mat with carry strap.", terms: "Delivered within 7 working days.", pointsCost: 2500, delivery: "physical", imageEmoji: "🧘", imageColor: "#8b5cf6", stock: 60, perEmployeeLimit: 1 },
  { categoryId: "rcat_gear", name: "Insulated Steel Bottle", description: "1 L bottle that keeps water cold for 24 hours.", terms: "Delivered within 7 working days.", pointsCost: 1200, delivery: "physical", imageEmoji: "🧴", imageColor: "#06b6d4", stock: 150, perEmployeeLimit: 2 },
  { categoryId: "rcat_gear", name: "Wireless Earbuds", description: "Sweat-resistant earbuds for workouts.", terms: "Delivered within 10 working days. 6-month warranty.", pointsCost: 5000, delivery: "physical", imageEmoji: "🎧", imageColor: "#6366f1", stock: 30, perEmployeeLimit: 1 },
  { categoryId: "rcat_experiences", name: "Spa & Massage Session", description: "60-minute relaxing massage at partner spas.", terms: "Booking required 48 hours in advance.", pointsCost: 4500, delivery: "experience", imageEmoji: "💆", imageColor: "#ec4899", stock: 40, perEmployeeLimit: 1 },
  { categoryId: "rcat_experiences", name: "Gym Pass — 1 Month", description: "Access to partner gyms in your city for one month.", terms: "Activate within 30 days of receiving the code.", pointsCost: 3500, delivery: "experience", imageEmoji: "🏋️", imageColor: "#10b981", stock: 80, perEmployeeLimit: 1, featured: true },
  { categoryId: "rcat_charity", name: "Plant 5 Trees", description: "We plant five trees on your behalf with a reforestation partner.", terms: "Certificate emailed within 14 days.", pointsCost: 800, delivery: "donation", imageEmoji: "🌳", imageColor: "#22c55e", stock: null, perEmployeeLimit: null },
  { categoryId: "rcat_charity", name: "Donate 10 Meals", description: "Provide 10 nutritious meals to children through a food charity.", terms: "Donation receipt emailed within 7 days.", pointsCost: 1000, delivery: "donation", imageEmoji: "🍲", imageColor: "#f97316", stock: null, perEmployeeLimit: null },
  { categoryId: "rcat_food", name: "Healthy Snack Box", description: "Box of 12 healthy snacks — nuts, bars and baked chips.", terms: "Delivered within 5 working days.", pointsCost: 1100, delivery: "physical", imageEmoji: "🥜", imageColor: "#84cc16", stock: 200, perEmployeeLimit: 3 },
]

export const COMPANY_REWARDS: RewardSeed[] = [
  { categoryId: "rcat_perks", name: "Extra Day Off", description: "One additional paid day off, approved by your manager.", terms: "Use within 3 months. Subject to manager approval.", pointsCost: 8000, delivery: "company_perk", imageEmoji: "🏖️", imageColor: "#0ea5e9", stock: 20, perEmployeeLimit: 1, featured: true },
  { categoryId: "rcat_perks", name: "Lunch with the CEO", description: "Join a small-group lunch with the leadership team.", terms: "Held monthly. HR will contact you to schedule.", pointsCost: 5000, delivery: "company_perk", imageEmoji: "🍽️", imageColor: "#8b5cf6", stock: 6, perEmployeeLimit: 1 },
  { categoryId: "rcat_gear", name: "Company Hoodie", description: "Limited-edition company hoodie in your size.", terms: "Collect from the office reception or delivered to you.", pointsCost: 2000, delivery: "physical", imageEmoji: "🧥", imageColor: "#10b981", stock: 75, perEmployeeLimit: 1 },
  { categoryId: "rcat_perks", name: "Work From Anywhere Week", description: "Work remotely from a location of your choice for a week.", terms: "Subject to manager approval and project needs.", pointsCost: 7000, delivery: "company_perk", imageEmoji: "🌴", imageColor: "#14b8a6", stock: 15, perEmployeeLimit: 1 },
  { categoryId: "rcat_perks", name: "Reserved Parking — 1 Month", description: "A reserved parking spot near the entrance.", terms: "Available at Bengaluru HQ only.", pointsCost: 3000, delivery: "company_perk", imageEmoji: "🅿️", imageColor: "#64748b", stock: 4, perEmployeeLimit: 1 },
  { categoryId: "rcat_food", name: "Team Lunch Voucher", description: "Lunch for your team of up to 6 people.", terms: "Book through HR. Valid for 2 months.", pointsCost: 6000, delivery: "company_perk", imageEmoji: "🥘", imageColor: "#f97316", stock: 10, perEmployeeLimit: 1 },
]

export const EXERCISES: Exercise[] = [
  { id: "ex_jumping_jacks", name: "Jumping Jacks", instructions: ["Stand with feet together and arms at your sides.", "Jump while spreading your legs and raising your arms overhead.", "Jump back to the starting position and repeat at a steady pace."], muscleGroups: ["full body"], equipment: [], level: "beginner", defaultDurationSec: 40, mediaEmoji: "🤸", status: "published" },
  { id: "ex_squats", name: "Bodyweight Squats", instructions: ["Stand with feet shoulder-width apart.", "Push hips back and bend knees until thighs are parallel to the floor.", "Drive through your heels to stand up."], muscleGroups: ["legs", "glutes"], equipment: [], level: "beginner", defaultDurationSec: 45, defaultReps: 15, mediaEmoji: "🦵", status: "published" },
  { id: "ex_pushups", name: "Push-ups", instructions: ["Start in a high plank with hands under shoulders.", "Lower your chest towards the floor, keeping your body straight.", "Push back up to the start."], muscleGroups: ["chest", "arms", "core"], equipment: [], level: "intermediate", defaultDurationSec: 40, defaultReps: 12, mediaEmoji: "💪", status: "published" },
  { id: "ex_knee_pushups", name: "Knee Push-ups", instructions: ["Start on hands and knees with hands wider than shoulders.", "Lower your chest while keeping hips in line.", "Press back up."], muscleGroups: ["chest", "arms"], equipment: [], level: "beginner", defaultDurationSec: 40, defaultReps: 10, mediaEmoji: "💪", status: "published" },
  { id: "ex_plank", name: "Plank", instructions: ["Rest on forearms and toes with body in a straight line.", "Brace your core and squeeze your glutes.", "Hold without letting hips sag."], muscleGroups: ["core"], equipment: [], level: "beginner", defaultDurationSec: 45, mediaEmoji: "🧱", status: "published" },
  { id: "ex_lunges", name: "Alternating Lunges", instructions: ["Step forward with one leg and lower until both knees are at 90°.", "Push back to standing.", "Alternate legs."], muscleGroups: ["legs", "glutes"], equipment: [], level: "beginner", defaultDurationSec: 45, defaultReps: 12, mediaEmoji: "🚶", status: "published" },
  { id: "ex_mountain_climbers", name: "Mountain Climbers", instructions: ["Start in a high plank.", "Drive one knee towards your chest, then switch quickly.", "Keep hips low and core tight."], muscleGroups: ["core", "full body"], equipment: [], level: "intermediate", defaultDurationSec: 35, mediaEmoji: "⛰️", status: "published" },
  { id: "ex_burpees", name: "Burpees", instructions: ["Squat down and place hands on the floor.", "Jump feet back to a plank, do a push-up.", "Jump feet forward and leap up."], muscleGroups: ["full body"], equipment: [], level: "advanced", defaultDurationSec: 30, defaultReps: 8, mediaEmoji: "🔥", status: "published" },
  { id: "ex_glute_bridge", name: "Glute Bridge", instructions: ["Lie on your back with knees bent.", "Lift hips until body forms a straight line from shoulders to knees.", "Lower slowly."], muscleGroups: ["glutes", "core"], equipment: ["mat"], level: "beginner", defaultDurationSec: 40, defaultReps: 15, mediaEmoji: "🌉", status: "published" },
  { id: "ex_bicycle_crunch", name: "Bicycle Crunches", instructions: ["Lie on your back, hands behind head.", "Bring opposite elbow to opposite knee while extending the other leg.", "Alternate sides in a pedalling motion."], muscleGroups: ["core"], equipment: ["mat"], level: "intermediate", defaultDurationSec: 40, mediaEmoji: "🚴", status: "published" },
  { id: "ex_db_rows", name: "Dumbbell Rows", instructions: ["Hinge at the hips holding dumbbells.", "Pull the weights towards your ribs, squeezing shoulder blades.", "Lower with control."], muscleGroups: ["back", "arms"], equipment: ["dumbbells"], level: "intermediate", defaultDurationSec: 45, defaultReps: 12, mediaEmoji: "🏋️", status: "published" },
  { id: "ex_db_press", name: "Dumbbell Shoulder Press", instructions: ["Hold dumbbells at shoulder height.", "Press overhead until arms are straight.", "Lower back to shoulders."], muscleGroups: ["shoulders", "arms"], equipment: ["dumbbells"], level: "intermediate", defaultDurationSec: 45, defaultReps: 10, mediaEmoji: "🏋️", status: "published" },
  { id: "ex_goblet_squat", name: "Goblet Squat", instructions: ["Hold a dumbbell at your chest.", "Squat down keeping your chest up.", "Stand up through your heels."], muscleGroups: ["legs", "glutes"], equipment: ["dumbbells"], level: "intermediate", defaultDurationSec: 45, defaultReps: 12, mediaEmoji: "🏋️", status: "published" },
  { id: "ex_neck_rolls", name: "Neck Release", instructions: ["Sit tall and drop your right ear to your right shoulder.", "Slowly roll your chin to your chest and over to the left.", "Breathe deeply."], muscleGroups: ["neck"], equipment: [], level: "beginner", defaultDurationSec: 40, mediaEmoji: "🙆", status: "published" },
  { id: "ex_seated_twist", name: "Seated Spinal Twist", instructions: ["Sit tall on your chair.", "Place right hand on left knee and twist gently to the left.", "Hold, then switch sides."], muscleGroups: ["back", "core"], equipment: ["chair"], level: "beginner", defaultDurationSec: 40, mediaEmoji: "🪑", status: "published" },
  { id: "ex_wrist_stretch", name: "Wrist & Forearm Stretch", instructions: ["Extend one arm with palm up.", "Gently pull fingers back with the other hand.", "Switch hands."], muscleGroups: ["arms"], equipment: [], level: "beginner", defaultDurationSec: 30, mediaEmoji: "✋", status: "published" },
  { id: "ex_sun_salutation", name: "Sun Salutation", instructions: ["Flow from mountain pose to forward fold.", "Step back to plank, lower, and lift to cobra.", "Press to downward dog, then return to standing."], muscleGroups: ["full body"], equipment: ["mat"], level: "beginner", defaultDurationSec: 60, mediaEmoji: "🌞", status: "published" },
  { id: "ex_childs_pose", name: "Child's Pose", instructions: ["Kneel and sit back on your heels.", "Fold forward with arms extended.", "Breathe slowly and relax."], muscleGroups: ["back"], equipment: ["mat"], level: "beginner", defaultDurationSec: 45, mediaEmoji: "🧎", status: "published" },
  { id: "ex_high_knees", name: "High Knees", instructions: ["Run in place, driving knees up to hip height.", "Pump your arms.", "Land softly on the balls of your feet."], muscleGroups: ["legs", "full body"], equipment: [], level: "intermediate", defaultDurationSec: 30, mediaEmoji: "🏃", status: "published" },
  { id: "ex_box_breathing", name: "Box Breathing", instructions: ["Inhale for 4 seconds.", "Hold for 4 seconds.", "Exhale for 4 seconds, hold for 4 seconds, repeat."], muscleGroups: ["mind"], equipment: [], level: "beginner", defaultDurationSec: 60, mediaEmoji: "🫁", status: "published" },
]

type WorkoutSeed = Omit<Workout, "id" | "companyId" | "status" | "completions" | "updatedAt">

const ex = (exerciseId: string, durationSec: number, restSec = 15, reps?: number) => ({ exerciseId, durationSec, restSec, reps })

export const WORKOUTS: WorkoutSeed[] = [
  { name: "7-Minute Desk Reset", description: "Quick stretches to undo hours of sitting. No equipment, no sweat.", category: "Desk & Office", level: "beginner", location: "office", equipment: ["chair"], muscleGroups: ["neck", "back", "arms"], durationMin: 7, calories: 25, points: 50, coverEmoji: "🪑", coverColor: "#14b8a6", exercises: [ex("ex_neck_rolls", 40, 10), ex("ex_seated_twist", 40, 10), ex("ex_wrist_stretch", 30, 10), ex("ex_seated_twist", 40, 10), ex("ex_box_breathing", 60, 0)] },
  { name: "Morning Energiser", description: "Wake up your whole body with a gentle 10-minute flow.", category: "Full Body", level: "beginner", location: "home", equipment: [], muscleGroups: ["full body"], durationMin: 10, calories: 60, points: 50, coverEmoji: "🌅", coverColor: "#f59e0b", exercises: [ex("ex_jumping_jacks", 40), ex("ex_squats", 45), ex("ex_knee_pushups", 40), ex("ex_plank", 30), ex("ex_lunges", 45), ex("ex_glute_bridge", 40, 0)] },
  { name: "Core Crusher", description: "Build a strong, stable core in 15 minutes.", category: "Core", level: "intermediate", location: "home", equipment: ["mat"], muscleGroups: ["core"], durationMin: 15, calories: 110, points: 50, coverEmoji: "🧱", coverColor: "#8b5cf6", exercises: [ex("ex_plank", 45), ex("ex_bicycle_crunch", 40), ex("ex_mountain_climbers", 35), ex("ex_glute_bridge", 40), ex("ex_plank", 45), ex("ex_bicycle_crunch", 40, 0)] },
  { name: "HIIT Fat Burner", description: "High-intensity intervals to spike your heart rate.", category: "Cardio / HIIT", level: "advanced", location: "home", equipment: [], muscleGroups: ["full body"], durationMin: 20, calories: 240, points: 50, coverEmoji: "🔥", coverColor: "#ef4444", exercises: [ex("ex_burpees", 30, 20), ex("ex_high_knees", 30, 20), ex("ex_mountain_climbers", 35, 20), ex("ex_jumping_jacks", 40, 20), ex("ex_burpees", 30, 20), ex("ex_squats", 45, 0)] },
  { name: "Lower Body Strength", description: "Squats, lunges and bridges for strong legs and glutes.", category: "Strength", level: "intermediate", location: "home", equipment: [], muscleGroups: ["legs", "glutes"], durationMin: 18, calories: 150, points: 50, coverEmoji: "🦵", coverColor: "#10b981", exercises: [ex("ex_squats", 45), ex("ex_lunges", 45), ex("ex_glute_bridge", 40), ex("ex_squats", 45), ex("ex_lunges", 45, 0)] },
  { name: "Upper Body Builder", description: "Dumbbell session for back, shoulders and arms.", category: "Strength", level: "intermediate", location: "gym", equipment: ["dumbbells"], muscleGroups: ["back", "shoulders", "arms", "chest"], durationMin: 25, calories: 180, points: 50, coverEmoji: "🏋️", coverColor: "#6366f1", exercises: [ex("ex_db_rows", 45, 30, 12), ex("ex_db_press", 45, 30, 10), ex("ex_pushups", 40, 30, 12), ex("ex_db_rows", 45, 30, 12), ex("ex_db_press", 45, 0, 10)] },
  { name: "Gym Leg Day", description: "Heavier lower-body work with dumbbells.", category: "Strength", level: "advanced", location: "gym", equipment: ["dumbbells"], muscleGroups: ["legs", "glutes"], durationMin: 30, calories: 260, points: 50, coverEmoji: "🏋️", coverColor: "#0ea5e9", exercises: [ex("ex_goblet_squat", 45, 30, 12), ex("ex_lunges", 45, 30), ex("ex_glute_bridge", 40, 30), ex("ex_goblet_squat", 45, 30, 12), ex("ex_high_knees", 30, 0)] },
  { name: "Yoga for Beginners", description: "Calm, gentle yoga to improve flexibility and breathing.", category: "Yoga", level: "beginner", location: "home", equipment: ["mat"], muscleGroups: ["full body", "back"], durationMin: 20, calories: 90, points: 50, coverEmoji: "🧘", coverColor: "#ec4899", exercises: [ex("ex_sun_salutation", 60, 10), ex("ex_childs_pose", 45, 10), ex("ex_sun_salutation", 60, 10), ex("ex_glute_bridge", 40, 10), ex("ex_childs_pose", 45, 0)] },
  { name: "Lunch-break Cardio", description: "A sweaty 12 minutes you can fit into any lunch break.", category: "Cardio / HIIT", level: "intermediate", location: "office", equipment: [], muscleGroups: ["full body"], durationMin: 12, calories: 120, points: 50, coverEmoji: "⏱️", coverColor: "#f97316", exercises: [ex("ex_jumping_jacks", 40), ex("ex_high_knees", 30), ex("ex_squats", 45), ex("ex_mountain_climbers", 35), ex("ex_jumping_jacks", 40, 0)] },
  { name: "Stress Release Breathing", description: "Slow breathing and stretches to calm your mind.", category: "Mindfulness", level: "beginner", location: "office", equipment: [], muscleGroups: ["mind"], durationMin: 8, calories: 15, points: 50, coverEmoji: "🫁", coverColor: "#06b6d4", exercises: [ex("ex_box_breathing", 60, 10), ex("ex_neck_rolls", 40, 10), ex("ex_box_breathing", 60, 10), ex("ex_childs_pose", 45, 0)] },
  { name: "Full Body Burn", description: "A balanced full-body session with no equipment.", category: "Full Body", level: "intermediate", location: "home", equipment: [], muscleGroups: ["full body"], durationMin: 22, calories: 200, points: 50, coverEmoji: "⚡", coverColor: "#84cc16", exercises: [ex("ex_jumping_jacks", 40), ex("ex_pushups", 40), ex("ex_squats", 45), ex("ex_plank", 45), ex("ex_lunges", 45), ex("ex_mountain_climbers", 35), ex("ex_burpees", 30, 0)] },
  { name: "Evening Wind-down", description: "Stretch and relax before bed for better sleep.", category: "Yoga", level: "beginner", location: "home", equipment: ["mat"], muscleGroups: ["back", "full body"], durationMin: 12, calories: 40, points: 50, coverEmoji: "🌙", coverColor: "#6366f1", exercises: [ex("ex_childs_pose", 45, 10), ex("ex_seated_twist", 40, 10), ex("ex_glute_bridge", 40, 10), ex("ex_box_breathing", 60, 0)] },
]

type HabitSeed = Omit<HabitDefinition, "id" | "usersCount" | "status">

export const HABITS: HabitSeed[] = [
  { name: "Walk 10,000 steps", description: "Reach 10,000 steps today.", icon: "👟", category: "movement", unit: "steps", defaultTarget: 10000, points: 5, autoCompleteFrom: "steps" },
  { name: "Drink 8 glasses of water", description: "Stay hydrated through the day.", icon: "💧", category: "hydration", unit: "glasses", defaultTarget: 8, points: 5, autoCompleteFrom: "water" },
  { name: "Sleep 7+ hours", description: "Get at least 7 hours of sleep.", icon: "😴", category: "sleep", unit: "hours", defaultTarget: 7, points: 5, autoCompleteFrom: "sleep" },
  { name: "Meditate", description: "Take a few minutes to breathe and reset.", icon: "🧘", category: "mindfulness", unit: "minutes", defaultTarget: 10, points: 5 },
  { name: "Stretch breaks", description: "Stand up and stretch during work.", icon: "🙆", category: "movement", unit: "times", defaultTarget: 3, points: 5 },
  { name: "Eat 5 servings of fruit & veg", description: "Fill half your plate with plants.", icon: "🥦", category: "nutrition", unit: "times", defaultTarget: 5, points: 5 },
  { name: "No sugary drinks", description: "Skip soda and sweetened drinks today.", icon: "🚫", category: "nutrition", unit: "check", defaultTarget: 1, points: 5 },
  { name: "Take the stairs", description: "Choose stairs over the lift.", icon: "🪜", category: "movement", unit: "times", defaultTarget: 2, points: 5 },
  { name: "Screen-free hour before bed", description: "Put devices away an hour before sleep.", icon: "📵", category: "sleep", unit: "check", defaultTarget: 1, points: 5 },
  { name: "Gratitude journal", description: "Write down three things you are grateful for.", icon: "📓", category: "mindfulness", unit: "check", defaultTarget: 1, points: 5 },
  { name: "Workout", description: "Complete any workout today.", icon: "🏋️", category: "movement", unit: "check", defaultTarget: 1, points: 5, autoCompleteFrom: "workout" },
  { name: "Healthy breakfast", description: "Start the day with a balanced breakfast.", icon: "🍳", category: "nutrition", unit: "check", defaultTarget: 1, points: 5 },
  { name: "Deep work focus block", description: "One 50-minute focused block without notifications.", icon: "🎯", category: "productivity", unit: "times", defaultTarget: 1, points: 5 },
  { name: "Walk after lunch", description: "A 10-minute walk after lunch helps digestion.", icon: "🚶", category: "movement", unit: "minutes", defaultTarget: 10, points: 5 },
]

type TemplateSeed = Omit<ChallengeTemplate, "id" | "usageCount" | "updatedAt" | "status">

export const CHALLENGE_TEMPLATES: TemplateSeed[] = [
  { name: "30-Day Step Challenge", description: "Walk 300,000 steps in 30 days — about 10,000 a day.", category: "movement", type: "individual", metric: "steps", target: 300000, durationDays: 30, points: 150, coverEmoji: "👟", coverColor: "#10b981", rules: ["Steps sync automatically from Apple Health or Health Connect.", "Manual entries do not count towards this challenge.", "Complete 300,000 steps before the end date to earn the reward."] },
  { name: "Department Step Battle", description: "Departments compete on average steps per person.", category: "team", type: "team", metric: "steps", target: 250000, durationDays: 21, points: 120, coverEmoji: "⚔️", coverColor: "#6366f1", rules: ["Ranking uses average steps per active member, so team size does not matter.", "Every member who joins counts toward the department average."] },
  { name: "21-Day Hydration Habit", description: "Drink 2 litres of water every day for 21 days.", category: "hydration", type: "individual", metric: "water", target: 42000, durationDays: 21, points: 100, coverEmoji: "💧", coverColor: "#06b6d4", rules: ["Log water in the app.", "Daily target is 2,000 ml."] },
  { name: "Mindful Minutes Together", description: "Meditate together to reach a company-wide goal.", category: "mindfulness", type: "collaborative", metric: "meditation", target: 10000, durationDays: 30, points: 80, coverEmoji: "🧘", coverColor: "#14b8a6", rules: ["Every meditation minute counts towards the shared goal.", "Everyone who contributes earns the points when the goal is reached."] },
  { name: "12 Workouts in 4 Weeks", description: "Complete three guided workouts a week.", category: "fitness", type: "individual", metric: "workouts", target: 12, durationDays: 28, points: 120, coverEmoji: "🏋️", coverColor: "#8b5cf6", rules: ["Any guided workout in the HealthX library counts.", "Workouts must be completed (not ended early)."] },
  { name: "Weekend Warrior Leaderboard", description: "Who can take the most steps this weekend?", category: "movement", type: "leaderboard", metric: "steps", target: 30000, durationDays: 3, points: 60, coverEmoji: "🏁", coverColor: "#f97316", rules: ["Top 10 get bonus points.", "Steps count from Friday 6 PM to Sunday 11:59 PM."] },
  { name: "Active Minutes Month", description: "Get 600 active minutes this month.", category: "fitness", type: "company", metric: "active_minutes", target: 600, durationDays: 30, points: 100, coverEmoji: "⏱️", coverColor: "#f59e0b", rules: ["Active minutes come from your phone or wearable."] },
  { name: "No Sugar Week", description: "Check in each day you avoid added sugar.", category: "habits", type: "individual", metric: "custom", target: 7, durationDays: 7, points: 70, coverEmoji: "🍬", coverColor: "#ec4899", rules: ["Check in once per day in the app.", "Be honest — this one is on trust!"] },
]

type ContentSeed = Omit<ContentItem, "id" | "companyId" | "status" | "publishedAt" | "views">

export const CONTENT: ContentSeed[] = [
  { title: "5 desk stretches to beat afternoon stiffness", summary: "Simple moves you can do in under five minutes without leaving your chair.", body: "Sitting for long periods tightens your hips, shoulders and neck. Try these five stretches every couple of hours: neck release, seated spinal twist, wrist stretch, shoulder rolls and a standing hamstring stretch. Hold each for 20–30 seconds and breathe slowly.", type: "article", category: "movement", coverColor: "#14b8a6", coverEmoji: "🪑", author: "HealthX Team", readMinutes: 3, tags: ["desk", "stretching"] },
  { title: "How much water do you really need?", summary: "The 8-glasses rule is a start — here is how to find your number.", body: "Most adults need between 2 and 3 litres of fluids a day, more when it is hot or when you exercise. A simple check: pale yellow urine means you are well hydrated. Keep a bottle at your desk and drink a glass with every meal.", type: "article", category: "hydration", coverColor: "#06b6d4", coverEmoji: "💧", author: "HealthX Team", readMinutes: 4, tags: ["hydration"] },
  { title: "Sleep hygiene: 7 habits for deeper sleep", summary: "Small evening changes that add up to better rest.", body: "Keep a regular bedtime, dim screens an hour before bed, avoid caffeine after 2 PM, keep your room cool and dark, and get morning daylight. If you cannot sleep after 20 minutes, get up and do something calm until you feel sleepy.", type: "article", category: "sleep", coverColor: "#6366f1", coverEmoji: "🌙", author: "HealthX Team", readMinutes: 5, tags: ["sleep"] },
  { title: "Box breathing in 60 seconds", summary: "A quick technique used to calm nerves before big moments.", body: "Inhale for four counts, hold for four, exhale for four, hold for four. Repeat four times. Box breathing slows your heart rate and helps you focus.", type: "video", category: "mindfulness", coverColor: "#14b8a6", coverEmoji: "🫁", author: "HealthX Team", readMinutes: 2, url: "https://example.com/box-breathing", tags: ["stress", "breathing"] },
  { title: "Build a balanced Indian thali", summary: "Half vegetables, a quarter protein, a quarter grains — with Indian favourites.", body: "Fill half your plate with sabzi and salad, a quarter with dal, paneer, eggs or chicken, and a quarter with roti or rice. Add curd for gut health and keep fried sides as an occasional treat.", type: "article", category: "nutrition", coverColor: "#f59e0b", coverEmoji: "🍛", author: "HealthX Nutrition", readMinutes: 4, tags: ["nutrition", "indian food"] },
  { title: "Tip: take a walking meeting", summary: "Turn your next 1:1 into a walk — ideas flow better on the move.", body: "Walking meetings add steps to your day and can make conversations more relaxed and creative. Keep it to small groups and pick a quiet route.", type: "tip", category: "movement", coverColor: "#10b981", coverEmoji: "🚶", author: "HealthX Team", readMinutes: 1, tags: ["steps", "work"] },
  { title: "Why streaks work (and how not to break yours)", summary: "The psychology of streaks and tips to keep them alive.", body: "Streaks use our dislike of losing progress. Set a minimum version of your habit for busy days — even 2,000 steps or one glass of water keeps the chain going.", type: "article", category: "general", coverColor: "#f97316", coverEmoji: "🔥", author: "HealthX Team", readMinutes: 3, tags: ["habits", "motivation"] },
  { title: "Beginner's guide to strength training", summary: "Why everyone should lift — and how to start safely.", body: "Strength training improves bone density, posture and metabolism. Start with bodyweight squats, push-ups and rows two to three times a week, focusing on form over weight.", type: "article", category: "movement", coverColor: "#8b5cf6", coverEmoji: "🏋️", author: "HealthX Fitness", readMinutes: 6, tags: ["strength"] },
  { title: "Tip: the 20-20-20 rule for your eyes", summary: "Every 20 minutes, look 20 feet away for 20 seconds.", body: "Screen time strains your eyes. Every 20 minutes, look at something 20 feet away for 20 seconds. Blink often and keep your screen at arm's length.", type: "tip", category: "general", coverColor: "#0ea5e9", coverEmoji: "👀", author: "HealthX Team", readMinutes: 1, tags: ["screen time"] },
  { title: "Managing stress during deadlines", summary: "Practical ways to stay calm when work piles up.", body: "Break work into small tasks, take short movement breaks, protect your sleep and talk to your manager early. A five-minute walk can reset your focus.", type: "article", category: "mindfulness", coverColor: "#ec4899", coverEmoji: "🧠", author: "HealthX Team", readMinutes: 5, tags: ["stress", "work"] },
  { title: "Healthy snacks under 200 calories", summary: "Smart swaps to keep energy steady through the afternoon.", body: "Try roasted chana, a fruit with a handful of nuts, sprouts chaat, Greek yoghurt or makhana. Pair protein with fibre to stay full longer.", type: "article", category: "nutrition", coverColor: "#84cc16", coverEmoji: "🥜", author: "HealthX Nutrition", readMinutes: 3, tags: ["snacks"] },
  { title: "10-minute morning yoga flow", summary: "Follow along to wake up your body gently.", body: "A gentle sequence of sun salutations, cat-cow and child's pose to start the day with energy.", type: "video", category: "movement", coverColor: "#f43f5e", coverEmoji: "🧘", author: "HealthX Fitness", readMinutes: 10, url: "https://example.com/morning-yoga", tags: ["yoga"] },
]

export const PROGRAMS: Omit<WellnessProgram, "id" | "companyId">[] = [
  {
    name: "Healthy Habits in 4 Weeks",
    description: "A guided month to build movement, hydration and sleep routines step by step.",
    coverEmoji: "🌱",
    coverColor: "#10b981",
    durationWeeks: 4,
    weeks: [
      { week: 1, title: "Move more", goals: [{ id: "g1", label: "Walk 7,000 steps a day", metric: "steps", target: 49000 }, { id: "g2", label: "Complete 1 workout", metric: "workouts", target: 1 }] },
      { week: 2, title: "Hydrate", goals: [{ id: "g3", label: "Drink 2 L a day", metric: "water", target: 14000 }, { id: "g4", label: "Walk 8,000 steps a day", metric: "steps", target: 56000 }] },
      { week: 3, title: "Rest & recover", goals: [{ id: "g5", label: "Meditate 10 min on 5 days", metric: "meditation", target: 50 }, { id: "g6", label: "Sleep 7 hours on 5 nights", metric: "habit", target: 5 }] },
      { week: 4, title: "Put it together", goals: [{ id: "g7", label: "Walk 10,000 steps a day", metric: "steps", target: 70000 }, { id: "g8", label: "Complete 3 workouts", metric: "workouts", target: 3 }] },
    ],
    status: "active",
    audienceType: "all",
    audienceIds: [],
    enrolledCount: 0,
    completionRate: 0,
    isTemplate: true,
  },
  {
    name: "Stress Less in 3 Weeks",
    description: "Breathing, mindfulness and gentle movement to manage stress.",
    coverEmoji: "🧘",
    coverColor: "#14b8a6",
    durationWeeks: 3,
    weeks: [
      { week: 1, title: "Breathe", goals: [{ id: "g1", label: "Meditate 5 min daily", metric: "meditation", target: 35 }] },
      { week: 2, title: "Move gently", goals: [{ id: "g2", label: "2 yoga sessions", metric: "workouts", target: 2 }, { id: "g3", label: "Meditate 10 min on 5 days", metric: "meditation", target: 50 }] },
      { week: 3, title: "Sustain", goals: [{ id: "g4", label: "Meditate 60 min total", metric: "meditation", target: 60 }, { id: "g5", label: "Walk 6,000 steps a day", metric: "steps", target: 42000 }] },
    ],
    status: "active",
    audienceType: "all",
    audienceIds: [],
    enrolledCount: 0,
    completionRate: 0,
    isTemplate: true,
  },
]

export const FOODS: Omit<FoodItem, "id">[] = [
  { name: "Roti (whole wheat)", serving: "1 medium", calories: 104, proteinG: 3.1, carbsG: 18, fatG: 2.4, tags: ["indian", "veg"] },
  { name: "Steamed rice", serving: "1 cup (150 g)", calories: 195, proteinG: 4, carbsG: 43, fatG: 0.4, tags: ["indian", "veg"] },
  { name: "Dal tadka", serving: "1 bowl (150 g)", calories: 180, proteinG: 9, carbsG: 24, fatG: 5, tags: ["indian", "veg"] },
  { name: "Paneer bhurji", serving: "1 bowl (120 g)", calories: 290, proteinG: 16, carbsG: 7, fatG: 22, tags: ["indian", "veg"] },
  { name: "Chicken curry", serving: "1 bowl (150 g)", calories: 260, proteinG: 24, carbsG: 8, fatG: 15, tags: ["indian", "non-veg"] },
  { name: "Mixed vegetable sabzi", serving: "1 bowl (150 g)", calories: 120, proteinG: 3, carbsG: 14, fatG: 6, tags: ["indian", "veg"] },
  { name: "Idli", serving: "2 pieces", calories: 116, proteinG: 4, carbsG: 24, fatG: 0.4, tags: ["indian", "veg", "breakfast"] },
  { name: "Sambar", serving: "1 bowl (150 g)", calories: 140, proteinG: 6, carbsG: 20, fatG: 4, tags: ["indian", "veg"] },
  { name: "Masala dosa", serving: "1 dosa", calories: 350, proteinG: 7, carbsG: 50, fatG: 13, tags: ["indian", "veg", "breakfast"] },
  { name: "Poha", serving: "1 plate (150 g)", calories: 250, proteinG: 5, carbsG: 42, fatG: 7, tags: ["indian", "veg", "breakfast"] },
  { name: "Upma", serving: "1 plate (150 g)", calories: 230, proteinG: 6, carbsG: 35, fatG: 7, tags: ["indian", "veg", "breakfast"] },
  { name: "Boiled eggs", serving: "2 eggs", calories: 156, proteinG: 13, carbsG: 1.1, fatG: 11, tags: ["non-veg", "breakfast"] },
  { name: "Curd (plain)", serving: "1 cup (200 g)", calories: 120, proteinG: 7, carbsG: 9, fatG: 6, tags: ["indian", "veg"] },
  { name: "Banana", serving: "1 medium", calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, tags: ["fruit", "veg"] },
  { name: "Apple", serving: "1 medium", calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, tags: ["fruit", "veg"] },
  { name: "Roasted chana", serving: "30 g", calories: 120, proteinG: 6, carbsG: 18, fatG: 2, tags: ["snack", "veg"] },
  { name: "Mixed nuts", serving: "30 g", calories: 180, proteinG: 5, carbsG: 6, fatG: 16, tags: ["snack", "veg"] },
  { name: "Sprouts chaat", serving: "1 bowl (150 g)", calories: 150, proteinG: 10, carbsG: 22, fatG: 2, tags: ["indian", "snack", "veg"] },
  { name: "Grilled chicken breast", serving: "150 g", calories: 248, proteinG: 46, carbsG: 0, fatG: 5, tags: ["non-veg"] },
  { name: "Oats with milk", serving: "1 bowl", calories: 280, proteinG: 11, carbsG: 45, fatG: 7, tags: ["breakfast", "veg"] },
  { name: "Green salad", serving: "1 bowl", calories: 50, proteinG: 2, carbsG: 9, fatG: 0.5, tags: ["veg"] },
  { name: "Masala chai (with sugar)", serving: "1 cup", calories: 90, proteinG: 3, carbsG: 12, fatG: 3, tags: ["indian", "drink"] },
  { name: "Black coffee", serving: "1 cup", calories: 5, proteinG: 0.3, carbsG: 0, fatG: 0, tags: ["drink"] },
  { name: "Rajma", serving: "1 bowl (150 g)", calories: 210, proteinG: 11, carbsG: 30, fatG: 5, tags: ["indian", "veg"] },
  { name: "Chole", serving: "1 bowl (150 g)", calories: 240, proteinG: 10, carbsG: 32, fatG: 8, tags: ["indian", "veg"] },
  { name: "Fish curry", serving: "1 bowl (150 g)", calories: 230, proteinG: 22, carbsG: 6, fatG: 13, tags: ["indian", "non-veg"] },
  { name: "Makhana (roasted)", serving: "30 g", calories: 110, proteinG: 3, carbsG: 20, fatG: 1, tags: ["indian", "snack", "veg"] },
  { name: "Vegetable biryani", serving: "1 plate (250 g)", calories: 420, proteinG: 9, carbsG: 62, fatG: 14, tags: ["indian", "veg"] },
]

export const SYSTEM_SETTINGS: Omit<SystemSetting, "updatedAt">[] = [
  { key: "app.min_version_ios", label: "Minimum iOS app version", description: "Older versions are asked to update before continuing.", group: "app", type: "text", value: "1.0.0" },
  { key: "app.min_version_android", label: "Minimum Android app version", description: "Older versions are asked to update before continuing.", group: "app", type: "text", value: "1.0.0" },
  { key: "app.maintenance_mode", label: "Maintenance mode", description: "Show a maintenance message in all apps.", group: "app", type: "boolean", value: false },
  { key: "app.default_language", label: "Default language", description: "Language used when an employee has not chosen one.", group: "app", type: "select", value: "English", options: ["English", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali"] },
  { key: "security.session_timeout_min", label: "Admin session timeout (minutes)", description: "Admins are signed out after this period of inactivity.", group: "security", type: "number", value: 30 },
  { key: "security.require_mfa_admins", label: "Require two-step verification for admins", description: "Company and platform admins must use MFA.", group: "security", type: "boolean", value: true },
  { key: "security.password_min_length", label: "Minimum password length", description: "Applies to all accounts that use a password.", group: "security", type: "number", value: 10 },
  { key: "notifications.daily_push_limit", label: "Max push notifications per employee per day", description: "Protects employees from notification overload.", group: "notifications", type: "number", value: 4 },
  { key: "notifications.sender_email", label: "Transactional email sender", description: "From-address for invitations and sign-in links.", group: "notifications", type: "text", value: "no-reply@healthx.life" },
  { key: "data.min_group_size", label: "Minimum group size for analytics", description: "Aggregates for groups smaller than this are hidden to protect privacy.", group: "data", type: "number", value: 5 },
  { key: "data.retention_days_inactive", label: "Delete data of deleted accounts after (days)", description: "Grace period before permanent deletion.", group: "data", type: "number", value: 30 },
  { key: "data.health_sync_interval_min", label: "Health data sync interval (minutes)", description: "How often the apps sync steps in the background.", group: "data", type: "number", value: 60 },
  { key: "integrations.apple_health_enabled", label: "Apple Health integration", description: "Allow employees to connect Apple Health.", group: "integrations", type: "boolean", value: true },
  { key: "integrations.health_connect_enabled", label: "Android Health Connect integration", description: "Allow employees to connect Health Connect.", group: "integrations", type: "boolean", value: true },
  { key: "integrations.fitbit_enabled", label: "Fitbit integration (Phase 2)", description: "Allow employees to connect Fitbit.", group: "integrations", type: "boolean", value: false },
]

export const INDUSTRIES = [
  "IT Services",
  "Software",
  "Banking",
  "Insurance",
  "Manufacturing",
  "Education",
  "Healthcare",
  "BPO / KPO",
  "Retail",
  "Logistics",
  "Pharmaceuticals",
  "Consulting",
] as const

export const OTHER_COMPANIES: { name: string; industry: (typeof INDUSTRIES)[number]; city: string; employees: number }[] = [
  { name: "Asteria Bank", industry: "Banking", city: "Mumbai", employees: 4200 },
  { name: "Kavach Insurance", industry: "Insurance", city: "Pune", employees: 1850 },
  { name: "Orbit Precision Manufacturing", industry: "Manufacturing", city: "Chennai", employees: 2600 },
  { name: "Lumen Learning Academy", industry: "Education", city: "Hyderabad", employees: 340 },
  { name: "Zenith Customer Services", industry: "BPO / KPO", city: "Gurugram", employees: 5400 },
  { name: "Vertex Health Clinics", industry: "Healthcare", city: "Bengaluru", employees: 620 },
  { name: "Saffron Retail Stores", industry: "Retail", city: "Ahmedabad", employees: 1280 },
  { name: "Monsoon Logistics", industry: "Logistics", city: "Kolkata", employees: 910 },
  { name: "Pixel Forge Studios", industry: "Software", city: "Bengaluru", employees: 85 },
  { name: "Northstar Pharma", industry: "Pharmaceuticals", city: "Hyderabad", employees: 3100 },
  { name: "Indus Steelworks", industry: "Manufacturing", city: "Jamshedpur", employees: 7800 },
  { name: "Coral Fintech", industry: "Software", city: "Mumbai", employees: 260 },
  { name: "Banyan Advisory", industry: "Consulting", city: "New Delhi", employees: 450 },
  { name: "Greenfield Agritech", industry: "Software", city: "Pune", employees: 64 },
  { name: "Quantum Insights Analytics", industry: "IT Services", city: "Noida", employees: 1150 },
  { name: "Harbor Line Shipping", industry: "Logistics", city: "Kochi", employees: 730 },
  { name: "Summit Auto Components", industry: "Manufacturing", city: "Pune", employees: 2250 },
  { name: "Lotus EdTech", industry: "Education", city: "Bengaluru", employees: 140 },
  { name: "Trident Infrastructure", industry: "Consulting", city: "Mumbai", employees: 980 },
  { name: "Aurora Media Network", industry: "Software", city: "Chennai", employees: 37 },
  { name: "Cedar Hospitality Group", industry: "Retail", city: "Jaipur", employees: 1600 },
  { name: "Helix Biotech Labs", industry: "Pharmaceuticals", city: "Bengaluru", employees: 290 },
]
