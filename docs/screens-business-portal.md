# Business Portal (Company Owner, HR Admin, Wellness Manager, Team Manager) — screen spec

Source: HEALTHX_BUSINESS_REQUIREMENT_AND_DEVELOPMENT_PLAN.xlsx, sheet 07. Phase is in Notes.


## MOD-02 Onboarding & Authentication

### SCR-B-001 — Admin Sign-in
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Company administrators sign in to the Business Portal.
- **Entry Point:** Business Portal URL; admin invitation email
- **Components:** HealthX logo; email and password fields; Google and Microsoft buttons; Forgot password link
- **Fields:** Email; Password
- **Buttons:** Sign in; Sign in with Google; Sign in with Microsoft; Forgot password?
- **Actions:** Authenticate; check the user has an admin role; route to MFA (if enabled) or Dashboard
- **API Required:** POST /api/v1/auth/login (portal=business); POST /api/v1/auth/oauth/google; POST /api/v1/auth/oauth/microsoft
- **Validation:** Valid email; password required; 5 failed attempts → 15-minute lock (ASSUMPTION) (FRM-25)
- **Error State:** 'Email or password is incorrect.'; employee-only account: 'You don't have access to the Business Portal. Use the HealthX mobile app.'
- **Success State:** Redirect to Dashboard
- **Notes:** Phase: MVP. Features: FEAT-037, FEAT-021, FEAT-024, FEAT-025, FEAT-032. Whether Team Managers get portal access is TBC.

### SCR-B-002 — Two-Step Verification (MFA)
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Second sign-in step for administrators using an authenticator app or email code.
- **Entry Point:** After Admin Sign-in when MFA is enabled
- **Components:** 6-digit code input; 'Use a recovery code' link; 'Remember this device for 30 days' (ASSUMPTION)
- **Fields:** Verification code; Recovery code
- **Buttons:** Verify; Use recovery code; Resend email code
- **Actions:** Verify second factor
- **API Required:** POST /api/v1/auth/mfa/verify
- **Validation:** 6 digits; max 5 attempts (ASSUMPTION)
- **Error State:** 'That code isn't right.'
- **Success State:** Redirect to Dashboard
- **Notes:** Phase: MVP. Features: FEAT-039. Not in the PDF; strongly advised because admins can access company-wide data.

### SCR-B-003 — Forgot / Reset Password
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Admins reset a forgotten password through a secure email link.
- **Entry Point:** Admin Sign-in 'Forgot password?'; reset email link
- **Components:** Email form; new password form with strength meter
- **Fields:** Email; New password; Confirm new password
- **Buttons:** Send reset link; Save password
- **Actions:** Email reset link; set new password; revoke other sessions
- **API Required:** POST /api/v1/auth/password/forgot; POST /api/v1/auth/password/reset
- **Validation:** Password policy for admins: min 10 chars incl. letters, numbers and a symbol (ASSUMPTION) (FRM-05)
- **Error State:** 'This reset link has expired.'
- **Success State:** 'Password updated. Please sign in.'
- **Notes:** Phase: MVP. Features: FEAT-034.


## MOD-19 Business Portal — Organisation & People

### SCR-B-004 — Accept Admin Invitation (Account Set-up)
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Invited administrators (e.g., a new Company Owner invited by HealthX) set up their portal account.
- **Entry Point:** Admin invitation email link
- **Components:** Company name and role invited to; set-up form; Terms acceptance
- **Fields:** Full name; Password; Confirm password; Accept Terms & Privacy Policy
- **Buttons:** Create account; Sign in with Google/Microsoft instead
- **Actions:** Activate admin account; record Terms acceptance
- **API Required:** GET /api/v1/invitations/{token}; POST /api/v1/invitations/{token}/accept
- **Validation:** Invitation pending and not expired; password policy (FRM-27)
- **Error State:** 'This invitation has expired. Ask your Company Owner or HealthX to resend it.'
- **Success State:** Redirect to Dashboard (Company Owner first sign-in: 'Set up your organisation' checklist)
- **Notes:** Phase: MVP. Features: FEAT-317, FEAT-248, FEAT-035.


## MOD-20 Business Portal — Analytics & Reporting

### SCR-B-005 — Dashboard
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Company overview of wellness participation and programme activity (aggregated only).
- **Entry Point:** After sign-in; left navigation 'Dashboard'
- **Components:** KPI tiles: Total Employees 2,450; Active Employees 1,820; Participation 74%; Challenges 12; Points Awarded 184K; Rewards Redeemed 3,820; Monthly Active Wellness Participants; Wellness Engagement Rate; low-participation alerts; active challenges widget; quick actions
- **Fields:** Date range; Department; Team
- **Buttons:** Invite employees; Create challenge; Send announcement; Tile drill-down
- **Actions:** Load aggregated KPIs; highlight groups below participation threshold
- **API Required:** GET /api/v1/organization/dashboard?from=&to=&department=&team=
- **Validation:** Groups with fewer than 5 employees are suppressed (RECOMMENDED – TBC)
- **Empty State:** New company: 'Invite your employees to get started.' with Invite button
- **Error State:** 'Couldn't load dashboard data.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-256, FEAT-263, FEAT-262, FEAT-269, FEAT-334, FEAT-335, FEAT-268. Definitions of 'active', 'participation', 'meaningful activity' and 'eligible employee' are TBC. No individual health data is shown.


## MOD-19 Business Portal — Organisation & People

### SCR-B-006 — Employees
- **User Role:** Company Owner, HR Admin
- **Purpose:** List, search and manage company employees and invitations (no health data).
- **Entry Point:** Left navigation 'Employees'
- **Components:** Search; filters; table: Name, Email, Employee ID, Department, Team, Role, Status (Invited / Registered / Active / Inactive / Deactivated), Invited / joined date; row actions; pagination
- **Fields:** Search; Department; Team; Status; Role (FRM-66)
- **Buttons:** Invite employee; Import CSV; Export CSV; Resend invite; Revoke invite; Bulk actions (Phase 2)
- **Actions:** Paginated list; sort columns; export non-health fields (audit-logged)
- **API Required:** GET /api/v1/organization/employees?q=&department=&team=&status=&role=&sort=&page=; GET /api/v1/organization/employees/export; POST /api/v1/organization/invitations/{id}/resend; POST /api/v1/organization/invitations/{id}/revoke
- **Empty State:** 'No employees yet. Invite employees or import a CSV file.'
- **Error State:** 'Couldn't load employees.' with Retry
- **Success State:** 'Invitation resent.'
- **Notes:** Phase: MVP. Features: FEAT-235, FEAT-236, FEAT-237, FEAT-238, FEAT-239, FEAT-242, FEAT-243, FEAT-247. Search, filters, sorting, export and resend/revoke are RECOMMENDED. 'Inactive' definition TBC. Bulk actions Phase 2.

