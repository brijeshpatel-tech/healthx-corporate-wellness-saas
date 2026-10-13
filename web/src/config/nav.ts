/**
 * Navigation for the three web apps. The same config drives:
 *  - the sidebar / bottom tabs (items filtered by role)
 *  - the command palette (Ctrl/⌘ + K)
 *  - route protection: a page is allowed only for the roles of its nav item
 *    (longest matching href wins; pages not in the nav are allowed for everyone signed in).
 */
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  CalendarOff,
  CircleHelp,
  ClipboardCheck,
  Bell,
  Bot,
  Building2,
  CalendarRange,
  ChartLine,
  Coins,
  CreditCard,
  Droplets,
  Dumbbell,
  FileBarChart,
  Footprints,
  Gauge,
  Gift,
  HeartPulse,
  Home,
  IndianRupee,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPin,
  Medal,
  Megaphone,
  Moon,
  MousePointerClick,
  Network,
  Newspaper,
  Package,
  Palette,
  PersonStanding,
  RefreshCw,
  Plug,
  ScrollText,
  Settings,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Utensils,
  Wallet,
  Webhook,
} from "lucide-react"
import type { BusinessRole, EmployeeAppRole, PlatformRole } from "@/lib/types"

export interface NavItem<R extends string = string> {
  title: string
  href: string
  icon: LucideIcon
  /** Roles that can see and open this page. Omit = everyone. */
  roles?: R[]
  /** Planned for a later release (shown with a tag). */
  phase?: 2 | 3
  /** Short description for the command palette. */
  description?: string
}

export interface NavGroup<R extends string = string> {
  label: string
  items: NavItem<R>[]
}

// ─── Platform Admin Portal ──────────────────────────────────────────────

const SA: PlatformRole[] = ["super_admin"]
const SA_SUP: PlatformRole[] = ["super_admin", "support_admin"]
const SA_CON: PlatformRole[] = ["super_admin", "content_admin"]

export const ADMIN_NAV: NavGroup<PlatformRole>[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin-portal/dashboard", icon: LayoutDashboard },
      { title: "Analytics & KPIs", href: "/admin-portal/analytics", icon: ChartLine },
    ],
  },
  {
    label: "Customers",
    items: [
      { title: "Companies", href: "/admin-portal/companies", icon: Building2, roles: SA_SUP },
      { title: "Users", href: "/admin-portal/users", icon: Users, roles: SA_SUP },
      { title: "Plans", href: "/admin-portal/plans", icon: Layers, roles: SA },
      { title: "Subscriptions", href: "/admin-portal/subscriptions", icon: CreditCard, roles: SA_SUP },
      { title: "Revenue & invoices", href: "/admin-portal/revenue", icon: IndianRupee, roles: SA, phase: 2 },
      { title: "Support tickets", href: "/admin-portal/support", icon: LifeBuoy, roles: SA_SUP },
      { title: "Help centre", href: "/admin-portal/help-centre", icon: BookOpen, roles: [...SA_SUP, "content_admin"] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { title: "Challenge templates", href: "/admin-portal/challenge-templates", icon: Trophy, roles: SA_CON },
      { title: "Rewards catalogue", href: "/admin-portal/rewards", icon: Gift, roles: SA_CON },
      { title: "Redemption orders", href: "/admin-portal/orders", icon: Package, roles: SA_SUP },
      { title: "Badges", href: "/admin-portal/badges", icon: Award, roles: SA_CON },
      { title: "Points rules", href: "/admin-portal/points-rules", icon: Coins, roles: SA },
      { title: "Program templates", href: "/admin-portal/program-templates", icon: CalendarRange, roles: SA_CON, phase: 2 },
    ],
  },
  {
    label: "Wellness content",
    items: [
      { title: "Workouts", href: "/admin-portal/workouts", icon: Dumbbell, roles: SA_CON },
      { title: "Exercises", href: "/admin-portal/exercises", icon: PersonStanding, roles: SA_CON },
      { title: "Habit library", href: "/admin-portal/habits", icon: ListChecks, roles: SA_CON },
      { title: "Content library", href: "/admin-portal/content", icon: Newspaper, roles: SA_CON, phase: 2 },
      { title: "Wellness score", href: "/admin-portal/wellness-score", icon: Gauge, roles: SA },
    ],
  },
  {
    label: "Platform",
    items: [
      { title: "HealthX admins", href: "/admin-portal/admins", icon: ShieldCheck, roles: SA },
      { title: "System configuration", href: "/admin-portal/settings", icon: Settings2, roles: SA },
      { title: "AI configuration", href: "/admin-portal/ai", icon: Sparkles, roles: SA, phase: 2 },
      { title: "Feature usage", href: "/admin-portal/feature-usage", icon: MousePointerClick, roles: SA, phase: 2 },
      { title: "API usage", href: "/admin-portal/api-usage", icon: Webhook, roles: SA, phase: 2 },
      { title: "System health", href: "/admin-portal/system-health", icon: Activity, roles: SA, phase: 2 },
      { title: "Audit logs", href: "/admin-portal/audit-logs", icon: ScrollText, roles: SA_SUP },
    ],
  },
]

