# Employee App (mobile + employee web app) — screen spec

Source: HEALTHX_BUSINESS_REQUIREMENT_AND_DEVELOPMENT_PLAN.xlsx, sheet 07. Phase is in Notes.


## MOD-02 Onboarding & Authentication

### SCR-M-001 — Splash
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Shows the brand while the app starts, checks the app version and the saved sign-in, then sends the user to onboarding or Home.
- **Entry Point:** App launch
- **Components:** Brand logo (company logo after sign-in if branding is set); progress indicator
- **Actions:** Check minimum supported app version; silently renew saved session; route to Company Identification (new user), Home (signed in) or App Update Required
- **API Required:** GET /api/v1/app/config; POST /api/v1/auth/refresh
- **Validation:** Saved session must be valid and not revoked; installed version ≥ minimum version
- **Error State:** Offline: 'You're offline. Check your connection and try again.' with Retry (signed-in users may continue to cached Home)
- **Success State:** Moves automatically to the next screen
- **Notes:** Phase: MVP. Features: FEAT-018, FEAT-032, FEAT-040.

### SCR-M-002 — App Update Required
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Blocks use of an outdated app version and guides the user to update from the store.
- **Entry Point:** Splash, when installed version is below the minimum supported version
- **Components:** Illustration; message; store link
- **Buttons:** Update now; (optional update only) Later
- **Actions:** Open App Store / Google Play listing
- **API Required:** GET /api/v1/app/config
- **Validation:** Version comparison per platform
- **Error State:** Store cannot be opened: 'Please update HealthX from the App Store / Google Play.'
- **Success State:** After update the app restarts at Splash
- **Notes:** Phase: MVP. Features: FEAT-040. Minimum versions are set by Platform Admin in System Configuration (SCR-P-023).

### SCR-M-003 — Company Identification
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** The employee identifies their company so the app loads the correct company workspace.
- **Entry Point:** Splash (first launch or after sign-out)
- **Components:** Header; company code input; 'Where do I find my code?' help; 'I have an invitation' link
- **Fields:** Company code (or work email – method TBC)
- **Buttons:** Continue; I have an invitation; Need help?
- **Actions:** Look up company; show company name and logo for confirmation; continue to Sign-in Options
- **API Required:** POST /api/v1/auth/company-lookup
- **Validation:** Code required; 4–20 letters/numbers; company must be Active (not Suspended/Terminated)
- **Error State:** 'We couldn't find a company with this code. Check with your HR team.'; suspended company: 'Your company's access is currently paused.'
- **Success State:** Company name and logo shown with 'Continue'
- **Notes:** Phase: MVP. Features: FEAT-019, FEAT-001. Identification method (company code, invitation link or work-email domain) is not defined in the PDF – TBC – see Client Questions. Lookup is rate-limited.

### SCR-M-004 — Sign-in Options (Login / Invitation)
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Lets the employee choose how to register or sign in, using the methods allowed for their company.
- **Entry Point:** Company Identification
- **Components:** Company logo/name; list of sign-in method buttons; Terms & Privacy links
- **Buttons:** Continue with email; Continue with phone; Email me a sign-in link; Continue with Google; Continue with Microsoft; I have an invitation
- **Actions:** Open the selected sign-in flow; only methods enabled for the company are shown
- **API Required:** GET /api/v1/auth/methods?org={code}
- **Validation:** At least one method must be enabled for the company
- **Error State:** 'Sign-in options could not be loaded. Try again.'
- **Notes:** Phase: MVP. Features: FEAT-020, FEAT-021, FEAT-022, FEAT-023, FEAT-024, FEAT-025. Email password vs one-time code is TBC; phone/SMS is proposed MVP (SMS cost – TBC); enterprise SAML/OIDC is Phase 3 (SCR-M-083).

### SCR-M-005 — Invitation Acceptance
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Opens a company invitation and pre-links the employee to their company, department and team.
- **Entry Point:** Invitation link in email/SMS (deep link) or 'I have an invitation'
- **Components:** Company logo; 'You've been invited to join <Company> on HealthX'; pre-filled email, department and team (read-only)
- **Fields:** Invitation code (only if opened without a link)
- **Buttons:** Accept & continue; Not you? Use another account
- **Actions:** Validate invitation; continue to account creation / sign-in with invited email
- **API Required:** GET /api/v1/invitations/{token}; POST /api/v1/invitations/{token}/accept
- **Validation:** Invitation must be Pending and not expired (expiry 14 days – ASSUMPTION)
- **Error State:** 'This invitation has expired or was cancelled. Ask your HR team to send a new one.'
- **Success State:** 'Invitation accepted' then moves to account set-up
- **Notes:** Phase: MVP. Features: FEAT-020, FEAT-202.

### SCR-M-006 — Email Sign-in / Registration
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Lets the employee register or sign in with their email address.
- **Entry Point:** Sign-in Options; Invitation Acceptance
- **Components:** Email field; password field (or one-time code – TBC); show/hide password; mode switch Sign in / Create account
- **Fields:** Email; Password; Confirm password (registration only)
- **Buttons:** Continue / Sign in; Create account; Forgot password?; Use another method
- **Actions:** Authenticate or create account; send verification code if one-time code is chosen
- **API Required:** POST /api/v1/auth/login; POST /api/v1/auth/register; POST /api/v1/auth/email-otp
- **Validation:** Valid email format; password policy (min 8 chars with letters and numbers – ASSUMPTION); email must belong to an invited/allowed employee of the company
- **Error State:** 'Email or password is incorrect.' (generic); after 5 failed attempts: 'Too many attempts. Try again in 15 minutes.'
- **Success State:** Signed in; continues to Terms acceptance (first time) or Home
- **Notes:** Phase: MVP. Features: FEAT-021, FEAT-032. Password vs one-time code for email sign-in is not stated in the PDF – TBC – see Client Questions.

### SCR-M-007 — Phone Sign-in
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Lets the employee register or sign in with a mobile number and an SMS one-time code.
- **Entry Point:** Sign-in Options
- **Components:** Country code picker; mobile number field; SMS consent note
- **Fields:** Country code; Mobile number
- **Buttons:** Send code; Use another method
- **Actions:** Request SMS one-time code; move to OTP Verification
- **API Required:** POST /api/v1/auth/phone-otp
- **Validation:** Valid number for the selected country (E.164); resend limited to 3 per 15 minutes (ASSUMPTION)
- **Error State:** 'Enter a valid mobile number.'; 'Too many code requests. Try again later.'
- **Success State:** 'Code sent to +91 ••••• 43210'
- **Notes:** Phase: MVP. Features: FEAT-022. Phase for phone sign-in is not stated in the PDF (proposed MVP); SMS provider cost – TBC – see Client Questions.

### SCR-M-008 — One-Time Code (OTP) Verification
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Confirms the user's phone or email by entering the one-time code sent to them.
- **Entry Point:** Phone Sign-in; Email Sign-in (if one-time code chosen); changing email/phone in Profile
- **Components:** 6-box code input with auto-fill from SMS; countdown timer; masked destination
- **Fields:** One-time code (6 digits)
- **Buttons:** Verify; Resend code (after 30 s); Change number / email
- **Actions:** Verify code; sign in or confirm contact change
- **API Required:** POST /api/v1/auth/otp/verify; POST /api/v1/auth/otp/resend
- **Validation:** 6 digits; expires in 10 minutes; max 5 wrong attempts (ASSUMPTION)
- **Error State:** 'That code isn't right. 4 attempts left.'; 'This code has expired. Request a new one.'
- **Success State:** Verified; continues to next onboarding step or Home
- **Notes:** Phase: MVP. Features: FEAT-022, FEAT-021, FEAT-041.

### SCR-M-009 — Magic Link Sent
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Tells the employee a one-time sign-in link was emailed and lets them open their email app.
- **Entry Point:** Sign-in Options ('Email me a sign-in link')
- **Components:** Illustration; masked email; instructions; resend timer
- **Fields:** Email (entered on previous step)
- **Buttons:** Open email app; Resend link (after 60 s); Use another method
- **Actions:** Send link; when the link is tapped on this device, sign the user in
- **API Required:** POST /api/v1/auth/magic-link; POST /api/v1/auth/magic-link/verify
- **Validation:** Link valid once, on the requesting device, for 15 minutes (ASSUMPTION)
- **Error State:** 'This sign-in link has expired or was already used. Request a new one.'
- **Success State:** 'You're signed in' then continues to onboarding or Home
- **Notes:** Phase: MVP. Features: FEAT-023, FEAT-202. Phase not stated in the PDF (proposed MVP).

### SCR-M-010 — Google / Microsoft Sign-in
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Signs the employee in with their Google or Microsoft account and links it to their company account.
- **Entry Point:** Sign-in Options
- **Components:** System secure browser sheet (Google / Microsoft); 'Account not linked' result screen
- **Buttons:** Continue; Try another method; Contact HR
- **Actions:** OAuth sign-in; match the account email to an invited/registered employee of the company
- **API Required:** POST /api/v1/auth/oauth/google; POST /api/v1/auth/oauth/microsoft
- **Validation:** Account email must match an invited or registered employee of the identified company
- **Error State:** 'This Google/Microsoft account isn't linked to <Company> on HealthX. Use your work email or ask HR for an invitation.'; user cancelled: returns to Sign-in Options
- **Success State:** Signed in; continues to onboarding or Home
- **Notes:** Phase: MVP. Features: FEAT-024, FEAT-025.

### SCR-M-011 — Forgot / Reset Password
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Lets a user who forgot their password request a reset link and set a new password.
- **Entry Point:** Email Sign-in ('Forgot password?'); reset link in email (deep link)
- **Components:** Step 1: email field; Step 2 (from link): new password + confirm with strength meter
- **Fields:** Email; New password; Confirm new password
- **Buttons:** Send reset link; Save new password; Back to sign in
- **Actions:** Email a reset link; set new password; sign out all other sessions
- **API Required:** POST /api/v1/auth/password/forgot; POST /api/v1/auth/password/reset
- **Validation:** Password policy (min 8 chars, letters and numbers – ASSUMPTION); passwords must match; link valid 30 minutes (ASSUMPTION)
- **Error State:** 'This reset link has expired. Request a new one.'; mismatch: 'Passwords don't match.'
- **Success State:** Always shows 'If an account exists, we've sent a reset link' (no account disclosure); after reset: 'Password updated. Please sign in.'
- **Notes:** Phase: MVP. Features: FEAT-034, FEAT-202. Only needed if password sign-in is confirmed – TBC.

