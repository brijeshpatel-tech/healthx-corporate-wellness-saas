/**
 * Typed access to environment variables.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so every variable must be
 * referenced statically (process.env.NEXT_PUBLIC_X) — never through a dynamic key.
 * Blank values fall back to safe defaults so the app runs on sample data.
 */

const blank = (value: string | undefined) => (value ?? "").trim()

const apiBaseUrl = blank(process.env.NEXT_PUBLIC_API_BASE_URL).replace(/\/+$/, "")
const mockFlag = blank(process.env.NEXT_PUBLIC_USE_MOCK_API).toLowerCase()

export type AppEnv = "development" | "staging" | "production"

export const env = {
  appEnv: (blank(process.env.NEXT_PUBLIC_APP_ENV) || "development") as AppEnv,
  appName: blank(process.env.NEXT_PUBLIC_APP_NAME) || "HealthX Business",
  appUrl: blank(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000",

  apiBaseUrl,
  apiVersion: blank(process.env.NEXT_PUBLIC_API_VERSION) || "v1",
  /** Sample data is used when explicitly enabled or when no API URL is configured. */
  useMock: mockFlag === "true" || !apiBaseUrl,
  wsUrl: blank(process.env.NEXT_PUBLIC_WS_URL),
  apiTimeoutMs: Number(blank(process.env.NEXT_PUBLIC_API_TIMEOUT_MS)) || 20000,

  googleClientId: blank(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
  microsoftClientId: blank(process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID),
  microsoftTenantId: blank(process.env.NEXT_PUBLIC_MICROSOFT_TENANT_ID) || "common",

  firebase: {
    apiKey: blank(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: blank(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: blank(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: blank(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: blank(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: blank(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    vapidKey: blank(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
  },

  assetsCdnUrl: blank(process.env.NEXT_PUBLIC_ASSETS_CDN_URL),
  sentryDsn: blank(process.env.NEXT_PUBLIC_SENTRY_DSN),
  posthogKey: blank(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  posthogHost: blank(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  supportEmail: blank(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) || "support@healthx.life",
} as const

export const apiUrl = (path: string) =>
  `${env.apiBaseUrl}/api/${env.apiVersion}${path.startsWith("/") ? path : `/${path}`}`
