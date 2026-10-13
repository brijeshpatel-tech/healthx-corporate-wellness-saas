"use client"

import { Suspense } from "react"
import { StaffLogin } from "@/components/auth/staff-login"
import { AuthLayout } from "@/components/shell/auth-layout"
import { adminAuthApi } from "@/lib/api/auth"
import { DEMO_ACCOUNTS } from "@/lib/mock/demo-accounts"

export default function AdminLoginPage() {
  return (
    <AuthLayout
      productLabel="Platform Admin"
      headline="Run the HealthX platform for every customer."
      points={["Onboard companies and manage subscriptions", "Curate challenges, rewards, workouts and habits", "Monitor platform KPIs, usage and audit trails"]}
      accent="from-slate-800 via-slate-900 to-emerald-900"
    >
      <Suspense>
        <StaffLogin
          portal="admin"
          title="Sign in to Platform Admin"
          subtitle="For the HealthX internal team. Two-step verification is required."
          login={adminAuthApi.login}
          verify={adminAuthApi.verifyMfa}
          demoAccounts={DEMO_ACCOUNTS.platform}
        />
      </Suspense>
    </AuthLayout>
  )
}