### SCR-B-007 — Employee Detail
- **User Role:** Company Owner, HR Admin
- **Purpose:** View and update an employee's work details, role and status – never personal health data.
- **Entry Point:** Employees row
- **Components:** Header (name, email, status); work details (Employee ID, department, team, role); invitation/registration dates; participation summary (challenges joined count – TBC); audit trail of admin changes
- **Fields:** Department; Team; Role; Employee ID
- **Buttons:** Edit; Save; Deactivate; Reactivate; Resend invitation
- **Actions:** Update employee (audit-logged; leaderboards/permissions update immediately); deactivate (blocks sign-in)
- **API Required:** GET /api/v1/organization/employees/{id}; PATCH /api/v1/organization/employees/{id}; POST /api/v1/organization/employees/{id}/deactivate; POST .../reactivate
- **Validation:** Team must belong to the selected department (if teams sit within departments – TBC) (FRM-30)
- **Error State:** 'Couldn't save changes.'
- **Success State:** 'Employee updated.'; 'Employee deactivated – they can no longer sign in.'
- **Notes:** Phase: MVP. Features: FEAT-244, FEAT-245, FEAT-246. Never shows steps, sleep, weight, water, workouts or Wellness Score (§36). What participation data HR may see per person is TBC. Data and points after leaving TBC.

### SCR-B-008 — Invite Employee
- **User Role:** Company Owner, HR Admin
- **Purpose:** Invite one employee by email (and optionally phone) with department, team and role.
- **Entry Point:** Employees 'Invite employee'; Dashboard quick action
- **Components:** Modal form; invitation preview
- **Fields:** First name; Last name; Work email; Mobile number; Employee ID; Department; Team; Role; Personal message
- **Buttons:** Send invitation; Cancel
- **Actions:** Create invitation; send email (and SMS if phone sign-in enabled)
- **API Required:** POST /api/v1/organization/employees/invite
- **Validation:** Valid email; no duplicate active invite or existing member; see FRM-28
- **Error State:** 'An employee with this email already exists.'
- **Success State:** 'Invitation sent to sarah@company.com.'
- **Notes:** Phase: MVP. Features: FEAT-240, FEAT-202.

### SCR-B-009 — Import Employees (CSV)
- **User Role:** Company Owner, HR Admin
- **Purpose:** Upload a CSV file to invite or create many employees at once, with a validation report.
- **Entry Point:** Employees 'Import CSV'
- **Components:** Step 1: download template; Step 2: upload file; Step 3: validation preview (valid rows, errors with row number and reason); Step 4: results (imported, updated, skipped, failed) with downloadable error report; import history
- **Fields:** CSV file; Duplicate handling; Send invitations after import
- **Buttons:** Download template; Upload; Confirm import; Download error report; Cancel
- **Actions:** Validate rows; import valid rows once; optionally send invitations
- **API Required:** POST /api/v1/organization/employee-imports; GET /api/v1/organization/employee-imports/{id}; POST /api/v1/organization/employee-imports/{id}/confirm; GET /api/v1/organization/employee-imports/{id}/errors
- **Validation:** CSV only, max 5 MB / 10,000 rows (ASSUMPTION); required columns present; see FRM-29
- **Error State:** 'File must be a .csv under 5 MB.'; 'Missing required column: email.'
- **Success State:** '2,431 employees imported, 19 rows need attention.'
- **Notes:** Phase: MVP. Features: FEAT-241. Phase not stated in the PDF (proposed MVP). Automated HRMS sync is Phase 2.

### SCR-B-010 — Departments
- **User Role:** Company Owner, HR Admin
- **Purpose:** Create, view, edit and delete departments.
- **Entry Point:** Left navigation 'Organisation > Departments'
- **Components:** Table: Department name, Employees, Teams, Created; Add/Edit modal; delete confirmation
- **Fields:** Department name; Description
- **Buttons:** Add department; Edit; Delete
- **Actions:** Manage departments (audit-logged)
- **API Required:** GET/POST /api/v1/organization/departments; PATCH/DELETE /api/v1/organization/departments/{id}
- **Validation:** Unique name within company; cannot delete while employees are assigned (FRM-31)
- **Empty State:** 'No departments yet. Add departments like Engineering, Sales, Marketing and HR.'
- **Error State:** 'This department still has 12 employees. Move them before deleting.'
- **Success State:** 'Department created.'
- **Notes:** Phase: MVP. Features: FEAT-232, FEAT-006.

### SCR-B-011 — Teams & Team Members
- **User Role:** Company Owner, HR Admin
- **Purpose:** Create teams within departments, manage members and assign Team Managers.
- **Entry Point:** Left navigation 'Organisation > Teams'
- **Components:** Table: Team, Department, Team Manager(s), Members; side panel with member list, add/remove members, assign Team Manager
- **Fields:** Team name; Department; Team Manager(s); Members; Description
- **Buttons:** Add team; Edit; Delete; Add members; Remove member; Assign Team Manager
- **Actions:** Manage teams and membership (audit-logged)
- **API Required:** GET/POST /api/v1/organization/teams; PATCH/DELETE /api/v1/organization/teams/{id}; PUT /api/v1/organization/teams/{id}/members; PUT /api/v1/organization/teams/{id}/managers
- **Validation:** Unique team name within department; non-empty team cannot be deleted until members are moved (FRM-32)
- **Empty State:** 'No teams yet.'
- **Error State:** 'Couldn't save the team.'
- **Success State:** 'Team updated.'
- **Notes:** Phase: MVP. Features: FEAT-233, FEAT-234. Whether a user can belong to more than one team, cross-department teams, and one vs many managers per team are TBC.

### SCR-B-012 — Administrators & Roles
- **User Role:** Company Owner
- **Purpose:** Company Owner assigns or removes HR Admin, Wellness Manager, Team Manager and Company Owner roles.
- **Entry Point:** Left navigation 'Settings > Administrators'
- **Components:** Table: Name, Email, Role, Status, Last sign-in; add administrator modal; role change; remove
- **Fields:** User (search employee or invite by email); Role; Team (for Team Manager)
- **Buttons:** Add administrator; Change role; Remove
- **Actions:** Grant/revoke admin roles (audit-logged; effective at next request)
- **API Required:** GET/POST /api/v1/organization/admins; PATCH/DELETE /api/v1/organization/admins/{id}
- **Validation:** At least one Company Owner must remain (FRM-33)
- **Error State:** 'You can't remove the last Company Owner.'
- **Success State:** 'Role updated.'
- **Notes:** Phase: MVP. Features: FEAT-248, FEAT-007. Whether multiple Company Owners are allowed is TBC.


