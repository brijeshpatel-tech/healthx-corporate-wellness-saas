import { AuthGuard } from "@/components/shell/auth-guard"
import { EmployeeShell } from "@/components/shell/employee-shell"

export default function EmployeeAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portal="employee" requireOnboarding>
      <EmployeeShell>{children}</EmployeeShell>
    </AuthGuard>
  )
}
