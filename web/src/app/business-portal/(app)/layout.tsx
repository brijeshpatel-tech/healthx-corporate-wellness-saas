import { AuthGuard } from "@/components/shell/auth-guard"
import { PortalShell } from "@/components/shell/portal-shell"

export default function BusinessAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portal="business">
      <PortalShell portal="business">{children}</PortalShell>
    </AuthGuard>
  )
}