### SCR-M-012 — Terms & Privacy Acceptance
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Asks the user to accept the current Terms of Use and Privacy Policy before using HealthX, and again when they change.
- **Entry Point:** First sign-in; any sign-in after a new policy version is published
- **Components:** Summary text; links to full Terms and Privacy Policy; two consent checkboxes
- **Fields:** Accept Terms of Use; Accept Privacy Policy
- **Buttons:** Accept & continue; Read full documents; Sign out
- **Actions:** Record acceptance with document versions, date/time and device
- **API Required:** GET /api/v1/legal/current; POST /api/v1/me/legal-acceptances
- **Validation:** Both boxes must be ticked to continue
- **Error State:** 'We couldn't record your acceptance. Please try again.'
- **Success State:** Continues to Profile Setup (first time) or Home
- **Notes:** Phase: MVP. Features: FEAT-035, FEAT-277. Legal texts to be provided by the client.


## MOD-03 Employee Profile & Preferences

### SCR-M-013 — Profile Setup
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Onboarding step 1: the employee completes basic profile details.
- **Entry Point:** Terms acceptance (first sign-in)
- **Components:** Step indicator (1 of 4); profile photo picker with crop; form fields; pre-filled values from invitation
- **Fields:** Profile photo; First name; Last name; Email (pre-filled); Phone; Gender; Date of birth; Location; Timezone (auto-detected)
- **Buttons:** Continue; Skip optional fields
- **Actions:** Save profile; upload photo; progress saved if the app is closed
- **API Required:** PATCH /api/v1/me/profile; POST /api/v1/me/profile/photo
- **Validation:** Mandatory: first name, last name, email (pre-filled) and timezone; other fields optional – TBC; see Form FRM-07
- **Error State:** Field-level messages (e.g., 'Enter your first name'); upload: 'Photo must be JPG or PNG under 5 MB.'
- **Success State:** Moves to Health & Wellness Goals
- **Notes:** Phase: MVP. Features: FEAT-028, FEAT-041, FEAT-042, FEAT-049, FEAT-015. Which fields are mandatory is TBC. Gender, date of birth and location are personal data (PII) – encrypted and never shown to HR beyond what is needed.

### SCR-M-014 — Health & Wellness Goals
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Onboarding step 2: the employee selects wellness goals and enters wellness details used to personalise the app.
- **Entry Point:** Profile Setup
- **Components:** Step indicator (2 of 4); goal chips; height/weight inputs with units; activity and fitness level selectors; preferred activities chips; privacy note 'Only you can see these details'
- **Fields:** Goals; Height; Weight; Activity level; Fitness level; Preferred activities
- **Buttons:** Continue; Back
- **Actions:** Save wellness profile and preferences
- **API Required:** PATCH /api/v1/me/wellness-profile; PATCH /api/v1/me/preferences
- **Validation:** At least one goal; height 100–250 cm and weight 30–300 kg (ASSUMPTION); see Form FRM-08
- **Error State:** Field-level messages, e.g., 'Enter a height between 100 and 250 cm.'
- **Success State:** Moves to Permissions
- **Notes:** Phase: MVP. Features: FEAT-029, FEAT-043, FEAT-044. Goal list and level values are not defined in the PDF – TBC. Wellness data is sensitive: encrypted, private to the employee and never shown to HR individually.


## MOD-02 Onboarding & Authentication

### SCR-M-015 — Permissions
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Onboarding step 3: explains and requests notification and motion/activity permissions; each can be skipped.
- **Entry Point:** Health & Wellness Goals
- **Components:** Step indicator (3 of 4); explanation cards for Notifications and Motion & Fitness / Physical activity; then the system prompt
- **Buttons:** Allow; Not now
- **Actions:** Show explanation, then the operating-system permission prompt; register device for push if allowed
- **API Required:** POST /api/v1/me/devices (push token)
- **Error State:** Permission denied: app continues; Settings link shown later where needed
- **Success State:** Moves to Health Integration
- **Notes:** Phase: MVP. Features: FEAT-030, FEAT-199.


## MOD-22 Integrations

### SCR-M-016 — Health Integration
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Onboarding step 4: connect Apple Health (iOS) or Health Connect (Android) so steps and activity sync automatically.
- **Entry Point:** Permissions; Connected Apps & Devices
- **Components:** Platform card (Apple Health or Health Connect); list of data types read (steps, distance, active energy, active minutes, workouts; sleep from Phase 2); privacy note
- **Fields:** Data types to share
- **Buttons:** Connect; Skip for now
- **Actions:** Open the platform permission sheet; record consent; start first sync (last 7 days – ASSUMPTION)
- **API Required:** POST /api/v1/me/health-connections; POST /api/v1/me/consents; POST /api/v1/me/activity/sync
- **Validation:** Health Connect app must be installed on Android (otherwise link to Play Store)
- **Error State:** 'We couldn't connect to Health Connect. You can try again from Profile > Connected apps.'
- **Success State:** 'Connected' tick; continues to Wellness Baseline
- **Notes:** Phase: MVP. Features: FEAT-031, FEAT-281, FEAT-282, FEAT-271, FEAT-272. PDF conflict: §38 lists Apple Health/Health Connect in Phase 1, §58 in Phase 2 – proposed MVP (TBC). Skipping shows a reminder card on Home.


## MOD-04 Home Dashboard & Wellness Score

### SCR-M-017 — Wellness Baseline (Onboarding Complete)
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Confirms onboarding is complete and shows the employee's starting point once enough data exists.
- **Entry Point:** Health Integration
- **Components:** Celebration header; baseline card (first Wellness Score, typical daily steps); next-step suggestions (join a challenge, set water goal)
- **Buttons:** Go to Home; Browse challenges
- **Actions:** Calculate and store the baseline after first sync
- **API Required:** GET /api/v1/me/baseline
- **Empty State:** 'We'll show your baseline after a few days of activity.' (when no synced history)
- **Error State:** Baseline unavailable: screen still allows 'Go to Home'
- **Success State:** 'You're all set, John!'
- **Notes:** Phase: MVP. Features: FEAT-061, FEAT-057. Definition of 'wellness baseline' is not given in the PDF – TBC – see Client Questions.

### SCR-M-018 — Home Dashboard
- **User Role:** Employee, Team Manager
- **Purpose:** The employee's daily overview: greeting, Wellness Score, today's progress, today's challenge, weekly progress and current rank.
- **Entry Point:** After onboarding; app open; bottom navigation 'Home'
- **Components:** Greeting 'Good Morning, John'; Wellness Score ring 82; Today's Progress tiles: Steps 7,820 / 10,000, Water 1.8 / 2.5 L, Workout Completed, Sleep 7h 20m (Phase 2); Today's Challenge card 'Walk 8,000 steps · +120 Points'; Weekly Progress bar; Current Rank '#8 in Engineering'; weekly summary card; connect-health reminder card; notification bell with unread count; bottom navigation
- **Buttons:** Tiles (open module); Today's Challenge card; Rank widget; Bell; Pull to refresh
- **Actions:** Load dashboard; refresh after each log/sync; deep-link to modules; hide cards for modules not enabled for the company
- **API Required:** GET /api/v1/me/dashboard; GET /api/v1/me/notifications/unread-count
- **Empty State:** No active challenge: 'No challenge today – browse challenges'; no data yet: tiles show 0 with 'Connect Apple Health / Health Connect to track steps automatically'
- **Error State:** 'Couldn't refresh. Showing data from 10:42.' with Retry
- **Success State:** Values update in place; '+10 points' toast after earning
- **Notes:** Phase: MVP. Features: FEAT-051, FEAT-052, FEAT-053, FEAT-054, FEAT-055, FEAT-057, FEAT-062, FEAT-170, FEAT-249, FEAT-310. Sleep tile appears from Phase 2. 'Weekly progress' calculation and which leaderboard the home rank uses are TBC. Bottom navigation proposed: Home, Activity, Challenges, Rewards, Profile (ASSUMPTION). Configurable layout is Phase 2 (SCR-M-021).

