import { AuthGuard } from "@/components/shell/auth-guard"

/** Terms acceptance happens after sign-in, before onboarding / Home. */
export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard portal="employee">{children}</AuthGuard>
}
