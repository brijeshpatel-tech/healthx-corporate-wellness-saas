import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "./theme-toggle"

/** Split-screen layout for sign-in, verification and invitation pages. */
export function AuthLayout({
  children,
  productLabel,
  headline,
  points,
  accent = "from-emerald-500 via-teal-500 to-sky-600",
}: {
  children: React.ReactNode
  productLabel: string
  headline: string
  points: string[]
  accent?: string
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_minmax(0,640px)]">
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-6">
          <Link href="/" aria-label="HealthX home">
            <Logo label={productLabel} />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-6">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="p-6 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} HealthX · Wellness, not medical advice.</p>
      </div>
      <aside className={`relative hidden overflow-hidden bg-gradient-to-br ${accent} lg:flex`}>
        <div className="bg-grid absolute inset-0 opacity-20" />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-end gap-8 p-12 text-white xl:p-16">
          <h2 className="max-w-md text-4xl leading-tight font-extrabold tracking-tight">{headline}</h2>
          <ul className="space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-base text-white/90">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
