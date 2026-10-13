/**
 * Dynamic Expo config. The app variant follows the environment:
 *
 *   development → "HealthX Dev"      life.healthx.employee.dev
 *   staging     → "HealthX Staging"  life.healthx.employee.staging
 *   production  → "HealthX"          life.healthx.employee
 *
 * Environment = EXPO_PUBLIC_APP_ENV (from the .env file), else APP_ENV (set by
 * `npm run start:staging` and by the EAS build profiles in eas.json), else development.
 */
import type { ConfigContext, ExpoConfig } from "expo/config"

type AppEnv = "development" | "staging" | "production"

const raw = (process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || "development").trim()
const APP_ENV: AppEnv = raw === "production" || raw === "staging" ? raw : "development"

const VARIANT: Record<AppEnv, { idSuffix: string; nameSuffix: string }> = {
  development: { idSuffix: ".dev", nameSuffix: " Dev" },
  staging: { idSuffix: ".staging", nameSuffix: " Staging" },
  production: { idSuffix: "", nameSuffix: "" },
}

const BASE_ID = "life.healthx.employee"
const APP_ID = `${BASE_ID}${VARIANT[APP_ENV].idSuffix}`
const APP_NAME = `${process.env.EXPO_PUBLIC_APP_NAME?.trim() || "HealthX"}${VARIANT[APP_ENV].nameSuffix}`

// Brand colours (see src/theme/tokens.ts).
const EMERALD = "#059669"

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: "healthx-employee",
  // Must be ≥ the minimum supported version returned by GET /app/config (sample data: 2.0.0).
  version: "2.4.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "healthx",
  userInterfaceStyle: "automatic",
  backgroundColor: "#f8fafc",
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    infoPlist: {
      NSMotionUsageDescription: "HealthX counts your steps and active minutes to show your daily progress.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      backgroundColor: EMERALD,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    permissions: ["android.permission.ACTIVITY_RECOGNITION"],
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
    name: APP_NAME,
    themeColor: EMERALD,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: EMERALD,
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
        dark: { backgroundColor: "#064e3b", image: "./assets/images/splash-icon.png" },
      },
    ],
    "expo-secure-store",
    "expo-font",
    [
      "expo-image-picker",
      {
        photosPermission: "Choose a profile photo from your library.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    appEnv: APP_ENV,
  },
})
