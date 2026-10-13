# Platform Admin Portal (HealthX Super Admin) — screen spec

Source: HEALTHX_BUSINESS_REQUIREMENT_AND_DEVELOPMENT_PLAN.xlsx, sheet 07. Phase is in Notes.


## MOD-25 Platform Admin Portal

### SCR-P-001 — Platform Admin Sign-in (with MFA)
- **User Role:** Platform Super Admin
- **Purpose:** HealthX internal staff sign in to the Platform Admin portal with two-step verification.
- **Entry Point:** Platform Admin URL (internal)
- **Components:** Email and password; MFA code step; Forgot password link
- **Fields:** Email; Password; Verification code (FRM-26)
- **Buttons:** Sign in; Verify; Forgot password?
- **Actions:** Authenticate HealthX staff only; all attempts audit-logged
- **API Required:** POST /api/v1/platform/auth/login; POST /api/v1/platform/auth/mfa/verify
- **Validation:** HealthX staff accounts only; MFA mandatory (RECOMMENDED); 5 failed attempts → lock
- **Error State:** 'Email or password is incorrect.'; 'That code isn't right.'
- **Success State:** Redirect to Platform Dashboard
- **Notes:** Phase: MVP. Features: FEAT-038, FEAT-039. MFA for platform staff is RECOMMENDED (FEAT-039). Network/IP restriction for this portal is RECOMMENDED – TBC.

### SCR-P-002 — Platform Dashboard
- **User Role:** Platform Super Admin
- **Purpose:** Overview of companies, users, usage and key platform metrics across all tenants.
- **Entry Point:** After sign-in; left navigation 'Dashboard'
- **Components:** Tiles: Companies (Active / Onboarding / Suspended); Employees invited; Registered; Monthly active users; Monthly Active Wellness Participants; Wellness Engagement Rate; Active challenges; Points awarded; Rewards redeemed; Pending reward orders; charts: companies onboarded, active users trend
- **Fields:** Date range; Company; Plan
- **Buttons:** Tile drill-down; Create company
- **Actions:** Load cross-company aggregates (visible only here)
- **API Required:** GET /api/v1/platform/dashboard?from=&to=
- **Empty State:** 'No companies yet. Create the first company.'
- **Error State:** 'Couldn't load dashboard.'
- **Notes:** Phase: MVP. Features: FEAT-315, FEAT-320, FEAT-328, FEAT-334, FEAT-335, FEAT-004. No individual employee health data is shown at platform level either.

### SCR-P-003 — Companies
- **User Role:** Platform Super Admin
- **Purpose:** Search, filter and open any customer company.
- **Entry Point:** Left navigation 'Companies'
- **Components:** Search; filters; table: Company, Code, Plan, Status (Onboarding / Active / Suspended / Terminated), Employees (invited / active), Created, Renewal date
- **Fields:** Search; Status; Plan; Industry; Size
- **Buttons:** Create company; Open; Export
- **Actions:** List companies
- **API Required:** GET /api/v1/platform/organizations?q=&status=&plan=&page=
- **Empty State:** 'No companies match these filters.'
- **Error State:** 'Couldn't load companies.'
- **Notes:** Phase: MVP. Features: FEAT-316.

### SCR-P-004 — Company Detail
- **User Role:** Platform Super Admin
- **Purpose:** View and manage one company: profile, subscription and modules, administrators, usage and audit trail.
- **Entry Point:** Companies row
- **Components:** Tabs: Overview (profile, status), Subscription & modules, Administrators, Usage (aggregated), Audit log; status actions
- **Fields:** Status change reason (FRM-71)
- **Buttons:** Edit; Suspend; Reactivate; Resend owner invitation; Change plan; Enable/disable modules
- **Actions:** Manage the tenant; suspension blocks sign-in but keeps data (audit-logged)
- **API Required:** GET /api/v1/platform/organizations/{id}; POST /api/v1/platform/organizations/{id}/suspend; POST .../reactivate; POST .../owner-invitation/resend; PUT .../modules
- **Validation:** Reason required to suspend
- **Error State:** 'Couldn't update company status.'
- **Success State:** 'Company suspended – users can no longer sign in.'
- **Notes:** Phase: MVP. Features: FEAT-316, FEAT-318, FEAT-309, FEAT-310, FEAT-317. Suspend/reactivate is RECOMMENDED (FEAT-318). Company employee health data is never visible here.

