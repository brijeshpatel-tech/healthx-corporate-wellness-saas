import { Headset, Library, ShieldCheck, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { PlatformRole } from "@/lib/types"
import { cn } from "@/lib/utils"

/** What each HealthX staff role can access (mirrors ADMIN_NAV + ADMIN_PERMISSIONS). */
export const ROLE_INFO: Record<PlatformRole, { label: string; summary: string; access: string[]; icon: LucideIcon; tone: string }> = {
  super_admin: {
    label: "Super Admin",
    summary: "Full access: companies, plans, billing, settings and admin users.",
    access: ["Companies, plans & subscriptions", "Revenue & invoices", "Points rules, wellness score, system & AI settings", "HealthX admin users"],
    icon: ShieldCheck,
    tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
  support_admin: {
    label: "Support Admin",
    summary: "Helps customers: companies, users, subscriptions (view only), orders, support and audit logs.",
    access: ["Companies (support actions)", "Users: resend invitations, sign out, deactivate", "Subscriptions (view only)", "Redemption orders, support tickets, audit logs"],
    icon: Headset,
    tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  content_admin: {
    label: "Content Admin",
    summary: "Manages the global catalogue: challenge templates, rewards, badges, workouts, habits and content.",
    access: ["Challenge & program templates", "Rewards catalogue and badges", "Workouts, exercises and habits", "Content library"],
    icon: Library,
    tone: "bg-amber-500/14 text-amber-700 dark:text-amber-300",
  },
}

export function RoleBadge({ role, className }: { role: PlatformRole; className?: string }) {
  const info = ROLE_INFO[role]
  return <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap", info.tone, className)}>{info.label}</span>
}

/** Three cards explaining what each role can access. */
export function RoleDescriptions({ counts }: { counts?: Partial<Record<PlatformRole, number>> }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {(Object.keys(ROLE_INFO) as PlatformRole[]).map((r) => {
        const info = ROLE_INFO[r]
        const Icon = info.icon
        return (
          <Card key={r} className="gap-0 py-0">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <span className={cn("flex size-9 items-center justify-center rounded-xl", info.tone)}>
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-heading font-semibold">{info.label}</div>
                  {counts ? <div className="text-xs text-muted-foreground">{formatNumber(counts[r] ?? 0)} active</div> : null}
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {info.access.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-current" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