## MOD-11 Wellness Challenges

### SCR-B-013 — Challenges
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** List and manage all company challenges with status, dates, participants and progress.
- **Entry Point:** Left navigation 'Challenges'
- **Components:** Status tabs/filter (Draft, Scheduled, Active, Finalising, Completed, Cancelled); table: Name, Type, Metric, Dates, Status, Participants, Completion %; row actions
- **Fields:** Status; Type; Date range; Search
- **Buttons:** Create challenge; Edit; Duplicate (Phase 2); Cancel; Delete draft; View
- **Actions:** List challenges; cancel (participants notified); delete drafts
- **API Required:** GET /api/v1/organization/challenges?status=&type=&q=; POST /api/v1/organization/challenges/{id}/cancel; DELETE /api/v1/organization/challenges/{id}
- **Validation:** Only Draft challenges can be deleted
- **Empty State:** 'No challenges yet. Create your first challenge or start from a HealthX template.'
- **Error State:** 'Couldn't load challenges.'
- **Success State:** 'Challenge cancelled – participants have been notified.'
- **Notes:** Phase: MVP. Features: FEAT-136, FEAT-139, FEAT-138, FEAT-148. Statuses, cancel and duplicate are RECOMMENDED. What happens to earned points on cancellation is TBC.

### SCR-B-014 — Create / Edit Challenge
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Step-by-step form to create or edit a challenge: basics, metric and target, participants, points and reward.
- **Entry Point:** Challenges 'Create challenge' / 'Edit'; Dashboard quick action
- **Components:** Stepper: 1 Template or blank, 2 Basics, 3 Metric & target, 4 Participants, 5 Points & reward, 6 Review; live preview of the employee challenge card
- **Fields:** Template; Name; Description; Type; Start date; End date; Metric; Custom metric; Target; Target basis; Participants; Departments/Teams/Employees; Enrolment; Points; Reward; Cover image (FRM-37)
- **Buttons:** Save draft; Next; Back; Publish; Schedule
- **Actions:** Create/update challenge; publish → Scheduled/Active based on dates; after start only safe fields can change
- **API Required:** GET /api/v1/challenge-templates; POST /api/v1/organization/challenges; PATCH /api/v1/organization/challenges/{id}; POST /api/v1/organization/challenges/{id}/publish
- **Validation:** End date after start date; target > 0 with unit matching metric; at least one participant group; restricted fields locked after start
- **Error State:** Field-level messages; 'End date must be after start date.'
- **Success State:** 'Challenge published – starts Monday 6 Oct.'
- **Notes:** Phase: MVP. Features: FEAT-122, FEAT-123, FEAT-124, FEAT-125, FEAT-126, FEAT-127, FEAT-128, FEAT-135, FEAT-137. §21 names HR Admin; §6 also gives Company Owner and Wellness Manager this right. Opt-in vs auto-enrol, who receives points and winner/reward rules are TBC. Start from template is RECOMMENDED (FEAT-135).

### SCR-B-015 — Challenge Detail & Analytics
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Shows a challenge's configuration, live leaderboard and aggregated performance.
- **Entry Point:** Challenges row
- **Components:** Overview (status, dates, metric, target, participants scope, points, reward); KPIs: Participants, Completion rate, Average activity, Team performance ranking; daily participation chart; challenge leaderboard (privacy setting applies); results after completion
- **Fields:** Date range (within challenge)
- **Buttons:** Edit; Cancel challenge; Send announcement about this challenge; Export (aggregated)
- **Actions:** Show challenge analytics; link to announcement composer
- **API Required:** GET /api/v1/organization/challenges/{id}; GET /api/v1/organization/challenges/{id}/analytics; GET /api/v1/organization/challenges/{id}/leaderboard
- **Empty State:** Not started: 'Analytics will appear once the challenge starts.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: MVP. Features: FEAT-146, FEAT-153, FEAT-144, FEAT-138, FEAT-155. Individual values appear only through the leaderboard under the company name-privacy rule.


## MOD-12 Leaderboards

### SCR-B-016 — Leaderboards
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** View company, department, team and challenge leaderboards in the portal.
- **Entry Point:** Left navigation 'Leaderboards'
- **Components:** Tabs Company / Department / Team / Challenge; metric and period filters; ranked tables using the same name-privacy setting as the app
- **Fields:** Scope; Metric; Period; Challenge
- **Buttons:** Tab; Filters; Export (Phase 2 – TBC)
- **Actions:** Show rankings identical to the app
- **API Required:** GET /api/v1/organization/leaderboards?scope=&metric=&period=&challengeId=
- **Empty State:** 'No rankings yet for this period.'
- **Error State:** 'Couldn't load leaderboard.'
- **Notes:** Phase: MVP. Features: FEAT-155, FEAT-149, FEAT-150, FEAT-151, FEAT-154.


## MOD-14 Rewards & Points Wallet

### SCR-B-017 — Rewards
- **User Role:** Company Owner
- **Purpose:** Manage company rewards and choose which HealthX catalogue rewards employees can see.
- **Entry Point:** Left navigation 'Rewards'
- **Components:** Tabs: Company rewards, HealthX catalogue; table: image, name, category, points cost, stock, redeemed count, status; visibility toggles for HealthX rewards
- **Fields:** Category; Status; Search
- **Buttons:** Add reward; Edit; Deactivate; Show/hide HealthX reward
- **Actions:** Manage company rewards; set visibility of global rewards for this company
- **API Required:** GET /api/v1/organization/rewards; PATCH /api/v1/organization/rewards/{id}; PATCH /api/v1/organization/catalogue-rewards/{id}/visibility
- **Empty State:** 'No company rewards yet. Add company merchandise or extra benefits.'
- **Error State:** 'Couldn't load rewards.'
- **Success State:** 'Reward updated.'
- **Notes:** Phase: MVP. Features: FEAT-180, FEAT-181, FEAT-179, FEAT-174. Company reward configuration is not in the §57 MVP list but is a Company Owner permission (§6.2) – proposed MVP (TBC). Who funds rewards is TBC.