### SCR-P-005 — Create / Edit Company
- **User Role:** Platform Super Admin
- **Purpose:** Create a new company workspace, assign a plan and invite its Company Owner.
- **Entry Point:** Companies 'Create company'; Company Detail 'Edit'
- **Components:** Form: company details, plan & subscription, Company Owner
- **Fields:** Company name; Company code; Industry; Size band; Country; Default timezone; Plan; Subscription start date; Company Owner name; Company Owner email; Status (FRM-48)
- **Buttons:** Create & invite owner; Save; Cancel
- **Actions:** Create isolated tenant; create subscription; send owner invitation
- **API Required:** POST /api/v1/platform/organizations; PATCH /api/v1/platform/organizations/{id}
- **Validation:** Unique company code; valid owner email (FRM-48)
- **Error State:** 'Company code already in use.'
- **Success State:** 'Company created – invitation sent to owner@company.com.'
- **Notes:** Phase: MVP. Features: FEAT-317, FEAT-316, FEAT-001. Whether companies can self-register is TBC (MVP: created by HealthX).

### SCR-P-006 — Users
- **User Role:** Platform Super Admin
- **Purpose:** Find any user across companies, view account status, deactivate and resend invitations.
- **Entry Point:** Left navigation 'Users'
- **Components:** Search (name, email, phone); table: Name, Email, Company, Role, Status, Last sign-in; detail drawer
- **Fields:** Search; Company; Role; Status
- **Buttons:** Deactivate; Reactivate; Resend invitation; Revoke sessions
- **Actions:** Manage account status (audit-logged); no health data shown
- **API Required:** GET /api/v1/platform/users?q=&org=&role=&status=; POST /api/v1/platform/users/{id}/deactivate; POST .../reactivate; POST .../sessions/revoke
- **Empty State:** 'No users match your search.'
- **Error State:** 'Couldn't load users.'
- **Success State:** 'User deactivated.'
- **Notes:** Phase: MVP. Features: FEAT-319.

### SCR-P-007 — HealthX Admin Users
- **User Role:** Platform Super Admin
- **Purpose:** Manage HealthX staff accounts that can access the Platform Admin portal.
- **Entry Point:** Left navigation 'Settings > Admin users'
- **Components:** Table: Name, Email, Role, MFA, Status, Last sign-in; add/edit modal
- **Fields:** Name; Email; Role; MFA required; Status (FRM-61)
- **Buttons:** Add admin; Edit; Deactivate
- **Actions:** Invite and manage internal admins (audit-logged)
- **API Required:** GET/POST /api/v1/platform/admin-users; PATCH /api/v1/platform/admin-users/{id}
- **Validation:** At least one active Super Admin must remain
- **Error State:** 'You can't deactivate the last Super Admin.'
- **Success State:** 'Admin invited.'
- **Notes:** Phase: MVP. Features: FEAT-326. Internal sub-roles (support, finance, content) are TBC.


## MOD-24 Subscription & Billing

### SCR-P-008 — Plans
- **User Role:** Platform Super Admin
- **Purpose:** List and manage SaaS plans (Starter, Growth, Enterprise).
- **Entry Point:** Left navigation 'Plans'
- **Components:** Plan cards/table: Name, Target segment, Modules, Price basis, Companies on plan, Status
- **Buttons:** Create plan; Edit; Deactivate
- **Actions:** Manage plans
- **API Required:** GET /api/v1/platform/plans
- **Empty State:** 'No plans yet.'
- **Error State:** 'Couldn't load plans.'
- **Notes:** Phase: MVP. Features: FEAT-306, FEAT-307.

### SCR-P-009 — Create / Edit Plan
- **User Role:** Platform Super Admin
- **Purpose:** Define a plan's modules, limits and pricing parameters without hard-coded prices.
- **Entry Point:** Plans 'Create plan' / 'Edit'
- **Components:** Form: plan details, included modules, pricing components (active employees, modules, integrations, support level), limits
- **Fields:** Plan name; Description; Included modules; Price per active employee; Currency; Billing period; Included integrations; Integration add-on price; Support level; Support price; Max active employees; Status (FRM-49)
- **Buttons:** Save; Cancel
- **Actions:** Create/update plan; new prices apply to new billing periods (audit-logged)
- **API Required:** POST /api/v1/platform/plans; PATCH /api/v1/platform/plans/{id}
- **Validation:** As FRM-49
- **Error State:** Field-level messages
- **Success State:** 'Plan saved.'
- **Notes:** Phase: MVP. Features: FEAT-306, FEAT-307, FEAT-310. Plan contents, limits and pricing model are TBC.

