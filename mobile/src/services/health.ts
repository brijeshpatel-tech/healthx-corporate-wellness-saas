/**
 * Health platform access — Apple Health (iOS) and Health Connect (Android).
 *
 * Screens only talk to `healthService` (this interface). Today it is a MOCK so the app
 * runs everywhere (Expo Go, web, emulators) without native health modules.
 *
 * TODO (native integration — needs a development build, not Expo Go):
 *  - iOS:     `npx expo install react-native-health` → HealthKit: add the config plugin with
 *             NSHealthShareUsageDescription, then implement requestPermissions() with
 *             AppleHealthKit.initHealthKit(...) and readDailyTotals() with getDailyStepCountSamples /
 *             getDistanceWalkingRunning / getActiveEnergyBurned / getAppleExerciseTime.
 *  - Android: `npx expo install react-native-health-connect expo-build-properties` (minSdk 26) →
 *             add the config plugin + READ_STEPS, READ_DISTANCE, READ_ACTIVE_CALORIES_BURNED,
 *             READ_EXERCISE permissions; implement with initialize(), requestPermission(),
 *             aggregateRecord({ recordType: "Steps", timeRangeFilter }). If the Health Connect app is
 *             missing, isAvailable() returns reason "not_installed" (UI links to the Play Store).
 *  - Motion:  iOS CMPedometer permission (NSMotionUsageDescription is already in app.config.ts) /
 *             Android ACTIVITY_RECOGNITION runtime permission (already declared).
 * After reading, POST the daily totals to /me/activity/sync (activityApi.sync) — the backend
 * de-duplicates sources (FEAT-072).
 */
import { Platform } from "react-native"

export type HealthProviderId = "apple_health" | "health_connect"

export interface HealthDataTypeInfo {
  /** Name stored with the connection (matches the backend / sample data). */
  key: string
  label: string
  description: string
  /** Sleep is read from Phase 2. */
  phase: 1 | 2
}

export interface HealthAvailability {
  available: boolean
  provider: HealthProviderId
  label: string
  /** Why it isn't available (Android without the Health Connect app, unsupported device). */
  reason?: "not_installed" | "unsupported"
  storeUrl?: string
}

export interface DailyHealthTotals {
  date: string
  steps: number
  distanceKm: number
  activeCalories: number
  activeMinutes: number
}

export type PermissionResult = "granted" | "denied"

export interface HealthService {
  /** Platform for this device: Apple Health on iOS, Health Connect elsewhere. */
  provider: HealthProviderId
  label: string
  dataTypes: HealthDataTypeInfo[]
  isAvailable(): Promise<HealthAvailability>
  /** Shows the platform permission sheet. Returns the data types the user allowed. */
  requestPermissions(types: string[]): Promise<{ granted: string[]; denied: string[] }>
  /** Motion & fitness / physical activity permission (step counting). */
  requestMotionPermission(): Promise<PermissionResult>
  /** Daily totals between two local dates (inclusive). */
  readDailyTotals(from: Date, to: Date): Promise<DailyHealthTotals[]>
}

const PROVIDER: HealthProviderId = Platform.OS === "ios" ? "apple_health" : "health_connect"

export const PROVIDER_LABEL: Record<HealthProviderId, string> = {
  apple_health: "Apple Health",
  health_connect: "Health Connect",
}

const DATA_TYPES: Record<HealthProviderId, HealthDataTypeInfo[]> = {
  apple_health: [
    { key: "Steps", label: "Steps", description: "Daily steps for your goal, challenges and points", phase: 1 },
    { key: "Distance", label: "Walking + running distance", description: "Shown on your Activity screen", phase: 1 },
    { key: "Active energy", label: "Active energy", description: "Calories burned while moving", phase: 1 },
    { key: "Workouts", label: "Workouts & exercise minutes", description: "Active minutes and workout challenges", phase: 1 },
    { key: "Sleep", label: "Sleep", description: "Sleep duration for the sleep tracker", phase: 2 },
  ],
  health_connect: [
    { key: "Steps", label: "Steps", description: "Daily steps for your goal, challenges and points", phase: 1 },
    { key: "Distance", label: "Distance", description: "Shown on your Activity screen", phase: 1 },
    { key: "Active calories", label: "Active calories burned", description: "Calories burned while moving", phase: 1 },
    { key: "Exercise", label: "Exercise sessions", description: "Active minutes and workout challenges", phase: 1 },
    { key: "Sleep", label: "Sleep", description: "Sleep duration for the sleep tracker", phase: 2 },
  ],
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Mock implementation — behaves like a successful connection with realistic delays. */
const mockHealthService: HealthService = {
  provider: PROVIDER,
  label: PROVIDER_LABEL[PROVIDER],
  dataTypes: DATA_TYPES[PROVIDER],
  async isAvailable() {
    return { available: true, provider: PROVIDER, label: PROVIDER_LABEL[PROVIDER] }
  },
  async requestPermissions(types) {
    await wait(900)
    return { granted: types, denied: [] }
  },
  async requestMotionPermission() {
    await wait(500)
    return "granted"
  },
  async readDailyTotals(from, to) {
    const out: DailyHealthTotals[] = []
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const steps = 5000 + Math.round(Math.random() * 5000)
      out.push({
        date: d.toISOString().slice(0, 10),
        steps,
        distanceKm: Number((steps * 0.00076).toFixed(2)),
        activeCalories: Math.round(steps * 0.042),
        activeMinutes: Math.round(steps / 150),
      })
    }
    return out
  },
}

export const healthService: HealthService = mockHealthService