### SCR-B-018 — Create / Edit Reward
- **User Role:** Company Owner
- **Purpose:** Create or edit a company reward with cost, stock, limits and delivery method.
- **Entry Point:** Rewards 'Add reward' / 'Edit'
- **Components:** Form with image upload and employee preview card
- **Fields:** Name; Category; Description; Image; Points cost; Delivery method; Stock; Per-employee limit; Available from/to; Terms; Visible to; Status (FRM-38)
- **Buttons:** Save; Save & activate; Cancel
- **Actions:** Create/update reward (audit-logged)
- **API Required:** POST /api/v1/organization/rewards; PATCH /api/v1/organization/rewards/{id}; POST /api/v1/files (image)
- **Validation:** As FRM-38
- **Error State:** Field-level messages; 'Image must be JPG or PNG under 5 MB.'
- **Success State:** 'Reward saved.'
- **Notes:** Phase: MVP. Features: FEAT-180, FEAT-181, FEAT-182. Stock and limits are RECOMMENDED (FEAT-181).

### SCR-B-019 — Redemption Orders
- **User Role:** Company Owner, HR Admin
- **Purpose:** Track and fulfil employee reward orders.
- **Entry Point:** Left navigation 'Rewards > Orders'; new-order alert
- **Components:** Status filter; table: Order no., Employee, Reward, Points, Date, Status; counts by status
- **Fields:** Status; Date range; Search (order no./employee)
- **Buttons:** View; Export CSV
- **Actions:** List orders for this company's rewards
- **API Required:** GET /api/v1/organization/redemptions?status=&from=&to=&q=
- **Empty State:** 'No reward orders yet.'
- **Error State:** 'Couldn't load orders.'
- **Notes:** Phase: MVP. Features: FEAT-177, FEAT-178, FEAT-182, FEAT-183. Employee name and delivery details are shown only for fulfilment. Who fulfils global rewards (company vs HealthX) is TBC.

### SCR-B-020 — Order Detail & Fulfilment
- **User Role:** Company Owner, HR Admin
- **Purpose:** Approve (if enabled), fulfil, deliver or cancel a reward order.
- **Entry Point:** Redemption Orders row
- **Components:** Order summary; status timeline; delivery details; fulfilment form; action buttons by status
- **Fields:** Status; Voucher code; Tracking / reference; Note to employee; Cancellation reason (FRM-39)
- **Buttons:** Approve; Reject; Mark processing; Mark fulfilled / delivered; Cancel & refund
- **Actions:** Update order status; refund points on reject/cancel; notify employee (audit-logged)
- **API Required:** GET /api/v1/organization/redemptions/{id}; POST /api/v1/organization/redemptions/{id}/approve|reject|fulfil|cancel
- **Validation:** Voucher code required for e-voucher fulfilment; reason required for reject/cancel
- **Error State:** 'This order was already updated by another admin. Refresh to see the latest status.'
- **Success State:** 'Order marked as delivered – employee notified.'
- **Notes:** Phase: MVP. Features: FEAT-178, FEAT-182, FEAT-183, FEAT-177. Approval step is TBC (FEAT-182); cancellation/refund is RECOMMENDED (FEAT-183).


## MOD-16 Announcements & Notifications

### SCR-B-021 — Announcements
- **User Role:** HR Admin (Company Owner, Wellness Manager – TBC)
- **Purpose:** List of company announcements with status and reach.
- **Entry Point:** Left navigation 'Announcements'
- **Components:** Table: Title, Type, Audience, Channels, Status (Draft / Scheduled / Sent / Cancelled), Send date, Reach (Phase 2)
- **Fields:** Status; Type; Search
- **Buttons:** New announcement; Edit; Duplicate; Cancel scheduled
- **Actions:** Manage announcements
- **API Required:** GET /api/v1/organization/announcements?status=&type=; POST /api/v1/organization/announcements/{id}/cancel
- **Validation:** Only Draft/Scheduled can be edited or cancelled
- **Empty State:** 'No announcements yet.'
- **Error State:** 'Couldn't load announcements.'
- **Notes:** Phase: MVP. Features: FEAT-193, FEAT-198, FEAT-205. Which roles may send announcements is TBC. Reach analytics Phase 2 (RECOMMENDED).

### SCR-B-022 — Create / Edit Announcement
- **User Role:** HR Admin (Company Owner, Wellness Manager – TBC)
- **Purpose:** Compose and send an announcement by push and/or in-app, now or scheduled.
- **Entry Point:** Announcements 'New announcement'; low-participation alert; Challenge Detail
- **Components:** Form; push and in-app previews; audience size estimate
- **Fields:** Title; Message; Type; Channels; Audience; Departments; Teams; Image; Link; Send option; Scheduled date & time (FRM-40)
- **Buttons:** Save draft; Send now; Schedule; Cancel
- **Actions:** Create announcement; deliver to targeted employees respecting notification preferences
- **API Required:** POST /api/v1/organization/announcements; PATCH /api/v1/organization/announcements/{id}; POST /api/v1/organization/announcements/{id}/send
- **Validation:** As FRM-40
- **Error State:** Field-level messages
- **Success State:** 'Announcement sent to 1,820 employees.' / 'Scheduled for Mon 6 Oct, 09:00.'
- **Notes:** Phase: MVP. Features: FEAT-193, FEAT-194, FEAT-196, FEAT-197, FEAT-198. Audience targeting and scheduling are RECOMMENDED (FEAT-197, FEAT-198).


## MOD-20 Business Portal — Analytics & Reporting

### SCR-B-023 — Analytics – Adoption
- **User Role:** Company Owner, HR Admin
- **Purpose:** Shows how many employees were invited, registered, are active and inactive.
- **Entry Point:** Left navigation 'Analytics > Adoption'
- **Components:** Funnel: Invited, Registered, Active, Inactive; registration %; trend chart; by-department table
- **Fields:** Date range; Department; Team (FRM-65)
- **Buttons:** Filters; Export (CSV/PDF)
- **Actions:** Show aggregated adoption metrics
- **API Required:** GET /api/v1/organization/analytics/adoption?from=&to=&department=&team=
- **Validation:** Groups below minimum size suppressed
- **Empty State:** 'Not enough data yet.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: MVP. Features: FEAT-257, FEAT-243, FEAT-262, FEAT-265. Part of MVP 'Basic analytics' (proposed). 'Active' definition TBC. Filters and export are RECOMMENDED.

