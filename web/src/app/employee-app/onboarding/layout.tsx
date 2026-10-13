import { AuthGuard } from "@/components/shell/auth-guard"

/** Onboarding needs a session but not the signed-in shell (which would redirect back here). */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard portal="employee">{children}</AuthGuard>
}
