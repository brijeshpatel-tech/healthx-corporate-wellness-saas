import { cn } from "@/lib/utils"
import { titleCase } from "@/lib/format"

type Tone = "green" | "blue" | "amber" | "red" | "gray" | "violet" | "teal"

const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300",
  blue: "bg-sky-500/12 text-sky-700 ring-sky-600/20 dark:text-sky-300",
  amber: "bg-amber-500/15 text-amber-800 ring-amber-600/25 dark:text-amber-300",
  red: "bg-rose-500/12 text-rose-700 ring-rose-600/20 dark:text-rose-300",
  gray: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300",
  violet: "bg-violet-500/12 text-violet-700 ring-violet-600/20 dark:text-violet-300",
  teal: "bg-teal-500/12 text-teal-700 ring-teal-600/20 dark:text-teal-300",
}

/** Status → colour. Covers every status used across the platform. */
const STATUS_TONE: Record<string, Tone> = {
  // generic
  active: "green",
  published: "green",
  connected: "green",
  completed: "green",
  delivered: "green",
  paid: "green",
  accepted: "green",
  resolved: "green",
  sent: "green",
  approved: "teal",
  live: "green",
  // in progress
  scheduled: "blue",
  processing: "blue",
  shipped: "violet",
  registered: "blue",
  onboarding: "blue",
  trial: "violet",
  pending: "amber",
  pending_approval: "amber",
  invited: "amber",
  due: "amber",
  open: "amber",
  draft: "gray",
  // problems
  inactive: "gray",
  disconnected: "gray",
  archived: "gray",
  closed: "gray",
  out_of_stock: "amber",
  expired: "gray",
  coming_soon: "gray",
  not_available: "gray",
  cancelled: "red",
  rejected: "red",
  suspended: "red",
  deactivated: "red",
  disabled: "red",
  overdue: "red",
  past_due: "red",
  error: "red",
  failed: "red",
  revoked: "red",
  void: "gray",
  paused: "gray",
  // priorities / severities
  low: "gray",
  medium: "blue",
  high: "amber",
  urgent: "red",
  info: "blue",
  warning: "amber",
  critical: "red",
}

const LABELS: Record<string, string> = {
  pending_approval: "Pending approval",
  out_of_stock: "Out of stock",
  past_due: "Past due",
  coming_soon: "Coming soon",
  not_available: "Not available",
}

export function StatusBadge({
  status,
  label,
  tone,
  dot = true,
  className,
}: {
  status: string
  label?: string
  tone?: Tone
  dot?: boolean
  className?: string
}) {
  const t = tone ?? STATUS_TONE[status] ?? "gray"
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASS[t],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" /> : null}
      {label ?? LABELS[status] ?? titleCase(status)}
    </span>
  )
}

/**
 * Release-phase tag. Hidden on request (13 Oct 2026): screens no longer show "Phase 2/3" labels.
 * Kept as a no-op so existing usages compile; phase info stays in docs/SCOPE.md.
 */
export function PhaseBadge(_props: { phase: 2 | 3; className?: string }) {
  void _props
  return null
}
