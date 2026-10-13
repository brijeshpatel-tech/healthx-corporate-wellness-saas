import { AuthGuard } from "@/components/shell/auth-guard"
import { PortalShell } from "@/components/shell/portal-shell"

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portal="admin">
      <PortalShell portal="admin">{children}</PortalShell>
    </AuthGuard>
  )
}
