# Roles & permissions (sheet 09)

Rule: no company role ever sees individual health data — only aggregates.

| Role | Module | View | Create | Edit | Delete | Approve | Export | Manage Users | Settings | Reports | Other | Platform |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Platform Super Admin | MOD-02 Onboarding & Authentication | Yes | No | No | No | N/A | No | Yes | Yes | No | Resend invitations; revoke a user's sessions; set up enterprise SSO for a company (Phase 3, TBC) | Platform Admin (Web) |
| Platform Super Admin | MOD-03 Employee Profile & Preferences | Yes | No | No | No | N/A | No | Yes | N/A | No | No access to the wellness profile | Platform Admin (Web) |
| Platform Super Admin | MOD-04 Home Dashboard & Wellness Score | No | N/A | Yes | N/A | N/A | No | N/A | Yes | Yes | Change score weights (must total 100%); version history kept | Platform Admin (Web) |
| Platform Super Admin | MOD-05 to MOD-10 Individual tracking data (activity, water, sleep, workouts done, nutrition, habits) | No | No | No | No | N/A | No | N/A | N/A | No | Support access to an individual's data only with the employee's consent and a recorded reason – TBC | Platform Admin (Web) |
| Platform Super Admin | MOD-08 Workout Module | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | Publish/unpublish workouts; manage categories and equipment/muscle-group lists | Platform Admin (Web) |
| Platform Super Admin | MOD-09 Nutrition Module (Phase 2) | Yes | TBC | TBC | TBC | N/A | No | N/A | TBC | No | - | Platform Admin (Web) |
| Platform Super Admin | MOD-10 Habit Tracker | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | Deactivate habits so they stop appearing for new selection | Platform Admin (Web) |
| Platform Super Admin | MOD-11 Wellness Challenges | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | View company challenges read-only for support – TBC | Platform Admin (Web) |
| Platform Super Admin | MOD-13 Gamification Engine (Points, Streaks & Badges) | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | Manual points adjustment with a reason (Phase 2); deactivate badges | Platform Admin (Web) |
| Platform Super Admin | MOD-14 Rewards & Points Wallet | Yes | Yes | Yes | Yes | TBC | TBC | N/A | Yes | Yes | Fulfil, cancel and refund orders for HealthX-catalogue rewards – TBC | Platform Admin (Web) |
| Platform Super Admin | MOD-15 Corporate Wellness Programs (Phase 2) | Yes | Yes | Yes | Yes | N/A | No | N/A | N/A | Yes | - | Platform Admin (Web) |
| Platform Super Admin | MOD-16 Announcements & Notifications | Yes | Yes | Yes | No | N/A | No | N/A | Yes | No | Platform-wide service messages to all users – TBC | Platform Admin (Web) |
| Platform Super Admin | MOD-17 Wellness Feed & Content (Phase 2) | Yes | Yes | Yes | Yes | TBC | No | N/A | Yes | Yes | Publish / archive content | Platform Admin (Web) |
| Platform Super Admin | MOD-18 AI Wellness Coach & Insights (Phase 2) | No | N/A | N/A | N/A | N/A | No | N/A | Yes | Yes | No access to AI conversation content | Platform Admin (Web) |
| Platform Super Admin | MOD-19 Business Portal — Organisation & People | Yes | TBC | TBC | No | N/A | No | Yes | TBC | No | Creates the company and invites its Company Owner (see MOD-25) | Platform Admin (Web) |
| Platform Super Admin | MOD-20 Business Portal — Analytics & Reporting | Company (aggregated) | N/A | N/A | N/A | N/A | TBC | N/A | N/A | Company (aggregated) | - | Platform Admin (Web) |
| Platform Super Admin | MOD-21 Privacy & Consent Management | TBC | Yes | Yes | No | N/A | TBC | N/A | Yes | No | Oversees automated account-deletion and data-export processing | Platform Admin (Web) |
| Platform Super Admin | MOD-22 Integrations | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | Cannot read employees' synced health data | Platform Admin (Web) |
| Platform Super Admin | MOD-23 White Label (Phase 3) | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | No | Manage branded app-store builds (Phase 3) | Platform Admin (Web) |
| Platform Super Admin | MOD-24 Subscription & Billing | Yes | Yes | Yes | Yes | N/A | Yes | N/A | Yes | Yes | Assign plans; change subscription status; switch modules on/off per company; issue/void invoices (Phase 2) | Platform Admin (Web) |
| Platform Super Admin | MOD-25 Platform Admin Portal | Yes | Yes | Yes | TBC | N/A | TBC | Yes | Yes | Yes | Suspend/reactivate companies; manage HealthX staff admins; view platform audit logs; handle support requests (Phase 2, TBC) | Platform Admin (Web) |
| Platform Super Admin | MOD-26 Product KPIs & Success Metrics | Yes | N/A | N/A | N/A | N/A | Yes | N/A | N/A | Yes | Filter by company and period | Platform Admin (Web) |
| Company Owner | MOD-02 to MOD-18 Employee App features (own data) | Own | Own | Own | Own | N/A | Own | No | Own | Own | Joins challenges, earns points and redeems rewards like any employee | Mobile App (iOS/Android) |
| Company Owner | MOD-02 Onboarding & Authentication | Own | N/A | Own | N/A | N/A | N/A | No | TBC | No | Set up company enterprise SSO (Phase 3, TBC) | Business Portal (Web) |
| Company Owner | MOD-04 Home Dashboard & Wellness Score | Company (aggregated) | N/A | TBC | N/A | N/A | No | N/A | TBC | Company (aggregated) | - | Business Portal (Web) |
| Company Owner | MOD-05 to MOD-10 Individual tracking data (activity, water, sleep, workouts done, nutrition, habits) | No | No | No | No | N/A | No | N/A | N/A | Company (aggregated) | Leaderboard values are the only individual totals visible, under the company's name-privacy setting | Business Portal (Web) |
| Company Owner | MOD-11 Wellness Challenges | Yes | Yes | Yes | Yes | N/A | TBC | N/A | Yes | Company (aggregated) | Set challenge points and attach rewards; view challenge results | Business Portal (Web) |
| Company Owner | MOD-12 Leaderboards | Yes | N/A | N/A | N/A | N/A | No | N/A | Yes | Yes | Allow employees to opt out of named display – TBC | Business Portal (Web) |
| Company Owner | MOD-13 Gamification Engine (Points, Streaks & Badges) | Company (aggregated) | No | TBC | No | N/A | No | N/A | TBC | Company (aggregated) | Manual points adjustment with a reason (Phase 2) – TBC | Business Portal (Web) |
| Company Owner | MOD-14 Rewards & Points Wallet | Yes | Yes | Yes | Yes | TBC | TBC | N/A | Yes | Company (aggregated) | Fulfil orders (voucher code, delivery details); cancel orders with points refund | Business Portal (Web) |
| Company Owner | MOD-15 Corporate Wellness Programs (Phase 2) | Yes | TBC | TBC | TBC | N/A | TBC | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| Company Owner | MOD-16 Announcements & Notifications | Yes | TBC | TBC | TBC | N/A | No | N/A | Yes | Company (aggregated) | - | Business Portal (Web) |
| Company Owner | MOD-17 Wellness Feed & Content (Phase 2) | Yes | TBC | TBC | TBC | N/A | No | N/A | N/A | No | - | Business Portal (Web) |
| Company Owner | MOD-18 AI Wellness Coach & Insights (Phase 2) | No | N/A | N/A | N/A | N/A | No | N/A | TBC | No | No access to individual AI content | Business Portal (Web) |
| Company Owner | MOD-19 Business Portal — Organisation & People | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Yes | Manage administrators (HR Admin, Wellness Manager, Team Manager roles); configure branding (logo, colours); view company audit log (Phase 2) | Business Portal (Web) |
| Company Owner | MOD-20 Business Portal — Analytics & Reporting | Company (aggregated) | N/A | N/A | N/A | N/A | Company (aggregated) | N/A | N/A | Company (aggregated) | Groups smaller than the minimum size (5 – RECOMMENDED, TBC) are hidden | Business Portal (Web) |
| Company Owner | MOD-21 Privacy & Consent Management | Company (aggregated) | No | No | No | N/A | No | N/A | Yes | Company (aggregated) | Cannot view individual consent records or health data; sets leaderboard name privacy (see MOD-12) | Business Portal (Web) |
| Company Owner | MOD-22 Integrations | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Yes | Run HRMS sync; view sync history and errors | Business Portal (Web) |
| Company Owner | MOD-23 White Label (Phase 3) | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | No | Custom domain and app name set up together with HealthX (Phase 3) | Business Portal (Web) |
| Company Owner | MOD-24 Subscription & Billing | Yes | No | No | No | N/A | Yes | N/A | No | No | Pay invoices online – TBC | Business Portal (Web) |
| Company Owner | MOD-26 Product KPIs & Success Metrics | Company (aggregated) | N/A | N/A | N/A | N/A | Company (aggregated) | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| HR Admin | MOD-02 to MOD-18 Employee App features (own data) | Own | Own | Own | Own | N/A | Own | No | Own | Own | Joins challenges, earns points and redeems rewards like any employee | Mobile App (iOS/Android) |
| HR Admin | MOD-05 to MOD-10 Individual tracking data (activity, water, sleep, workouts done, nutrition, habits) | No | No | No | No | N/A | No | N/A | N/A | Company (aggregated) | Leaderboard values are the only individual totals visible, under the company's name-privacy setting | Business Portal (Web) |
| HR Admin | MOD-11 Wellness Challenges | Yes | Yes | Yes | Yes | N/A | TBC | N/A | Yes | Company (aggregated) | Set challenge points and attach rewards | Business Portal (Web) |
| HR Admin | MOD-12 Leaderboards | Yes | N/A | N/A | N/A | N/A | No | N/A | No | Yes | - | Business Portal (Web) |
| HR Admin | MOD-13 Gamification Engine (Points, Streaks & Badges) | Company (aggregated) | No | No | No | N/A | No | N/A | No | Company (aggregated) | Manual points adjustment with a reason (Phase 2) – TBC | Business Portal (Web) |
| HR Admin | MOD-14 Rewards & Points Wallet | Yes | No | No | No | TBC | TBC | N/A | No | Company (aggregated) | Fulfil orders; cancel with points refund – TBC | Business Portal (Web) |
| HR Admin | MOD-15 Corporate Wellness Programs (Phase 2) | Yes | Yes | Yes | Yes | N/A | TBC | N/A | N/A | Company (aggregated) | Publish programs; start from templates | Business Portal (Web) |
| HR Admin | MOD-16 Announcements & Notifications | Yes | Yes | Yes | Yes | N/A | No | N/A | Yes | Company (aggregated) | Cancel scheduled announcements; see reach statistics (Phase 2) | Business Portal (Web) |
| HR Admin | MOD-17 Wellness Feed & Content (Phase 2) | Yes | TBC | TBC | TBC | N/A | No | N/A | N/A | No | - | Business Portal (Web) |
| HR Admin | MOD-19 Business Portal — Organisation & People | Yes | Yes | Yes | Yes | N/A | Yes | Yes | No | Yes | Resend/revoke invitations; view employee details without health data | Business Portal (Web) |
| HR Admin | MOD-20 Business Portal — Analytics & Reporting | Company (aggregated) | N/A | N/A | N/A | N/A | Company (aggregated) | N/A | N/A | Company (aggregated) | Monthly report (Phase 2) | Business Portal (Web) |
| HR Admin | MOD-21 Privacy & Consent Management | Company (aggregated) | No | No | No | N/A | No | N/A | No | Company (aggregated) | Cannot view individual consent records or health data | Business Portal (Web) |
| HR Admin | MOD-22 Integrations | Yes | Yes | Yes | TBC | N/A | No | N/A | Yes | Yes | Run sync now; view sync errors | Business Portal (Web) |
| HR Admin | MOD-26 Product KPIs & Success Metrics | Company (aggregated) | N/A | N/A | N/A | N/A | Company (aggregated) | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| Wellness Manager | MOD-02 to MOD-18 Employee App features (own data) | Own | Own | Own | Own | N/A | Own | No | Own | Own | Joins challenges, earns points and redeems rewards like any employee | Mobile App (iOS/Android) |
| Wellness Manager | MOD-05 to MOD-10 Individual tracking data (activity, water, sleep, workouts done, nutrition, habits) | No | No | No | No | N/A | No | N/A | N/A | Company (aggregated) | Leaderboard values are the only individual totals visible, under the company's name-privacy setting | Business Portal (Web) |
| Wellness Manager | MOD-08 Workout Module | Yes | TBC | TBC | TBC | N/A | No | N/A | TBC | No | May also cover habits or custom challenge activities – TBC | Business Portal (Web) |
| Wellness Manager | MOD-11 Wellness Challenges | Yes | Yes | Yes | Yes | N/A | TBC | N/A | Yes | Company (aggregated) | Set challenge points and attach rewards | Business Portal (Web) |
| Wellness Manager | MOD-12 Leaderboards | Yes | N/A | N/A | N/A | N/A | No | N/A | No | Yes | - | Business Portal (Web) |
| Wellness Manager | MOD-14 Rewards & Points Wallet | Yes | TBC | TBC | TBC | TBC | No | N/A | No | Company (aggregated) | - | Business Portal (Web) |
| Wellness Manager | MOD-15 Corporate Wellness Programs (Phase 2) | Yes | Yes | Yes | Yes | N/A | TBC | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| Wellness Manager | MOD-16 Announcements & Notifications | Yes | TBC | TBC | TBC | N/A | No | N/A | No | No | - | Business Portal (Web) |
| Wellness Manager | MOD-17 Wellness Feed & Content (Phase 2) | Yes | Yes | Yes | Yes | TBC | No | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| Wellness Manager | MOD-19 Business Portal — Organisation & People | Yes | No | No | No | N/A | No | No | No | No | Select participants (department, team, selected employees) | Business Portal (Web) |
| Wellness Manager | MOD-20 Business Portal — Analytics & Reporting | Company (aggregated) | N/A | N/A | N/A | N/A | TBC | N/A | N/A | Company (aggregated) | - | Business Portal (Web) |
| Wellness Manager | MOD-21 Privacy & Consent Management | Company (aggregated) | No | No | No | N/A | No | N/A | No | Company (aggregated) | Cannot view individual consent records or health data | Business Portal (Web) |
| Team Manager | MOD-02 to MOD-18 Employee App features (own data) | Own | Own | Own | Own | N/A | Own | No | Own | Own | - | Mobile App (iOS/Android) |
| Team Manager | MOD-11 Wellness Challenges | Yes | No | No | No | N/A | No | No | No | Team (aggregated) | Join/leave challenges (own participation) | Mobile App – 'My Team' area (ASSUMPTION – TBC) |
| Team Manager | MOD-12 Leaderboards | Yes | N/A | N/A | N/A | N/A | No | N/A | No | Team (aggregated) | - | Mobile App – 'My Team' area (ASSUMPTION – TBC) |
| Team Manager | MOD-19 Business Portal — Organisation & People | Team (aggregated) | No | No | No | N/A | No | No | No | Team (aggregated) | Only for teams they are assigned to | Mobile App – 'My Team' area (ASSUMPTION – TBC) |
| Team Manager | MOD-05 to MOD-10 Individual tracking data (activity, water, sleep, workouts done, nutrition, habits) | TBC | No | No | No | N/A | No | N/A | N/A | Team (aggregated) | - | Mobile App – 'My Team' area (ASSUMPTION – TBC) |
| Team Manager | MOD-16 Announcements & Notifications | Own | TBC | No | No | N/A | No | N/A | Own | No | - | Mobile App – 'My Team' area (ASSUMPTION – TBC) |
| Employee | MOD-02 Onboarding & Authentication | Own | Own | Own | Own | N/A | N/A | No | Own | N/A | Accept Terms of Use and Privacy Policy | Mobile App (iOS/Android) |
| Employee | MOD-03 Employee Profile & Preferences | Own | Own | Own | Own | N/A | Own | No | Own | N/A | - | Mobile App (iOS/Android) |
| Employee | MOD-04 Home Dashboard & Wellness Score | Own | N/A | N/A | N/A | N/A | No | No | No | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-05 Activity & Steps Tracking | Own | Own | No | Own | N/A | No | No | Own | Own | Only manual entries can be deleted | Mobile App (iOS/Android) |
| Employee | MOD-06 Water / Hydration Tracking | Own | Own | Own | Own | N/A | No | No | Own | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-07 Sleep Tracking (Phase 2) | Own | Own | No | Own | N/A | No | No | Own | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-08 Workout Module | Yes | Own | Own | No | N/A | No | No | No | Own | Pause, resume or end a workout early | Mobile App (iOS/Android) |
| Employee | MOD-09 Nutrition Module (Phase 2) | Own | Own | Own | Own | N/A | No | No | No | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-10 Habit Tracker | Own | Own | Own | Own | N/A | No | No | Own | Own | Custom habits – TBC (Phase 2) | Mobile App (iOS/Android) |
| Employee | MOD-11 Wellness Challenges | Yes | No | No | No | N/A | No | No | No | Own | Join challenge (own participation); custom-metric check-ins; leave challenge (RECOMMENDED) | Mobile App (iOS/Android) |
| Employee | MOD-12 Leaderboards | Yes | N/A | N/A | N/A | N/A | No | No | TBC | Own | Opt out of named display – TBC | Mobile App (iOS/Android) |
| Employee | MOD-13 Gamification Engine (Points, Streaks & Badges) | Own | N/A | N/A | N/A | N/A | No | No | No | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-14 Rewards & Points Wallet | Yes | Own | No | No | N/A | No | No | No | Own | Redeem points (creates own order) | Mobile App (iOS/Android) |
| Employee | MOD-15 Corporate Wellness Programs (Phase 2) | Yes | Own | No | No | N/A | No | No | No | Own | - | Mobile App (iOS/Android) |
| Employee | MOD-16 Announcements & Notifications | Own | N/A | N/A | N/A | N/A | No | No | Own | No | Mark notifications as read | Mobile App (iOS/Android) |
| Employee | MOD-17 Wellness Feed & Content (Phase 2) | Yes | No | No | No | N/A | No | No | No | No | Save content to view later (RECOMMENDED) | Mobile App (iOS/Android) |
| Employee | MOD-18 AI Wellness Coach & Insights (Phase 2) | Own | Own | N/A | Own | N/A | No | No | Own | Own | Delete own conversations | Mobile App (iOS/Android) |
| Employee | MOD-21 Privacy & Consent Management | Own | Own | Own | N/A | N/A | Own | No | Own | N/A | Request account deletion; download own data (Phase 2) | Mobile App (iOS/Android) |
| Employee | MOD-22 Integrations | Own | Own | N/A | Own | N/A | No | No | Own | N/A | - | Mobile App (iOS/Android) |
| Company Leadership (stakeholder – role TBC) | MOD-20 Business Portal — Analytics & Reporting | Company (aggregated) | No | No | No | N/A | TBC | No | No | Company (aggregated) | Location comparison needs a Location structure (TBC) | Business Portal (Web) – TBC |
| Company Leadership (stakeholder – role TBC) | MOD-15 Corporate Wellness Programs (Phase 2) | Company (aggregated) | No | No | No | N/A | TBC | No | No | TBC | Program ROI view (Phase 3, TBC) | Business Portal (Web) – TBC |
| Company Leadership (stakeholder – role TBC) | MOD-26 Product KPIs & Success Metrics | Company (aggregated) | No | No | No | N/A | TBC | No | No | Company (aggregated) | - | Business Portal (Web) – TBC |