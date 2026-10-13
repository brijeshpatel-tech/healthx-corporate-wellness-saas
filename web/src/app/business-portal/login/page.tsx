"use client"

import Link from "next/link"
import { Suspense } from "react"
import { StaffLogin } from "@/components/auth/staff-login"
import { AuthLayout } from "@/components/shell/auth-layout"
import { businessAuthApi } from "@/lib/api/auth"
import { DEMO_ACCOUNTS } from "@/lib/mock/demo-accounts"

export default function BusinessLoginPage() {
  return (
    <AuthLayout
      productLabel="Business Portal"
      headline="A healthier, more engaged workplace — measured."
      points={["Launch challenges and wellness programs in minutes", "Reward healthy habits with points and perks", "Privacy-safe analytics on participation and engagement"]}
    >
      <Suspense>
        <StaffLogin
          portal="business"
          title="Sign in to your company"
          subtitle="Company Owners, HR Admins, Wellness Managers and Team Managers."
          login={businessAuthApi.login}
          verify={businessAuthApi.verifyMfa}
          demoAccounts={DEMO_ACCOUNTS.business}
          forgotHref="/business-portal/forgot-password"
          footer={
            <div className="space-y-1.5 text-center text-sm text-muted-foreground">
              <p>
                Invited as an administrator?{" "}
                <Link href="/business-portal/accept-invite?token=demo" className="font-medium text-primary hover:underline">
                  Set up your account
                </Link>
              </p>
              <p>
                New to HealthX?{" "}
                <Link href="/business-portal/signup" className="font-medium text-primary hover:underline">
                  Start a 30-day free trial
                </Link>
              </p>
            </div>
          }
        />
      </Suspense>
    </AuthLayout>
  )
}