### SCR-M-019 — Wellness Score Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Explains the HealthX Wellness Score and how each part contributes, with a clear non-medical disclaimer.
- **Entry Point:** Home (score ring)
- **Components:** Score 82/100 ring; component bars: Activity 25%, Sleep 20%, Hydration 15%, Exercise 20%, Habits 10%, Mindfulness 10%; 7-day / 30-day trend chart; tips per component; disclaimer 'This is a wellness engagement score, not a medical assessment.'
- **Fields:** Period (7 days / 30 days)
- **Buttons:** Period toggle; Component row (opens module); Info (how it's calculated)
- **Actions:** Show score history and breakdown
- **API Required:** GET /api/v1/me/wellness-score?period=7d
- **Empty State:** 'Your score appears after your first full day of activity.'
- **Error State:** 'Score unavailable right now.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-057, FEAT-058, FEAT-060. Shown on the Home example but not in the §57 MVP list – proposed MVP using activity, exercise, hydration and habits; sleep and mindfulness added in Phase 2 (TBC). Handling of missing components is TBC.


## MOD-18 AI Wellness Coach & Insights

### SCR-M-020 — Weekly Wellness Summary & Insight
- **User Role:** Employee, Team Manager
- **Purpose:** Weekly recap of what the employee completed; from Phase 2 adds an AI opportunity and recommendation.
- **Entry Point:** Home weekly card; weekly push notification
- **Components:** 'Weekly HealthX Insight' card: You completed ✓ 4 workouts ✓ 52,300 steps ✓ 6/7 hydration goals; Phase 2: Opportunity 'Your activity dropped 18% on weekends.'; Recommendation 'Try a 30-minute Saturday walk.'; previous weeks list
- **Fields:** Week selector
- **Buttons:** Previous / next week; Recommendation action (e.g., open workout); Feedback (helpful / not helpful – Phase 2)
- **Actions:** Show stored weekly summary
- **API Required:** GET /api/v1/me/weekly-summary?week=; GET /api/v1/me/insights/weekly (Phase 2)
- **Empty State:** 'Your first weekly summary will be ready next Monday.'
- **Error State:** 'Summary unavailable.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-062, FEAT-227. MVP: rule-based counts (no AI). AI opportunity/recommendation is Phase 2 and needs AI-personalisation consent (FEAT-275).


## MOD-04 Home Dashboard & Wellness Score

### SCR-M-021 — Customise Home
- **User Role:** Employee, Team Manager
- **Purpose:** Lets the home screen layout be configured (which cards show and in what order).
- **Entry Point:** Home > Edit (Phase 2)
- **Components:** Draggable list of home cards with show/hide toggles; preview
- **Fields:** Card visibility; Card order
- **Buttons:** Save; Reset to default
- **Actions:** Save layout; apply on next Home load
- **API Required:** GET/PUT /api/v1/me/home-layout
- **Validation:** Mandatory cards (e.g., Today's Progress) cannot be hidden (ASSUMPTION)
- **Error State:** 'Couldn't save your layout.'
- **Success State:** 'Home layout updated.'
- **Notes:** Phase: Phase 2. Features: FEAT-056. PDF says the home screen should be 'highly configurable' but not by whom (employee or company admin) – TBC – see Client Questions. MVP uses a fixed layout.


## MOD-05 Activity & Steps Tracking

### SCR-M-022 — Activity & Steps
- **User Role:** Employee, Team Manager
- **Purpose:** Shows today's steps against the goal plus distance, calories and active minutes, with weekly/monthly charts.
- **Entry Point:** Home Steps tile; bottom navigation 'Activity'
- **Components:** Steps ring 7,820 / 10,000; Distance 5.6 km; Active calories 320 kcal; Active minutes 42 min; week/month bar chart with goal line; source and 'Last synced 10:42'; links to Water, Workouts, Habits
- **Fields:** Date selector; Period (Week / Month)
- **Buttons:** Log activity; Sync now; Activity history; Period toggle
- **Actions:** Show daily totals; trigger health-platform sync
- **API Required:** GET /api/v1/me/activity/summary?date=; GET /api/v1/me/activity/daily?from=&to=; POST /api/v1/me/activity/sync
- **Empty State:** 'No activity yet today. Connect Apple Health / Health Connect or log an activity.'
- **Error State:** Sync error: 'We couldn't sync your steps. Last synced 08:15.' with Retry
- **Success State:** 'Synced just now'
- **Notes:** Phase: MVP. Features: FEAT-064, FEAT-065, FEAT-066, FEAT-067, FEAT-073, FEAT-072, FEAT-017. Distance, calories and active minutes phase not stated in the PDF (proposed MVP). Charts are RECOMMENDED (FEAT-073). Daily totals use the employee's timezone (ASSUMPTION).

### SCR-M-023 — Activity History
- **User Role:** Employee, Team Manager
- **Purpose:** Lists past activity by day and week, showing synced and manual entries.
- **Entry Point:** Activity & Steps > History
- **Components:** Day groups with daily totals; activity rows (type icon, time, duration, distance, 'Synced'/'Manual' label); type filter; infinite scroll
- **Fields:** Activity type filter; Date range
- **Buttons:** Filter; Row tap (detail sheet); Edit / Delete (manual entries only)
- **Actions:** Paginated history; edit/delete manual entries (totals, streaks and points recalculate)
- **API Required:** GET /api/v1/me/activity?from=&to=&type=&page=; PATCH/DELETE /api/v1/me/activity/{id}
- **Validation:** Synced entries are read-only
- **Empty State:** 'No activities in this period.'
- **Error State:** 'Couldn't load your history.' with Retry
- **Success State:** 'Activity deleted.' with Undo (5 s)
- **Notes:** Phase: MVP. Features: FEAT-071, FEAT-068, FEAT-070.

### SCR-M-024 — Log Activity (Manual Entry)
- **User Role:** Employee, Team Manager
- **Purpose:** Lets the employee add an activity that was not captured by a device (e.g., swim, yoga, meditation).
- **Entry Point:** Activity & Steps 'Log activity'; Home quick action
- **Components:** Activity type grid (Walking, Running, Cycling, Swimming, Yoga, Meditation, Workout); form; 'Manual' label notice
- **Fields:** Activity type; Date; Start time; Duration; Distance (optional); Notes (optional)
- **Buttons:** Save; Cancel
- **Actions:** Create manual activity; update totals, challenges and points per agreed rules
- **API Required:** POST /api/v1/me/activity
- **Validation:** Date not in the future and within the last 7 days (ASSUMPTION); duration 1–600 min; distance 0.1–300 km; overlapping entries flagged (FRM-13)
- **Error State:** Field-level messages; 'This overlaps another activity at 07:00.'
- **Success State:** 'Activity saved' (+ points toast if eligible)
- **Notes:** Phase: MVP. Features: FEAT-070, FEAT-068, FEAT-069, FEAT-169. Whether manual entries earn points or count in challenges is TBC – see Client Questions.


## MOD-06 Water / Hydration Tracking

### SCR-M-025 — Water Tracker
- **User Role:** Employee, Team Manager
- **Purpose:** Log water in one tap and see today's goal, consumption, streak and weekly chart.
- **Entry Point:** Home Water tile; Activity hub; hydration reminder notification
- **Components:** Progress ring: Goal 2.4 L, Consumed 1.8 L, 75%; quick-add buttons 250 ml / 500 ml / 750 ml / 1 L; custom amount; streak counter ('5-day streak'); weekly bar chart with goal line; today's entries list (swipe to edit/delete)
- **Fields:** Custom amount (ml)
- **Buttons:** 250 ml; 500 ml; 750 ml; 1 L; Custom; Settings (goal & reminders); Edit / Delete entry
- **Actions:** Add water entry; update total, streak and 'water goal' points; fire water_logged event
- **API Required:** GET /api/v1/me/water?date=; POST /api/v1/me/water; PATCH/DELETE /api/v1/me/water/{id}; GET /api/v1/me/water/weekly
- **Validation:** Custom amount 50–2,000 ml (ASSUMPTION); daily total capped at 10 L for points (ASSUMPTION)
- **Empty State:** 'No water logged today. Tap a glass to start.'
- **Error State:** 'Couldn't save. We'll retry when you're back online.' (queued offline)
- **Success State:** Ring animates; at goal: 'Goal reached! +20 points'
- **Notes:** Phase: MVP. Features: FEAT-074, FEAT-076, FEAT-078, FEAT-079, FEAT-080, FEAT-081. Edit/delete and custom amount are RECOMMENDED (FEAT-080, FEAT-081).

### SCR-M-026 — Water Goal & Reminders
- **User Role:** Employee, Team Manager
- **Purpose:** Set the daily water goal and smart hydration reminders.
- **Entry Point:** Water Tracker > Settings
- **Components:** Goal stepper (litres); reminder toggle; time window pickers; interval selector; explanation of 'smart' reminders (stop once goal is met)
- **Fields:** Daily water goal; Smart reminders on/off; Reminder start time; Reminder end time; Reminder interval
- **Buttons:** Save; Cancel
- **Actions:** Save goal (progress recalculates); schedule reminders
- **API Required:** PUT /api/v1/me/water/goal; PUT /api/v1/me/notification-preferences
- **Validation:** Goal 1.0–5.0 L in 0.1 L steps (ASSUMPTION); end time after start time (FRM-15)
- **Error State:** 'Choose a goal between 1 and 5 litres.'
- **Success State:** 'Water goal updated to 2.5 L.'
- **Notes:** Phase: MVP. Features: FEAT-075, FEAT-077, FEAT-046. Default goal is TBC (PDF examples show 2.4 L and 2.5 L). 'Smart' reminders proposed as rule-based (no AI).


## MOD-07 Sleep Tracking

### SCR-M-027 — Sleep Dashboard
- **User Role:** Employee, Team Manager
- **Purpose:** Shows sleep score, duration and consistency with a weekly view.
- **Entry Point:** Home Sleep tile (Phase 2); Activity hub
- **Components:** Sleep Score 86; Duration 7h 32m; Consistency 'Good'; 7-day chart of duration with bedtime/wake markers; sleep goal; data source label; non-medical disclaimer
- **Fields:** Week selector; Sleep goal (hours)
- **Buttons:** Log sleep; Edit goal; Entry tap (edit/delete manual)
- **Actions:** Show latest calculated sleep values
- **API Required:** GET /api/v1/me/sleep/summary?week=; GET /api/v1/me/sleep?from=&to=; PUT /api/v1/me/sleep/goal
- **Empty State:** 'No sleep recorded yet. Log last night's sleep or connect a health app.'
- **Error State:** 'Couldn't load sleep data.' with Retry
- **Notes:** Phase: Phase 2. Features: FEAT-086, FEAT-083, FEAT-084, FEAT-085, FEAT-087, FEAT-088. Sleep score and consistency formulas are TBC. Sleep goal is RECOMMENDED (FEAT-088). Sleep data is sensitive – encrypted and private.

### SCR-M-028 — Log Sleep
- **User Role:** Employee, Team Manager
- **Purpose:** Record bedtime and wake-up time for a night.
- **Entry Point:** Sleep Dashboard 'Log sleep'; morning reminder
- **Components:** Night-of date picker; bedtime and wake-up time wheels; calculated duration preview
- **Fields:** Night of; Bedtime; Wake-up time; Duration (calculated)
- **Buttons:** Save; Cancel
- **Actions:** Create/update sleep record; fire sleep_logged event
- **API Required:** POST /api/v1/me/sleep; PATCH/DELETE /api/v1/me/sleep/{id}
- **Validation:** Wake-up after bedtime (across midnight); duration 1–16 h (ASSUMPTION); no overlap with an existing record (FRM-16)
- **Error State:** 'Wake-up time must be after bedtime.'; 'You already have sleep recorded for this night.'
- **Success State:** 'Sleep saved: 7h 32m'
- **Notes:** Phase: Phase 2. Features: FEAT-082, FEAT-083.


## MOD-08 Workout Module

### SCR-M-029 — Workout Library
- **User Role:** Employee, Team Manager
- **Purpose:** Browse workouts by category and open one to start.
- **Entry Point:** Activity hub 'Workouts'; Home Workout tile
- **Components:** Search bar; category chips (e.g., Cardio, Strength, Yoga, Stretching – list TBC); workout cards (image, title, duration, level, equipment icon, '+50 pts'); filter button with active-filter count; 'History' link
- **Fields:** Search text; Category
- **Buttons:** Search; Category chip; Filters; Workout card; History
- **Actions:** List published workouts; search as the user types; apply filters
- **API Required:** GET /api/v1/workouts?category=&level=&location=&equipment=&duration=&muscle=&q=&page=; GET /api/v1/workouts/categories
- **Validation:** Search min 2 characters
- **Empty State:** No results: 'No workouts match your filters.' with 'Clear filters'
- **Error State:** 'Couldn't load workouts.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-089, FEAT-090, FEAT-102. Workout content (videos/images/instructions) must be supplied or licensed – TBC. Search is RECOMMENDED (FEAT-102).

### SCR-M-030 — Workout Filters
- **User Role:** Employee, Team Manager
- **Purpose:** Filter workouts by level, location, equipment, duration and muscle group.
- **Entry Point:** Workout Library 'Filters'
- **Components:** Bottom sheet with chip groups and result count preview
- **Fields:** Level; Location; Equipment; Duration; Muscle groups
- **Buttons:** Apply (n results); Reset
- **Actions:** Apply filters to the library
- **API Required:** GET /api/v1/workouts/filters (filter values); GET /api/v1/workouts?...
- **Validation:** Multiple values allowed per group (FRM-70)
- **Empty State:** '0 workouts' with Apply disabled
- **Error State:** Filter values fail to load: 'Filters unavailable.'
- **Success State:** Library updates with the active filters
- **Notes:** Phase: MVP. Features: FEAT-091, FEAT-092, FEAT-093, FEAT-094, FEAT-095. Equipment and muscle-group value lists are TBC.

### SCR-M-031 — Workout Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the workout overview before starting: exercises, duration, level, equipment, muscle groups and points.
- **Entry Point:** Workout Library card; Home 'Today's Workout' (Phase 2 feed); AI Coach suggestion (Phase 2)
- **Components:** Hero image/video preview; title; duration 20 min; level; Home/Gym; equipment; muscle groups; '+50 points'; ordered exercise list with time/reps and rest periods
- **Buttons:** Start Workout; Save (Phase 2); Back
- **Actions:** Show workout; start a session
- **API Required:** GET /api/v1/workouts/{id}
- **Validation:** Workout must be Published
- **Error State:** 'This workout is no longer available.'
- **Notes:** Phase: MVP. Features: FEAT-096.

### SCR-M-032 — Workout Player – Exercise
- **User Role:** Employee, Team Manager
- **Purpose:** Guides the employee through each exercise with media, instructions and a timer.
- **Entry Point:** Workout Detail 'Start Workout'; after Rest
- **Components:** Exercise media (video/animation/image – TBC); exercise name; instructions; countdown timer or rep counter; progress 'Exercise 3 of 8'; next-up preview; Pause overlay; End-early confirmation dialog
- **Buttons:** Pause / Resume; Skip exercise; Previous; End workout
- **Actions:** Start session (workout_started event); move to Rest when the exercise ends; pause/resume timers; end early with confirmation (partial completion per agreed rule)
- **API Required:** POST /api/v1/me/workout-sessions; PATCH /api/v1/me/workout-sessions/{id}
- **Error State:** Media fails: text instructions shown and the session continues; offline: progress kept on the device and synced later
- **Notes:** Phase: MVP. Features: FEAT-097, FEAT-098. Pause/resume/end early is RECOMMENDED — REQUIRED FOR IMPLEMENTATION (FEAT-098); partial-completion rule TBC.

### SCR-M-033 — Workout Player – Rest
- **User Role:** Employee, Team Manager
- **Purpose:** Rest period between exercises with a countdown and preview of the next exercise.
- **Entry Point:** Automatically after each exercise
- **Components:** Rest countdown (e.g., 30 s); next exercise preview; progress indicator
- **Buttons:** +10 s; Skip rest; Pause; End workout
- **Actions:** Count down and move to the next exercise automatically
- **API Required:** PATCH /api/v1/me/workout-sessions/{id} (progress)
- **Success State:** Moves to next exercise or Workout Complete
- **Notes:** Phase: MVP. Features: FEAT-097.


## MOD-13 Gamification Engine (Points, Streaks & Badges)

### SCR-M-034 — Workout Complete
- **User Role:** Employee, Team Manager
- **Purpose:** Celebrates the finished workout, records it and shows points (and any badge) earned.
- **Entry Point:** Last exercise finished
- **Components:** Celebration animation; summary (duration, exercises completed); '+50 points'; badge unlocked card (e.g., First Workout); streak update
- **Buttons:** Done; View history; View badge
- **Actions:** Complete session (workout_completed event); award points once via the gamification engine; check badges
- **API Required:** POST /api/v1/me/workout-sessions/{id}/complete
- **Validation:** Points awarded once per completed workout per active rule
- **Error State:** Offline: 'Workout saved on your phone. Points will be added when you're back online.' (points shown as Pending)
- **Success State:** 'Great job! +50 points'
- **Notes:** Phase: MVP. Features: FEAT-099, FEAT-170, FEAT-163, FEAT-166. Minimum completion needed to earn points is TBC.


## MOD-08 Workout Module

### SCR-M-035 — Workout History
- **User Role:** Employee, Team Manager
- **Purpose:** Lists completed workouts with date, duration and points.
- **Entry Point:** Workout Library 'History'; Profile
- **Components:** Monthly summary (workouts, minutes); list rows (date, workout, duration, points); month selector
- **Fields:** Month
- **Buttons:** Row tap (opens workout detail); Month selector
- **Actions:** Show completed sessions newest first
- **API Required:** GET /api/v1/me/workout-sessions?status=completed&month=
- **Empty State:** 'No workouts yet. Start your first workout to earn the First Workout badge.'
- **Error State:** 'Couldn't load history.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-100.


## MOD-09 Nutrition Module

### SCR-M-036 — Nutrition Dashboard
- **User Role:** Employee, Team Manager
- **Purpose:** Daily food log with calories, protein, carbohydrates and fat totals, plus water from hydration tracking.
- **Entry Point:** Activity hub 'Nutrition' (Phase 2)
- **Components:** Date selector; daily totals (calories, protein, carbohydrates, fat); water total (from Water Tracker, no double entry); meal sections Breakfast / Lunch / Dinner / Snacks with items; disclaimer 'General wellness information, not dietary or medical advice.'
- **Fields:** Date
- **Buttons:** Add food (per meal); Item tap (edit/delete); Previous / next day
- **Actions:** Show day's meals and totals
- **API Required:** GET /api/v1/me/nutrition?date=; DELETE /api/v1/me/nutrition/{id}
- **Empty State:** 'Nothing logged today. Add your breakfast to get started.'
- **Error State:** 'Couldn't load your food log.' with Retry
- **Success State:** Totals update immediately after changes
- **Notes:** Phase: Phase 2. Features: FEAT-103, FEAT-104, FEAT-105, FEAT-107. Nutrition is Phase 2 (§58) and should be independently deployable. Daily nutrition targets are not defined in the PDF – TBC.

### SCR-M-037 — Log Meal – Search & Add Food
- **User Role:** Employee, Team Manager
- **Purpose:** Search the food database and add a food with portion to a meal.
- **Entry Point:** Nutrition Dashboard 'Add food'
- **Components:** Meal type selector; food search with results; recent foods; portion selector; nutrition preview (calories, protein, carbohydrates, fat)
- **Fields:** Meal type; Food; Portion / serving size; Quantity; Calories, Protein, Carbohydrates, Fat (auto-calculated)
- **Buttons:** Add to meal; Cancel
- **Actions:** Search foods; save nutrition record; update totals
- **API Required:** GET /api/v1/foods?q=&page=; POST /api/v1/me/nutrition; PATCH /api/v1/me/nutrition/{id}
- **Validation:** Food selected; quantity 0.25–20 servings (ASSUMPTION) (FRM-17)
- **Empty State:** 'No foods found for "paneer wrap".'
- **Error State:** 'Couldn't add this food. Try again.'
- **Success State:** 'Added to Lunch'
- **Notes:** Phase: Phase 2. Features: FEAT-103, FEAT-104, FEAT-106. Food database source and licence are TBC (FEAT-106); Indian food database is Future.


## MOD-10 Habit Tracker

### SCR-M-038 — My Habits (Today)
- **User Role:** Employee, Team Manager
- **Purpose:** Shows today's selected habits with targets, check-ins, streaks and points.
- **Entry Point:** Activity hub 'Habits'; Home; habit reminder
- **Components:** Summary '3 of 5 habits done'; habit rows (icon, name, target e.g., 'Take breaks 2/3', 'Drink water ✓'); check/increment button; streak flame count; points per habit
- **Buttons:** Check / +1; Habit tap (detail); Add habits
- **Actions:** Record completion (habit_completed event); update streak and points once per habit per day
- **API Required:** GET /api/v1/me/habits/today; POST /api/v1/me/habits/{id}/completions; DELETE /api/v1/me/habits/{id}/completions/{date}
- **Validation:** Cannot complete future days; undo allowed same day
- **Empty State:** 'Pick a few healthy habits to build.' with 'Choose habits'
- **Error State:** 'Couldn't save. We'll retry when you're back online.'
- **Success State:** Check animation; '+10 points' toast
- **Notes:** Phase: MVP. Features: FEAT-114, FEAT-115, FEAT-116, FEAT-113, FEAT-121. Points value per habit is TBC. Phase 2: habits such as Drink water / Walk daily auto-complete from tracked data (FEAT-121, RECOMMENDED).

### SCR-M-039 — Choose Habits
- **User Role:** Employee, Team Manager
- **Purpose:** Select habits from the HealthX habit list and set a daily target for each.
- **Entry Point:** My Habits 'Add habits'; onboarding suggestion
- **Components:** Habit list: Walk daily, Drink water, Exercise, Meditation, Sleep early, Reduce sugary drinks, Stretch, Take breaks; toggles; daily target per selected habit
- **Fields:** Selected habits; Daily target per habit
- **Buttons:** Save; Cancel
- **Actions:** Save selected habits and targets
- **API Required:** GET /api/v1/habits; PUT /api/v1/me/habits
- **Validation:** At least 1 habit to save (ASSUMPTION); target within the habit's allowed range (FRM-18)
- **Error State:** 'Couldn't save your habits.'
- **Success State:** 'Habits updated.'
- **Notes:** Phase: MVP. Features: FEAT-112, FEAT-113, FEAT-119. Fixed list vs custom habits is TBC (custom habits SCR-M-041).

### SCR-M-040 — Habit Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Shows one habit's target, streaks and calendar, and lets the employee adjust the target and reminder.
- **Entry Point:** My Habits row tap
- **Components:** Habit header; daily target editor; current and best streak; month calendar (completed / missed days); reminder toggle and time; remove habit
- **Fields:** Daily target; Reminder on/off; Reminder time
- **Buttons:** Save; Remove habit; Month navigation
- **Actions:** Update target and reminder; show history
- **API Required:** GET /api/v1/me/habits/{id}; PATCH /api/v1/me/habits/{id}; GET /api/v1/me/habits/{id}/history?month=
- **Validation:** Target within allowed range
- **Empty State:** 'No history yet.'
- **Error State:** 'Couldn't update this habit.'
- **Success State:** 'Habit updated.'
- **Notes:** Phase: MVP. Features: FEAT-113, FEAT-115, FEAT-117, FEAT-118. Calendar and reminders are RECOMMENDED (FEAT-117, FEAT-118).

### SCR-M-041 — Create Custom Habit
- **User Role:** Employee, Team Manager
- **Purpose:** Lets the employee create a personal habit not in the standard list.
- **Entry Point:** Choose Habits 'Create your own' (Phase 2, if approved)
- **Components:** Name field; icon picker; target type; daily target
- **Fields:** Habit name; Icon; Target type; Daily target
- **Buttons:** Create; Cancel
- **Actions:** Create a personal habit
- **API Required:** POST /api/v1/me/habits/custom
- **Validation:** Name 2–40 characters; target within range (FRM-19)
- **Error State:** 'A habit with this name already exists.'
- **Success State:** 'Habit created.'
- **Notes:** Phase: Phase 2. Features: FEAT-120. Not stated in the PDF; whether custom habits earn points is TBC – see Client Questions.


## MOD-11 Wellness Challenges

### SCR-M-042 — Challenges
- **User Role:** Employee, Team Manager
- **Purpose:** Lists challenges the employee can join, is taking part in, or has completed.
- **Entry Point:** Bottom navigation 'Challenges'; Home challenge card; challenge notification
- **Components:** Tabs: Available, Active (joined), Completed; challenge cards (cover, name, type badge Individual/Leaderboard/Team/Company-wide/Collaborative, dates, metric icon, target, points, reward icon, participants count, my progress bar)
- **Fields:** Tab; Type filter
- **Buttons:** Card tap; Tab switch; Filter
- **Actions:** Show only challenges the employee is eligible for, grouped by status
- **API Required:** GET /api/v1/challenges?status=available|active|completed&page=
- **Empty State:** Available: 'No challenges open right now – check back soon.'; Completed: 'Your finished challenges will appear here.'
- **Error State:** 'Couldn't load challenges.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-140, FEAT-139.

### SCR-M-043 — Challenge Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Shows a challenge's rules, dates, metric, target, points, reward and participants, and lets the employee join or leave.
- **Entry Point:** Challenges list; Home 'Today's Challenge'; announcement link
- **Components:** Cover; name; description; type explanation; start/end dates with countdown; metric and target (e.g., '100,000 steps in 30 days'); who can join; '+100 points'; reward card; participants count; rules (incl. late-sync grace period)
- **Buttons:** Join challenge; Leave challenge; View progress; View leaderboard
- **Actions:** Join (challenge_joined event) or leave (confirmation dialog)
- **API Required:** GET /api/v1/challenges/{id}; POST /api/v1/challenges/{id}/join; POST /api/v1/challenges/{id}/leave
- **Validation:** Employee must be eligible; joining after start allowed? (TBC)
- **Error State:** 'This challenge is no longer open to join.'; 'You're not eligible for this challenge.'
- **Success State:** 'You've joined! Your progress starts counting now.'
- **Notes:** Phase: MVP. Features: FEAT-141, FEAT-142, FEAT-145, FEAT-127, FEAT-128, FEAT-129, FEAT-130, FEAT-131, FEAT-132, FEAT-133. Leave challenge is RECOMMENDED (FEAT-145). Whether data before joining counts is TBC.

### SCR-M-044 — Challenge Progress
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the employee's (and team's or company's) progress toward the challenge target.
- **Entry Point:** Challenge Detail 'View progress'; Home challenge card
- **Components:** My progress vs target (e.g., 64,200 / 100,000 steps, 64%); daily breakdown chart; Team type: department/team score vs others (e.g., Engineering vs Sales); Company-wide/Collaborative: company total vs goal (e.g., 6.2M / 10M steps) and my contribution; days remaining; last synced time
- **Buttons:** Sync now; View leaderboard; Check in (custom metric)
- **Actions:** Show automatically calculated progress from synced/logged data
- **API Required:** GET /api/v1/challenges/{id}/progress
- **Empty State:** 'No progress yet – your activity will appear after your next sync.'
- **Error State:** 'Couldn't load progress.' with Retry
- **Success State:** Target reached banner: 'Target reached! Points will be added when the challenge ends.'
- **Notes:** Phase: MVP. Features: FEAT-143, FEAT-129, FEAT-131, FEAT-132, FEAT-133. Team scoring (total vs per-member average) and difference between Company-wide and Collaborative are TBC.


## MOD-12 Leaderboards

### SCR-M-045 — Challenge Leaderboard
- **User Role:** Employee, Team Manager
- **Purpose:** Ranking for one challenge (individuals or teams/departments depending on type).
- **Entry Point:** Challenge Detail / Progress 'Leaderboard'
- **Components:** Top 3 podium; ranked list (rank, name per privacy setting, avatar if allowed, total); my row pinned and highlighted; 'Updated 10 minutes ago'
- **Buttons:** Pull to refresh
- **Actions:** Show challenge-only ranking
- **API Required:** GET /api/v1/challenges/{id}/leaderboard?page=
- **Empty State:** 'Rankings appear once participants start logging activity.'
- **Error State:** 'Couldn't load the leaderboard.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-153, FEAT-152, FEAT-154. Refreshes about every 15 minutes in MVP (ASSUMPTION); live updates Phase 2 (FEAT-014). Tie-break rule TBC.


## MOD-11 Wellness Challenges

### SCR-M-046 — Custom Challenge Check-in
- **User Role:** Employee, Team Manager
- **Purpose:** Lets participants record progress for a challenge with a 'Custom' metric (e.g., 'No sugar today').
- **Entry Point:** Challenge Progress 'Check in'; daily reminder
- **Components:** Custom metric name; today's check-in control (Yes/No or value); check-in history
- **Fields:** Check-in date; Completed (Yes/No) or Value
- **Buttons:** Check in; Undo (same day)
- **Actions:** Record self-reported check-in
- **API Required:** POST /api/v1/challenges/{id}/check-ins
- **Validation:** One check-in per day; date within challenge dates; not in the future (FRM-20)
- **Error State:** 'You've already checked in today.'
- **Success State:** 'Checked in for today.'
- **Notes:** Phase: MVP. Features: FEAT-124. Meaning of the 'Custom' metric is not defined in the PDF – this check-in design is our proposal – TBC – see Client Questions.

### SCR-M-047 — Challenge Results
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the final outcome: rank or completion, points and any reward earned.
- **Entry Point:** Completed tab; 'Results are out' notification
- **Components:** Final status (Completed / Not Completed) or final rank; final total; '+100 points'; reward earned card (link to My Orders); top 3 podium; 'Finalising' banner during grace period; suggested next challenges
- **Buttons:** View reward; Join next challenge; View leaderboard
- **Actions:** Show finalised ChallengeResult
- **API Required:** GET /api/v1/challenges/{id}/results
- **Error State:** 'Results are being finalised while late data syncs (until 3 Nov).'
- **Success State:** 'Challenge complete! You finished #4.'
- **Notes:** Phase: MVP. Features: FEAT-144, FEAT-127, FEAT-128. Late-sync grace period, winner/reward rules and ties are TBC.


## MOD-12 Leaderboards

### SCR-M-048 — Leaderboards (Company / Department / Team)
- **User Role:** Employee, Team Manager
- **Purpose:** Company, department and team rankings with the employee's own position always visible.
- **Entry Point:** Bottom navigation / Challenges hub 'Leaderboards'; Home rank widget
- **Components:** Tabs: Company (e.g., 1. John 82,340; 2. Sarah 79,420; 3. David 75,200), Department (Engineering, Sales, Marketing, HR), Team (Team A, Team B, Team C); metric selector; period filter Today / Week / Month; my rank pinned row; names per company privacy setting
- **Fields:** Scope tab; Metric; Period
- **Buttons:** Tab; Metric selector; Period selector; Pull to refresh
- **Actions:** Show rankings for the selected scope, metric and period
- **API Required:** GET /api/v1/leaderboards?scope=company|department|team&metric=&period=&page=
- **Empty State:** 'No rankings yet for this period.'
- **Error State:** 'Couldn't load the leaderboard.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-149, FEAT-150, FEAT-151, FEAT-152, FEAT-154, FEAT-157, FEAT-158. Default metric/period and department ranking method (total vs per-member average) are TBC. Period filter is RECOMMENDED (FEAT-157). Anonymous mode shows no names/photos except the viewer's own.

### SCR-M-049 — My Rank (Individual)
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the employee's personal rank across company, department and team.
- **Entry Point:** Home 'Current Rank' widget; Leaderboards 'My rank'
- **Components:** Rank cards: '#8 in Engineering', '#42 in Company', '#2 in Team A'; my total; gap to next rank ('1,240 steps to #7'); change vs last week
- **Fields:** Period
- **Buttons:** Open full leaderboard
- **Actions:** Show personal rank only
- **API Required:** GET /api/v1/me/rank?metric=&period=
- **Empty State:** 'Join a challenge or log activity to get ranked.'
- **Error State:** 'Couldn't load your rank.'
- **Notes:** Phase: MVP. Features: FEAT-152, FEAT-055.


## MOD-13 Gamification Engine (Points, Streaks & Badges)

### SCR-M-050 — Badges & Achievements
- **User Role:** Employee, Team Manager
- **Purpose:** Shows earned and locked badges, progress toward each, and current streaks.
- **Entry Point:** Profile; Home achievement; badge notification
- **Components:** Streak summary (activity, hydration, habits); Earned grid (badge, date earned); Locked grid with requirement and progress (e.g., Step Master 64,200 / 100,000 steps; Hydration Hero 9 / 14 days); badge detail bottom sheet
- **Buttons:** Badge tap (detail sheet)
- **Actions:** Show badges and streaks
- **API Required:** GET /api/v1/me/badges; GET /api/v1/me/streaks
- **Empty State:** 'Complete your first workout to earn your first badge.'
- **Error State:** 'Couldn't load badges.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-165, FEAT-164, FEAT-163, FEAT-162. Default badges: First Workout, 7-Day Streak, Step Master, Hydration Hero, Early Bird. 'Morning' time window for Early Bird is TBC.

### SCR-M-051 — Badge Unlocked Celebration
- **User Role:** Employee, Team Manager
- **Purpose:** Celebrates a newly unlocked badge once.
- **Entry Point:** Automatically after the qualifying action; badge notification
- **Components:** Full-screen overlay with animation; badge image; 'You unlocked Hydration Hero!'; bonus points if configured
- **Buttons:** View badges; Close
- **Actions:** Mark celebration as seen
- **API Required:** POST /api/v1/me/badges/{id}/seen
- **Validation:** Shown once per badge
- **Success State:** Overlay closes
- **Notes:** Phase: MVP. Features: FEAT-166.


## MOD-14 Rewards & Points Wallet

### SCR-M-052 — Points Wallet
- **User Role:** Employee, Team Manager
- **Purpose:** Shows available, lifetime and redeemed points with recent transactions.
- **Entry Point:** Bottom navigation 'Rewards'; Home points chip
- **Components:** Available Points 2,450; Lifetime Points 8,920; Redeemed 6,470; recent transactions (+50 Workout, +100 Challenge, −500 Amazon Voucher); links to Rewards and My Orders
- **Buttons:** Browse rewards; See all transactions; My orders
- **Actions:** Show wallet balances from the points ledger
- **API Required:** GET /api/v1/me/wallet
- **Validation:** Available = Lifetime − Redeemed ± adjustments
- **Empty State:** 'Earn points by logging activity, workouts and challenges.'
- **Error State:** 'Couldn't load your wallet.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-171, FEAT-172, FEAT-185. Points expiry is not stated in the PDF – TBC (Phase 2, FEAT-185); if approved, expiring points are shown here.

### SCR-M-053 — Points History
- **User Role:** Employee, Team Manager
- **Purpose:** Full list of points earned and spent.
- **Entry Point:** Points Wallet 'See all'
- **Components:** Filter chips All / Earned / Spent; transaction rows (source, date, +/− points, 'Reversed' label); infinite scroll
- **Fields:** Type filter; Date range
- **Buttons:** Filter; Row tap (source detail)
- **Actions:** Paginated ledger, newest first
- **API Required:** GET /api/v1/me/wallet/transactions?type=&from=&to=&page=
- **Empty State:** 'No transactions in this period.'
- **Error State:** 'Couldn't load history.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-172.

### SCR-M-054 — Rewards Catalogue
- **User Role:** Employee, Team Manager
- **Purpose:** Browse rewards available to the employee's company with points cost.
- **Entry Point:** Points Wallet 'Browse rewards'; reward announcement
- **Components:** Balance header; category chips (e.g., Vouchers, Gift cards, Company merchandise, Fitness memberships, Gym discounts, Wellness products, Company benefits – list TBC); reward cards (image, name, points cost, 'Company reward' tag, low-stock label, 'You need 550 more points')
- **Fields:** Category; 'Affordable only' toggle
- **Buttons:** Category chip; Reward card; Toggle
- **Actions:** List rewards visible to the company and in stock (reward_viewed event on detail)
- **API Required:** GET /api/v1/rewards?category=&affordable=&page=; GET /api/v1/rewards/categories
- **Empty State:** 'No rewards available yet. Your company will add rewards soon.'
- **Error State:** 'Couldn't load rewards.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-173, FEAT-174, FEAT-180, FEAT-181.

### SCR-M-055 — Reward Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Shows reward description, points cost, terms, delivery method and availability.
- **Entry Point:** Rewards Catalogue card
- **Components:** Image gallery; name; points cost; description; delivery method (e-voucher by email / physical delivery / benefit); terms & conditions; stock / per-employee limit; balance after redemption
- **Buttons:** Redeem; Back
- **Actions:** Show reward (reward_viewed event)
- **API Required:** GET /api/v1/rewards/{id}
- **Validation:** Redeem disabled when points are insufficient or out of stock / limit reached
- **Error State:** 'This reward is no longer available.'
- **Notes:** Phase: MVP. Features: FEAT-175, FEAT-181.

### SCR-M-056 — Redeem Reward (Confirm & Delivery Details)
- **User Role:** Employee, Team Manager
- **Purpose:** Confirms the redemption, captures delivery details where needed and deducts points once.
- **Entry Point:** Reward Detail 'Redeem'
- **Components:** Points summary (Cost 500, Balance after 1,950); delivery section (email for e-vouchers; name, phone and address for physical items); confirmation checkbox; success panel
- **Fields:** Delivery email; Recipient name; Phone; Address; Confirm points deduction
- **Buttons:** Confirm redemption; Cancel
- **Actions:** Create order with idempotency key; deduct points exactly once (reward_redeemed event)
- **API Required:** POST /api/v1/rewards/{id}/redeem
- **Validation:** Enough available points; in stock; within per-employee limit; delivery fields valid (FRM-21)
- **Error State:** 'Not enough points.'; 'Sorry, this reward just went out of stock.'; 'Something went wrong – no points were deducted.'
- **Success State:** 'Order placed! 500 points deducted. Track it in My Orders.' (or 'Waiting for approval' if approval is enabled)
- **Notes:** Phase: MVP. Features: FEAT-176, FEAT-182. Whether admin approval is required is TBC (FEAT-182). Address and phone are PII – encrypted and visible only to fulfilment admins.

### SCR-M-057 — My Orders
- **User Role:** Employee, Team Manager
- **Purpose:** Lists the employee's reward orders and their status.
- **Entry Point:** Points Wallet 'My orders'; order notification
- **Components:** Order rows (reward image, name, date, points, status chip: Requested / Pending Approval / Approved / Rejected / Processing / Fulfilled / Cancelled)
- **Fields:** Status filter
- **Buttons:** Order tap
- **Actions:** Show orders newest first
- **API Required:** GET /api/v1/me/redemptions?status=&page=
- **Empty State:** 'No orders yet. Redeem your points for a reward.'
- **Error State:** 'Couldn't load orders.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-177.

### SCR-M-058 — Order Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Tracks one order from request to delivery, including voucher code or tracking reference.
- **Entry Point:** My Orders row; order status notification
- **Components:** Status timeline; voucher code (masked; tap to reveal/copy) or tracking reference; delivery details; points spent; refund note if cancelled; support link
- **Buttons:** Reveal / copy code; Contact support
- **Actions:** Show order status and delivery details
- **API Required:** GET /api/v1/me/redemptions/{id}
- **Error State:** 'Couldn't load this order.' with Retry
- **Success State:** Delivered: 'Delivered on 12 Oct.'; Cancelled: 'Cancelled – 500 points refunded.'
- **Notes:** Phase: MVP. Features: FEAT-177, FEAT-178, FEAT-183. Voucher codes are stored encrypted and shown only to the order owner.


## MOD-16 Announcements & Notifications

### SCR-M-059 — Announcements
- **User Role:** Employee, Team Manager
- **Purpose:** Lists company announcements (wellness tips, challenge and reward announcements).
- **Entry Point:** Notification Centre; Home; push notification
- **Components:** List newest first; type label/icon (Wellness tip, Challenge announcement, Reward announcement); unread highlight; type filter
- **Fields:** Type filter
- **Buttons:** Row tap; Filter
- **Actions:** Show announcements targeted to the employee
- **API Required:** GET /api/v1/announcements?type=&page=
- **Empty State:** 'No announcements from your company yet.'
- **Error State:** 'Couldn't load announcements.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-195, FEAT-196.

### SCR-M-060 — Announcement Detail
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the full announcement with any image and link.
- **Entry Point:** Announcements list; push notification tap
- **Components:** Title (e.g., 'Our October Step Challenge starts Monday.'); type; date; sender (company / HR); message; image; call-to-action (e.g., 'View challenge')
- **Buttons:** Call-to-action; Back
- **Actions:** Mark as read; fire notification_opened when opened from push
- **API Required:** GET /api/v1/announcements/{id}; POST /api/v1/announcements/{id}/read
- **Error State:** 'This announcement is no longer available.'
- **Notes:** Phase: MVP. Features: FEAT-195, FEAT-194, FEAT-203.

### SCR-M-061 — Notification Centre
- **User Role:** Employee, Team Manager
- **Purpose:** One list of all notifications (reminders, challenges, rewards, badges, announcements) with read/unread status.
- **Entry Point:** Home bell icon
- **Components:** Groups Today / Earlier; rows with type icon, title, time, unread dot; swipe to delete (ASSUMPTION)
- **Buttons:** Row tap (deep link); Mark all as read; Notification settings
- **Actions:** Mark read on open (notification_opened event); deep-link to the related screen
- **API Required:** GET /api/v1/me/notifications?page=; PATCH /api/v1/me/notifications/{id}; POST /api/v1/me/notifications/read-all
- **Empty State:** 'You're all caught up.'
- **Error State:** 'Couldn't load notifications.' with Retry
- **Success State:** Unread badge count updates
- **Notes:** Phase: MVP. Features: FEAT-200, FEAT-203, FEAT-199, FEAT-147, FEAT-012. PDF lists 'Notifications' in the MVP and a Notification entity; the in-app centre layout is our design.


## MOD-17 Wellness Feed & Content

### SCR-M-062 — Wellness Feed
- **User Role:** Employee, Team Manager
- **Purpose:** Personalised feed of tips, workouts, challenges, announcements, articles and achievements.
- **Entry Point:** Bottom navigation / Home 'Feed' (Phase 2)
- **Components:** Cards: Today's Tip, Today's Workout, Current Challenge, Company Announcement, Wellness Article, Achievement; pull to refresh
- **Buttons:** Card tap; Save (bookmark); Pull to refresh
- **Actions:** Show cards ordered by agreed rules; refresh daily
- **API Required:** GET /api/v1/me/feed?page=
- **Empty State:** 'Your feed is being prepared – check back tomorrow.'
- **Error State:** 'Couldn't load your feed.' with Retry
- **Notes:** Phase: Phase 2. Features: FEAT-206, FEAT-207, FEAT-208, FEAT-209, FEAT-210, FEAT-211, FEAT-212. Phase not stated in the PDF (proposed Phase 2). Card ordering rules TBC.

### SCR-M-063 — Content Viewer (Article / Video / Link)
- **User Role:** Employee, Team Manager
- **Purpose:** Read articles, watch videos and open links inside the app; save items for later.
- **Entry Point:** Wellness Feed card; announcement link; Saved list
- **Components:** Article: title, image, formatted text; Video: player with play/pause; Link: in-app browser; Saved tab
- **Buttons:** Save / Unsave; Share link (ASSUMPTION); Back
- **Actions:** Show published content; save bookmark
- **API Required:** GET /api/v1/content/{id}; POST/DELETE /api/v1/me/saved-content/{id}; GET /api/v1/me/saved-content
- **Validation:** Only Published content is shown
- **Empty State:** Saved tab: 'Nothing saved yet.'
- **Error State:** 'This content is unavailable.'; video: 'Video can't play right now.'
- **Success State:** 'Saved'
- **Notes:** Phase: Phase 2. Features: FEAT-216, FEAT-213, FEAT-218. Save/bookmark is RECOMMENDED (FEAT-218).


## MOD-15 Corporate Wellness Programs

### SCR-M-064 — Wellness Programs
- **User Role:** Employee, Team Manager
- **Purpose:** Lists structured company wellness programs the employee can join or is following.
- **Entry Point:** Challenges hub 'Programs'; announcement (Phase 2)
- **Components:** Tabs Available / My programs / Completed; program cards (e.g., '30-Day Healthy Lifestyle Program', duration, current week, progress)
- **Fields:** Tab
- **Buttons:** Program card
- **Actions:** Show eligible programs
- **API Required:** GET /api/v1/programs?status=
- **Empty State:** 'No programs available right now.'
- **Error State:** 'Couldn't load programs.' with Retry
- **Notes:** Phase: Phase 2. Features: FEAT-189.

### SCR-M-065 — Program Detail & Progress
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the program's weekly goals and the employee's progress, week by week.
- **Entry Point:** Wellness Programs card
- **Components:** Overview; weeks: Week 1 – Walk 5,000 steps, Drink 2L water; Week 2 – 3 workouts, Sleep 7 hours; Week 3 – Meditation, Nutrition tracking; Week 4 – Combined challenge; locked future weeks; overall progress; completion points
- **Buttons:** Join program; Leave program; Week goal tap (opens module)
- **Actions:** Enrol; track goals from module data
- **API Required:** GET /api/v1/programs/{id}; POST /api/v1/programs/{id}/enrol; GET /api/v1/programs/{id}/progress
- **Validation:** Must be eligible; weeks unlock in order
- **Error State:** 'You can't join this program.'
- **Success State:** 'You've joined the 30-Day Healthy Lifestyle Program.'
- **Notes:** Phase: Phase 2. Features: FEAT-189, FEAT-187, FEAT-188. How a combined challenge is scored is TBC.


## MOD-18 AI Wellness Coach & Insights

### SCR-M-066 — AI Coach – Introduction & Consent
- **User Role:** Employee, Team Manager
- **Purpose:** First-use screen explaining what the AI Coach can do, what data it uses, and asking for AI-personalisation consent.
- **Entry Point:** First open of AI Coach (Phase 2)
- **Components:** Explanation; data used (only the employee's permitted data); 'HR and colleagues can never see your conversations'; non-medical disclaimer; consent toggle
- **Fields:** AI personalisation consent
- **Buttons:** Agree & start; Not now; Learn more
- **Actions:** Record consent (versioned); open chat
- **API Required:** GET /api/v1/me/consents; PUT /api/v1/me/consents/ai_personalization
- **Validation:** Consent required to use personalised answers
- **Error State:** 'Couldn't save your choice.'
- **Success State:** Opens AI Coach Chat
- **Notes:** Phase: Phase 2. Features: FEAT-275, FEAT-219, FEAT-225, FEAT-226.

### SCR-M-067 — AI Coach Chat
- **User Role:** Employee, Team Manager
- **Purpose:** Employees ask wellness questions and get guidance based only on their own permitted data.
- **Entry Point:** Bottom navigation / Home 'Ask Coach' (Phase 2)
- **Components:** Chat thread; suggested prompts ('How can I improve my wellness score?', 'Give me a 20-minute workout.', 'What should I eat for lunch?', 'How can I improve my sleep?', 'Create a 7-day wellness plan.'); message input; typing indicator; workout suggestion cards; disclaimer banner; feedback thumbs
- **Fields:** Message
- **Buttons:** Send; Suggested prompt; Open workout; Thumbs up/down; Clear conversation
- **Actions:** Send message; stream answer; medical questions get a safe redirect
- **API Required:** POST /api/v1/me/ai-coach/messages (streaming); GET /api/v1/me/ai-coach/conversations; DELETE /api/v1/me/ai-coach/conversations/{id}
- **Validation:** Message 1–1,000 characters; per-employee usage limit (TBC) (FRM-24)
- **Empty State:** Suggested prompts shown on a new conversation
- **Error State:** 'Coach is unavailable right now. Please try again later.'; 'You've reached today's question limit.'
- **Success State:** Answer appears; plan/workout cards are tappable
- **Notes:** Phase: Phase 2. Features: FEAT-219, FEAT-220, FEAT-221, FEAT-222, FEAT-223, FEAT-225, FEAT-226, FEAT-229. AI must not diagnose or give clinical advice (§4) and never exposes data to HR or colleagues (§30). Conversations are sensitive – encrypted; retention TBC.

### SCR-M-068 — 7-Day Wellness Plan
- **User Role:** Employee, Team Manager
- **Purpose:** Shows an AI-generated 7-day plan (activity, workouts, water, sleep, habits) that the employee can save and follow.
- **Entry Point:** AI Coach answer 'Create a 7-day wellness plan'
- **Components:** Day tabs 1–7; plan items per day with links to modules; tick-off per item; save banner
- **Buttons:** Save plan; Mark done; Regenerate; Delete plan
- **Actions:** Save structured plan; track item completion
- **API Required:** POST /api/v1/me/ai-coach/plans; GET /api/v1/me/plans/{id}; PATCH /api/v1/me/plans/{id}/items/{itemId}
- **Error State:** 'Couldn't create a plan right now.'
- **Success State:** 'Plan saved.'
- **Notes:** Phase: Phase 2. Features: FEAT-224. Whether plans can auto-create habits/goals is TBC.


## MOD-03 Employee Profile & Preferences

### SCR-M-069 — My Profile
- **User Role:** Employee, Team Manager
- **Purpose:** Shows the employee's profile summary and links to edit details, preferences, privacy and settings.
- **Entry Point:** Bottom navigation 'Profile'
- **Components:** Avatar; name; company, department, team; profile completion 80% with prompt; points and badges counts; sections: Basic details, Wellness details, Preferences, Badges, Workout history, Connected apps, Privacy & consent, Settings; 'My Team' (Team Managers only)
- **Buttons:** Edit profile; section rows
- **Actions:** Show profile (GET /me)
- **API Required:** GET /api/v1/me
- **Error State:** 'Couldn't load your profile.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-048, FEAT-049, FEAT-041, FEAT-042.

### SCR-M-070 — Edit Profile – Basic Details
- **User Role:** Employee, Team Manager
- **Purpose:** Edit name, contact details, photo and personal details.
- **Entry Point:** My Profile 'Edit profile'
- **Components:** Photo with change/remove; form fields; verification notice for email/phone changes
- **Fields:** Profile photo; First name; Last name; Email; Phone; Gender; Date of birth; Location; Timezone
- **Buttons:** Save; Cancel; Remove photo
- **Actions:** Save changes; email/phone changes require OTP verification first
- **API Required:** PATCH /api/v1/me/profile; POST /api/v1/me/profile/photo; DELETE /api/v1/me/profile/photo; POST /api/v1/me/contact-change
- **Validation:** As FRM-07 (field-level)
- **Error State:** Field-level messages; 'This email is already used by another account.'
- **Success State:** 'Profile updated.'
- **Notes:** Phase: MVP. Features: FEAT-041, FEAT-042, FEAT-048. Personal data (PII) – encrypted at rest; not visible to colleagues except name/photo on leaderboards per privacy settings.

### SCR-M-071 — Edit Profile – Wellness Details
- **User Role:** Employee, Team Manager
- **Purpose:** Edit height, weight, goals, activity level, fitness level and daily step goal.
- **Entry Point:** My Profile 'Wellness details'
- **Components:** Form with unit labels; privacy note 'Only you can see these details'
- **Fields:** Height; Weight; Goals; Activity level; Fitness level; Daily step goal
- **Buttons:** Save; Cancel
- **Actions:** Save wellness profile; recalculate goals where relevant
- **API Required:** PATCH /api/v1/me/wellness-profile
- **Validation:** As FRM-08
- **Error State:** Field-level messages
- **Success State:** 'Wellness details updated.'
- **Notes:** Phase: MVP. Features: FEAT-043, FEAT-029. Health/wellness data – encrypted and restricted; never shown to HR or company admins individually.

### SCR-M-072 — Preferences
- **User Role:** Employee, Team Manager
- **Purpose:** Set preferred activities, workout preference, food preference, language and (Phase 2) units.
- **Entry Point:** My Profile 'Preferences'; Settings
- **Components:** Chip groups and dropdowns
- **Fields:** Preferred activities; Workout location preference; Preferred workout types; Food preference; Language; Units (Phase 2)
- **Buttons:** Save; Cancel
- **Actions:** Save preferences; language applies immediately
- **API Required:** PATCH /api/v1/me/preferences
- **Validation:** As FRM-09
- **Error State:** 'Couldn't save your preferences.'
- **Success State:** 'Preferences saved.'
- **Notes:** Phase: MVP. Features: FEAT-044, FEAT-045, FEAT-047, FEAT-016, FEAT-050. Value lists are TBC. Languages at launch TBC (MVP assumption: English only, translation-ready). Units preference is RECOMMENDED for Phase 2.


## MOD-16 Announcements & Notifications

### SCR-M-073 — Notification Preferences
- **User Role:** Employee, Team Manager
- **Purpose:** Choose which notification types to receive and set quiet hours.
- **Entry Point:** Settings 'Notifications'; Notification Centre settings icon
- **Components:** Toggle list by type; quiet hours pickers; note that service messages (e.g., security) are always sent
- **Fields:** Activity & goal reminders; Hydration reminders; Habit reminders; Challenge updates; Company announcements; Rewards & orders; Weekly summary; Quiet hours start; Quiet hours end
- **Buttons:** Save (auto-save per toggle)
- **Actions:** Update preferences; changes apply within one minute
- **API Required:** GET /api/v1/me/notification-preferences; PUT /api/v1/me/notification-preferences
- **Validation:** Quiet hours end ≠ start (FRM-10)
- **Error State:** 'Couldn't update. Your previous setting is still active.'
- **Success State:** Toggle stays in the new position
- **Notes:** Phase: MVP. Features: FEAT-046, FEAT-201, FEAT-274, FEAT-077, FEAT-118. Notification types are our proposal (PDF lists only 'Notification preferences').


## MOD-02 Onboarding & Authentication

### SCR-M-074 — Settings
- **User Role:** Employee, Team Manager
- **Purpose:** Central place for account, notifications, privacy, connected apps, language, help, legal and sign out.
- **Entry Point:** My Profile 'Settings'
- **Components:** Grouped list: Account, Notifications, Privacy & consent, Connected apps & devices, Language, Units (Phase 2), Help & support, Terms of Use, Privacy Policy, App version; Sign out; Delete account
- **Buttons:** Row items; Sign out (with confirmation)
- **Actions:** Navigate to sub-screens; sign out clears local data and revokes the session
- **API Required:** POST /api/v1/auth/logout
- **Error State:** Sign out offline: local data cleared; session revoked when back online
- **Success State:** Signed out: returns to Company Identification
- **Notes:** Phase: MVP. Features: FEAT-033, FEAT-047, FEAT-035.


## MOD-21 Privacy & Consent Management

### SCR-M-075 — Privacy & Consent Centre
- **User Role:** Employee, Team Manager
- **Purpose:** One place where the employee controls what personal data is collected and shared, and sees what HR can and cannot see.
- **Entry Point:** Settings 'Privacy & consent'; Profile
- **Components:** 'What your company can see' explainer (aggregated data only); consent toggles with descriptions; leaderboard display option; consent history list
- **Fields:** Health data permissions; Wearable / health app connection; Data sharing – show my name on leaderboards; Data sharing – Slack/Teams shout-outs (Phase 2); Notifications; AI personalisation (Phase 2); Analytics participation
- **Buttons:** Toggles; View consent history; Download my data (Phase 2); Delete account
- **Actions:** Grant/withdraw each consent; changes take effect immediately and are versioned and auditable
- **API Required:** GET /api/v1/me/consents; PUT /api/v1/me/consents/{type}; GET /api/v1/me/consents/history
- **Validation:** Withdrawing health data permission shows what will stop (FRM-22)
- **Error State:** 'Couldn't save your choice. Your previous setting is still active.'
- **Success State:** 'Your choice has been saved.'
- **Notes:** Phase: MVP. Features: FEAT-270, FEAT-271, FEAT-272, FEAT-273, FEAT-274, FEAT-275, FEAT-276, FEAT-158, FEAT-277, FEAT-278. Leaderboard opt-out is TBC (FEAT-158). Effect of analytics opt-out on challenges/leaderboards TBC. AI personalisation consent from Phase 2.


## MOD-22 Integrations

### SCR-M-076 — Connected Apps & Devices
- **User Role:** Employee, Team Manager
- **Purpose:** See and manage health connections: status, last sync, sync now, reconnect or disconnect.
- **Entry Point:** Settings; Privacy & Consent Centre; sync-error banner
- **Components:** Rows: Apple Health (iOS) / Health Connect (Android) with status (Not Connected / Connected / Sync Error / Disconnected) and last sync time; Phase 2: Fitbit, Garmin; Phase 3: other wearables
- **Buttons:** Connect; Sync now; Disconnect (confirmation); Reconnect
- **Actions:** Connect via platform permission or OAuth (Fitbit/Garmin); disconnect stops sync immediately
- **API Required:** GET /api/v1/me/health-connections; POST /api/v1/me/health-connections/{provider}; POST /api/v1/me/health-connections/{provider}/sync; DELETE /api/v1/me/health-connections/{provider}
- **Empty State:** 'No apps connected. Connect Apple Health / Health Connect to track steps automatically.'
- **Error State:** 'Sync failed – tap to reconnect.'
- **Success State:** 'Connected' / 'Disconnected – we've stopped syncing.'
- **Notes:** Phase: MVP. Features: FEAT-283, FEAT-272, FEAT-281, FEAT-282, FEAT-284, FEAT-285, FEAT-286. Fitbit/Garmin Phase 2 (§38; §59 lists 'Wearables' in Phase 3 – TBC); other wearables Phase 3. Garmin requires partner approval.


## MOD-21 Privacy & Consent Management

### SCR-M-077 — Download My Data
- **User Role:** Employee
- **Purpose:** Lets the employee request a copy of their personal data.
- **Entry Point:** Privacy & Consent Centre (Phase 2)
- **Components:** Explanation; request button; request status; download link with expiry
- **Buttons:** Request my data; Download
- **Actions:** Generate export file securely; notify when ready
- **API Required:** POST /api/v1/me/data-exports; GET /api/v1/me/data-exports/{id}
- **Validation:** One active request at a time; link valid 7 days (ASSUMPTION)
- **Error State:** 'Couldn't create your export. Please try again later.'
- **Success State:** 'Your data is ready to download.'
- **Notes:** Phase: Phase 2. Features: FEAT-279.

### SCR-M-078 — Delete Account
- **User Role:** Employee
- **Purpose:** Lets the employee request deletion of their HealthX account and personal data.
- **Entry Point:** Settings / Privacy & Consent Centre 'Delete account'
- **Components:** What will be deleted; effect on points and orders; optional reason; type-to-confirm; re-authentication
- **Fields:** Reason (optional); Type DELETE to confirm; Password or one-time code
- **Buttons:** Delete my account; Cancel
- **Actions:** Deactivate immediately; schedule deletion/anonymisation per retention rule; sign out
- **API Required:** POST /api/v1/me/deletion-request
- **Validation:** Confirmation text must match; re-authentication required (FRM-23)
- **Error State:** 'We couldn't process your request. Please try again.'
- **Success State:** 'Your account has been deactivated. Your personal data will be deleted within 30 days.' (period TBC)
- **Notes:** Phase: MVP. Features: FEAT-036, FEAT-280. Required by Apple App Store and Google Play for apps that allow account creation. Retention period and treatment of points are TBC.


## MOD-19 Business Portal — Organisation & People

### SCR-M-079 — My Team (Team Manager)
- **User Role:** Team Manager
- **Purpose:** Lets a Team Manager see their team's aggregated progress, challenge position and team leaderboard.
- **Entry Point:** My Profile 'My Team' (visible to Team Managers only)
- **Components:** Team name and rank among teams; participation this week (e.g., 9 of 12 members active); team challenge progress; team average steps (only if team ≥ 5 members); team member leaderboard (company name-privacy setting applies)
- **Fields:** Period; Challenge selector
- **Buttons:** Open team leaderboard; Challenge selector
- **Actions:** Show aggregated team data only
- **API Required:** GET /api/v1/me/team/summary?period=; GET /api/v1/me/team/leaderboard
- **Validation:** Visible only to the assigned Team Manager
- **Empty State:** 'Your team has no activity yet this week.'
- **Error State:** 'Couldn't load team data.' with Retry
- **Notes:** Phase: MVP. Features: FEAT-254, FEAT-156, FEAT-151, FEAT-269. Team Manager using the mobile app is an ASSUMPTION – TBC. Individual vs aggregated data for managers is TBC; no individual health metrics are shown beyond the normal leaderboard.


## MOD-25 Platform Admin Portal

### SCR-M-080 — Help & Support
- **User Role:** Employee, Team Manager
- **Purpose:** Help articles, support contact and (Phase 2) an in-app support request form.
- **Entry Point:** Settings 'Help & support'; error screens
- **Components:** FAQ list; contact support email; app version and device info; Phase 2: support request form and my requests
- **Fields:** Subject; Category; Description; Screenshot (Phase 2)
- **Buttons:** Contact support; Submit request (Phase 2)
- **Actions:** Open FAQ; email support; create support ticket (Phase 2)
- **API Required:** GET /api/v1/help/faqs; POST /api/v1/support/tickets (Phase 2)
- **Validation:** As FRM-68
- **Error State:** 'Couldn't send your request.'
- **Success State:** 'Request sent – we'll reply by email.'
- **Notes:** Phase: MVP. Features: FEAT-324, FEAT-035. App stores require a support contact. Support model (in-house tickets vs external helpdesk) is TBC.


## MOD-01 Platform Foundation & Multi-Tenancy

### SCR-M-081 — No Connection / Something Went Wrong
- **User Role:** Employee, Team Manager
- **Purpose:** Standard screen/banner for no internet, server errors and planned maintenance.
- **Entry Point:** Any screen when a request fails or maintenance mode is on
- **Components:** Illustration; message; Retry; offline banner variant for cached screens
- **Buttons:** Retry; Contact support
- **Actions:** Retry last request; show maintenance message from app config
- **API Required:** GET /api/v1/app/config (maintenance flag)
- **Error State:** 'You're offline. Some information may be out of date.'; 'Something went wrong. Please try again.'; 'HealthX is under maintenance until 02:00.'
- **Success State:** Returns to the previous screen when connection is restored
- **Notes:** Phase: MVP. Features: FEAT-010.

### SCR-M-082 — Access Blocked (Account Deactivated / Company Suspended)
- **User Role:** Employee, Team Manager
- **Purpose:** Explains why the user cannot use the app (account deactivated, company suspended, or module not in plan).
- **Entry Point:** Any API response indicating deactivated user or suspended company
- **Components:** Illustration; message; Sign out
- **Buttons:** Sign out; Contact HR
- **Actions:** Clear local session
- **Error State:** 'Your account is no longer active. Please contact your HR team.'; 'Your company's HealthX access is paused. Please contact your HR team.'
- **Notes:** Phase: MVP. Features: FEAT-246, FEAT-318, FEAT-310.


## MOD-02 Onboarding & Authentication

### SCR-M-083 — Enterprise SSO Sign-in
- **User Role:** Employee, Team Manager (new or signed-out user)
- **Purpose:** Sends employees of companies that require enterprise SSO to their corporate identity provider.
- **Entry Point:** Company Identification (company with SSO enforced)
- **Components:** Company logo; 'Continue with <Company> SSO'; secure browser sheet
- **Buttons:** Continue with SSO
- **Actions:** SAML 2.0 / OIDC sign-in; create or link account on first sign-in
- **API Required:** GET /api/v1/auth/sso/{org}/start; POST /api/v1/auth/sso/callback
- **Validation:** Company SSO must be configured and active
- **Error State:** 'Single sign-on failed. Contact your IT team.'
- **Success State:** Signed in
- **Notes:** Phase: Phase 3. Features: FEAT-026, FEAT-027.


## MOD-14 Rewards & Points Wallet

### SCR-M-084 — Reward Marketplace
- **User Role:** Employee, Team Manager
- **Purpose:** Partner rewards (vouchers, gift cards, fitness memberships, gym discounts, wellness products) delivered automatically by providers.
- **Entry Point:** Rewards tab 'Marketplace' (Phase 3)
- **Components:** Partner reward catalogue; provider badges; instant delivery labels
- **Buttons:** Reward card; Redeem
- **Actions:** Redeem through provider API with automatic delivery
- **API Required:** GET /api/v1/marketplace/rewards; POST /api/v1/marketplace/rewards/{id}/redeem
- **Empty State:** 'Marketplace rewards are coming soon.'
- **Error State:** 'Provider unavailable. Try again later.'
- **Success State:** 'Your voucher has been sent to your email.'
- **Notes:** Phase: Phase 3. Features: FEAT-184, FEAT-298. Main screen only – detailed design in Phase 3. Provider and funding model TBC.


## MOD-18 AI Wellness Coach & Insights

### SCR-M-085 — Personalised Recommendations (For You)
- **User Role:** Employee, Team Manager
- **Purpose:** AI-personalised suggestions for workouts, habits, challenges and content.
- **Entry Point:** Home / Feed 'For you' (Phase 3)
- **Components:** Recommendation cards with reason ('Because you prefer home workouts'); dismiss / not interested
- **Buttons:** Card tap; Not interested
- **Actions:** Show recommendations based on permitted data and AI-personalisation consent
- **API Required:** GET /api/v1/me/recommendations
- **Validation:** Requires AI-personalisation consent
- **Empty State:** 'Recommendations will appear as we learn your preferences.'
- **Error State:** 'Couldn't load recommendations.'
- **Notes:** Phase: Phase 3. Features: FEAT-230. Main screen only – detailed design in Phase 3.