### SCR-B-024 — Analytics – Departments
- **User Role:** Company Owner, HR Admin
- **Purpose:** Per-department employees, active employees and participation, with low-participation highlighting.
- **Entry Point:** Left navigation 'Analytics > Departments'; Dashboard alert
- **Components:** Table: Department, Employees, Active, Participation (e.g., Engineering 500 / 410 / 82%; Sales 350 / 245 / 70%; Marketing 120 / 94 / 78%; HR 60 / 52 / 87%); low-participation flag with 'Send announcement'
- **Fields:** Date range; Participation threshold
- **Buttons:** Send announcement; Export
- **Actions:** Show aggregated department metrics; open announcement composer pre-targeted
- **API Required:** GET /api/v1/organization/analytics/departments?from=&to=
- **Validation:** Departments with fewer than 5 employees show 'Not enough data'
- **Empty State:** 'No departments yet.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: MVP. Features: FEAT-260, FEAT-263, FEAT-269. Low-participation threshold TBC.

### SCR-B-025 — Analytics – Challenges
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Compare participation and completion across challenges.
- **Entry Point:** Left navigation 'Analytics > Challenges'
- **Components:** Table/chart per challenge: Participants, Completion rate, Average activity, Team performance; trend
- **Fields:** Date range; Challenge type
- **Buttons:** Row (open Challenge Detail); Export
- **Actions:** Show aggregated challenge analytics
- **API Required:** GET /api/v1/organization/analytics/challenges?from=&to=
- **Empty State:** 'No challenges in this period.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: MVP. Features: FEAT-146.

### SCR-B-026 — Analytics – Engagement
- **User Role:** Company Owner, HR Admin
- **Purpose:** Daily, weekly and monthly active users and session frequency.
- **Entry Point:** Left navigation 'Analytics > Engagement' (Phase 2)
- **Components:** DAU, WAU, MAU tiles; session frequency chart; trend lines
- **Fields:** Date range; Department; Team
- **Buttons:** Filters; Export
- **Actions:** Show aggregated engagement metrics
- **API Required:** GET /api/v1/organization/analytics/engagement
- **Empty State:** 'Not enough data yet.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: Phase 2. Features: FEAT-258. Phase not stated in the PDF (proposed Phase 2 'Advanced analytics').

### SCR-B-027 — Analytics – Wellness Participation
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Aggregated wellness participation: average steps, workout, hydration, sleep participation and habit completion.
- **Entry Point:** Left navigation 'Analytics > Wellness' (Phase 2)
- **Components:** Tiles and charts: Average steps (e.g., 'Engineering average steps: 8,240'), Workout participation, Hydration participation, Sleep participation, Habit completion; by department/team
- **Fields:** Date range; Department; Team
- **Buttons:** Filters; Export (aggregated only)
- **Actions:** Show aggregates for groups meeting the minimum size
- **API Required:** GET /api/v1/organization/analytics/wellness
- **Validation:** Groups below minimum size suppressed; employees who opted out of analytics excluded
- **Empty State:** 'Not enough data to show this group.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: Phase 2. Features: FEAT-259, FEAT-268, FEAT-269, FEAT-276. Never shows an individual's values (§36: HR sees 'Engineering average steps: 8,240', not 'John walked 8,234 steps').

### SCR-B-028 — Analytics – Wellness Trends
- **User Role:** Company Owner, HR Admin
- **Purpose:** Trend charts for participation, activity, challenges, wellness score, engagement, redemptions and monthly active employees.
- **Entry Point:** Left navigation 'Analytics > Trends' (Phase 2)
- **Components:** Charts: Participation trend, Activity trend, Challenge participation, Average wellness score, Employee engagement, Reward redemption, Monthly active employees
- **Fields:** Date range; Granularity (week/month); Department
- **Buttons:** Filters; Export
- **Actions:** Show aggregated trends
- **API Required:** GET /api/v1/organization/analytics/trends
- **Empty State:** 'Trends appear after one month of data.'
- **Error State:** 'Couldn't load trends.'
- **Notes:** Phase: Phase 2. Features: FEAT-261.

### SCR-B-029 — Monthly Report
- **User Role:** Company Owner, HR Admin
- **Purpose:** Generate, download and schedule the monthly wellness report for HR and leadership.
- **Entry Point:** Left navigation 'Analytics > Reports' (Phase 2)
- **Components:** Report list by month; generate; preview; schedule email delivery
- **Fields:** Report month; Format; Email recipients (FRM-72)
- **Buttons:** Generate; Download PDF; Schedule; Delete schedule
- **Actions:** Generate aggregated monthly report
- **API Required:** GET /api/v1/organization/reports; POST /api/v1/organization/reports; GET /api/v1/organization/reports/{id}/download; PUT /api/v1/organization/reports/schedule
- **Validation:** Recipients must be company administrators (ASSUMPTION)
- **Empty State:** 'No reports yet. Your first report will be available after a full month.'
- **Error State:** 'Report generation failed. Try again.'
- **Success State:** 'October 2026 report is ready.'
- **Notes:** Phase: Phase 2. Features: FEAT-264. Report format, content and delivery are TBC.


## MOD-15 Corporate Wellness Programs

### SCR-B-030 — Wellness Programs
- **User Role:** HR Admin, Wellness Manager
- **Purpose:** List and manage structured multi-week wellness programs (campaigns).
- **Entry Point:** Left navigation 'Programs' (Phase 2)
- **Components:** Table: Program, Duration, Dates, Status (Draft / Scheduled / Active / Completed / Archived), Enrolled, Completion %
- **Fields:** Status; Search
- **Buttons:** Create program; Use template; Edit; Archive
- **Actions:** Manage programs
- **API Required:** GET /api/v1/organization/programs
- **Empty State:** 'No programs yet. Start from the 30-Day Healthy Lifestyle template.'
- **Error State:** 'Couldn't load programs.'
- **Notes:** Phase: Phase 2. Features: FEAT-186, FEAT-191, FEAT-190. Whether a 'campaign' is the same as a program is TBC.

### SCR-B-031 — Create / Edit Program
- **User Role:** HR Admin, Wellness Manager
- **Purpose:** Build a program with weekly goals and an optional combined challenge.
- **Entry Point:** Wellness Programs 'Create program'
- **Components:** Stepper: details, weeks builder (add goals per week), participants, points, review; template picker
- **Fields:** Name; Description; Start date; Duration (weeks); Participants; Week goals (metric, target, frequency); Combined challenge; Completion points; Cover image (FRM-41)
- **Buttons:** Save draft; Add week; Add goal; Publish; Cancel
- **Actions:** Create/publish program
- **API Required:** POST /api/v1/organization/programs; PATCH /api/v1/organization/programs/{id}; POST /api/v1/organization/programs/{id}/publish
- **Validation:** At least 1 week with 1 goal; dates valid
- **Error State:** Field-level messages
- **Success State:** 'Program published.'
- **Notes:** Phase: Phase 2. Features: FEAT-186, FEAT-187, FEAT-188, FEAT-190.

