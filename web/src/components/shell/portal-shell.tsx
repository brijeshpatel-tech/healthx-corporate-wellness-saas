"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ChevronsUpDown, Database, LogOut, RotateCcw, UserRound, Users } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { PhaseBadge } from "@/components/common/status-badge"
import { AccessDenied } from "@/components/common/states"
import { UserAvatar } from "@/components/common/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { env } from "@/config/env"
import { ADMIN_NAV, BUSINESS_NAV, canAccessPath, filterNav, findNavItem, type NavGroup } from "@/config/nav"
import { adminAuthApi, businessAuthApi } from "@/lib/api/auth"
import { useAuthStore, useSession, HOME_PATH, LOGIN_PATH } from "@/lib/auth/session"
import { DEMO_ACCOUNTS } from "@/lib/mock/demo-accounts"
import { BUSINESS_ROLE_LABEL, PLATFORM_ROLE_LABEL } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CommandMenu } from "./command-menu"
import { ThemeToggle } from "./theme-toggle"

type ShellPortal = "admin" | "business"

/**
 * Sidebar layout for the Platform Admin Portal and the Business Portal.
 * Menu items, the command palette and page access all follow the user's role.
 */
export function PortalShell({
  portal,
  headerActions,
  children,
}: {
  portal: ShellPortal
  headerActions?: React.ReactNode
  children: React.ReactNode
}) {
  const nav: NavGroup[] = portal === "admin" ? ADMIN_NAV : BUSINESS_NAV
  const session = useSession(portal)
  const pathname = usePathname()
  const role = session?.role
  const groups = filterNav(nav, role)
  const current = findNavItem(nav, pathname)
  const allowed = canAccessPath(nav, pathname, role)

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <Link href={HOME_PATH[portal]} className="flex items-center gap-2 overflow-hidden rounded-lg px-1 py-1">
            <Logo label={portal === "admin" ? "Platform Admin" : session && "companyName" in session ? session.companyName : "Business Portal"} />
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-0 pb-4">
          {groups.map((group) => (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-wide uppercase">{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = current?.item.href === item.href
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="data-[active=true]:font-semibold">
                        <Link href={item.href}>
                          <item.icon />
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.phase ? <PhaseBadge phase={item.phase} className="group-data-[collapsible=icon]:hidden" /> : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <UserMenu portal={portal} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <Breadcrumb className="hidden min-w-0 md:block">
            <BreadcrumbList>
              {current ? (
                <>
                  <BreadcrumbItem className="text-muted-foreground">{current.group.label}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="truncate font-medium">{current.item.title}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>{portal === "admin" ? "Platform Admin" : "Business Portal"}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-1.5">
            <CommandMenu groups={groups} className="hidden w-56 sm:inline-flex" />
            {env.useMock ? (
              <Badge variant="outline" className="hidden gap-1 border-amber-500/40 text-amber-700 lg:inline-flex dark:text-amber-300">
                <Database className="size-3" /> Sample data
              </Badge>
            ) : null}
            {headerActions}
            <ThemeToggle />
          </div>
        </header>
        <main className={cn("flex-1")}>{allowed ? children : <AccessDenied homeHref={HOME_PATH[portal]} />}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function UserMenu({ portal }: { portal: ShellPortal }) {
  const session = useSession(portal)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isMobile } = useSidebar()
  const setSession = useAuthStore((s) => s.setSession)
  const clearSession = useAuthStore((s) => s.clearSession)
  if (!session) return null

  const roleLabel = portal === "admin" ? PLATFORM_ROLE_LABEL[session.role as keyof typeof PLATFORM_ROLE_LABEL] : BUSINESS_ROLE_LABEL[session.role as keyof typeof BUSINESS_ROLE_LABEL]

  const signOut = async () => {
    try {
      await (portal === "admin" ? adminAuthApi.logout() : businessAuthApi.logout())
    } catch {
      // Signing out locally is enough if the server can't be reached.
    }
    clearSession(portal)
    queryClient.clear()
    router.replace(LOGIN_PATH[portal])
  }

  const switchRole = async (email: string) => {
    const next = await businessAuthApi.switchDemoAccount({ email })
    setSession("business", next)
    queryClient.clear()
    toast.success(`Now viewing as ${BUSINESS_ROLE_LABEL[next.role]}`, { description: next.user.name })
    router.push(HOME_PATH.business)
  }

  const resetData = async () => {
    const { resetDb } = await import("@/lib/mock/db")
    resetDb()
    queryClient.clear()
    toast.success("Sample data reset", { description: "All changes were cleared." })
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <UserAvatar name={session.user.name} color={session.user.avatarColor} size="sm" className="rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{session.user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" side={isMobile ? "bottom" : "right"} align="end" sideOffset={6}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2.5">
                <UserAvatar name={session.user.name} color={session.user.avatarColor} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={portal === "admin" ? "/admin-portal/account" : "/business-portal/account"}>
                  <UserRound /> My account
                </Link>
              </DropdownMenuItem>
              {portal === "business" && env.useMock ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Users /> Preview as role
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-60">
                    {DEMO_ACCOUNTS.business.map((a) => (
                      <DropdownMenuItem key={a.email} onClick={() => switchRole(a.email)} disabled={a.email === session.user.email}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{a.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {env.useMock ? (
                <DropdownMenuItem onClick={resetData}>
                  <RotateCcw /> Reset sample data
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
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
