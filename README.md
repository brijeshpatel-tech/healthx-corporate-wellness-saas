# HealthX Business — Frontend

Corporate wellness platform frontend: three web apps (one Next.js project) and the employee mobile app (React Native + Expo, Android & iOS).
Backend is not built yet — every screen runs on built-in **sample data** and switches to the real API when you fill in the environment files.

```
healthx-business/
├── web/       Next.js 16 · React 19 · Tailwind 4 · shadcn/ui — admin-portal, business-portal, employee-app
├── mobile/    React Native (Expo, TypeScript) — HealthX employee app (Android / iOS)
└── docs/      Screen specs (from the requirement workbook), roles & permissions, frontend guide
```

## Web — quick start

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

| App | URL | Users |
|---|---|---|
| Landing (choose an app) | http://localhost:3000 | — |
| Platform Admin Portal | http://localhost:3000/admin-portal | HealthX internal team |
| Business Portal | http://localhost:3000/business-portal | Company Owner · HR Admin · Wellness Manager · Team Manager |
| Employee App (web) | http://localhost:3000/employee-app | Employees · Team Managers |

### Demo accounts (sample-data mode)

Password for all: `Demo@1234` · verification code: `123456` (`000000` simulates a wrong code)

| Portal | Email | Role |
|---|---|---|
| Admin | arjun.nair@healthx.life | Super Admin |
| Admin | meera.joshi@healthx.life | Support Admin |
| Admin | kabir.sethi@healthx.life | Content Admin |
| Business | ananya.iyer@nimbustech.in | Company Owner |
| Business | vikram.mehta@nimbustech.in | HR Admin |
| Business | sneha.kapoor@nimbustech.in | Wellness Manager |
| Business | rahul.verma@nimbustech.in | Team Manager |
| Employee | priya.sharma@nimbustech.in | Employee |
| Employee | rahul.verma@nimbustech.in | Team Manager |
| Employee | invitation `NIMBUS-WELCOME-2026` | New joiner (onboarding flow) |

Company code for the employee app: `NIMBUS`. In the Business Portal user menu, **Preview as role** switches between the four company roles. **Reset sample data** clears all changes.

### Environments

`web/.env.development`, `.env.staging`, `.env.production` contain every key with blank values (documented in `web/.env.example`). Fill them in when the backend is ready:

- `NEXT_PUBLIC_API_BASE_URL` — e.g. `http://localhost:4000`. When blank, the app uses sample data.
- `NEXT_PUBLIC_USE_MOCK_API=true` — force sample data even when an API URL is set.
- Sign-in providers (Google, Microsoft), Firebase web push, CDN, Sentry, PostHog, support email.

Scripts: `npm run dev`, `npm run dev:staging`, `npm run build`, `npm run build:staging`, `npm run start`, `npm run typecheck`, `npm run lint`.

### Connecting the real backend

Every data call is declared once in `web/src/lib/api/**` with its REST route (from the API inventory) and a mock implementation, e.g.
`employeesApi.list` → `GET /api/v1/organization/employees`. Set the API URL and the same screens call the backend with the user's bearer token — no screen changes needed. See `docs/FRONTEND_GUIDE.md`.

## Mobile — quick start

See `mobile/README.md`. Short version:

```bash
cd mobile
npm install
npm run start          # Expo dev server — press a (Android) / i (iOS) / w (web)
```

The mobile app reuses the web app's TypeScript types, sample data and employee services (`npm run sync-shared` copies them from `web/`), so both apps behave the same.

## Docs

- `docs/FRONTEND_GUIDE.md` — how the web code is organised and how to add a screen
- `docs/screens-admin-portal.md`, `docs/screens-business-portal.md`, `docs/screens-employee-app.md` — screen specs
- `docs/roles-permissions.md` — role & permission matrix