### SCR-P-010 — Subscriptions
- **User Role:** Platform Super Admin
- **Purpose:** Assign plans to companies and manage subscription dates and status.
- **Entry Point:** Left navigation 'Subscriptions'; Company Detail
- **Components:** Table: Company, Plan, Start, Renewal, Status (Active / Past Due / Suspended / Cancelled / Expired), Seats; assign/edit drawer
- **Fields:** Company; Plan; Start date; Renewal date; Billing cycle; Seat limit; Status; Custom price (FRM-50)
- **Buttons:** Assign plan; Edit; Change status
- **Actions:** Create/update subscription (one active per company; audit-logged); update module entitlements
- **API Required:** GET /api/v1/platform/subscriptions; POST /api/v1/platform/subscriptions; PATCH /api/v1/platform/subscriptions/{id}
- **Validation:** One active subscription per company; renewal after start
- **Empty State:** 'No subscriptions yet.'
- **Error State:** 'This company already has an active subscription.'
- **Success State:** 'Subscription updated.'
- **Notes:** Phase: MVP. Features: FEAT-309, FEAT-310. Trial status is TBC.


## MOD-11 Wellness Challenges

### SCR-P-011 — Challenge Templates
- **User Role:** Platform Super Admin
- **Purpose:** Manage ready-made challenge templates available to all companies.
- **Entry Point:** Left navigation 'Challenges'
- **Components:** Table: Template, Type, Metric, Duration, Used by (companies), Status
- **Fields:** Search; Type; Status
- **Buttons:** Create template; Edit; Retire
- **Actions:** Manage global templates
- **API Required:** GET /api/v1/platform/challenge-templates
- **Empty State:** 'No templates yet. Add Step, Hydration, Workout, Meditation and Team challenge templates.'
- **Error State:** 'Couldn't load templates.'
- **Notes:** Phase: MVP. Features: FEAT-134. Interpretation of Platform Admin 'Manage challenges' as global templates is an assumption – TBC.

### SCR-P-012 — Create / Edit Challenge Template
- **User Role:** Platform Super Admin
- **Purpose:** Create or edit a challenge template (e.g., 'Step Challenge – 100,000 steps in 30 days').
- **Entry Point:** Challenge Templates 'Create' / 'Edit'
- **Components:** Form similar to company challenge without dates/participants; preview
- **Fields:** Template name; Description; Type; Metric; Target; Duration (days); Suggested points; Cover image; Available to plans; Status (FRM-51)
- **Buttons:** Save; Publish; Retire
- **Actions:** Create/update template
- **API Required:** POST /api/v1/platform/challenge-templates; PATCH /api/v1/platform/challenge-templates/{id}
- **Validation:** As FRM-51
- **Error State:** Field-level messages
- **Success State:** 'Template published.'
- **Notes:** Phase: MVP. Features: FEAT-134.


## MOD-14 Rewards & Points Wallet

### SCR-P-013 — Rewards Catalogue & Categories
- **User Role:** Platform Super Admin
- **Purpose:** Manage the global HealthX rewards catalogue and reward categories.
- **Entry Point:** Left navigation 'Rewards'
- **Components:** Tabs: Rewards (table: image, name, category, points cost, stock, visibility, status), Categories (name, icon, order, status)
- **Fields:** Search; Category; Status; Category form (FRM-53)
- **Buttons:** Add reward; Edit; Deactivate; Add category; Reorder
- **Actions:** Manage global rewards and categories
- **API Required:** GET /api/v1/platform/rewards; GET/POST/PATCH /api/v1/platform/reward-categories
- **Validation:** Category name unique
- **Empty State:** 'No rewards yet.'
- **Error State:** 'Couldn't load rewards.'
- **Success State:** 'Category saved.'
- **Notes:** Phase: MVP. Features: FEAT-179, FEAT-174, FEAT-181.

