# HealthX Employee app (mobile)

React Native app for employees, built with **Expo SDK 57**, **Expo Router** and **TypeScript**.
It is the mobile twin of the web employee app in `../web` (`/employee-app`) and shows the same data and rules.

**Frontend only.** Out of the box the app runs on **built-in sample data** — no backend, no keys, no accounts needed.
Scope: the client feature sheet, Phase 1 + Phase 2 only (see `../docs/SCOPE.md`). No "Phase" labels are shown in the app (`<PhaseBadge />` is kept in the code as a marker but renders nothing).

---

## 1. Run it

Requirements: Node.js 20+ and npm. For a phone: the **Expo Go** app (Android / iOS) on the same Wi-Fi as your computer.

```bash
npm install            # once
npm run start          # dev server (development env) — scan the QR code with Expo Go
npm run start:staging  # same, with .env.staging and the "HealthX Staging" app variant
npm run android        # dev server + open on a connected Android device / emulator
npm run ios            # dev server + open on the iOS simulator (needs a Mac)
npm run web            # run in the browser
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run sync-shared` | Copy the shared code from `../web` (see §4) |
| `npm run export:web` | Static web build into `dist/` |
| `npm run doctor` | `expo-doctor` dependency / config check |

After changing a `.env*` file restart with `npx expo start --clear`.

## 2. Environment variables

Copy keys from **`.env.example`** (it documents every key). Files:

| File | Used by |
|---|---|
| `.env.development` | `npm run start` / `android` / `ios` / `web` |
| `.env.staging` | `npm run start:staging` |
| `.env.production` | production builds / `npm run export:web` |

**All values are blank by design.** Blank = safe defaults and sample-data mode.