### SCR-B-032 — Program Detail & Analytics
- **User Role:** HR Admin, Wellness Manager, Company Owner
- **Purpose:** Shows enrolment, weekly completion and overall completion for a program (aggregated).
- **Entry Point:** Wellness Programs row
- **Components:** Overview; KPIs (enrolled, active, completion %); completion by week chart; by department
- **Fields:** Department
- **Buttons:** Edit; Archive; Send announcement
- **Actions:** Show aggregated program analytics
- **API Required:** GET /api/v1/organization/programs/{id}; GET /api/v1/organization/programs/{id}/analytics
- **Validation:** Groups below minimum size suppressed
- **Empty State:** 'Analytics appear once the program starts.'
- **Error State:** 'Couldn't load analytics.'
- **Notes:** Phase: Phase 2. Features: FEAT-189, FEAT-192. Program analytics are RECOMMENDED (FEAT-192).


## MOD-17 Wellness Feed & Content

### SCR-B-033 — Content Library
- **User Role:** Wellness Manager
- **Purpose:** Manage company-specific wellness content (tips, articles, videos, links).
- **Entry Point:** Left navigation 'Content' (Phase 2)
- **Components:** Tabs: Company content, HealthX content (read-only); table: Title, Type, Category, Status (Draft / Published / Archived), Updated
- **Fields:** Type; Status; Search
- **Buttons:** New content; Edit; Publish; Archive
- **Actions:** Manage company content
- **API Required:** GET /api/v1/organization/content?type=&status=
- **Empty State:** 'No company content yet.'
- **Error State:** 'Couldn't load content.'
- **Notes:** Phase: Phase 2. Features: FEAT-215, FEAT-217, FEAT-213. Phase not stated in the PDF (proposed Phase 2). Approval step TBC.

### SCR-B-034 — Create / Edit Content
- **User Role:** Wellness Manager
- **Purpose:** Create or edit text, image, video, link or article content.
- **Entry Point:** Content Library 'New content'
- **Components:** Rich-text editor; media upload; link field; preview as phone card
- **Fields:** Title; Content type; Category; Body; Image; Video; External link; Tags; Audience; Status; Publish date (FRM-42)
- **Buttons:** Save draft; Preview; Publish; Cancel
- **Actions:** Create/update content
- **API Required:** POST /api/v1/organization/content; PATCH /api/v1/organization/content/{id}; POST /api/v1/files
- **Validation:** As FRM-42
- **Error State:** 'Video must be MP4 under 200 MB.'
- **Success State:** 'Content published.'
- **Notes:** Phase: Phase 2. Features: FEAT-213, FEAT-215, FEAT-217.


## MOD-13 Gamification Engine (Points, Streaks & Badges)

### SCR-B-035 — Points
- **User Role:** Company Owner, HR Admin (TBC)
- **Purpose:** View employee points balances, adjustments and redemptions, and make manual adjustments with a reason.
- **Entry Point:** Left navigation 'Points' (Phase 2)
- **Components:** Summary tiles (points awarded, redeemed, outstanding); table: Employee, Available, Lifetime, Redeemed; adjustment modal; adjustments log
- **Fields:** Employee; Adjustment type; Points; Reason (FRM-43)
- **Buttons:** Adjust points; Export
- **Actions:** Manual credit/debit (audit-logged; updates wallet)
- **API Required:** GET /api/v1/organization/points/balances; POST /api/v1/organization/points/adjustments; GET /api/v1/organization/points/adjustments
- **Validation:** Reason required; debit cannot exceed available balance
- **Empty State:** 'No points activity yet.'
- **Error State:** 'Couldn't save the adjustment.'
- **Success State:** 'Adjustment saved – 200 points added.'
- **Notes:** Phase: Phase 2. Features: FEAT-168, FEAT-161. Scope of the 'Points' admin section is TBC. To protect privacy, per-employee earning sources (e.g., '+50 Workout') are not shown to company admins – TBC – see Client Questions.


## MOD-22 Integrations

### SCR-B-036 — Integrations
- **User Role:** Company Owner, HR Admin
- **Purpose:** Connect and monitor HRMS, Slack and Microsoft Teams integrations.
- **Entry Point:** Left navigation 'Integrations' (Phase 2)
- **Components:** Cards: HRMS, Slack, Microsoft Teams with status, last sync, errors; Slack/Teams panel: channel, message types, enable toggle
- **Fields:** Platform; Channel; Message types; Enabled (FRM-45)
- **Buttons:** Connect; Configure; Disconnect; Test message
- **Actions:** OAuth connect Slack/Teams; post engagement updates only for employees who allowed sharing
- **API Required:** GET /api/v1/organization/integrations; POST /api/v1/organization/integrations/slack/connect; POST /api/v1/organization/integrations/teams/connect; PATCH /api/v1/organization/integrations/{id}
- **Validation:** Channel required before enabling
- **Empty State:** 'No integrations connected.'
- **Error State:** 'Slack connection expired – reconnect.'
- **Success State:** 'Test message posted to #wellness.'
- **Notes:** Phase: Phase 2. Features: FEAT-253, FEAT-287, FEAT-288. Message types and employee opt-in for Slack/Teams posts are TBC.

### SCR-B-037 — HRMS Integration Setup
- **User Role:** Company Owner, HR Admin
- **Purpose:** Configure HRMS synchronisation of employees, departments, managers and employment status.
- **Entry Point:** Integrations 'HRMS > Configure' (Phase 2)
- **Components:** Stepper: method, connection, field mapping, schedule, test & activate; sync history with results and errors
- **Fields:** HRMS system; Sync method; API URL & credentials / SFTP details / webhook secret; Field mapping; Schedule; Leaver handling (FRM-44)
- **Buttons:** Test connection; Save; Activate; Run sync now; Pause
- **Actions:** Synchronise employees; leavers deactivated per rule
- **API Required:** POST /api/v1/organization/integrations/hrms; POST /api/v1/organization/integrations/hrms/test; POST /api/v1/organization/integrations/hrms/sync; GET /api/v1/organization/integrations/hrms/runs; POST /api/v1/webhooks/hrms/{orgId}
- **Validation:** Required connection fields per method; mandatory mappings (employee ID, email)
- **Empty State:** 'No syncs yet.'
- **Error State:** 'Connection failed: authentication error.'
- **Success State:** 'Sync completed: 12 added, 30 updated, 3 deactivated.'
- **Notes:** Phase: Phase 2. Features: FEAT-289, FEAT-290, FEAT-291, FEAT-292, FEAT-293, FEAT-294. Which HRMS systems to support is TBC.