### SCR-P-014 — Create / Edit Reward (Global)
- **User Role:** Platform Super Admin
- **Purpose:** Create or edit a global reward and choose which companies/plans can see it.
- **Entry Point:** Rewards Catalogue 'Add reward' / 'Edit'
- **Components:** Form with image upload; visibility selector
- **Fields:** Name; Category; Description; Image; Points cost; Delivery method; Stock; Per-employee limit; Available to; Fulfilled by; Terms; Status (FRM-52)
- **Buttons:** Save; Activate; Cancel
- **Actions:** Create/update reward (audit-logged)
- **API Required:** POST /api/v1/platform/rewards; PATCH /api/v1/platform/rewards/{id}; POST /api/v1/files
- **Validation:** As FRM-52
- **Error State:** Field-level messages
- **Success State:** 'Reward saved.'
- **Notes:** Phase: MVP. Features: FEAT-179, FEAT-181. Points-to-money value and who funds global rewards are TBC.

### SCR-P-015 — Redemption Orders (Platform)
- **User Role:** Platform Super Admin
- **Purpose:** Track and fulfil orders for HealthX-fulfilled global rewards across companies.
- **Entry Point:** Left navigation 'Rewards > Orders'
- **Components:** Table: Order no., Company, Employee, Reward, Points, Date, Status; order drawer with fulfilment form
- **Fields:** Status; Voucher code; Tracking / reference; Note; Cancellation reason (FRM-39)
- **Buttons:** Mark processing; Mark fulfilled; Cancel & refund; Export
- **Actions:** Fulfil orders manually in MVP; notify employee
- **API Required:** GET /api/v1/platform/redemptions; POST /api/v1/platform/redemptions/{id}/fulfil|cancel
- **Validation:** As FRM-39
- **Empty State:** 'No orders to fulfil.'
- **Error State:** 'Couldn't update order.'
- **Success State:** 'Order fulfilled – employee notified.'
- **Notes:** Phase: MVP. Features: FEAT-177, FEAT-178, FEAT-183. Who fulfils global rewards (HealthX vs company) is TBC. Automated provider delivery is Phase 3.


## MOD-08 Workout Module

### SCR-P-016 — Workouts
- **User Role:** Platform Super Admin (Wellness Manager for company workouts – TBC)
- **Purpose:** Manage the workout library shown in the app.
- **Entry Point:** Left navigation 'Content > Workouts'
- **Components:** Table: Title, Category, Level, Location, Duration, Status (Draft / Published), Updated
- **Fields:** Search; Category; Level; Status
- **Buttons:** Create workout; Edit; Publish / Unpublish; Delete
- **Actions:** Manage workouts; only Published appear in the app
- **API Required:** GET /api/v1/platform/workouts?q=&category=&level=&status=
- **Empty State:** 'No workouts yet.'
- **Error State:** 'Couldn't load workouts.'
- **Notes:** Phase: MVP. Features: FEAT-101, FEAT-090. Who authors workouts and the content source (in-house or licensed) are TBC.

### SCR-P-017 — Create / Edit Workout
- **User Role:** Platform Super Admin
- **Purpose:** Build a workout from exercises with level, location, equipment, duration and muscle groups.
- **Entry Point:** Workouts 'Create workout' / 'Edit'
- **Components:** Form; exercise sequence builder (drag to reorder; time/reps; rest seconds); auto-calculated duration; preview
- **Fields:** Title; Description; Category; Level; Location; Equipment; Muscle groups; Cover image; Exercises (sequence); Rest between exercises; Status (FRM-54)
- **Buttons:** Save draft; Publish; Preview; Cancel
- **Actions:** Create/update workout
- **API Required:** POST /api/v1/platform/workouts; PATCH /api/v1/platform/workouts/{id}
- **Validation:** At least 1 exercise; as FRM-54
- **Error State:** Field-level messages
- **Success State:** 'Workout published.'
- **Notes:** Phase: MVP. Features: FEAT-101, FEAT-090, FEAT-091, FEAT-092, FEAT-093, FEAT-094, FEAT-095.

### SCR-P-018 — Exercise Library & Editor
- **User Role:** Platform Super Admin
- **Purpose:** Manage individual exercises (media and instructions) used to build workouts.
- **Entry Point:** Left navigation 'Content > Exercises'
- **Components:** Table of exercises; editor drawer with media upload and instructions
- **Fields:** Exercise name; Instructions; Media; Default duration / reps; Muscle groups; Equipment; Level (FRM-55)
- **Buttons:** Add exercise; Edit; Delete
- **Actions:** Manage exercises
- **API Required:** GET/POST /api/v1/platform/exercises; PATCH/DELETE /api/v1/platform/exercises/{id}; POST /api/v1/files
- **Validation:** Exercises used in published workouts cannot be deleted
- **Empty State:** 'No exercises yet.'
- **Error State:** 'Video must be MP4 under 100 MB.'
- **Success State:** 'Exercise saved.'
- **Notes:** Phase: MVP. Features: FEAT-101. Media format (video/animation/image) is TBC.


