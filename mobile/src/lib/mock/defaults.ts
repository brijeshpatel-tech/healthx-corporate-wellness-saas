// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Lightweight defaults shared by the seed and the mock services. */
import type { CompanySettings } from "@/lib/types"

export function defaultCompanySettings(companyId: string): CompanySettings {
  return {
    companyId,
    defaultLanguage: "English",
    timezone: "Asia/Kolkata",
    weekStartsOn: "monday",
    leaderboardNameDisplay: "first_name_initial",
    allowLeaderboardOptOut: true,
    allowManualActivity: true,
    manualActivityEarnsPoints: false,
    redemptionApprovalRequired: true,
    minAnalyticsGroupSize: 5,
    defaultStepGoal: 8000,
    defaultWaterGoalMl: 2500,
    pointsExpiryMonths: null,
    notifications: {
      challengeReminders: true,
      weeklySummary: true,
      rewardUpdates: true,
      inactivityNudges: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
    },
    aiCoachEnabled: false,
    aiInsightsEnabled: true,
  }
}
