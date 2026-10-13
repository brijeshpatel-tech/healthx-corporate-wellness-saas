/**
 * Typed access to environment variables (mobile twin of web/src/config/env.ts — same `env` shape).
 *
 * EXPO_PUBLIC_* values are inlined into the JS bundle at build time, so every
 * variable must be referenced statically (process.env.EXPO_PUBLIC_X) — never through a
 * dynamic key. Blank values fall back to safe defaults so the app runs on sample data.
 *
 * Files: .env.development (npm start), .env.staging (npm run start:staging), .env.production (EAS production).
 */
import Constants from "expo-constants"
import { Platform } from "react-native"

const blank = (value: string | undefined) => (value ?? "").trim()

const apiBaseUrl = blank(process.env.EXPO_PUBLIC_API_BASE_URL).replace(/\/+$/, "")
const mockFlag = blank(process.env.EXPO_PUBLIC_USE_MOCK_API).toLowerCase()

export type AppEnv = "development" | "staging" | "production"

/** Fallback set by app.config.ts (APP_ENV from `npm run start:staging` / EAS profiles). */
const configAppEnv = (Constants.expoConfig?.extra as { appEnv?: string } | undefined)?.appEnv

export const env = {
  appEnv: (blank(process.env.EXPO_PUBLIC_APP_ENV) || configAppEnv || "development") as AppEnv,
  appName: blank(process.env.EXPO_PUBLIC_APP_NAME) || "HealthX",
  /** Not used by the native app (kept for parity with the web env shape). */
  appUrl: "",

  apiBaseUrl,
  apiVersion: blank(process.env.EXPO_PUBLIC_API_VERSION) || "v1",
  /** Sample data is used when explicitly enabled or when no API URL is configured. */
  useMock: mockFlag === "true" || !apiBaseUrl,
  wsUrl: blank(process.env.EXPO_PUBLIC_WS_URL),
  apiTimeoutMs: Number(blank(process.env.EXPO_PUBLIC_API_TIMEOUT_MS)) || 20000,

  /** Google sign-in: the client id for the current platform (iOS / Android / web). */
  googleClientId:
    Platform.select({
      ios: blank(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
      android: blank(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID),
      default: blank(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    }) ?? "",
  googleClientIdIos: blank(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
  googleClientIdAndroid: blank(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID),
  googleWebClientId: blank(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  microsoftClientId: blank(process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID),
  microsoftTenantId: blank(process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID) || "common",

  sentryDsn: blank(process.env.EXPO_PUBLIC_SENTRY_DSN),
  posthogKey: blank(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: blank(process.env.EXPO_PUBLIC_POSTHOG_HOST),
  supportEmail: blank(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) || "support@healthx.life",
} as const

export const apiUrl = (path: string) =>
  `${env.apiBaseUrl}/api/${env.apiVersion}${path.startsWith("/") ? path : `/${path}`}`