## MOD-10 Habit Tracker

### SCR-P-019 — Habit Library
- **User Role:** Platform Super Admin
- **Purpose:** Maintain the list of habits employees can choose.
- **Entry Point:** Left navigation 'Content > Habits'
- **Components:** Table: Habit, Icon, Target type, Default target, Points, Status; editor modal
- **Fields:** Habit name; Icon; Target type; Default daily target; Min / max target; Points per completion; Status (FRM-56)
- **Buttons:** Add habit; Edit; Deactivate
- **Actions:** Manage habit library; deactivated habits stop appearing for new selection
- **API Required:** GET/POST /api/v1/platform/habits; PATCH /api/v1/platform/habits/{id}
- **Validation:** Unique name
- **Error State:** 'Couldn't save habit.'
- **Success State:** 'Habit saved.'
- **Notes:** Phase: MVP. Features: FEAT-119, FEAT-112. Seeded with the 8 PDF habits: Walk daily, Drink water, Exercise, Meditation, Sleep early, Reduce sugary drinks, Stretch, Take breaks.


## MOD-13 Gamification Engine (Points, Streaks & Badges)

### SCR-P-020 — Badges
- **User Role:** Platform Super Admin
- **Purpose:** Create and edit badges, icons and criteria.
- **Entry Point:** Left navigation 'Gamification > Badges'
- **Components:** Table: Badge, Criteria, Threshold, Awarded count, Status; editor
- **Fields:** Badge name; Description; Icon; Criteria type; Metric / event; Threshold; Time window; Bonus points; Status (FRM-57)
- **Buttons:** Add badge; Edit; Deactivate
- **Actions:** Manage badges (audit-logged)
- **API Required:** GET/POST /api/v1/platform/badges; PATCH /api/v1/platform/badges/{id}
- **Validation:** As FRM-57
- **Error State:** 'Couldn't save badge.'
- **Success State:** 'Badge saved.'
- **Notes:** Phase: MVP. Features: FEAT-167, FEAT-164. Seeded with First Workout, 7-Day Streak, Step Master, Hydration Hero, Early Bird.

### SCR-P-021 — Points Rules
- **User Role:** Platform Super Admin
- **Purpose:** View and change the central gamification points rules (no hard-coded points).
- **Entry Point:** Left navigation 'Gamification > Points rules'
- **Components:** Table: Rule, Trigger, Points, Daily cap, Effective from, Status; editor; change history
- **Fields:** Rule name; Trigger event; Threshold; Points; Daily cap; Effective from; Scope; Status (FRM-58)
- **Buttons:** Add rule; Edit; Activate / Deactivate; View history
- **Actions:** Update rules; apply to new events from the effective date (audit-logged)
- **API Required:** GET/POST /api/v1/platform/points-rules; PATCH /api/v1/platform/points-rules/{id}
- **Validation:** As FRM-58
- **Error State:** 'Couldn't save rule.'
- **Success State:** 'Rule updated – applies from 1 Nov.'
- **Notes:** Phase: MVP. Features: FEAT-161, FEAT-160, FEAT-169, FEAT-159. Default rules: 1,000 steps +10; Workout +50; Meditation +20; Water goal +20; Challenge +100; 7-day streak +100. Company-level override and daily cap values are TBC.


## MOD-04 Home Dashboard & Wellness Score

### SCR-P-022 — Wellness Score Weights
- **User Role:** Platform Super Admin
- **Purpose:** Configure the Wellness Score component weights.
- **Entry Point:** Left navigation 'Gamification > Wellness score'
- **Components:** Weight inputs per component with live total; effective date; version history; non-medical reminder
- **Fields:** Activity %; Sleep %; Hydration %; Exercise %; Habits %; Mindfulness %; Effective from; Missing-component handling (FRM-59)
- **Buttons:** Save; Reset to defaults
- **Actions:** Save new weights version (audit-logged)
- **API Required:** GET/PUT /api/v1/platform/wellness-score/weights
- **Validation:** Weights must total 100%
- **Error State:** 'Weights must add up to 100% (currently 95%).'
- **Success State:** 'Weights saved – apply from the next daily calculation.'
- **Notes:** Phase: MVP. Features: FEAT-059, FEAT-058. Platform-only vs company override is TBC. Defaults: Activity 25, Sleep 20, Hydration 15, Exercise 20, Habits 10, Mindfulness 10.


