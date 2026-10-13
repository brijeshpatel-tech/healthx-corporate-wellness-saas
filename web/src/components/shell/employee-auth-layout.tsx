import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"

/** Mobile-first layout for the employee app's sign-in and onboarding screens. */
export function EmployeeAuthLayout({
  children,
  step,
  totalSteps,
  className,
}: {
  children: React.ReactNode
  /** Onboarding progress (1-based). */
  step?: number
  totalSteps?: number
  className?: string
}) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/15 via-teal-500/5 to-transparent" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pt-5">
        <Link href="/employee-app/welcome" aria-label="HealthX">
          <Logo size="sm" />
        </Link>
        <ThemeToggle />
      </header>
      {step && totalSteps ? (
        <div className="relative z-10 mx-auto mt-5 flex w-full max-w-md gap-1.5 px-5" aria-label={`Step ${step} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full bg-muted transition-colors", i < step && "bg-primary")} />
          ))}
        </div>
      ) : null}
      <main className={cn("relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-8 pb-10", className)}>{children}</main>
    </div>
  )
}
