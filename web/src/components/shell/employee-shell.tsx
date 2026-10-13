"use client"

import { useQueryClient } from "@tanstack/react-query"
import { Bell, ChevronsUpDown, LogOut, RotateCcw, Settings, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { PhaseBadge } from "@/components/common/status-badge"
import { AccessDenied } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { env } from "@/config/env"
import { EMPLOYEE_NAV, EMPLOYEE_TABS, canAccessPath, filterNav, findNavItem } from "@/config/nav"
import { employeeAuthApi } from "@/lib/api/auth"
import { notificationsApi } from "@/lib/api/employee/notifications"
import { useApiQuery } from "@/lib/api/hooks"
import { HOME_PATH, LOGIN_PATH, useAuthStore, useSession } from "@/lib/auth/session"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./theme-toggle"

/**
 * Employee web app layout — mirrors the mobile app:
 * sidebar on desktop, top bar + bottom tab bar on phones.
 */
export function EmployeeShell({ children }: { children: React.ReactNode }) {
  const session = useSession("employee")
  const pathname = usePathname()
  const groups = filterNav(EMPLOYEE_NAV, session?.role)
  const current = findNavItem(EMPLOYEE_NAV, pathname)
  const allowed = canAccessPath(EMPLOYEE_NAV, pathname, session?.role)

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <Link href={HOME_PATH.employee} className="px-1 py-1">
            <Logo label={session?.companyName ?? "Employee App"} />
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-0 pb-4">
          {groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-wide uppercase">{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={current?.item.href === item.href} className="data-[active=true]:font-semibold">
                      <Link href={item.href}>
                        <item.icon />
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.phase ? <PhaseBadge phase={item.phase} /> : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <AccountMenu />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Link href={HOME_PATH.employee} className="md:hidden">
            <Logo size="sm" />
          </Link>
          <span className="hidden truncate text-sm font-medium text-muted-foreground md:block">{current?.item.title ?? ""}</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 pb-24 md:pb-8">{allowed ? children : <AccessDenied homeHref={HOME_PATH.employee} />}</main>
        <BottomTabs />
      </SidebarInset>
    </SidebarProvider>
  )
}

function NotificationBell() {
  const { data } = useApiQuery(["employee", "notifications", "unread"], () => notificationsApi.unreadCount(), { refetchInterval: 60_000 })
  const count = data?.count ?? 0
  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}>
      <Link href="/employee-app/notifications">
        <Bell />
        {count > 0 ? (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}

function BottomTabs() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {EMPLOYEE_TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors", active && "text-primary")}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-primary/12")}>
                  <tab.icon className="size-5" />
                </span>
                {tab.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function AccountMenu() {
  const session = useSession("employee")
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearSession = useAuthStore((s) => s.clearSession)
  const { isMobile } = useSidebar()
  if (!session) return null

  const signOut = async () => {
    try {
      await employeeAuthApi.logout()
    } catch {
      // ignore — local sign-out is enough
    }
    clearSession("employee")
    queryClient.clear()
    router.replace(LOGIN_PATH.employee)
  }

  const resetData = async () => {
    const { resetDb } = await import("@/lib/mock/db")
    resetDb()
    queryClient.clear()
    toast.success("Sample data reset")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <UserAvatar name={session.user.name} color={session.user.avatarColor} className="rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{session.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{session.user.jobTitle}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" side={isMobile ? "bottom" : "right"} align="end" sideOffset={6}>
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{session.user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/employee-app/profile">
                <UserRound /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/employee-app/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            {env.useMock ? (
              <DropdownMenuItem onClick={resetData}>
                <RotateCcw /> Reset sample data
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} variant="destructive">
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