| Key | Purpose |
|---|---|
| `EXPO_PUBLIC_APP_ENV` | `development` / `staging` / `production` — app name and bundle id suffix (`.dev`, `.staging`) |
| `EXPO_PUBLIC_APP_NAME` | Display name (default "HealthX") |
| `EXPO_PUBLIC_API_BASE_URL` | Backend base URL, without `/api/v1`. **Blank = sample data** |
| `EXPO_PUBLIC_API_VERSION` | API version segment (default `v1`) |
| `EXPO_PUBLIC_USE_MOCK_API` | `true` forces sample data even when an API URL is set |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Request timeout (default 20000) |
| `EXPO_PUBLIC_WS_URL` | Realtime WebSocket URL (leaderboards / live progress) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` / `_ANDROID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Sign in with Google |
| `EXPO_PUBLIC_MICROSOFT_CLIENT_ID`, `EXPO_PUBLIC_MICROSOFT_TENANT_ID` | Sign in with Microsoft (tenant default `common`) |
| `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | Monitoring / analytics |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Shown on help / error screens (default support@healthx.life) |

`EXPO_PUBLIC_*` values are compiled into the app — **never put secrets in them**. Read them only through `src/config/env.ts`.

## 3. Sample-data mode and demo accounts

With no API URL, every API call runs against an on-device sample database (`src/lib/mock`), saved on the device, so changes you make (water logged, habits ticked, workouts finished…) persist between launches.

| What | Value |
|---|---|
| Company code (welcome screen) | `NIMBUS` |
| Employee | `priya.sharma@nimbustech.in` |
| Team Manager | `rahul.verma@nimbustech.in` |
| Password | `Demo@1234` |
| OTP / verification code | `123456` |
| Invite token | `NIMBUS-WELCOME-2026` |

## 4. Shared code with the web app — `npm run sync-shared`

The web app (`../web/src/lib`) is the single source of truth for the **types, formatters, sample data and employee API services**. `npm run sync-shared` copies these into `src/lib` with the same paths:

- `types.ts`, `format.ts`
- `mock/series.ts`, `mock/defaults.ts`, `mock/demo-accounts.ts`, `mock/random.ts`, `mock/seed/**`
- `api/auth.ts`, `api/employee/**` (habits, sleep, workouts, nutrition, activity, home, water, challenges, rewards…)

Why: both apps then use the same business rules (points once per activity, approvals, validation messages…) and the same sample data, so they always agree.

Rules:
- Every synced file starts with `// AUTO-SYNCED from web/src/lib`. **Never edit synced files in mobile** — change them in `web/` and run `npm run sync-shared` again.
- Files that import web-only code are skipped (the script lists them). Files deleted in web are removed here too.
- Mobile-specific twins (not synced, same exports): `src/config/env.ts`, `src/lib/auth/session.ts`, `src/lib/mock/db.ts`, `src/lib/api/core.ts`, `src/lib/api/hooks.ts`.

## 5. Folder structure

```
mobile/
├─ app.config.ts          Expo config (name / bundle id per environment, plugins, icons, splash)
├─ eas.json               EAS Build profiles: development, staging, production
├─ .env.example           All environment keys, documented
├─ scripts/sync-shared.mjs
├─ assets/images/         App icon, adaptive icon, splash, favicon
└─ src/
   ├─ app/                Screens — every file is a route (Expo Router)
   │  ├─ (auth)/          Welcome, sign-in, verify, invite, terms…
   │  ├─ (tabs)/          Bottom tabs: Home, Activity, Challenges, Rewards, Profile
   │  ├─ onboarding/      First-run onboarding
   │  ├─ activity/        History, log activity, daily step goal
   │  ├─ habits/          My habits, choose, detail, create custom habit
   │  ├─ sleep/           Sleep dashboard, log sleep
   │  ├─ workouts/        Library, detail, player ([id]/play), history
   │  ├─ nutrition/       Food log, add food
   │  ├─ home/customise   Customise Home
   │  └─ …                water, challenges, wallet, rewards, badges, settings, help…
   ├─ components/
   │  ├─ ui/              UI kit: Screen, Card, Button, Text, TextField, charts, sheets, states…
   │  ├─ track/           Tracking components (habits, sleep, workouts, nutrition, home layout)
   │  └─ engage/          Engagement components (challenges, rewards, feed…)
   ├─ features/           Feature pieces shared by several screens (home cards, sync status, auth)
   ├─ config/env.ts       Typed environment variables
   ├─ lib/
   │  ├─ api/             core (fetch / mock switch), hooks (React Query), employee/** (synced services)
   │  ├─ auth/            Session store (secure storage)
   │  ├─ mock/            Sample database (seed is synced from web)
   │  └─ format.ts, types.ts, toast.ts, haptics.ts, routes.ts…
   ├─ services/           Device services: health (Apple Health / Health Connect — mock today), push
   └─ theme/              Design tokens (light / dark), theme provider
```

## 6. Add a screen

1. Create a file under `src/app/`, e.g. `src/app/water/history.tsx` → route `/water/history`. Export a default component.
2. Build it with the UI kit (`import { Screen, Card, Button, … } from "@/components/ui"`) and theme colours from `useTheme()` — no hard-coded greys, so dark mode works.
3. Load data with the synced service + React Query, the same way the web page does:
   ```tsx
   const q = useApiQuery(["employee", "water"], () => waterApi.today())
   const add = useApiMutation(waterApi.add, { success: "+250 ml logged" })
   ```
   Always handle loading (`Skeleton`), empty (`EmptyState`), error with Retry (`ErrorState`) and success (toast).
4. Link to it with `router.push("/water/history")`.
5. Screen-specific components go in `src/components/<area>/`. Run `npm run typecheck` and `npm run lint`.

## 7. Switch to the real API

1. Set `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://api.healthx.life`; Android emulator → `http://10.0.2.2:4000`) in the right `.env*` file, and leave `EXPO_PUBLIC_USE_MOCK_API` blank.
2. Restart with `npx expo start --clear`.

Every service endpoint then calls `{base}/api/{version}{path}` (e.g. `GET /api/v1/me/water/today`) with the session's bearer token — no screen changes are needed. Path params (`:id`) come from input fields of the same name; other fields become the query string (GET/DELETE) or JSON body (POST/PUT/PATCH). See `src/lib/api/core.ts`.

Native health data (Apple Health / Health Connect) is mocked in `src/services/health.ts`; that file lists the packages and steps for the real integration (needs a development build, not Expo Go).

## 8. Android build

**Cloud (recommended):** `npx eas-cli@latest build --platform android --profile development` (or `staging` / `production`). Development and staging produce an installable `.apk`; production produces an `.aab` for Google Play.

**Local:** needs Android Studio (its bundled JDK) and the Android SDK.

```bash
npx expo prebuild --platform android --clean    # generates ./android (not committed — regenerate any time)
# android/local.properties →  sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk   (if Gradle can't find the SDK)
cd android
# Windows (Git Bash):
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
./gradlew assembleDebug
# faster: only the ABIs you need, fewer parallel workers on a busy PC
./gradlew assembleDebug --max-workers=2 -PreactNativeArchitectures=arm64-v8a,x86_64
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk` — install with `adb install -r <apk>`.
A debug APK loads JavaScript from the dev server (`npm run start`); for a standalone APK use `./gradlew assembleRelease` (signed with the debug key unless you configure a release keystore) or EAS Build.

`android/` and `ios/` are generated (Continuous Native Generation) and git-ignored — configure native behaviour in `app.config.ts` and config plugins, never by editing those folders. Note: `expo prebuild` rewrites the `android` / `ios` npm scripts to `expo run:*`; restore them to `expo start --android` / `expo start --ios` if you want the Expo Go workflow.

## 9. iOS

iOS builds need **a Mac with Xcode** (`npx expo prebuild --platform ios` then `npx expo run:ios`) **or EAS Build** from any OS: `npx eas-cli@latest build --platform ios --profile development` (simulator build) or `--profile production` (App Store, needs an Apple Developer account). For day-to-day testing, Expo Go on an iPhone works without a Mac (`npm run start`, scan the QR code).
