# HealthX Business — Frontend guide (web)

Everything a developer needs to add or change a screen in `web/`.

> **Scope rule:** build only what is in `docs/SCOPE.md` (client feature sheet, Phase 1 + Phase 2). Nothing extra. Client decisions listed there override the screen specs.

## 1. Apps and URLs (one Next.js app on localhost:3000)

| App | URL | Who | Sign-in |
|---|---|---|---|
| Platform Admin Portal | `/admin-portal/*` | HealthX staff (Super Admin, Support Admin, Content Admin) | `/admin-portal/login` (password + 6-digit code) |
| Business Portal | `/business-portal/*` | Company Owner, HR Admin, Wellness Manager, Team Manager | `/business-portal/login` (password + 6-digit code) |
| Employee App (web) | `/employee-app/*` | Employees, Team Managers | `/employee-app/welcome` → `/employee-app/sign-in` |

Demo mode (no backend): any password works for the demo accounts (shown on each sign-in page), code `123456`. Code `000000` simulates a wrong code. Company code `NIMBUS`. Invitation token `NIMBUS-WELCOME-2026` (new joiner Karan → onboarding).

## 2. Folder structure

```
web/src
├── app/                         routes (App Router)
│   ├── admin-portal/(app)/…     signed-in admin pages (layout = AuthGuard + PortalShell)
│   ├── business-portal/(app)/…  signed-in business pages (same shell, role-filtered menu)
│   └── employee-app/(app)/…     signed-in employee pages (EmployeeShell: sidebar / bottom tabs)
├── components/
│   ├── ui/                      shadcn/ui primitives (Radix) — do not edit
│   ├── common/                  shared building blocks (see §5)
│   ├── shell/                   layouts, guards, theme toggle, command menu
│   ├── auth/                    shared sign-in pieces
│   ├── admin/ business/ employee/   portal-specific components
├── config/  env.ts (typed env), nav.ts (menus + route permissions)
├── lib/
│   ├── api/core.ts              endpoint() factory, ApiError, mock helpers
│   ├── api/hooks.ts             useApiQuery / useApiMutation
│   ├── api/auth.ts              sign-in services (all portals)
│   ├── api/platform/*.ts        Admin Portal services
│   ├── api/business/*.ts        Business Portal services
│   ├── api/employee/*.ts        Employee App services
│   ├── auth/session.ts          per-portal sessions (zustand, persisted)
│   ├── auth/permissions.ts      Business Portal permission matrix + useCan()
│   ├── mock/                    sample database (seed, persistence) — mock mode only
│   ├── types.ts                 domain types
│   ├── format.ts                number/date/currency helpers (en-IN)
│   └── download.ts              CSV download / parse
```

## 3. Data access — always through a service

Every call is declared once with its **real REST route** and a **mock implementation**:

```ts
// lib/api/business/teams.ts
export const teamsApi = {
  list: endpoint<{ departmentId?: string }, TeamRow[], "business">(
    "business", "GET", "/organization/teams",
    (q, ctx) => ctx.db.teams.filter((t) => t.companyId === ctx.companyId() && (!q.departmentId || t.departmentId === q.departmentId)),
  ),
  create: endpoint<CreateTeamInput, Team, "business">("business", "POST", "/organization/teams", (input, ctx) => {
    // validate → throw badRequest("Message", { field: "error" })
    // mutate ctx.db … then ctx.save()
    audit(ctx, { action: "Created team", entityType: "Team", entityName: input.name, companyId: ctx.companyId() })
    ctx.save()
    return team
  }),
}
```

- Real mode (`NEXT_PUBLIC_API_BASE_URL` set): `GET {base}/api/v1/organization/teams?departmentId=…` with the portal's bearer token.
- Path params `:id` are taken from the input object; other fields → query (GET/DELETE) or JSON body (POST/PUT/PATCH).
- `ctx` gives `db`, `save()`, `session()`, `companyId()`, `me()` (employee private data), `extra(key, init)` (feature-owned extra sample data), `now`.
- Throw `badRequest(msg, fieldErrors)`, `notFound("Thing")`, `forbidden()` — the UI shows them.
- Company admins **never** receive individual health data (steps history, water, sleep…). Only aggregates, with groups smaller than `minAnalyticsGroupSize` (5) suppressed.
- Employee-app services only read/write the signed-in employee's data via `ctx.me()`.
- Keep mock services free of `@/lib/mock/seed` and `@/lib/mock/random` imports (they pull the data generator into the page bundle). Use `@/lib/mock/series` (dates, `dailySeries`, `noise`, colours) and `@/lib/mock/defaults`.

