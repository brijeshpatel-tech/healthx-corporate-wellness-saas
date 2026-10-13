// AUTO-SYNCED from web/src/lib — edit in web/, then run npm run sync-shared
/** Demo identities shown on the sign-in pages (sample-data mode only). */

export const DEMO_COMPANY_ID = "org_nimbus"
export const DEMO_PASSWORD = "Demo@1234"

export const DEMO_ACCOUNTS = {
  platform: [
    { email: "arjun.nair@healthx.life", name: "Arjun Nair", role: "super_admin" as const, label: "Super Admin" },
    { email: "meera.joshi@healthx.life", name: "Meera Joshi", role: "support_admin" as const, label: "Support Admin" },
    { email: "kabir.sethi@healthx.life", name: "Kabir Sethi", role: "content_admin" as const, label: "Content Admin" },
  ],
  business: [
    { email: "ananya.iyer@nimbustech.in", name: "Ananya Iyer", role: "company_owner" as const, label: "Company Owner" },
    { email: "vikram.mehta@nimbustech.in", name: "Vikram Mehta", role: "hr_admin" as const, label: "HR Admin" },
    { email: "sneha.kapoor@nimbustech.in", name: "Sneha Kapoor", role: "wellness_manager" as const, label: "Wellness Manager" },
    { email: "rahul.verma@nimbustech.in", name: "Rahul Verma", role: "team_manager" as const, label: "Team Manager" },
  ],
  employee: [
    { email: "priya.sharma@nimbustech.in", name: "Priya Sharma", label: "Employee" },
    { email: "rahul.verma@nimbustech.in", name: "Rahul Verma", label: "Team Manager" },
    { email: "karan.malhotra@nimbustech.in", name: "Karan Malhotra", label: "New joiner (onboarding)" },
  ],
}

export const DEMO_INVITE_TOKEN = "NIMBUS-WELCOME-2026"

/** Any 6 digits work as a verification code in demo mode; this one simulates a wrong code. */
export const DEMO_WRONG_CODE = "000000"
export const DEMO_CODE = "123456"