## MOD-16 Announcements & Notifications

### SCR-B-038 — Notification Settings
- **User Role:** Company Owner, HR Admin
- **Purpose:** Company-level notification options (e.g., which automatic reminders are on).
- **Entry Point:** Left navigation 'Settings > Notifications' (Phase 2)
- **Components:** Toggle list of automatic notification types; quiet hours default; weekly summary day
- **Fields:** Automatic reminders by type; Default quiet hours; Weekly summary day; Max pushes per day (FRM-46)
- **Buttons:** Save
- **Actions:** Override defaults for this company only
- **API Required:** GET/PUT /api/v1/organization/notification-settings
- **Error State:** 'Couldn't save settings.'
- **Success State:** 'Notification settings saved.'
- **Notes:** Phase: Phase 2. Features: FEAT-204. Scope of the 'Notifications' admin section is TBC.


## MOD-18 AI Wellness Coach & Insights

### SCR-B-039 — AI Configuration
- **User Role:** Company Owner (TBC)
- **Purpose:** Enable or disable AI features for the company within the plan.
- **Entry Point:** Left navigation 'Settings > AI' (Phase 2)
- **Components:** Toggles for AI Coach and Weekly AI Insight; plan usage indicator; privacy statement
- **Fields:** AI Coach enabled; Weekly AI insight enabled (FRM-47)
- **Buttons:** Save
- **Actions:** Hide/show AI features for the company immediately
- **API Required:** GET/PUT /api/v1/organization/ai-settings
- **Validation:** Only modules included in the plan can be enabled
- **Error State:** 'Couldn't save settings.'
- **Success State:** 'AI settings saved.'
- **Notes:** Phase: Phase 2. Features: FEAT-228. Scope of 'AI Configuration' is TBC. Company admins never see individual AI conversations.


## MOD-19 Business Portal — Organisation & People

### SCR-B-040 — Organisation Profile
- **User Role:** Company Owner
- **Purpose:** Company Owner manages company details.
- **Entry Point:** Left navigation 'Settings > Organisation'
- **Components:** Form; company code (read-only); set-up checklist
- **Fields:** Company name; Industry; Company size; Address; Country; Default timezone; Primary contact name; Primary contact email; Company code (FRM-34)
- **Buttons:** Save; Cancel
- **Actions:** Update company profile (audit-logged)
- **API Required:** GET/PATCH /api/v1/organization
- **Validation:** As FRM-34
- **Error State:** Field-level messages
- **Success State:** 'Organisation details saved.'
- **Notes:** Phase: MVP. Features: FEAT-231.

### SCR-B-041 — Company Settings
- **User Role:** Company Owner
- **Purpose:** Company-wide settings such as leaderboard name privacy, default goals and enabled modules.
- **Entry Point:** Left navigation 'Settings > General'
- **Components:** Sections: Leaderboard privacy (Full name / First name + initial / Anonymous) with preview; Default goals; Modules (read-only from plan, toggles where allowed); Rewards options; Analytics thresholds
- **Fields:** Leaderboard name display; Show profile photos; Allow employee opt-out; Default step goal; Default water goal; Week start day; Enabled modules; Redemption approval; Low-participation threshold (FRM-35)
- **Buttons:** Save; Cancel
- **Actions:** Save settings (audit-logged); leaderboards update everywhere
- **API Required:** GET/PATCH /api/v1/organization/settings
- **Validation:** As FRM-35
- **Error State:** 'Couldn't save settings.'
- **Success State:** 'Settings saved. Leaderboards now show first name + initial.'
- **Notes:** Phase: MVP. Features: FEAT-250, FEAT-154, FEAT-158, FEAT-182, FEAT-263, FEAT-310. Final list of company settings is TBC. Default privacy option TBC.

### SCR-B-042 — Branding
- **User Role:** Company Owner
- **Purpose:** Upload the company logo and choose brand colours shown to employees (co-branding).
- **Entry Point:** Left navigation 'Settings > Branding'
- **Components:** Logo upload with crop; colour pickers; live preview of app home and portal header; contrast check
- **Fields:** Company logo; Primary colour; Secondary colour (FRM-36)
- **Buttons:** Save; Reset to HealthX default
- **Actions:** Apply branding to app and portal for this company only
- **API Required:** GET/PUT /api/v1/organization/branding; POST /api/v1/files
- **Validation:** PNG/SVG/JPG ≤ 2 MB; colours must meet contrast guidelines (ASSUMPTION)
- **Error State:** 'Logo must be PNG, SVG or JPG under 2 MB.'; 'This colour is too light for text.'
- **Success State:** 'Branding updated – employees will see it next time they open the app.'
- **Notes:** Phase: MVP. Features: FEAT-249, FEAT-015, FEAT-005. Phase not stated in the PDF (proposed MVP for logo/colours). Full white-label is Phase 3 (SCR-B-048).

### SCR-B-043 — Audit Logs
- **User Role:** Company Owner
- **Purpose:** Read-only log of administrator actions in the company.
- **Entry Point:** Left navigation 'Settings > Audit logs' (Phase 2)
- **Components:** Table: Date/time, User, Action, Target, IP; filters; detail drawer
- **Fields:** Date range; User; Action type
- **Buttons:** Filter; Export
- **Actions:** Search logs (read-only)
- **API Required:** GET /api/v1/organization/audit-logs?from=&to=&user=&action=
- **Empty State:** 'No activity in this period.'
- **Error State:** 'Couldn't load logs.'
- **Notes:** Phase: Phase 2. Features: FEAT-251, FEAT-013. Audit logging is captured from MVP; viewer UI proposed Phase 2.


## MOD-24 Subscription & Billing