## MOD-25 Platform Admin Portal

### SCR-P-023 — System Configuration
- **User Role:** Platform Super Admin
- **Purpose:** Global settings: default goals, app versions, legal documents, feature flags and thresholds.
- **Entry Point:** Left navigation 'Settings > System'
- **Components:** Sections: Defaults, Mobile app versions, Legal documents, Security, Analytics privacy, Feature flags
- **Fields:** Default step goal; Default water goal; Minimum iOS / Android version; Terms / Privacy version; Invitation expiry; OTP expiry; Minimum analytics group size; Leaderboard refresh interval; Maintenance mode (FRM-60)
- **Buttons:** Save; Publish new legal version
- **Actions:** Apply settings platform-wide (audit-logged)
- **API Required:** GET/PUT /api/v1/platform/config; POST /api/v1/platform/legal-documents
- **Validation:** As FRM-60
- **Error State:** 'Couldn't save configuration.'
- **Success State:** 'Configuration saved.'
- **Notes:** Phase: MVP. Features: FEAT-325, FEAT-040, FEAT-035, FEAT-269.


## MOD-26 Product KPIs & Success Metrics

### SCR-P-024 — Platform Analytics & KPIs
- **User Role:** Platform Super Admin
- **Purpose:** Platform-wide analytics: acquisition, activation, engagement, retention, wellness and the north-star metric.
- **Entry Point:** Left navigation 'Analytics'
- **Components:** MVP: Companies onboarded, Employees invited, Active users, Monthly Active Wellness Participants, Wellness Engagement Rate; Phase 2: activation funnel, DAU/WAU/MAU, retention cohorts (7/30/90-day), wellness KPIs
- **Fields:** Date range; Company; Plan
- **Buttons:** Filters; Export
- **Actions:** Show aggregated platform metrics
- **API Required:** GET /api/v1/platform/analytics?metric=&from=&to=&org=
- **Empty State:** 'Not enough data yet.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: MVP. Features: FEAT-320, FEAT-328, FEAT-334, FEAT-335, FEAT-329, FEAT-330, FEAT-331, FEAT-332. Activation, engagement, retention and wellness KPIs proposed Phase 2. Definitions ('meaningful activity', 'eligible employee') TBC.


## MOD-25 Platform Admin Portal

### SCR-P-025 — Audit Logs
- **User Role:** Platform Super Admin
- **Purpose:** Search and view audit logs across the platform, including consent changes.
- **Entry Point:** Left navigation 'Audit logs'
- **Components:** Table: Date/time, Company, Actor, Action, Target, IP; detail drawer; filters
- **Fields:** Date range; Company; Actor; Action type
- **Buttons:** Filter; Export
- **Actions:** Search immutable logs (read-only)
- **API Required:** GET /api/v1/platform/audit-logs?from=&to=&org=&actor=&action=
- **Empty State:** 'No entries for these filters.'
- **Error State:** 'Couldn't load logs.'
- **Notes:** Phase: MVP. Features: FEAT-327, FEAT-013, FEAT-277.


## MOD-24 Subscription & Billing

### SCR-P-026 — Revenue & Invoices
- **User Role:** Platform Super Admin
- **Purpose:** Revenue by company and plan, billable active employees and invoice management.
- **Entry Point:** Left navigation 'Revenue' (Phase 2)
- **Components:** KPIs: MRR, ARR, ARPU, revenue per employee, expansion revenue, churn; revenue by plan/company; invoices table (number, company, period, amount, status Draft / Issued / Paid / Overdue / Void)
- **Fields:** Date range; Company; Plan; Invoice status
- **Buttons:** Generate invoices; Issue; Mark paid; Void; Download PDF
- **Actions:** Calculate bills from active employees + modules + integrations + support level
- **API Required:** GET /api/v1/platform/revenue; GET/POST /api/v1/platform/invoices; PATCH /api/v1/platform/invoices/{id}
- **Validation:** Invoice totals must match line items
- **Empty State:** 'No invoices yet.'
- **Error State:** 'Couldn't load revenue.'
- **Success State:** 'Invoice issued.'
- **Notes:** Phase: Phase 2. Features: FEAT-314, FEAT-312, FEAT-308, FEAT-311, FEAT-333. Pricing formula, taxes/GST, currency and online payment are TBC.