// ─── Business Portal ────────────────────────────────────────────────────

const O: BusinessRole = "company_owner"
const H: BusinessRole = "hr_admin"
const W: BusinessRole = "wellness_manager"
const T: BusinessRole = "team_manager"

export const BUSINESS_NAV: NavGroup<BusinessRole>[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/business-portal/dashboard", icon: LayoutDashboard },
      { title: "My team", href: "/business-portal/my-team", icon: UsersRound, roles: [T] },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Employees", href: "/business-portal/employees", icon: Users, roles: [O, H] },
      { title: "Departments", href: "/business-portal/departments", icon: Network, roles: [O, H] },
      { title: "Teams", href: "/business-portal/teams", icon: UsersRound, roles: [O, H] },
      { title: "Locations", href: "/business-portal/locations", icon: MapPin, roles: [O, H], phase: 2 },
      { title: "Administrators", href: "/business-portal/administrators", icon: UserCog, roles: [O] },
      { title: "Tracker & sync", href: "/business-portal/sync-status", icon: RefreshCw, roles: [O, H] },
    ],
  },
  {
    label: "Engagement",
    items: [
      { title: "Challenges", href: "/business-portal/challenges", icon: Trophy, roles: [O, H, W, T] },
      { title: "Leaderboards", href: "/business-portal/leaderboards", icon: Medal },
      { title: "Announcements", href: "/business-portal/announcements", icon: Megaphone, roles: [O, H, W] },
      { title: "Activity review", href: "/business-portal/activity-review", icon: ClipboardCheck, roles: [O, H, W] },
      { title: "Workouts", href: "/business-portal/workouts", icon: Dumbbell, roles: [O, W], phase: 2 },
      { title: "Wellness programs", href: "/business-portal/programs", icon: CalendarRange, roles: [O, H, W], phase: 2 },
      { title: "Content library", href: "/business-portal/content", icon: Newspaper, roles: [O, W], phase: 2 },
    ],
  },
  {
    label: "Rewards",
    items: [
      { title: "Rewards", href: "/business-portal/rewards", icon: Gift, roles: [O] },
      { title: "Redemption orders", href: "/business-portal/orders", icon: Package, roles: [O, H] },
      { title: "Points", href: "/business-portal/points", icon: Coins, roles: [O, H], phase: 2 },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", href: "/business-portal/analytics", icon: BarChart3, roles: [O, H, W] },
      { title: "Monthly report", href: "/business-portal/reports", icon: FileBarChart, roles: [O, H], phase: 2 },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Organisation profile", href: "/business-portal/settings/organisation", icon: Building2, roles: [O] },
      { title: "Company settings", href: "/business-portal/settings/company", icon: Settings, roles: [O] },
      { title: "Branding", href: "/business-portal/settings/branding", icon: Palette, roles: [O] },
      { title: "Excused dates", href: "/business-portal/settings/excused-dates", icon: CalendarOff, roles: [O, H] },
      { title: "Notification settings", href: "/business-portal/settings/notifications", icon: Bell, roles: [O, H], phase: 2 },
      { title: "Integrations", href: "/business-portal/settings/integrations", icon: Plug, roles: [O, H], phase: 2 },
      { title: "AI configuration", href: "/business-portal/settings/ai", icon: Sparkles, roles: [O], phase: 2 },
      { title: "Subscription & invoices", href: "/business-portal/settings/subscription", icon: CreditCard, roles: [O], phase: 2 },
      { title: "Audit logs", href: "/business-portal/settings/audit-logs", icon: ScrollText, roles: [O], phase: 2 },
      { title: "Help & tutorials", href: "/business-portal/help", icon: CircleHelp, phase: 2 },
    ],
  },
]

