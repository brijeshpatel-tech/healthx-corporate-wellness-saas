"use client"

import { Award, Building2, ChevronRight, Coins, Flame, HeartPulse, History, LifeBuoy, MapPin, Pencil, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, UsersRound, Wallet, Watch } from "lucide-react"
import Link from "next/link"
import { ProgressRing } from "@/components/common/charts"
import { UserAvatar } from "@/components/common/user-avatar"
import { GOAL_OPTIONS, labelOf } from "@/components/employee/engage/account/labels"
import { EngagePage, LoadError, MenuGroup, MenuRow } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** SCR-M-069 My Profile. */
export default function ProfilePage() {
  const session = useSession("employee")
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  if (q.error)
    return (
      <EngagePage>
        <LoadError title="Couldn't load your profile." error={q.error} onRetry={() => q.refetch()} />
      </EngagePage>
    )
  if (!q.data) return <ProfileSkeleton />
  return <Profile data={q.data} isTeamManager={session?.role === "team_manager"} />
}

function Profile({ data, isTeamManager }: { data: MyProfile; isTeamManager: boolean }) {
  const org = [data.departmentName, data.teamName].filter(Boolean).join(" · ")
  return (
    <EngagePage>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5 lg:sticky lg:top-20">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 p-5 text-white shadow-lg shadow-emerald-500/20 sm:p-6">
            <div className="bg-grid absolute inset-0 opacity-10" />
            <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex flex-col items-center gap-4 text-center">
              <Button asChild size="sm" className="absolute top-0 right-0 h-9 rounded-full border-0 bg-white/20 px-3 text-white backdrop-blur hover:bg-white/30">
                <Link href="/employee-app/profile/edit">
                  <Pencil data-icon="inline-start" />
                  Edit profile
                </Link>
              </Button>
              <UserAvatar name={data.fullName} color={data.avatarColor} src={data.photoUrl} size="xl" className="mt-6 size-24 ring-4 ring-white/30 sm:mt-2 [&_[data-slot=avatar-fallback]]:text-3xl" />
              <div className="min-w-0 space-y-1">
                <h1 className="font-heading text-2xl font-extrabold tracking-tight">{data.fullName}</h1>
                <p className="text-sm font-medium text-white/85">{data.jobTitle}</p>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3.5" /> {data.companyName}
                  </span>
                  {data.locationName ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" /> {data.locationName}
                    </span>
                  ) : null}
                </div>
                {org ? <p className="text-xs text-white/80">{org}</p> : null}
              </div>
              <div className="grid w-full grid-cols-3 divide-x divide-white/20 rounded-2xl bg-white/15 py-3 backdrop-blur">
                <HeroStat href="/employee-app/wallet" icon={<Coins className="size-4" />} value={formatNumber(data.stats.pointsBalance)} label="Points" />
                <HeroStat href="/employee-app/badges" icon={<Award className="size-4" />} value={formatNumber(data.stats.badgesCount)} label="Badges" />
                <HeroStat icon={<Flame className="size-4" />} value={formatNumber(data.stats.currentStreak)} label="Day streak" />
              </div>
            </div>
          </section>

          <CompletionCard data={data} />
        </div>

        <div className="space-y-5">
          {isTeamManager ? (
            <Link
              href="/employee-app/my-team"
              className="group flex items-center gap-4 rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 p-4 transition-colors hover:from-violet-500/15"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25">
                <UsersRound className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">My Team</span>
                <span className="block text-sm text-muted-foreground">See {data.teamName ? `${data.teamName}'s` : "your team's"} progress, challenge position and leaderboard.</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : null}

          <MenuGroup title="My details">
            <MenuRow icon={UserRound} tone="sky" title="Basic details" description="Name, photo, contact and personal details" href="/employee-app/profile/edit" />
            <MenuRow
              icon={HeartPulse}
              tone="rose"
              title="Wellness details"
              description="Height, weight and goals — private to you"
              value={labelOf(GOAL_OPTIONS, data.wellness.mainGoal)}
              href="/employee-app/profile/wellness"
            />
            <MenuRow icon={SlidersHorizontal} tone="violet" title="Preferences" description="Activities, workouts, food and language" href="/employee-app/settings/preferences" />
          </MenuGroup>

          <MenuGroup title="My progress">
            <MenuRow icon={Award} tone="amber" title="Badges" value={`${formatNumber(data.stats.badgesCount)} earned`} href="/employee-app/badges" />
            <MenuRow icon={History} tone="indigo" title="Workout history" href="/employee-app/workouts/history" />
            <MenuRow icon={Wallet} tone="emerald" title="Points wallet" value={`${formatNumber(data.stats.pointsBalance)} pts`} href="/employee-app/wallet" />
          </MenuGroup>

          <MenuGroup title="Account">
            <MenuRow icon={Watch} tone="cyan" title="Connected apps" value={data.connectedApps.length ? data.connectedApps.join(", ") : "Not connected"} href="/employee-app/settings/connected-apps" />
            <MenuRow icon={ShieldCheck} tone="teal" title="Privacy & consent" href="/employee-app/settings/privacy" />
            <MenuRow icon={Settings} tone="slate" title="Settings" href="/employee-app/settings" />
            <MenuRow icon={LifeBuoy} tone="orange" title="Help & support" href="/employee-app/help" />
          </MenuGroup>
        </div>
      </div>
    </EngagePage>
  )
}

function HeroStat({ href, icon, value, label }: { href?: string; icon: React.ReactNode; value: string; label: string }) {
  const body = (
    <>
      <span className="flex items-center justify-center gap-1.5 font-heading text-lg font-bold tabular-nums">
        {icon}
        {value}
      </span>
      <span className="text-[11px] font-medium text-white/80">{label}</span>
    </>
  )
  const cls = "flex min-h-11 flex-col items-center justify-center gap-0.5 px-2"
  return href ? (
    <Link href={href} className={cn(cls, "rounded-lg transition-colors hover:bg-white/10")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function CompletionCard({ data }: { data: MyProfile }) {
  const { percent, missing } = data.completion
  const complete = missing.length === 0
  const prompt = complete
    ? "Your profile is complete — you'll get the most personal goals and tips."
    : missing.length === 1
      ? `${missing[0]!.label} to reach 100%.`
      : `${missing[0]!.label} and ${missing[1]!.label.charAt(0).toLowerCase()}${missing[1]!.label.slice(1)} to get more personal goals and tips.`
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={percent} size={68} stroke={7} color={complete ? "var(--chart-1)" : "var(--primary)"}>
          <span className="font-heading text-sm font-bold tabular-nums">{percent}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex items-center gap-1.5 font-semibold">
            {complete ? <Sparkles className="size-4 text-amber-500" /> : null}
            {complete ? "Profile complete" : `Profile ${percent}% complete`}
          </p>
          <p className="text-sm text-muted-foreground">{prompt}</p>
        </div>
      </div>
      {!complete ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {missing.slice(0, 4).map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              + {m.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <EngagePage>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="space-y-5">
          {[3, 3, 4].map((rows, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                {Array.from({ length: rows }).map((_, r) => (
                  <div key={r} className="flex items-center gap-3 px-4 py-3.5">
                    <IconTileSkeleton />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </EngagePage>
  )
}

function IconTileSkeleton() {
  return <Skeleton className="size-8 shrink-0 rounded-xl" />
}