## MOD-25 Platform Admin Portal

### SCR-P-027 — Feature Usage
- **User Role:** Platform Super Admin
- **Purpose:** Which features are used, by how many users and companies.
- **Entry Point:** Left navigation 'Usage > Features' (Phase 2)
- **Components:** Table/chart per feature (from analytics events): users, companies, events, trend
- **Fields:** Date range; Company; Feature
- **Buttons:** Filters; Export
- **Actions:** Show feature adoption
- **API Required:** GET /api/v1/platform/usage/features
- **Empty State:** 'No usage data yet.'
- **Error State:** 'Couldn't load usage.'
- **Notes:** Phase: Phase 2. Features: FEAT-321.

### SCR-P-028 — API Usage
- **User Role:** Platform Super Admin
- **Purpose:** API request volumes, errors and response times per company and integration.
- **Entry Point:** Left navigation 'Usage > API' (Phase 2)
- **Components:** Charts: requests, error rate, p95 response time; table by company/integration; rate-limit hits
- **Fields:** Date range; Company; Endpoint group
- **Buttons:** Filters; Export
- **Actions:** Show API metrics
- **API Required:** GET /api/v1/platform/usage/api
- **Empty State:** 'No data for this period.'
- **Error State:** 'Couldn't load API usage.'
- **Notes:** Phase: Phase 2. Features: FEAT-322.

### SCR-P-029 — System Health
- **User Role:** Platform Super Admin
- **Purpose:** Status of services, queues, integrations and recent errors.
- **Entry Point:** Left navigation 'System health' (Phase 2)
- **Components:** Service status tiles (API, database, cache, job queues, push, email); integration status; recent errors list (from Sentry/CloudWatch)
- **Buttons:** Refresh; Open in monitoring tool
- **Actions:** Show live health from monitoring tools
- **API Required:** GET /api/v1/platform/system-health
- **Error State:** 'Health data unavailable.'
- **Success State:** 'All systems operational.'
- **Notes:** Phase: Phase 2. Features: FEAT-323.

### SCR-P-030 — Support
- **User Role:** Platform Super Admin
- **Purpose:** Handle support requests from companies and employees.
- **Entry Point:** Left navigation 'Support' (Phase 2)
- **Components:** Ticket list (Open / In Progress / Resolved / Closed); ticket detail with conversation and internal notes
- **Fields:** Status; Assignee; Reply; Internal note (FRM-68)
- **Buttons:** Assign; Reply; Change status
- **Actions:** Manage tickets
- **API Required:** GET /api/v1/platform/support/tickets; PATCH /api/v1/platform/support/tickets/{id}; POST /api/v1/platform/support/tickets/{id}/messages
- **Empty State:** 'No open tickets.'
- **Error State:** 'Couldn't load tickets.'
- **Success State:** 'Reply sent.'
- **Notes:** Phase: Phase 2. Features: FEAT-324. Support model (in-house tickets vs external helpdesk) is TBC – this screen is only needed for in-house tickets.


## MOD-17 Wellness Feed & Content

### SCR-P-031 — Global Content Library
- **User Role:** Platform Super Admin
- **Purpose:** Manage wellness content (tips, articles, videos, links) available to all companies.
- **Entry Point:** Left navigation 'Content > Articles & tips' (Phase 2)
- **Components:** Table: Title, Type, Category, Status, Published date; editor (same as company content editor)
- **Fields:** Content fields (FRM-42)
- **Buttons:** New content; Edit; Publish; Unpublish; Delete
- **Actions:** Manage global content
- **API Required:** GET/POST /api/v1/platform/content; PATCH/DELETE /api/v1/platform/content/{id}
- **Validation:** As FRM-42
- **Empty State:** 'No content yet.'
- **Error State:** 'Couldn't load content.'
- **Success State:** 'Content published.'
- **Notes:** Phase: Phase 2. Features: FEAT-214, FEAT-213, FEAT-217.


## MOD-15 Corporate Wellness Programs