// ─── Employee App ───────────────────────────────────────────────────────

export const EMPLOYEE_TABS: NavItem<EmployeeAppRole>[] = [
  { title: "Home", href: "/employee-app/home", icon: Home },
  { title: "Activity", href: "/employee-app/activity", icon: Footprints },
  { title: "Challenges", href: "/employee-app/challenges", icon: Trophy },
  { title: "Rewards", href: "/employee-app/rewards", icon: Gift },
  { title: "Profile", href: "/employee-app/profile", icon: UserRound },
]

export const EMPLOYEE_NAV: NavGroup<EmployeeAppRole>[] = [
  {
    label: "Today",
    items: [
      { title: "Home", href: "/employee-app/home", icon: Home },
      { title: "Wellness score", href: "/employee-app/wellness-score", icon: HeartPulse },
      { title: "Notifications", href: "/employee-app/notifications", icon: Bell },
    ],
  },
  {
    label: "Track",
    items: [
      { title: "Activity", href: "/employee-app/activity", icon: Footprints },
      { title: "Water", href: "/employee-app/water", icon: Droplets },
      { title: "Workouts", href: "/employee-app/workouts", icon: Dumbbell },
      { title: "Habits", href: "/employee-app/habits", icon: ListChecks },
      { title: "Sleep", href: "/employee-app/sleep", icon: Moon, phase: 2 },
      { title: "Nutrition", href: "/employee-app/nutrition", icon: Utensils, phase: 2 },
    ],
  },
  {
    label: "Compete & earn",
    items: [
      { title: "Challenges", href: "/employee-app/challenges", icon: Trophy },
      { title: "Leaderboards", href: "/employee-app/leaderboards", icon: Medal },
      { title: "Badges", href: "/employee-app/badges", icon: Award },
      { title: "Rewards", href: "/employee-app/rewards", icon: Gift },
      { title: "Points wallet", href: "/employee-app/wallet", icon: Wallet },
    ],
  },
  {
    label: "Grow",
    items: [
      { title: "Wellness programs", href: "/employee-app/programs", icon: CalendarRange, phase: 2 },
      { title: "Wellness feed", href: "/employee-app/feed", icon: Newspaper, phase: 2 },
      { title: "AI coach", href: "/employee-app/coach", icon: Bot, phase: 2 },
      { title: "Announcements", href: "/employee-app/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Me",
    items: [
      { title: "My team", href: "/employee-app/my-team", icon: UsersRound, roles: ["team_manager"] },
      { title: "Profile", href: "/employee-app/profile", icon: UserRound },
      { title: "Settings", href: "/employee-app/settings", icon: Settings },
      { title: "Privacy & consent", href: "/employee-app/settings/privacy", icon: KeyRound },
      { title: "Help & support", href: "/employee-app/help", icon: LifeBuoy },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────

export function filterNav<R extends string>(groups: NavGroup<R>[], role: R | undefined) {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (role !== undefined && i.roles.includes(role))) }))
    .filter((g) => g.items.length > 0)
}

/** The nav item that owns a pathname (longest href prefix). */
export function findNavItem<R extends string>(groups: NavGroup<R>[], pathname: string) {
  let best: { item: NavItem<R>; group: NavGroup<R> } | null = null
  for (const group of groups) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        if (!best || item.href.length > best.item.href.length) best = { item, group }
      }
    }
  }
  return best
}

export function canAccessPath<R extends string>(groups: NavGroup<R>[], pathname: string, role: R | undefined) {
  const match = findNavItem(groups, pathname)
  if (!match?.item.roles) return true
  return role !== undefined && match.item.roles.includes(role)
}

