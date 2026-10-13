# Development scope — source of truth

Source: Google Sheet **"HealthX Business corporate Feature List" → tab "All Features List"** (377 rows). Decision (12 Oct 2026): build **Phase 1 + Phase 2 only**, **frontend only** (no backend). Nothing that is not in this list. Not now: Phase 3, Future, and everything in the sheet's **"Extra Features"** tab. The employee web app (`/employee-app`) is kept by the user's request (web twin of the mobile app); the mobile app is the employee's primary app.

Included: **340 features** (Phase 1: 234, Phase 2: 106). Rows 1–344 match FEAT-001…FEAT-344 in the requirement workbook (Phase 1 = MVP). Rows 346–378 are newer additions (see §3).

## 1. Client decisions (sheet tab "Questions for confirmations") — must be reflected in the UI

| # | Decision | What it means for the frontend |
|---|---|---|
| 3 | "Admin Portal" = Business Portal | Company admin screens live in `/business-portal`. Platform Admin (`/admin-portal`) is the HealthX team's portal. |
| 6 | Active employee = defined activity/login within the selected period; Participation = active ÷ eligible × 100 | Use these definitions in all dashboards/analytics labels. |
| 7 | HR may see individual NON-health participation data (status, challenges joined) | OK on employee detail. Never health data. |
| 8 | MVP: offline invoicing / manual billing. Phase 2: online payment | Invoices shown; "Pay online" only as a Phase 2 feature. |
| 12 | Wellness Score weights: HealthX Admin only | Weights screen only in Platform Admin. No company-level override. |
| 13 | Reward redemptions need company admin approval (MVP) | Orders start as "Pending approval". |
| 14 | Points do NOT expire. NO company rewards budget | No points-expiry setting, no budget/spend UI anywhere. |
| 15 | MVP reward categories: basic wellness, gift vouchers, recognition rewards | Catalogue/categories reflect these. |
| 16 | Exercise media: short videos + images/instructions | Exercise editor/player show video + image + steps. |
| 17 | 30-day free trial / pilot | Trial length = 30 days wherever a trial is shown (e.g. self-serve sign-up #353). |
| 18 | HR can NOT see an individual employee's points history | Business Portal must not show per-employee points ledgers/history. Totals in leaderboards are fine. |
| 19 | Same activity must not earn points twice (e.g. water habit vs water goal) | Points logic de-duplicates. |
| 20 | Challenge creators: Company Owner + HR Admin + Wellness Manager | Team Manager is view-only. |
| 21 | Challenges cannot be edited after they start | Once a challenge has started, editing is disabled (cancel/end only). |

## 2. Not in scope now

- Phase 3 & Future rows: #26 Enterprise SSO – SAML 2.0; #27 Enterprise SSO – OAuth/OIDC; #63 Corporate wellness scoring; #108 AI meal planner; #109 Indian food database; #110 Grocery planner; #111 Personalised meal recommendations; #184 Third-party reward marketplace; #230 AI personalisation; #266 Leadership ROI view; #267 Advanced reporting; #286 Other wearables; #295 Insurance integrations; #296 Gym network integrations; #297 Corporate benefits integrations; #298 Reward provider integrations; #299 API marketplace; #300 Custom app name; #301 Custom email templates; #302 Custom notification templates; #303 Custom domain; #304 Company content & reward catalogue; #305 White-label mobile apps; #336 Sleep Coach; #337 Water Tracker; #338 AI Workout Generator; #339 Habit Coach; #340 Posture Coach; #341 Health Report Analyzer; #342 HealthX Consumer; #343 HealthX Partners; #344 HealthX Engine; #370 Advanced Reports & Export; #375 QR Code Fitness Hunt; #376 Fitness Assessment Tests; #377 Accountability Pods; #378 Employee Testimonials.
- Everything in the "Extra Features" tab (step-equivalent conversion, streak freeze, widgets, smartwatch, buddy challenges, levels, leagues, mood check-in, eye breaks, offline mode, charity steps, surveys, auto-nudge rules, wellness calendar, events, QR poster, EAP link, industry benchmark, customer health score, NPS, A/B testing, WhatsApp, regional content, UPI cashback, festival challenges).
- Anything else not listed below (e.g. company rewards budget, points expiry).

## 3. Newer rows (346–378) and where they live

| # | Phase | Feature | App / screen |
|---|---|---|---|
| 346 | P1 | “Sync Now” Button and Sync Status Tracking — Employees should have a “Sync Now” button to manually refresh their activity data when steps are missing or delayed. HR should also have access to a sync-status dashboard showing employees who have not connected their trackers or whose devices have not synced for seven days or more. This information is limited to device connectivity and sync activity, without exposing personal health data, helping maintain employee privacy. | Employee app: Activity + Home ("Sync now", last-sync status) |
| 347 | P1 | Employee Help Centre, FAQs, and Support Tickets — The app should include an in-built Help Centre with FAQs and troubleshooting guides for common issues, such as missing steps and tracker connection problems. Employees should also be able to raise support tickets directly through the app. This will reduce the support burden on HR and the HealthX team while helping employees resolve issues more efficiently. | Employee app: Help centre (FAQs, troubleshooting, raise/view support tickets) · Platform Admin: Help-centre articles/FAQ management + Support tickets |
| 348 | P2 | Rank-Change Alerts — Notify employees when their leaderboard position changes, including when they move up or lose a top-three position. | Employee app: notifications when rank changes (incl. leaving top 3) |
| 349 | P2 | Suspicious-Data Review Queue — Allow HR to review unusual activity records and accept, adjust, or reject them before awarding points. | Business Portal: Activity review (suspicious data — accept / adjust / reject) |
| 350 | P2 | Mini-Challenges — Create short, optional competitions within a main challenge, with bonus points and limited winner slots. | Business Portal: challenge mini-challenges · Employee app: show & join |
| 351 | P2 | Public / TV Leaderboard — Provide a shareable leaderboard link for office screens or Slack, with privacy controls. | Business Portal: share public/TV leaderboard link (privacy controls) · public page `/board/[token]` |
| 352 | P2 | Bulk Award Points — Allow HR to award bonus points to multiple employees or teams at once, with a reason and date. | Business Portal: Points → bulk award (employees/teams, reason, date) |
| 353 | P2 | Self-Serve Sign-Up & Free Trial — Let companies register independently, try the platform for 21 days, and purchase a subscription online. | Business Portal: self-serve sign-up + 30-day free trial (`/business-portal/signup`) · Platform Admin: trial companies |
| 354 | P2 | Admin Getting-Started Checklist — Guide admins through initial setup, including creating challenges, adding teams and employees, and sending invitations. | Business Portal: dashboard getting-started checklist |
| 355 | P2 | Completion Certificates — Automatically generate certificates for employees who complete a challenge, with bulk email or CSV export options. | Business Portal: challenge completion certificates (bulk email / CSV) · Employee app: download certificate |
| 356 | P1 | QR Code / Short-Code Joining — Allow employees to join a company challenge using a QR code, short code, or shareable link. | Business Portal: challenge QR code / short code / share link · Employee app: join by code/link |
| 357 | P1 | Challenge Fairness Lock — Lock scoring rules, start dates, and daily goals once a challenge begins to prevent unfair changes. | Business Portal: lock scoring rules, dates and goals once a challenge starts |
| 358 | P2 | Challenge Warm-Up Period — Allow employees to join and connect their health trackers before activity scoring starts. | Business Portal: challenge warm-up period · Employee app: warm-up state |
| 359 | P1 | Winner Prizes & Rankings — Configure rewards for first, second, and third place in individual and team competitions. | Business Portal: 1st/2nd/3rd prizes for individual & team competitions · Employee app: prizes on challenge |
| 360 | P1 | Employee Sync-Status Tracking — Show HR whether employees have connected their health apps, when they last synced, and whether they have given consent. | Business Portal: employees list/detail — health-app connected, last sync, consent status |
| 361 | P2 | Personal-Data Access Log — Track who accessed, modified, or deleted personal data for improved security and compliance. | Business Portal + Platform Admin audit logs: personal-data access log |
| 362 | P2 | Personalized Daily Goals — Set daily activity goals based on each employee's recent activity and award bonus points for achieving them. | Employee app: personalised daily goal from recent activity + bonus points |
| 363 | P1 | Tracker & Sync Issue Management — Allow HR to identify employees who have not connected their trackers, have not synced for 3 or 7+ days, or need to reconnect. Include follow-up messaging and contact status. | Business Portal: Tracker & sync issues (not connected, no sync 3 / 7+ days, nudge) |
| 364 | P1 | Excused Dates Management — Allow HR to mark company holidays, office shutdowns, or individual sick days as excused so employees are not unfairly penalized. | Business Portal: Excused dates (holidays, shutdowns, individual sick days) |
| 365 | P1 | Manual Activity Approval & Correction — Require HR approval for manually entered activities before awarding points. Allow authorized admins to correct missing or incorrect activity records when necessary. | Business Portal: Activity review — approve manual activities before points; admins correct records · Employee app: manual entries show "Pending approval" |
| 366 | P1 | Employee Support Tools — Provide employee search by name, email, or ID, tracker troubleshooting, shareable help articles, and account login unlocking. | Platform Admin: employee support tools (search by name/email/ID, tracker troubleshooting, share help articles, account lookup) |
| 367 | P2 | Challenge Setup Checklist — Guide HR through challenge setup and highlight missing configuration steps before launch. | Business Portal: challenge setup checklist before launch |
| 368 | P2 | Bulk Sync & Historical Data Recovery — Allow admins to resync activity data for an entire group, including eligible historical challenge data. | Business Portal: bulk resync & historical data recovery for a group |
| 369 | P2 | Custom Scoring Rules — Support flexible scoring methods, such as counting the best 5 out of 7 days or using score bands. | Business Portal: custom scoring rules (best N of M days, score bands) |
| 371 | P2 | Targeted Employee Messaging — Allow HR to send announcements to selected employees rather than only entire companies, departments, or teams. | Business Portal: announcements to selected employees |
| 372 | P2 | Company-Created Workouts — Allow company admins to create and manage their own workouts instead of relying exclusively on HealthX Admin. | Business Portal: company-created workouts |
| 373 | P2 | Admin Video Tutorials — Provide video guides to help HR understand platform features and complete common tasks. | Business Portal: admin video tutorials (Help) |
| 374 | P2 | Walking Journey Management — Allow admins to configure virtual routes, milestones, and rewards for walking challenges. | Business Portal: walking journey (virtual route, milestones, rewards) · Employee app: journey progress |

## 4. Full included list (Phase 1 + Phase 2)


### Platform Foundation & Security

- #1 (P1) **Multi-tenant company workspaces** — Each company gets its own private workspace on one shared platform.
- #2 (P1) **Tenant isolation – database level** — The database itself blocks one company from seeing another company's data.
- #3 (P1) **Tenant isolation – API & authorisation level** — Every request is checked for the right company and role.
- #4 (P1) **Tenant isolation – analytics level** — Company reports are calculated only from that company's data.
- #5 (P1) **Tenant isolation – file storage level** — Uploaded files are kept separate per company behind secure, expiring links.
- #6 (P1) **Organisation hierarchy** — Every user belongs to Organisation → Department → Team.
- #7 (P1) **Role-based access control (6 roles)** — Each role can see and do only what it is allowed to.
- #8 (P1) **Modular backend architecture** — The backend is split into independent modules so new ones plug in easily.
- #9 (P1) **Reusable wellness engines** — Core logic (water, workout, habits, challenges, rewards) is reusable by future HealthX apps.
- #10 (P1) **HealthX Design System** — A shared set of buttons, cards, charts and progress rings used in all apps.
- #11 (P1) **Mobile clean architecture** — A structured Flutter codebase where each feature stays independent.
- #12 (P1) **Event-driven analytics tracking** — Records key user actions to measure engagement.
- #13 (P1) **System-wide audit logging** — Records who did what and when for important actions.
- #14 (P2) **Real-time updates** — Leaderboards and progress refresh live without reloading.
- #15 (P1) **Secure file upload** — Safe upload of photos, logos and media with type and size checks.
- #16 (P1) **Multi-language support** — The app is built so it can be translated into other languages.
- #17 (P1) **Timezone-aware daily calculations** — A "day" follows each employee's local time.

### Onboarding & Login

- #18 (P1) **Splash screen** — Branded launch screen shown while the app loads.
- #19 (P1) **Company identification** — Employee finds their company using a code, invite link or work email.
- #20 (P1) **Join via company invitation** — Employee joins from an invite already linked to their company and team.
- #21 (P1) **Email registration & sign-in** — Sign up and log in with an email address.
- #22 (P1) **Phone sign-in (SMS code)** — Log in with a mobile number and a one-time SMS code.
- #23 (P1) **Magic-link sign-in** — Log in by tapping a one-time link sent by email.
- #24 (P1) **Sign in with Google** — One-tap login with a Google account.
- #25 (P1) **Sign in with Microsoft** — One-tap login with a Microsoft account.
- #28 (P1) **Onboarding – profile setup** — New user fills in basic profile details.
- #29 (P1) **Onboarding – health & wellness goals** — User picks goals like "be more active" or "drink more water".
- #30 (P1) **Onboarding – device permissions** — Explains and asks for notification and health permissions.
- #31 (P1) **Onboarding – connect health platform** — Connect Apple Health or Health Connect, or skip for later.
- #32 (P1) **Secure session management** — Users stay safely logged in; sessions renew automatically and can be revoked.
- #33 (P1) **Sign out** — Log out and clear data from the device.
- #34 (P1) **Forgot / reset password** — Reset a forgotten password through a secure email link.
- #35 (P1) **Terms & Privacy acceptance** — User accepts Terms and Privacy Policy; acceptance is recorded.
- #36 (P1) **Account deletion request** — Employee can ask to delete their account from inside the app.
- #37 (P1) **Business Portal sign-in** — Company admins log in to the web portal.
- #38 (P1) **Platform Admin sign-in** — HealthX staff log in to the admin portal.
- #39 (P1) **Multi-factor authentication for admins** — Admins confirm login with a second step for extra security.
- #40 (P1) **App version check / forced update** — Asks users to update when an old app version must stop working.

### Employee Profile

- #41 (P1) **Basic profile details** — Name, email, phone, gender, date of birth, location and timezone.
- #42 (P1) **Profile image upload** — Add or change a profile photo.
- #43 (P1) **Wellness profile** — Height, weight, goal, activity level and fitness level.
- #44 (P1) **Activity & workout preferences** — Preferred activities and home/gym workout style.
- #45 (P1) **Food preference** — Veg, vegan, non-veg etc. for later nutrition features.
- #46 (P1) **Notification preferences** — Choose which reminders and alerts to receive.
- #47 (P1) **Language preference** — Choose the app language.
- #48 (P1) **View & edit profile** — Update profile information at any time.
- #49 (P1) **Profile completion tracking** — Shows how complete the profile is and nudges the user to finish it.
- #50 (P2) **Units of measurement** — Choose metric or imperial units.

### Home Dashboard & Wellness Score

- #51 (P1) **Personalised greeting** — Shows "Good Morning, John" based on time of day.
- #52 (P1) **Today's progress summary** — Today's steps, water, workout (and sleep later) against goals.
- #53 (P1) **Today's challenge card** — Today's challenge target and the points available.
- #54 (P1) **Weekly progress indicator** — Bar showing how much of this week's goals is done.
- #55 (P1) **Current rank widget** — Shows the employee's rank, e.g. "#8 in Engineering".
- #56 (P2) **Configurable home dashboard** — Choose which cards appear on Home and in what order.
- #57 (P1) **HealthX Wellness Score** — One 0–100 score summarising the employee's wellness habits.
- #58 (P1) **Wellness Score weights** — Score made from activity, sleep, hydration, exercise, habits and mindfulness.
- #59 (P1) **Configurable score weights** — Admin can change the score weights without code changes.
- #60 (P1) **Wellness Score disclaimer** — Score is clearly labelled as an engagement score, not a medical one.
- #61 (P1) **Wellness baseline** — Starting score and typical activity shown after onboarding.
- #62 (P1) **Weekly wellness summary** — Weekly recap of workouts, steps and water goals completed.

### Activity & Steps

- #64 (P1) **Daily step tracking** — Today's steps against a daily goal.
- #65 (P1) **Distance tracking** — Daily walking and running distance.
- #66 (P1) **Calories tracking** — Active calories burned, taken from the health app.
- #67 (P1) **Active minutes tracking** — Minutes of moderate or vigorous activity.
- #68 (P1) **Activity types** — Log running, walking, cycling, swimming or yoga.
- #69 (P1) **Meditation minutes logging** — Record meditation time for habits, challenges and the score.
- #70 (P1) **Manual activity entry** — Add an activity that the device did not capture.
- #71 (P1) **Activity history** — Past activity shown by day and week.
- #72 (P1) **Daily activity aggregation** — Combines data from all sources without double-counting steps.
- #73 (P1) **Weekly / monthly activity charts** — Trend charts of steps and activity over time.

### Water Tracking

- #74 (P1) **Quick water logging** — One tap to add 250 ml, 500 ml, 750 ml or 1 L.
- #75 (P1) **Daily water goal** — A daily water target the employee can adjust.
- #76 (P1) **Hydration dashboard** — Shows water goal, amount drunk and % complete.
- #77 (P1) **Smart hydration reminders** — Reminders paced through the day that stop once the goal is met.
- #78 (P1) **Hydration streak** — Count of consecutive days the water goal was met.
- #79 (P1) **Weekly hydration chart** — 7-day water chart with a goal line.
- #80 (P1) **Edit / delete water entry** — Fix or remove a wrong water log.
- #81 (P1) **Custom water amount** — Enter any water amount besides the quick buttons.

### Sleep Tracking

- #82 (P2) **Sleep log** — Record bedtime and wake-up time.
- #83 (P2) **Sleep duration calculation** — Works out hours slept automatically.
- #84 (P2) **Sleep consistency tracking** — Rates how regular the sleep times are.
- #85 (P2) **Sleep score** — A 0–100 sleep score (non-medical).
- #86 (P2) **Sleep dashboard** — Sleep score, duration and consistency at a glance.
- #87 (P2) **Sleep data sync** — Import sleep from Apple Health, Health Connect or wearables.
- #88 (P2) **Sleep goal** — Target hours of sleep per night.

### Workouts

- #89 (P1) **Workout library** — Browse all available workouts.
- #90 (P1) **Workout categories** — Workouts grouped by type such as cardio, strength or yoga.
- #91 (P1) **Workout filter – difficulty** — Filter by beginner, intermediate or advanced.
- #92 (P1) **Workout filter – location** — Filter by home or gym workouts.
- #93 (P1) **Workout filter – equipment** — Filter by equipment needed (none, dumbbells, mat, etc.).
- #94 (P1) **Workout filter – duration** — Filter by workout length.
- #95 (P1) **Workout filter – muscle groups** — Filter by the body area targeted.
- #96 (P1) **Workout detail view** — Shows exercises, duration, level, equipment and points.
- #97 (P1) **Guided workout session** — Step-by-step player: exercise → rest → exercise → complete.
- #98 (P1) **Pause / resume / end workout** — Control the workout if interrupted.
- #99 (P1) **Workout completion & points** — Finishing a workout records it and earns points.
- #100 (P1) **Workout history** — List of completed workouts.
- #101 (P1) **Workout content management** — Admins create and publish workouts and exercises with media.
- #102 (P1) **Workout search** — Find workouts by name.

### Nutrition

- #103 (P2) **Meal logging** — Log breakfast, lunch, dinner and snacks.
- #104 (P2) **Nutrition totals** — Daily calories, protein, carbohydrates and fat.
- #105 (P2) **Water in nutrition view** — Shows water intake from hydration tracking inside nutrition.
- #106 (P2) **Food database** — Searchable foods with nutrition values.
- #107 (P2) **Independent nutrition module** — Nutrition can be released and updated on its own.

### Habits

- #112 (P1) **Habit selection** — Choose habits like walk daily, drink water, stretch or take breaks.
- #113 (P1) **Daily habit target** — A daily goal for each habit.
- #114 (P1) **Habit check-in** — Mark a habit as done today.
- #115 (P1) **Habit streaks** — Consecutive days each habit was completed.
- #116 (P1) **Habit points** — Completing habits earns points.
- #117 (P1) **Habit history & calendar** — Calendar showing done and missed days.
- #118 (P1) **Habit reminders** — Optional reminder at a chosen time.
- #119 (P1) **Habit library management** — Admins maintain the list of available habits.
- #120 (P2) **Custom habits** — Employees create their own personal habits.
- #121 (P2) **Auto-complete habits** — Habits tick automatically when tracked data meets the goal.

### Challenges

- #122 (P1) **Create challenge – basic details** — Set challenge name, description, type, start and end date.
- #123 (P1) **Challenge metric** — Choose steps, distance, calories, workout, water or meditation.
- #124 (P1) **Custom challenge metric** — A self-reported custom goal (definition to be confirmed).
- #125 (P1) **Challenge target** — Set the goal, e.g. 100,000 steps in 30 days.
- #126 (P1) **Challenge participants** — Choose all employees, a department, a team or selected people.
- #127 (P1) **Challenge points** — Points awarded for completing the challenge.
- #128 (P1) **Challenge reward** — Optional reward attached to the challenge.
- #129 (P1) **Challenge type – Individual** — Each person works against their own target.
- #130 (P1) **Challenge type – Leaderboard** — Employees compete against each other.
- #131 (P1) **Challenge type – Team** — Departments or teams compete (e.g. Engineering vs Sales).
- #132 (P1) **Challenge type – Company-wide** — The whole company works toward one target.
- #133 (P1) **Challenge type – Collaborative** — Everyone contributes to one shared goal.
- #134 (P1) **Global challenge templates** — Ready-made challenges provided by HealthX.
- #135 (P1) **Create challenge from template** — Start a challenge from a template and adjust it.
- #136 (P1) **Challenge list & management** — Admins see all challenges with status and progress.
- #137 (P1) **Edit challenge** — Change a challenge (limited once it has started).
- #138 (P1) **Cancel / delete challenge** — Stop a challenge or delete a draft.
- #139 (P1) **Challenge status lifecycle** — Draft → Scheduled → Active → Completed / Cancelled.
- #140 (P1) **Browse challenges** — Employees see available, active and completed challenges.
- #141 (P1) **Challenge detail** — Rules, dates, target, points, reward and progress.
- #142 (P1) **Join challenge** — Employee joins an eligible challenge.
- #143 (P1) **Automatic challenge progress** — Progress updates automatically from tracked data.
- #144 (P1) **Challenge completion & results** — Final ranks, completions, points and rewards at the end.
- #145 (P1) **Leave challenge** — Employee can leave a challenge they joined.
- #146 (P1) **Challenge analytics** — Participants, completion rate, average activity and team performance.
- #147 (P1) **Challenge notifications** — Start, reminder and results alerts for participants.
- #148 (P2) **Duplicate challenge** — Copy an old challenge to reuse it.

### Leaderboards

- #149 (P1) **Company leaderboard** — Ranking of all employees in the company.
- #150 (P1) **Department leaderboard** — Ranking of departments.
- #151 (P1) **Team leaderboard** — Ranking of teams.
- #152 (P1) **Personal rank** — The employee's own position is always shown.
- #153 (P1) **Challenge leaderboard** — Ranking within each challenge.
- #154 (P1) **Leaderboard name privacy** — Company chooses full name, first name + initial, or anonymous.
- #155 (P1) **Leaderboards in Business Portal** — Admins view the same leaderboards on the web.
- #156 (P1) **Team Manager team leaderboard** — Managers track their team's leaderboard position.
- #157 (P1) **Leaderboard period filter** — Switch between today, week, month or challenge.
- #158 (P1) **Leaderboard opt-out** — Employee can choose to appear as "Anonymous".

### Points & Badges

- #159 (P1) **Centralised points engine** — One engine awards all points using configurable rules.
- #160 (P1) **Default points rules** — 1,000 steps +10, workout +50, meditation +20, water goal +20, challenge +100, 7-day streak +100.
- #161 (P1) **Points rules configuration** — Admins change point values and daily caps.
- #162 (P1) **Streak engine** — Tracks consecutive-day streaks and streak bonuses.
- #163 (P1) **Badge engine** — Automatically awards badges when criteria are met.
- #164 (P1) **Default badges** — First Workout, 7-Day Streak, Step Master, Hydration Hero, Early Bird.
- #165 (P1) **Badges & achievements screen** — Shows earned and locked badges with progress.
- #166 (P1) **Badge unlock celebration** — Celebration and notification when a badge is earned.
- #167 (P1) **Badge management** — Admins create and edit badges.
- #168 (P2) **Points administration** — View the points ledger and make manual adjustments.
- #169 (P1) **Points anti-abuse controls** — Daily caps and checks stop unrealistic points.
- #170 (P1) **Points earned feedback** — '+ 50 points pop-up after an action.'

### Rewards & Wallet

- #171 (P1) **Points wallet** — Shows available, lifetime and redeemed points.
- #172 (P1) **Points transaction history** — Every points credit and debit.
- #173 (P1) **Rewards catalogue** — Browse rewards and their points cost.
- #174 (P1) **Reward categories** — Vouchers, merchandise, fitness and company benefits.
- #175 (P1) **Reward detail** — Description, cost, terms and delivery method.
- #176 (P1) **Redeem reward** — Spend points on a reward and create an order.
- #177 (P1) **Order tracking** — Follow a redemption from order to delivery.
- #178 (P1) **Reward fulfilment** — Admins deliver rewards manually (voucher code or shipping).
- #179 (P1) **Global reward catalogue** — HealthX manages rewards offered to all companies.
- #180 (P1) **Company reward configuration** — Company adds its own rewards like merchandise or extra benefits.
- #181 (P1) **Reward stock & limits** — Set quantity available and per-person limits.
- #182 (P1) **Redemption approval** — Optional admin approval before a reward is delivered.
- #183 (P1) **Redemption cancellation & refund** — Cancelled orders get their points back.
- #185 (P2) **Points expiry** — Points expire after a set period.

### Wellness Programs

- #186 (P2) **Create wellness program** — HR builds a multi-week program (e.g. 30-Day Healthy Lifestyle).
- #187 (P2) **Weekly program goals** — Different goals each week (steps, water, workouts, sleep).
- #188 (P2) **Combined program challenge** — A multi-metric challenge inside a program.
- #189 (P2) **Program enrolment & progress** — Employees join programs and follow weekly goals.
- #190 (P2) **Program templates** — Ready-made programs to copy.
- #191 (P2) **Wellness campaigns** — HR and Wellness Manager campaigns (exact meaning to be confirmed).
- #192 (P2) **Program analytics** — Enrolment and completion for each program.

### Announcements & Notifications

- #193 (P1) **Create & send announcement** — HR writes and sends company messages.
- #194 (P1) **Announcement via push** — Announcement delivered as a phone notification.
- #195 (P1) **In-app announcements** — Announcement list and detail inside the app.
- #196 (P1) **Announcement types** — Wellness tip, challenge or reward announcement.
- #197 (P1) **Announcement targeting** — Send to everyone, a department or a team.
- #198 (P1) **Announcement scheduling** — Send an announcement at a future date and time.
- #199 (P1) **Push notification service** — Sends push notifications to iPhone and Android devices.
- #200 (P1) **Notification centre** — All notifications in one place with read/unread status.
- #201 (P1) **Notification preference enforcement** — Only sends notifications the user has allowed.
- #202 (P1) **Transactional email** — Invites, login links and admin alerts sent by email.
- #203 (P1) **Notification open tracking** — Records when notifications are opened.
- #204 (P2) **Company notification settings** — Company controls which automatic reminders are on.
- #205 (P2) **Announcement reach analytics** — How many people received and opened each message.

### Wellness Feed & Content

- #206 (P2) **Personalised wellness feed** — A daily feed of relevant wellness cards.
- #207 (P2) **Feed – Today's Tip** — A daily wellness tip.
- #208 (P2) **Feed – Today's Workout** — A suggested workout for today.
- #209 (P2) **Feed – Current Challenge** — The active challenge and its progress.
- #210 (P2) **Feed – Company Announcement** — The latest company message.
- #211 (P2) **Feed – Wellness Article** — A recommended article.
- #212 (P2) **Feed – Achievement** — The latest badge or milestone.
- #213 (P2) **Content engine** — Supports text, images, videos, links and articles.
- #214 (P2) **Global content library** — HealthX content available to all companies.
- #215 (P2) **Company content management** — Companies add their own wellness content.
- #216 (P2) **Article & video viewer** — Read articles and watch videos inside the app.
- #217 (P2) **Content publishing status** — Draft, Published or Archived content.
- #218 (P2) **Save / bookmark content** — Save articles and workouts to view later.

### AI Wellness Coach

- #219 (P2) **AI Wellness Coach chat** — Ask wellness questions and get personal, non-medical guidance.
- #220 (P2) **AI Coach – improve wellness score** — Coach explains the score and suggests how to improve it.
- #221 (P2) **AI Coach – workout suggestion** — Suggests a workout, e.g. "Give me a 20-minute workout".
- #222 (P2) **AI Coach – meal suggestion** — Gives healthy meal ideas based on food preference.
- #223 (P2) **AI Coach – sleep tips** — Sleep tips based on the employee's sleep trends.
- #224 (P2) **AI Coach – 7-day wellness plan** — AI builds a weekly wellness plan the user can save.
- #225 (P2) **AI privacy guardrails** — AI never shares one person's data with HR or colleagues.
- #226 (P2) **AI safety guardrails** — No diagnosis; medical questions are redirected to professionals.
- #227 (P2) **AI weekly insight** — Spots trends (e.g. weekend activity drop) and suggests actions.
- #228 (P2) **AI configuration** — Admins switch AI features on or off and set limits.
- #229 (P2) **AI usage & cost controls** — Track and cap AI usage per company.

### Company & Employee Management

- #231 (P1) **Organisation profile** — Company name, logo, industry, size, address and timezone.
- #232 (P1) **Department management** — Create, edit and delete departments.
- #233 (P1) **Team management** — Create, edit and delete teams.
- #234 (P1) **Assign Team Manager** — Give each team its manager.
- #235 (P1) **Employee directory** — List of all employees with status, department and team.
- #236 (P1) **Employee search** — Find employees by name, email or ID.
- #237 (P1) **Employee filters** — Filter by department, team, status or role.
- #238 (P1) **Employee sorting** — Sort the employee list by any column.
- #239 (P1) **Employee export (CSV)** — Download the employee list without health data.
- #240 (P1) **Invite employee** — Invite one employee by email.
- #241 (P1) **Bulk employee import (CSV)** — Invite many employees at once from a spreadsheet.
- #242 (P1) **Resend / revoke invitation** — Manage pending invitations.
- #243 (P1) **Invitation status tracking** — Track Invited, Registered, Active and Inactive status.
- #244 (P1) **View employee details** — Work details and participation only, never health data.
- #245 (P1) **Edit employee** — Change an employee's department, team or role.
- #246 (P1) **Deactivate employee** — Remove access for people who leave the company.
- #247 (P2) **Bulk employee actions** — Move or deactivate many employees at once.
- #248 (P1) **Manage administrators** — Assign HR Admin, Wellness Manager and Team Manager roles.
- #249 (P1) **Company branding** — Company logo and colours shown in the app and portal.
- #250 (P1) **Company settings** — Leaderboard privacy, default goals, timezone and enabled modules.
- #251 (P2) **Company audit log viewer** — See admin actions taken in the company.
- #252 (P2) **Subscription & plan view** — Company sees its current plan and invoices.
- #253 (P2) **Integrations settings** — Connect HRMS, Slack and Microsoft Teams.
- #254 (P1) **Team Manager team progress** — Aggregated progress of the manager's team.
- #255 (P2) **Office locations** — Compare participation by office or site.

### Analytics & Reports

- #256 (P1) **Corporate analytics dashboard** — Total and active employees, participation, challenges, points and rewards.
- #257 (P1) **Adoption analytics** — Invited, registered, active and inactive employee counts.
- #258 (P2) **Engagement analytics** — Daily, weekly and monthly active users.
- #259 (P2) **Wellness participation analytics** — Average steps and workout, hydration, sleep and habit participation.
- #260 (P1) **Department analytics** — Employees, active users and participation % per department.
- #261 (P2) **Wellness trends charts** — Participation, activity, score and engagement over time.
- #262 (P1) **Analytics filters** — Filter analytics by date range, department and team.
- #263 (P1) **Low-participation identification** — Highlights groups that need encouragement.
- #264 (P2) **Monthly wellness report** — Monthly summary report for HR and leadership.
- #265 (P1) **Analytics export** — Download analytics as CSV or PDF.

### Privacy & Consent

- #268 (P1) **Aggregated-only data for HR** — HR sees group averages, never individual health data.
- #269 (P1) **Minimum group size** — Groups smaller than 5 people are hidden in analytics.
- #270 (P1) **Privacy & consent centre** — One screen for the employee to control all data sharing.
- #271 (P1) **Consent – health data** — Choose which health data HealthX can read.
- #272 (P1) **Consent – wearable connection** — Connect or disconnect health apps and devices.
- #273 (P1) **Consent – data sharing** — Control what colleagues and the company can see.
- #274 (P1) **Consent – notifications** — Opt in or out of engagement notifications.
- #275 (P2) **Consent – AI personalisation** — Opt in or out of AI using personal data.
- #276 (P1) **Consent – analytics participation** — Include or exclude yourself from company statistics.
- #277 (P1) **Auditable consent records** — Every consent change is saved with date and version.
- #278 (P1) **Consent withdrawal handling** — Stops data processing immediately when consent is withdrawn.
- #279 (P2) **Personal data export** — Employee downloads a copy of their own data.
- #280 (P1) **Data retention & deletion** — Data is deleted or anonymised after agreed periods.

### Integrations (Apple Health, Health Connect, Google/Microsoft login)

- #281 (P1) **Apple Health integration** — Read steps, distance, calories, active minutes and workouts on iPhone.
- #282 (P1) **Android Health Connect integration** — Read the same health data on Android phones.
- #283 (P1) **Health connection management** — See connected sources and last sync; reconnect or disconnect.
- #284 (P2) **Fitbit integration** — Import Fitbit activity and sleep data.
- #285 (P2) **Garmin integration** — Import Garmin activity and sleep data.
- #287 (P2) **Slack integration** — Post engagement updates to company Slack channels.
- #288 (P2) **Microsoft Teams integration** — Post engagement updates to Microsoft Teams channels.
- #289 (P2) **HRMS – REST API** — Sync employees from the HR system through its API.
- #290 (P2) **HRMS – CSV sync** — Recurring employee updates through CSV files.
- #291 (P2) **HRMS – SFTP** — Automatic pick-up of HR files from a secure server.
- #292 (P2) **HRMS – Webhook** — Real-time employee changes sent from the HR system.
- #293 (P2) **HRMS – scheduled sync** — Automatic nightly synchronisation with the HR system.
- #294 (P2) **HRMS data sync** — Keeps employee, department, manager and employment status up to date.

### Subscription & Billing

- #306 (P1) **Plan management** — Starter, Growth and Enterprise subscription plans.
- #307 (P1) **Configurable pricing** — Prices are editable in admin, never hard-coded.
- #308 (P2) **Billing basis** — Price calculated from active employees, modules, integrations and support level.
- #309 (P1) **Subscription assignment** — Assign a plan and dates to each company.
- #310 (P1) **Module entitlements** — Switch modules on or off per company based on its plan.
- #311 (P2) **Active employee metering** — Counts billable active employees each billing period.
- #312 (P2) **Invoice generation & history** — Create and store company invoices.
- #313 (P2) **Online payment collection** — Pay subscriptions online by card or bank transfer.
- #314 (P2) **Platform revenue view** — Revenue by company and plan.

### Platform Admin (HealthX Team)

- #315 (P1) **Platform dashboard** — Overview of companies, users and usage for the HealthX team.
- #316 (P1) **Company management** — List, view, create and edit customer companies.
- #317 (P1) **Company onboarding** — Create a company and invite its Company Owner.
- #318 (P1) **Suspend / reactivate company** — Temporarily block or restore a company's access.
- #319 (P1) **Platform user management** — Find any user and manage their account status.
- #320 (P1) **Platform analytics** — Companies, active users and usage across the platform.
- #321 (P2) **Feature usage analytics** — Which features are used most.
- #322 (P2) **API usage monitoring** — API volumes, errors and response speed.
- #323 (P2) **System health view** — Status of services and integrations.
- #324 (P2) **Support management** — Handle support requests from companies and employees.
- #325 (P1) **System configuration** — Global settings, defaults and feature switches.
- #326 (P1) **HealthX admin users** — Manage HealthX staff accounts for the admin portal.
- #327 (P1) **Platform audit log viewer** — Search all audit logs across the platform.

### Success Metrics (KPIs)

- #328 (P1) **Acquisition KPIs** — Companies onboarded and employees invited.
- #329 (P2) **Activation KPIs** — Registration %, profile completion %, first activity % and first challenge %.
- #330 (P2) **Engagement KPIs** — DAU, WAU, MAU, activities per user and challenge participation.
- #331 (P2) **Retention KPIs** — 7-day, 30-day and 90-day retention.
- #332 (P2) **Wellness KPIs** — Average activity and workout, habit and challenge completion.
- #333 (P2) **Revenue KPIs** — MRR, ARR, ARPU, revenue per employee, expansion revenue and churn.
- #334 (P1) **Monthly Active Wellness Participants** — Main success metric: people doing at least one wellness activity a month.
- #335 (P1) **Wellness Engagement Rate** — Active wellness employees ÷ eligible employees × 100.

### Activity & Steps Tracking

- #346 (P1) **“Sync Now” Button and Sync Status Tracking** — Employees should have a “Sync Now” button to manually refresh their activity data when steps are missing or delayed. HR should also have access to a sync-status dashboard showing employees who have not connected their trackers or whose devices have not synced for seven days or more. This information is limited to device connectivity and sync activity, without exposing personal health data, helping maintain employee privacy.

### Platform Admin Portal

- #347 (P1) **Employee Help Centre, FAQs, and Support Tickets** — The app should include an in-built Help Centre with FAQs and troubleshooting guides for common issues, such as missing steps and tracker connection problems. Employees should also be able to raise support tickets directly through the app. This will reduce the support burden on HR and the HealthX team while helping employees resolve issues more efficiently.

### Leaderboards

- #348 (P2) **Rank-Change Alerts** — Notify employees when their leaderboard position changes, including when they move up or lose a top-three position.

### Gamification Engine (Points, Streaks & Badges)

- #349 (P2) **Suspicious-Data Review Queue** — Allow HR to review unusual activity records and accept, adjust, or reject them before awarding points.

### Wellness Challenges

- #350 (P2) **Mini-Challenges** — Create short, optional competitions within a main challenge, with bonus points and limited winner slots.

### Leaderboards

- #351 (P2) **Public / TV Leaderboard** — Provide a shareable leaderboard link for office screens or Slack, with privacy controls.

### Gamification Engine (Points, Streaks & Badges)

- #352 (P2) **Bulk Award Points** — Allow HR to award bonus points to multiple employees or teams at once, with a reason and date.

### Subscription & Billing

- #353 (P2) **Self-Serve Sign-Up & Free Trial** — Let companies register independently, try the platform for 21 days, and purchase a subscription online.

### Business Portal — Organisation & People

- #354 (P2) **Admin Getting-Started Checklist** — Guide admins through initial setup, including creating challenges, adding teams and employees, and sending invitations.

### Wellness Challenges

- #355 (P2) **Completion Certificates** — Automatically generate certificates for employees who complete a challenge, with bulk email or CSV export options.

### Onboarding & Authentication

- #356 (P1) **QR Code / Short-Code Joining** — Allow employees to join a company challenge using a QR code, short code, or shareable link.

### Wellness Challenges

- #357 (P1) **Challenge Fairness Lock** — Lock scoring rules, start dates, and daily goals once a challenge begins to prevent unfair changes.
- #358 (P2) **Challenge Warm-Up Period** — Allow employees to join and connect their health trackers before activity scoring starts.
- #359 (P1) **Winner Prizes & Rankings** — Configure rewards for first, second, and third place in individual and team competitions.

### Integrations

- #360 (P1) **Employee Sync-Status Tracking** — Show HR whether employees have connected their health apps, when they last synced, and whether they have given consent.

### Privacy & Consent Management

- #361 (P2) **Personal-Data Access Log** — Track who accessed, modified, or deleted personal data for improved security and compliance.

### Home Dashboard & Wellness Score

- #362 (P2) **Personalized Daily Goals** — Set daily activity goals based on each employee's recent activity and award bonus points for achieving them.

### Integrations

- #363 (P1) **Tracker & Sync Issue Management** — Allow HR to identify employees who have not connected their trackers, have not synced for 3 or 7+ days, or need to reconnect. Include follow-up messaging and contact status.

### Wellness Challenges

- #364 (P1) **Excused Dates Management** — Allow HR to mark company holidays, office shutdowns, or individual sick days as excused so employees are not unfairly penalized.

### Activity & Steps Tracking

- #365 (P1) **Manual Activity Approval & Correction** — Require HR approval for manually entered activities before awarding points. Allow authorized admins to correct missing or incorrect activity records when necessary.

### Platform Admin Portal

- #366 (P1) **Employee Support Tools** — Provide employee search by name, email, or ID, tracker troubleshooting, shareable help articles, and account login unlocking.

### Wellness Challenges

- #367 (P2) **Challenge Setup Checklist** — Guide HR through challenge setup and highlight missing configuration steps before launch.

### Integrations

- #368 (P2) **Bulk Sync & Historical Data Recovery** — Allow admins to resync activity data for an entire group, including eligible historical challenge data.

### Wellness Challenges

- #369 (P2) **Custom Scoring Rules** — Support flexible scoring methods, such as counting the best 5 out of 7 days or using score bands.

### Announcements & Notifications

- #371 (P2) **Targeted Employee Messaging** — Allow HR to send announcements to selected employees rather than only entire companies, departments, or teams.

### Workout Module

- #372 (P2) **Company-Created Workouts** — Allow company admins to create and manage their own workouts instead of relying exclusively on HealthX Admin.

### Business Portal — Organisation & People

- #373 (P2) **Admin Video Tutorials** — Provide video guides to help HR understand platform features and complete common tasks.

### Wellness Challenges

- #374 (P2) **Walking Journey Management** — Allow admins to configure virtual routes, milestones, and rewards for walking challenges.
