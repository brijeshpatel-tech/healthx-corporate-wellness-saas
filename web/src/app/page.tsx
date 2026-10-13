import { ArrowRight, Building2, Database, ShieldCheck, Smartphone } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/shell/theme-toggle"
import { env } from "@/config/env"

const APPS = [
  {
    href: "/admin-portal/login",
    path: "/admin-portal",
    title: "Platform Admin Portal",
    who: "HealthX internal team",
    description: "Companies, plans & subscriptions, global challenge templates, rewards, workouts, habits, wellness score, system settings and audit logs.",
    icon: ShieldCheck,
    color: "from-slate-700 to-slate-900",
  },
  {
    href: "/business-portal/login",
    path: "/business-portal",
    title: "Business Portal",
    who: "Company Owner · HR Admin · Wellness Manager · Team Manager",
    description: "Employees & teams, challenges, leaderboards, rewards & orders, announcements, programs and privacy-safe analytics — menus adapt to each role.",
    icon: Building2,
    color: "from-emerald-500 to-teal-600",
  },
  {
    href: "/employee-app/welcome",
    path: "/employee-app",
    title: "Employee App (web)",
    who: "Employees & Team Managers",
    description: "Wellness score, steps, water, workouts, habits, challenges, leaderboards, badges, points wallet and rewards — the web twin of the mobile app.",
    icon: Smartphone,
    color: "from-sky-500 to-indigo-600",
  },
]

export default function Home() {
  return (
    <div className="relative min-h-svh overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)] opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/10" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between p-5 sm:p-6">
        <Logo label="Business" />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-12 px-5 pt-8 pb-16 sm:px-6 sm:pt-14">
        <section className="max-w-3xl space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Corporate wellness platform
          </span>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-6xl">
            The operating system for <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">employee wellness</span>.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            One platform, three apps. Pick where you want to go — every app runs on localhost:3000 with its own sign-in.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {APPS.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group relative flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${app.color} text-white shadow-lg`}>
                <app.icon className="size-6" />
              </span>
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">{app.title}</h2>
                <p className="text-xs font-medium text-primary">{app.who}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t pt-4 text-sm">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{app.path}</code>
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        {env.useMock ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 sm:flex-row sm:items-center">
            <Database className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold">Running on built-in sample data</p>
              <p className="text-muted-foreground">
                No backend is configured yet. Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_BASE_URL</code> in <code className="rounded bg-muted px-1">.env.development</code> to connect a real API. Demo
                accounts are listed on each sign-in page.
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