In pages:

```tsx
const q = useApiQuery(["business", "teams", filters], () => teamsApi.list(filters))
const create = useApiMutation(teamsApi.create, { success: "Team created", onSuccess: () => setOpen(false) })
```

`useApiMutation` refreshes all queries after success and shows toasts (success + API error message). Map `ApiError.fieldErrors` onto form fields with `form.setError`.

## 4. Roles & access

- Menus and page access come from `config/nav.ts`. A page is reachable only by the roles on its nav item (longest matching href). Sub-pages inherit (e.g. `/business-portal/challenges/new` follows "Challenges").
- Inside pages use `useCan()` (Business Portal) to show/hide actions: `can("challenges.manage")`. Team Managers can view challenges but not create/edit.
- Platform roles: Super Admin (everything), Support Admin (companies, users, subscriptions, orders, support, audit), Content Admin (templates, rewards, badges, workouts, exercises, habits, content).

## 5. Shared components (import from `@/components/common/...`)

| Component | Use |
|---|---|
| `PageContainer`, `PageHeader` (title, description, actions, backHref, badge) | Every page starts with these |
| `StatCard` (label, value, icon, tone, delta, hint, href) | KPI tiles |
| `DataTable` (columns, rows, getRowId, loading, pagination / clientPageSize, selectable, toolbar, onRowClick, empty*) | All tables |
| `SearchInput` (debounced), `ConfirmDialog`, `SectionCard`, `KeyValueList`, `PrivacyNote`, `InlineBar` | `misc.tsx` |
| `StatusBadge` (any status string), `PhaseBadge` | statuses & "Phase 2" tags |
| `PersonCell`, `UserAvatar` | people in lists |
| `EmptyState`, `ErrorState`, `QueryState`, `PageSkeleton`, `TableSkeleton`, `AccessDenied` | `states.tsx` |
| `TrendChart`, `BarsChart`, `DonutChart`, `Sparkline`, `ProgressRing`, `ChartLegend` | `charts.tsx` |
| `TextField`, `TextareaField`, `SelectField`, `SwitchField`, `CheckboxField`, `ChoiceField`, `FieldShell` | `form-fields.tsx` (React Hook Form + zod) |

UI primitives: `@/components/ui/*` (button, card, dialog, sheet, tabs, select, dropdown-menu, table, badge, progress, switch, slider, calendar, popover, command, tooltip, accordion, alert, alert-dialog, input-otp, toggle-group, skeleton, spinner, empty, item, field, kbd…). Icons: `lucide-react`.

## 6. Design rules

- Brand: emerald primary (`bg-primary`, `text-primary`), Plus Jakarta Sans headings, Inter body. Rounded-xl cards, soft shadows, generous spacing. Light **and** dark mode must both look right — use tokens (`bg-card`, `text-muted-foreground`, `border`), never hard-coded greys.
- Page = `PageContainer` → `PageHeader` → filter row (one row, above content) → content.
- Every data view has loading (skeleton), empty (with a helpful action), error (with Retry) and success (toast) states — as in the spec (`docs/screens-*.md`).
- Forms: React Hook Form + zod, inline field errors, disabled submit while pending, `Spinner` in the button.
- Destructive actions use `ConfirmDialog`.
- Responsive: works from 360px phones to wide desktops. Tables hide secondary columns on mobile (`hideOnMobile`).
- Charts: categorical colours `var(--chart-1..8)` in fixed order; single-series charts use the brand colour; one y-axis only; legends for 2+ series; tooltips.
- Numbers/dates: always via `lib/format.ts` (`formatNumber`, `formatCompact`, `formatPercent`, `formatCurrency`, `formatDate`, `formatRelative`, `formatMl`, `formatDuration`).
- Phase 2 features are fully built but tagged with `<PhaseBadge phase={2} />` in page headers.
- Next.js 16: client pages (`"use client"`) read route params with `useParams()`. Any component calling `useSearchParams()` must be inside `<Suspense>`.

## 7. Environment

`.env.development`, `.env.staging`, `.env.production` (all blank) and `.env.example` (documented). With no `NEXT_PUBLIC_API_BASE_URL` the app runs on sample data. Scripts: `npm run dev`, `npm run dev:staging`, `npm run build`, `npm run build:staging`, `npm run typecheck`, `npm run lint`.