### SCR-B-044 — Subscription & Invoices
- **User Role:** Company Owner
- **Purpose:** Shows the company's plan, modules, limits and invoices.
- **Entry Point:** Left navigation 'Settings > Subscription' (Phase 2)
- **Components:** Plan card (Starter / Growth / Enterprise); renewal date; active employees vs limit; modules and integrations; invoices table (number, period, amount, status, PDF)
- **Buttons:** Download invoice; Contact HealthX to change plan; Pay now (TBC)
- **Actions:** View plan and invoices
- **API Required:** GET /api/v1/organization/subscription; GET /api/v1/organization/invoices; GET /api/v1/organization/invoices/{id}/pdf
- **Empty State:** 'No invoices yet.'
- **Error State:** 'Couldn't load subscription details.'
- **Notes:** Phase: Phase 2. Features: FEAT-252, FEAT-312, FEAT-313. Online payment is TBC (no payment gateway in MVP).


## MOD-02 Onboarding & Authentication

### SCR-B-045 — My Account
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Admin's own account: name, password and two-step verification.
- **Entry Point:** Header avatar menu 'My account'
- **Components:** Profile form; change password; MFA set-up (QR code) and recovery codes; active sessions
- **Fields:** Full name; Current password; New password; Confirm password; Enable MFA (FRM-64)
- **Buttons:** Save; Change password; Set up MFA; Sign out other sessions; Sign out
- **Actions:** Update own account; manage sessions
- **API Required:** PATCH /api/v1/me; POST /api/v1/auth/password/change; POST /api/v1/auth/mfa/setup; DELETE /api/v1/me/sessions
- **Validation:** Password policy; current password required to change
- **Error State:** 'Current password is incorrect.'
- **Success State:** 'Password changed.'
- **Notes:** Phase: MVP. Features: FEAT-039, FEAT-033, FEAT-032.


## MOD-19 Business Portal — Organisation & People

### SCR-B-046 — Locations
- **User Role:** Company Owner, HR Admin
- **Purpose:** Record office locations/sites to compare participation by location.
- **Entry Point:** Left navigation 'Organisation > Locations' (if approved)
- **Components:** Table: Location, City, Country, Employees; add/edit modal
- **Fields:** Location name; Address; City; Country; Timezone (FRM-67)
- **Buttons:** Add location; Edit; Delete
- **Actions:** Manage locations; assign employees
- **API Required:** GET/POST /api/v1/organization/locations; PATCH/DELETE /api/v1/organization/locations/{id}
- **Validation:** Unique name; cannot delete while employees are assigned
- **Empty State:** 'No locations yet.'
- **Error State:** 'Couldn't save location.'
- **Success State:** 'Location added.'
- **Notes:** Phase: Phase 2. Features: FEAT-255. PDF mentions comparing 'departments/locations' (§2) but defines no Location entity – required or not is TBC.


## MOD-01 Platform Foundation & Multi-Tenancy

### SCR-B-047 — Access Denied / Page Not Found / Error
- **User Role:** Company Owner, HR Admin, Wellness Manager
- **Purpose:** Standard pages when a user lacks permission, a page doesn't exist or an error occurs.
- **Entry Point:** Any blocked or failed request
- **Components:** Illustration; message; Back to dashboard
- **Buttons:** Back to dashboard; Contact support
- **Error State:** 403: 'You don't have permission to view this page.'; 404: 'Page not found.'; 500: 'Something went wrong. Please try again.'
- **Notes:** Phase: MVP. Features: FEAT-007, FEAT-003.


## MOD-23 White Label

### SCR-B-048 — White Label Settings
- **User Role:** Company Owner / Platform Super Admin
- **Purpose:** Configure full white-label: app name, email and notification templates, custom domain, content and reward catalogue.
- **Entry Point:** Left navigation 'Settings > White label' (Phase 3)
- **Components:** Sections: App name; Email templates editor; Notification templates; Custom domain with DNS instructions; Content and reward catalogue selection
- **Fields:** App name; Email templates; Notification templates; Domain; Content; Reward catalogue (FRM-62)
- **Buttons:** Save; Verify domain; Preview email
- **Actions:** Apply company branding beyond logo/colours
- **API Required:** GET/PUT /api/v1/organization/white-label; POST /api/v1/organization/white-label/domain/verify
- **Validation:** Domain ownership verified via DNS
- **Error State:** 'Domain verification failed – DNS record not found.'
- **Success State:** 'White-label settings saved.'
- **Notes:** Phase: Phase 3. Features: FEAT-300, FEAT-301, FEAT-302, FEAT-303, FEAT-304. Main screen only – detailed design in Phase 3. Logo and colours are delivered in MVP Branding (SCR-B-042).


## MOD-02 Onboarding & Authentication

### SCR-B-049 — Enterprise SSO Setup
- **User Role:** Company Owner
- **Purpose:** Configure SAML 2.0 or OIDC single sign-on with the company's identity provider.
- **Entry Point:** Left navigation 'Settings > Single sign-on' (Phase 3)
- **Components:** Protocol selector; IdP metadata/configuration fields; test sign-in; enforce toggle
- **Fields:** Protocol; IdP metadata URL; Entity ID; SSO URL; Certificate; Client ID; Client secret; Allowed domains; Enforce SSO (FRM-63)
- **Buttons:** Test; Save; Enforce
- **Actions:** Save SSO configuration; enforce SSO for the company's users
- **API Required:** GET/PUT /api/v1/organization/sso; POST /api/v1/organization/sso/test
- **Validation:** Successful test sign-in required before enforcing
- **Error State:** 'Test failed: invalid certificate.'
- **Success State:** 'SSO enforced for @company.com users.'
- **Notes:** Phase: Phase 3. Features: FEAT-026, FEAT-027. Main screen only – detailed design in Phase 3.


## MOD-20 Business Portal — Analytics & Reporting

### SCR-B-050 — Advanced Reports & Corporate Wellness Score
- **User Role:** Company Owner, HR Admin
- **Purpose:** Configurable reports and an aggregated company/department wellness score.
- **Entry Point:** Left navigation 'Analytics > Advanced' (Phase 3)
- **Components:** Company and department wellness score cards (aggregated); report builder (metrics, groupings, period); saved reports
- **Fields:** Metrics; Group by; Period
- **Buttons:** Build report; Save; Export
- **Actions:** Generate aggregated custom reports
- **API Required:** GET /api/v1/organization/analytics/wellness-score; POST /api/v1/organization/reports/custom
- **Validation:** Minimum group size applies
- **Error State:** 'Couldn't build report.'
- **Notes:** Phase: Phase 3. Features: FEAT-267, FEAT-063, FEAT-266. Main screen only – Phase 3. Leadership role and how 'program ROI' is measured are TBC (FEAT-266).
