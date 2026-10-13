import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { cn } from "@/lib/utils"

export type IllustrationTone = "emerald" | "amber" | "rose" | "sky" | "slate" | "violet"

const GRADIENT: Record<IllustrationTone, { circle: string; glow: string; ring: string }> = {
  emerald: { circle: "from-emerald-400 to-teal-600 shadow-emerald-500/30", glow: "from-emerald-500/15", ring: "bg-emerald-500" },
  amber: { circle: "from-amber-400 to-orange-500 shadow-amber-500/30", glow: "from-amber-500/15", ring: "bg-amber-500" },
  rose: { circle: "from-rose-400 to-red-600 shadow-rose-500/30", glow: "from-rose-500/15", ring: "bg-rose-500" },
  sky: { circle: "from-sky-400 to-indigo-600 shadow-sky-500/30", glow: "from-sky-500/15", ring: "bg-sky-500" },
  slate: { circle: "from-slate-400 to-slate-600 shadow-slate-500/30", glow: "from-slate-500/15", ring: "bg-slate-500" },
  violet: { circle: "from-violet-400 to-fuchsia-600 shadow-violet-500/30", glow: "from-violet-500/15", ring: "bg-violet-500" },
}

/** Large icon in a gradient circle with soft rings — the "illustration" of full-screen states. */
export function StateIllustration({ icon: Icon, tone = "emerald", className }: { icon: LucideIcon; tone?: IllustrationTone; className?: string }) {
  const g = GRADIENT[tone]
  return (
    <div className={cn("relative flex size-40 items-center justify-center", className)} aria-hidden>
      <span className={cn("absolute inset-0 rounded-full opacity-[0.07]", g.ring)} />
      <span className={cn("absolute inset-5 rounded-full opacity-[0.12]", g.ring)} />
      <span className={cn("relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-xl", g.circle)}>
        <Icon className="size-11" strokeWidth={1.75} />
      </span>
    </div>
  )
}

/**
 * Full-screen, centred, branded layout for screens outside the signed-in shell
 * (offline, blocked, not found). Mobile-first, works up to desktop.
 */
export function StandaloneScreen({
  icon,
  tone = "emerald",
  eyebrow,
  title,
  message,
  children,
  footer,
  logoHref = "/employee-app/home",
}: {
  icon: LucideIcon
  tone?: IllustrationTone
  eyebrow?: React.ReactNode
  title: React.ReactNode
  message?: React.ReactNode
  /** Actions and extra content under the message. */
  children?: React.ReactNode
  footer?: React.ReactNode
  logoHref?: string
}) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b via-transparent to-transparent", GRADIENT[tone].glow)} />
      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center justify-between px-5 pt-5">
        <Link href={logoHref} aria-label="HealthX home">
          <Logo size="sm" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <StateIllustration icon={icon} tone={tone} />
        <div className="mt-6 space-y-2">
          {eyebrow ? <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{eyebrow}</p> : null}
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{title}</h1>
          {message ? <p className="text-base text-pretty text-muted-foreground">{message}</p> : null}
        </div>
        {children ? <div className="mt-8 flex w-full flex-col gap-3">{children}</div> : null}
      </main>
      <footer className="relative z-10 mx-auto w-full max-w-md px-5 pb-6 text-center text-xs text-muted-foreground">
        {footer ?? (
          <>
            Need help? Email{" "}
            <a href="mailto:support@healthx.life" className="font-medium text-primary underline-offset-4 hover:underline">
              support@healthx.life
            </a>
          </>
        )}
      </footer>
    </div>
  )
}