### SCR-P-032 — Program Templates
- **User Role:** Platform Super Admin
- **Purpose:** Ready-made wellness program templates (e.g., 30-Day Healthy Lifestyle) that companies can copy.
- **Entry Point:** Left navigation 'Programs' (Phase 2)
- **Components:** Template list; editor reusing the program builder
- **Fields:** Program fields (FRM-41)
- **Buttons:** Create template; Edit; Publish; Retire
- **Actions:** Manage program templates
- **API Required:** GET/POST /api/v1/platform/program-templates; PATCH /api/v1/platform/program-templates/{id}
- **Validation:** At least 1 week with 1 goal
- **Empty State:** 'No templates yet.'
- **Error State:** 'Couldn't save template.'
- **Success State:** 'Template published.'
- **Notes:** Phase: Phase 2. Features: FEAT-190.


## MOD-18 AI Wellness Coach & Insights

### SCR-P-033 — AI Configuration & Usage
- **User Role:** Platform Super Admin
- **Purpose:** Enable AI features per company/plan, set usage limits and monitor AI usage and cost.
- **Entry Point:** Left navigation 'AI' (Phase 2)
- **Components:** Per-company AI toggles; usage limits; usage dashboard (requests, tokens, cost by company); safety settings
- **Fields:** AI Coach enabled; Weekly AI insight enabled; Monthly limit per employee; Company monthly budget (FRM-47)
- **Buttons:** Save; Export usage
- **Actions:** Apply AI settings and limits
- **API Required:** GET/PUT /api/v1/platform/ai-settings; GET /api/v1/platform/ai-usage
- **Validation:** Limits must be positive numbers
- **Empty State:** 'No AI usage yet.'
- **Error State:** 'Couldn't load AI usage.'
- **Success State:** 'AI settings saved.'
- **Notes:** Phase: Phase 2. Features: FEAT-228, FEAT-229. Usage monitoring and cost controls are RECOMMENDED (FEAT-229). Platform staff do not see conversation content.


## MOD-23 White Label

### SCR-P-034 — White-Label Apps
- **User Role:** Platform Super Admin
- **Purpose:** Manage branded app builds and store listings per enterprise customer.
- **Entry Point:** Left navigation 'White label' (Phase 3)
- **Components:** List of white-label configurations per company; build status; store listing details
- **Fields:** Company; App name; Bundle identifiers; Store accounts
- **Buttons:** Create configuration; Request build
- **Actions:** Manage white-label apps
- **API Required:** GET/POST /api/v1/platform/white-label-apps
- **Empty State:** 'No white-label apps yet.'
- **Error State:** 'Couldn't load configurations.'
- **Notes:** Phase: Phase 3. Features: FEAT-305, FEAT-300. Main screen only – detailed design in Phase 3. Store accounts and per-client builds TBC.


## MOD-14 Rewards & Points Wallet

### SCR-P-035 — Reward Providers & Marketplace
- **User Role:** Platform Super Admin
- **Purpose:** Connect reward providers and manage marketplace rewards with automatic fulfilment.
- **Entry Point:** Left navigation 'Rewards > Providers' (Phase 3)
- **Components:** Provider list with status; provider catalogue import; margin/points conversion settings
- **Fields:** Provider; API credentials; Points conversion rate
- **Buttons:** Connect provider; Import catalogue; Disable
- **Actions:** Manage provider integrations
- **API Required:** GET/POST /api/v1/platform/reward-providers
- **Empty State:** 'No providers connected.'
- **Error State:** 'Provider connection failed.'
- **Notes:** Phase: Phase 3. Features: FEAT-298, FEAT-184. Main screen only – Phase 3. Provider and funding model TBC.


## MOD-22 Integrations

### SCR-P-036 — Partner Integrations & API Marketplace
- **User Role:** Platform Super Admin
- **Purpose:** Manage partner integrations (insurance, gym networks, corporate benefits) and partner API access.
- **Entry Point:** Left navigation 'Partners' (Phase 3)
- **Components:** Partner list by type; API client keys and scopes; consent requirements per partner
- **Fields:** Partner; Type; API scopes
- **Buttons:** Add partner; Issue API key; Revoke
- **Actions:** Manage partners and API access
- **API Required:** GET/POST /api/v1/platform/partners; POST /api/v1/platform/api-clients
- **Validation:** Explicit employee consent required before any health data is shared with partners
- **Empty State:** 'No partners yet.'
- **Error State:** 'Couldn't load partners.'
- **Notes:** Phase: Phase 3. Features: FEAT-295, FEAT-296, FEAT-297, FEAT-299. Main screen only – Phase 3. Purpose and data shared with insurers/partners require legal review – TBC.
