"use client"

import { ArrowRight, Award, ChevronRight, Clock, Dumbbell, Flame, Lightbulb, Megaphone, Pin, Sparkles, Trophy } from "lucide-react"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import type { FeedAchievement, FeedAnnouncement, FeedChallenge, FeedWorkout, ContentCard } from "@/lib/api/employee/feed"
import { formatNumber, formatRelative, titleCase } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmojiCover } from "../page"
import { Medallion } from "../celebration"
import { CategoryPill, ContentCover, SaveButton, contentHref } from "./content"

function Eyebrow({ icon: Icon, children, className }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase", className)}>
      <Icon className="size-3.5" /> {children}
    </p>
  )
}

const tipTitle = (t: string) => {
  const s = t.replace(/^Tip:\s*/i, "")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const shell = "group relative overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-md"

/** Today's tip — bold gradient card. */
export function TipFeedCard({ item, className }: { item: ContentCard; className?: string }) {
  return (
    <article
      className={cn("group relative overflow-hidden rounded-2xl p-5 text-white shadow-lg sm:p-6", className)}
      style={{ background: `radial-gradient(90% 120% at 100% 0%, ${item.coverColor}66, transparent 60%), linear-gradient(135deg, ${item.coverColor}, ${item.coverColor}cc 55%, #0f172a 160%)`, boxShadow: `0 12px 30px -14px ${item.coverColor}` }}
    >
      <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
      <span className="pointer-events-none absolute -right-3 -bottom-6 text-[7.5rem] leading-none opacity-25 select-none sm:text-[9rem]" aria-hidden>
        {item.coverEmoji}
      </span>
      <div className="relative flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Eyebrow icon={Lightbulb} className="text-white/85">
            Today&apos;s tip
          </Eyebrow>
          <h3 className="font-heading text-xl leading-tight font-extrabold sm:text-2xl">
            <Link href={contentHref(item.id)} className="after:absolute after:inset-0 focus-visible:outline-none">
              {tipTitle(item.title)}
            </Link>
          </h3>
          <p className="max-w-xl text-sm text-white/90">{item.summary}</p>
          <p className="inline-flex items-center gap-1 pt-1 text-sm font-semibold">
            Read the tip <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
        <SaveButton id={item.id} saved={item.saved} variant="onColor" />
      </div>
    </article>
  )
}

/** Today's workout matched to the employee's preferences. */
export function WorkoutFeedCard({ workout, className }: { workout: FeedWorkout; className?: string }) {
  return (
    <article className={cn(shell, "flex flex-col gap-4 p-4 sm:p-5", className)}>
      <Eyebrow icon={Dumbbell} className="text-violet-600 dark:text-violet-400">
        Today&apos;s workout
      </Eyebrow>
      <div className="flex items-center gap-4">
        <EmojiCover emoji={workout.coverEmoji} color={workout.coverColor} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-heading text-lg leading-tight font-bold">
            <Link href={`/employee-app/workouts/${workout.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {workout.name}
            </Link>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{workout.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <Clock className="size-3.5" /> {workout.durationMin} min
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1">{titleCase(workout.level)}</span>
        <span className="rounded-full bg-muted px-2.5 py-1">{titleCase(workout.location)}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
          <Flame className="size-3.5 text-orange-500" /> {formatNumber(workout.calories)} kcal
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 shrink-0 text-violet-500" />
          <span className="line-clamp-2">{workout.reason}</span>
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-xs">
          Start <ChevronRight className="size-4" />
        </span>
      </div>
    </article>
  )
}

/** The employee's best active challenge with live progress. */
export function ChallengeFeedCard({ challenge, className }: { challenge: FeedChallenge; className?: string }) {
  const pct = Math.min(100, challenge.target ? (challenge.progress / challenge.target) * 100 : 0)
  return (
    <article className={cn(shell, "flex flex-col", className)}>
      <div className="flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${challenge.color}, ${challenge.color}c0)` }}>
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white/20 text-2xl" aria-hidden>
          {challenge.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow icon={Trophy} className="text-white/85">
            Current challenge
          </Eyebrow>
          <h3 className="truncate font-heading text-lg font-bold">
            <Link href={`/employee-app/challenges/${challenge.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
              {challenge.name}
            </Link>
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">+{formatNumber(challenge.points)} pts</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="text-lg font-bold tabular-nums">{formatNumber(challenge.progress)}</span>
            <span className="text-muted-foreground">
              {" "}
              / {formatNumber(challenge.target)} {challenge.unit}
            </span>
          </p>
          <span className="text-sm font-semibold tabular-nums">{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            You&apos;re <span className="font-semibold text-foreground">#{challenge.rank}</span> of {formatNumber(challenge.participants)}
          </span>
          <span>{challenge.daysLeft === 0 ? "Ends today" : `${challenge.daysLeft} days left`}</span>
        </div>
      </div>
    </article>
  )
}

/** Latest company announcement for this employee's audience. */
export function AnnouncementFeedCard({ announcement, className }: { announcement: FeedAnnouncement; className?: string }) {
  return (
    <article className={cn(shell, "flex flex-col gap-3 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow icon={Megaphone} className="text-amber-600 dark:text-amber-400">
          Company announcement
        </Eyebrow>
        <span className="flex items-center gap-1.5">
          {announcement.pinned ? <Pin className="size-3.5 text-muted-foreground" aria-label="Pinned" /> : null}
          {announcement.unread ? <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">New</span> : null}
        </span>
      </div>
      <h3 className="font-heading text-lg leading-snug font-bold">
        <Link href={`/employee-app/announcements/${announcement.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          {announcement.title}
        </Link>
      </h3>
      <p className="line-clamp-3 text-sm text-muted-foreground">{announcement.body}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="truncate">
          {announcement.author} · {formatRelative(announcement.sentAt)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary">
          Read <ChevronRight className="size-3.5" />
        </span>
      </div>
    </article>
  )
}

/** Wellness article / video card. */
export function ArticleFeedCard({ item, className }: { item: ContentCard; className?: string }) {
  return (
    <article className={cn(shell, "flex flex-col", className)}>
      <ContentCover item={item}>
        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          <CategoryPill category={item.category} onColor />
          {item.fromCompany ? <span className="inline-flex h-6 items-center rounded-full bg-black/35 px-2.5 text-[11px] font-semibold backdrop-blur">From {item.companyName ?? "your company"}</span> : null}
        </span>
      </ContentCover>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[11px] font-bold tracking-wider text-sky-600 uppercase dark:text-sky-400">{item.type === "video" ? "Wellness video" : "Wellness article"}</p>
        <h3 className="line-clamp-2 font-heading text-lg leading-snug font-bold">
          <Link href={contentHref(item.id)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">
              {item.readMinutes} min {item.type === "video" ? "video" : "read"} · {item.author}
            </span>
          </p>
          <SaveButton id={item.id} saved={item.saved} />
        </div>
      </div>
    </article>
  )
}

/** Latest earned badge. */
export function AchievementFeedCard({ achievement, className }: { achievement: FeedAchievement; className?: string }) {
  return (
    <article
      className={cn(shell, "flex items-center gap-4 p-4 sm:p-5", className)}
      style={{ background: `radial-gradient(120% 140% at 0% 0%, ${achievement.color}26, transparent 55%)` }}
    >
      <Medallion emoji={achievement.icon} color={achievement.color} size="md" />
      <div className="min-w-0 flex-1 space-y-1">
        <Eyebrow icon={Award} className="text-amber-600 dark:text-amber-400">
          Achievement unlocked
        </Eyebrow>
        <h3 className="font-heading text-lg leading-tight font-bold">
          <Link href="/employee-app/badges" className="after:absolute after:inset-0 focus-visible:outline-none">
            {achievement.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{achievement.description}</p>
        <p className="text-xs text-muted-foreground">
          Earned {formatRelative(achievement.earnedAt)} · <span className="font-semibold text-amber-700 dark:text-amber-300">+{formatNumber(achievement.points)} pts</span>
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </article>
  )
}
