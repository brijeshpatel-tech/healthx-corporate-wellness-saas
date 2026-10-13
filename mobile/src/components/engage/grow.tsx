/** Wellness feed, content library and program pieces (SCR-M-062 … 065, Phase 2). */
import {
  Award,
  Bookmark,
  BookmarkCheck,
  Brain,
  Building2,
  CalendarRange,
  Check,
  ChevronRight,
  CircleCheckBig,
  Clock,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  Megaphone,
  Moon,
  Newspaper,
  Pin,
  Play,
  Sparkles,
  Timer,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react-native"
import { useState, type ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { Button, Card, IconTile, ProgressBar, Text } from "@/components/ui"
import { CONTENT_CATEGORY_LABEL, feedApi, type ContentCard, type ContentCategory, type FeedAchievement, type FeedAnnouncement, type FeedChallenge, type FeedWorkout } from "@/lib/api/employee/feed"
import type { ProgramCard, ProgramGoalProgress, ProgramWeekProgress } from "@/lib/api/employee/programs"
import { useApiMutation } from "@/lib/api/hooks"
import { formatMl, formatNumber, formatRelative, formatShortDate, titleCase } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { useTheme } from "@/theme/theme"
import type { TintName } from "@/theme/tokens"
import { alpha, EmojiTile, go, GradientCard, Medallion, OnColorPill, TintPill } from "./shared"

export const TYPE_ICON = { article: Newspaper, video: Play, tip: Lightbulb, link: Link2 } as const
export const contentHref = (id: string, from?: "explore" | "saved") => `/feed/${id}${from ? `?from=${from}` : ""}`

// ─── Save / bookmark ────────────────────────────────────────────────────

/** Bookmark state with an optimistic flip while the request runs. */
export function useSaveToggle(id: string, saved: boolean) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const settle = () => setOptimistic(null)
  const save = useApiMutation(feedApi.save, { success: "Saved", invalidate: [["employee", "feed"], ["employee", "content"]], onSuccess: settle, onError: settle })
  const unsave = useApiMutation(feedApi.unsave, { success: "Removed from saved", invalidate: [["employee", "feed"], ["employee", "content"]], onSuccess: settle, onError: settle })
  const value = optimistic ?? saved
  const toggle = () => {
    if (save.isPending || unsave.isPending) return
    haptic.select()
    setOptimistic(!value)
    if (value) unsave.mutate({ id })
    else save.mutate({ id })
  }
  return { saved: value, toggle }
}

/** Round bookmark button (on colour or on a card). */
export function SaveButton({ id, saved, onColor }: { id: string; saved: boolean; onColor?: boolean }) {
  const { colors } = useTheme()
  const s = useSaveToggle(id, saved)
  const Icon = s.saved ? BookmarkCheck : Bookmark
  const fg = onColor ? "#ffffff" : s.saved ? colors.primary : colors.mutedForeground
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: s.saved }}
      accessibilityLabel={s.saved ? "Remove from saved" : "Save for later"}
      hitSlop={6}
      onPress={s.toggle}
      style={({ pressed }) => [styles.save, { backgroundColor: onColor ? "rgba(255,255,255,0.22)" : s.saved ? colors.primarySoft : colors.muted }, pressed && { opacity: 0.75 }]}
    >
      <Icon size={18} color={fg} fill={s.saved ? fg : "transparent"} />
    </Pressable>
  )
}

/** Labelled save button for the content viewer. */
export function SaveLabelled({ id, saved }: { id: string; saved: boolean }) {
  const s = useSaveToggle(id, saved)
  return <Button title={s.saved ? "Saved" : "Save"} icon={s.saved ? BookmarkCheck : Bookmark} variant={s.saved ? "secondary" : "outline"} size="md" onPress={s.toggle} feedback="none" />
}

// ─── Content covers & tiles ─────────────────────────────────────────────

export function CategoryPill({ category, onColor }: { category: ContentCategory; onColor?: boolean }) {
  const { colors } = useTheme()
  if (onColor) return <OnColorPill label={CONTENT_CATEGORY_LABEL[category]} dark />
  return <TintPill label={CONTENT_CATEGORY_LABEL[category]} color={colors.mutedForeground} bg={colors.muted} />
}

/** Gradient band with the content emoji (cards and viewer). */
export function ContentCover({ item, height = 120, children }: { item: Pick<ContentCard, "coverColor" | "coverEmoji" | "type">; height?: number; children?: ReactNode }) {
  return (
    <GradientCard colors={[item.coverColor, alpha(item.coverColor, 0.7)]} radius={0} padding={0}>
      <View style={[styles.cover, { height }]}>
        <Text style={{ fontSize: height * 0.42, lineHeight: height * 0.54 }}>{item.coverEmoji}</Text>
        {item.type === "video" ? (
          <View style={styles.videoTag}>
            <Play size={11} color="#ffffff" fill="#ffffff" />
            <Text variant="small" color="#ffffff" weight="semibold">
              Video
            </Text>
          </View>
        ) : null}
        {children}
      </View>
    </GradientCard>
  )
}

/** Library tile (Explore). */
export function ContentTile({ item, from }: { item: ContentCard; from?: "explore" | "saved" }) {
  const { colors } = useTheme()
  return (
    <Card padding={0} onPress={() => go(contentHref(item.id, from))} accessibilityLabel={`${item.title}. ${item.readMinutes} minute ${item.type === "video" ? "video" : "read"}`} style={styles.clip}>
      <ContentCover item={item} height={110}>
        <View style={styles.coverTopLeft}>
          <CategoryPill category={item.category} onColor />
        </View>
      </ContentCover>
      <View style={styles.tileBody}>
        <Text variant="subtitle" numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={styles.tileFoot}>
          <Clock size={13} color={colors.mutedForeground} />
          <Text variant="small" tone="muted" numberOfLines={1} style={styles.flex}>
            {item.readMinutes} min {item.type === "video" ? "video" : "read"} · {item.fromCompany ? (item.companyName ?? "Your company") : item.author}
          </Text>
          <SaveButton id={item.id} saved={item.saved} />
        </View>
      </View>
    </Card>
  )
}

/** Compact row (Saved list, "More like this"). */
export function ContentRow({ item, from }: { item: ContentCard; from?: "explore" | "saved" }) {
  const { colors } = useTheme()
  const Icon = TYPE_ICON[item.type]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={() => {
        haptic.tap()
        go(contentHref(item.id, from))
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.muted }]}
    >
      <EmojiTile emoji={item.coverEmoji} color={item.coverColor} size={50} solid />
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.rowMeta}>
          <Icon size={12} color={colors.mutedForeground} />
          <Text variant="small" tone="muted" numberOfLines={1}>
            {CONTENT_CATEGORY_LABEL[item.category]} · {item.readMinutes} min
          </Text>
        </View>
      </View>
      <SaveButton id={item.id} saved={item.saved} />
    </Pressable>
  )
}

// ─── Feed cards ─────────────────────────────────────────────────────────

function Eyebrow({ icon: Icon, children, color }: { icon: LucideIcon; children: string; color: string }) {
  return (
    <View style={styles.eyebrow}>
      <Icon size={13} color={color} strokeWidth={2.4} />
      <Text variant="overline" color={color}>
        {children}
      </Text>
    </View>
  )
}

const tipTitle = (t: string) => {
  const s = t.replace(/^Tip:\s*/i, "")
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function TipFeedCard({ item }: { item: ContentCard }) {
  return (
    <GradientCard colors={[item.coverColor, alpha(item.coverColor, 0.78), "#0f172a"]} emoji={item.coverEmoji} onPress={() => go(contentHref(item.id))} accessibilityLabel={`Today's tip: ${tipTitle(item.title)}`}>
      <View style={styles.tipRow}>
        <View style={styles.flex}>
          <Eyebrow icon={Lightbulb} color="rgba(255,255,255,0.9)">
            Today&apos;s tip
          </Eyebrow>
          <Text variant="heading" color="#ffffff">
            {tipTitle(item.title)}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.9)" numberOfLines={3}>
            {item.summary}
          </Text>
          <Text variant="label" color="#ffffff" style={styles.mt4}>
            Read the tip →
          </Text>
        </View>
        <SaveButton id={item.id} saved={item.saved} onColor />
      </View>
    </GradientCard>
  )
}

export function WorkoutFeedCard({ workout }: { workout: FeedWorkout }) {
  const { colors, tint } = useTheme()
  return (
    <Card onPress={() => go(`/workouts/${workout.id}`)} accessibilityLabel={`Today's workout: ${workout.name}, ${workout.durationMin} minutes`}>
      <Eyebrow icon={Dumbbell} color={tint("workout").fg}>
        Today&apos;s workout
      </Eyebrow>
      <View style={[styles.rowCenter, styles.mt8]}>
        <EmojiTile emoji={workout.coverEmoji} color={workout.coverColor} size={60} solid />
        <View style={styles.flex}>
          <Text variant="subtitle">{workout.name}</Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {workout.description}
          </Text>
        </View>
      </View>
      <View style={styles.chips}>
        <TintPill label={`${workout.durationMin} min`} icon={Clock} color={colors.foreground} bg={colors.muted} />
        <TintPill label={titleCase(workout.level)} color={colors.foreground} bg={colors.muted} />
        <TintPill label={titleCase(workout.location)} color={colors.foreground} bg={colors.muted} />
        <TintPill label={`${formatNumber(workout.calories)} kcal`} icon={Flame} color={tint("streak").fg} bg={colors.muted} />
      </View>
      <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
        <Sparkles size={13} color={tint("insight").fg} />
        <Text variant="small" tone="muted" numberOfLines={2} style={styles.flex}>
          {workout.reason}
        </Text>
        <View style={[styles.startPill, { backgroundColor: colors.primary }]}>
          <Text variant="label" color={colors.primaryForeground}>
            Start
          </Text>
          <ChevronRight size={14} color={colors.primaryForeground} />
        </View>
      </View>
    </Card>
  )
}

export function ChallengeFeedCard({ challenge }: { challenge: FeedChallenge }) {
  const { colors } = useTheme()
  const pct = Math.min(100, challenge.target ? (challenge.progress / challenge.target) * 100 : 0)
  return (
    <Card padding={0} onPress={() => go(`/challenges/${challenge.id}`)} accessibilityLabel={`Current challenge ${challenge.name}`} style={styles.clip}>
      <GradientCard colors={[challenge.color, alpha(challenge.color, 0.75)]} radius={0} padding={14}>
        <View style={styles.rowCenter}>
          <View style={styles.emojiBox}>
            <Text style={styles.emoji}>{challenge.emoji}</Text>
          </View>
          <View style={styles.flex}>
            <Eyebrow icon={Trophy} color="rgba(255,255,255,0.88)">
              Current challenge
            </Eyebrow>
            <Text variant="subtitle" color="#ffffff" numberOfLines={1}>
              {challenge.name}
            </Text>
          </View>
          <OnColorPill label={`+${formatNumber(challenge.points)} pts`} />
        </View>
      </GradientCard>
      <View style={styles.pad}>
        <View style={styles.between}>
          <Text variant="caption" tone="muted">
            <Text variant="subtitle">{formatNumber(challenge.progress)}</Text> / {formatNumber(challenge.target)} {challenge.unit}
          </Text>
          <Text variant="label">{Math.round(pct)}%</Text>
        </View>
        <ProgressBar value={pct} height={8} color={colors.primary} />
        <View style={styles.between}>
          <Text variant="small" tone="muted">
            You&apos;re <Text variant="small" weight="bold">#{challenge.rank}</Text> of {formatNumber(challenge.participants)}
          </Text>
          <Text variant="small" tone="muted">
            {challenge.daysLeft === 0 ? "Ends today" : `${challenge.daysLeft} days left`}
          </Text>
        </View>
      </View>
    </Card>
  )
}

export function AnnouncementFeedCard({ announcement }: { announcement: FeedAnnouncement }) {
  const { colors, tint } = useTheme()
  return (
    <Card onPress={() => go(`/announcements/${announcement.id}`)} accessibilityLabel={`Company announcement: ${announcement.title}`}>
      <View style={styles.between}>
        <Eyebrow icon={Megaphone} color={tint("points").fg}>
          Company announcement
        </Eyebrow>
        <View style={styles.rowCenter}>
          {announcement.pinned ? <Pin size={13} color={colors.mutedForeground} /> : null}
          {announcement.unread ? <TintPill label="NEW" color={colors.primaryForeground} bg={colors.primary} /> : null}
        </View>
      </View>
      <Text variant="subtitle" style={styles.mt8}>
        {announcement.title}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={3} style={styles.mt4}>
        {announcement.body}
      </Text>
      <View style={[styles.cardFoot, { borderTopColor: colors.border }]}>
        <Text variant="small" tone="muted" numberOfLines={1} style={styles.flex}>
          {announcement.author} · {formatRelative(announcement.sentAt)}
        </Text>
        <Text variant="label" tone="primary">
          Read →
        </Text>
      </View>
    </Card>
  )
}

export function ArticleFeedCard({ item }: { item: ContentCard }) {
  const { colors, tint } = useTheme()
  return (
    <Card padding={0} onPress={() => go(contentHref(item.id))} accessibilityLabel={`${item.type === "video" ? "Video" : "Article"}: ${item.title}`} style={styles.clip}>
      <ContentCover item={item} height={130}>
        <View style={styles.coverTopLeft}>
          <CategoryPill category={item.category} onColor />
          {item.fromCompany ? <OnColorPill label={`From ${item.companyName ?? "your company"}`} dark /> : null}
        </View>
      </ContentCover>
      <View style={styles.pad}>
        <Text variant="overline" color={tint("steps").fg}>
          {item.type === "video" ? "Wellness video" : "Wellness article"}
        </Text>
        <Text variant="subtitle" numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {item.summary}
        </Text>
        <View style={styles.tileFoot}>
          <Clock size={13} color={colors.mutedForeground} />
          <Text variant="small" tone="muted" numberOfLines={1} style={styles.flex}>
            {item.readMinutes} min {item.type === "video" ? "video" : "read"} · {item.author}
          </Text>
          <SaveButton id={item.id} saved={item.saved} />
        </View>
      </View>
    </Card>
  )
}

export function AchievementFeedCard({ achievement }: { achievement: FeedAchievement }) {
  const { colors, tint } = useTheme()
  return (
    <Card onPress={() => go("/badges")} accessibilityLabel={`Achievement unlocked: ${achievement.name}`}>
      <View style={styles.rowCenter}>
        <Medallion emoji={achievement.icon} color={achievement.color} size="md" />
        <View style={styles.flex}>
          <Eyebrow icon={Award} color={tint("points").fg}>
            Achievement unlocked
          </Eyebrow>
          <Text variant="subtitle">{achievement.name}</Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {achievement.description}
          </Text>
          <Text variant="small" tone="muted">
            Earned {formatRelative(achievement.earnedAt)} ·{" "}
            <Text variant="small" color={tint("points").fg} weight="bold">
              +{formatNumber(achievement.points)} pts
            </Text>
          </Text>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

// ─── Programs ───────────────────────────────────────────────────────────

export function goalVisual(goal: Pick<ProgramGoalProgress, "metric" | "label">): { icon: LucideIcon; tint: TintName } {
  switch (goal.metric) {
    case "steps":
      return { icon: Footprints, tint: "steps" }
    case "water":
      return { icon: Droplets, tint: "water" }
    case "workouts":
      return { icon: Dumbbell, tint: "workout" }
    case "meditation":
      return { icon: Brain, tint: "insight" }
    case "calories":
      return { icon: Flame, tint: "streak" }
    case "active_minutes":
    case "distance":
      return { icon: Timer, tint: "steps" }
    case "habit":
      return /sleep/i.test(goal.label) ? { icon: Moon, tint: "sleep" } : { icon: ListChecks, tint: "habits" }
    default:
      return { icon: ListChecks, tint: "habits" }
  }
}

const goalValue = (value: number, g: Pick<ProgramGoalProgress, "metric" | "unit">) => (g.metric === "water" ? formatMl(value) : g.metric === "distance" ? `${formatNumber(value, 1)} km` : formatNumber(value))
const goalTarget = (g: ProgramGoalProgress) => (g.metric === "water" ? formatMl(g.target) : `${formatNumber(g.target)} ${g.unit}`)

export function dateRange(start?: string, end?: string) {
  if (!start || !end) return null
  return `${formatShortDate(start)} – ${formatShortDate(end)}`
}

/** Program list card. */
export function ProgramCardView({ program }: { program: ProgramCard }) {
  const { colors, tint } = useTheme()
  const pct = Math.round(program.progress * 100)
  const range = dateRange(program.startDate, program.endDate)
  const pts = tint("points")
  return (
    <Card padding={0} onPress={() => go(`/programs/${program.id}`)} accessibilityLabel={`${program.name}, ${program.durationWeeks} weeks`} style={styles.clip}>
      <GradientCard colors={[program.coverColor, alpha(program.coverColor, 0.72)]} radius={0} padding={14}>
        <View style={styles.programHead}>
          <OnColorPill label={program.kind === "company" ? (program.companyName ?? "Your company") : "HealthX · self-paced"} icon={program.kind === "company" ? Building2 : Sparkles} dark />
          <Text style={styles.programEmoji}>{program.coverEmoji}</Text>
        </View>
      </GradientCard>
      <View style={styles.pad}>
        <Text variant="subtitle">{program.name}</Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {program.description}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.rowCenterSm}>
            <CalendarRange size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {program.durationWeeks} weeks
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {range ?? "Starts when you join"}
          </Text>
          <View style={styles.rowCenterSm}>
            <Users size={13} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {formatNumber(program.enrolledCount)} joined
            </Text>
          </View>
        </View>
        <View style={[styles.programFoot, { borderTopColor: colors.border }]}>
          {program.tab === "mine" ? (
            <View style={styles.flex}>
              <View style={styles.between}>
                <Text variant="label">{program.currentWeek ? `Week ${program.currentWeek} of ${program.durationWeeks}` : `Starts ${program.startDate ? formatShortDate(program.startDate) : "soon"}`}</Text>
                <Text variant="label" tone="primary">
                  {pct}%
                </Text>
              </View>
              <ProgressBar value={pct} height={7} />
              <Text variant="small" tone="muted">
                {program.goalsDone} of {program.goalsTotal} goals done · {formatNumber(program.completionPoints)} pts on completion
              </Text>
            </View>
          ) : program.tab === "completed" ? (
            <View style={[styles.between, styles.flex]}>
              {program.achieved ? (
                <View style={styles.rowCenterSm}>
                  <CircleCheckBig size={16} color={colors.success} />
                  <Text variant="label" tone="success">
                    Completed
                  </Text>
                </View>
              ) : (
                <Text variant="label" tone="muted">
                  Ended · {pct}% done
                </Text>
              )}
              {program.achieved ? <TintPill label={`+${formatNumber(program.completionPoints)} pts`} icon={Trophy} color={pts.fg} bg={pts.bg} /> : null}
            </View>
          ) : (
            <View style={[styles.between, styles.flex]}>
              <TintPill label={`${formatNumber(program.completionPoints)} pts on completion`} icon={Trophy} color={pts.fg} bg={pts.bg} />
              <Text variant="label" tone="primary">
                View →
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  )
}

/** One week of a program with live goal progress. */
export function WeekCard({ week, tracking, selfPaced }: { week: ProgramWeekProgress; tracking: boolean; selfPaced: boolean }) {
  const { colors, tint } = useTheme()
  const locked = week.status === "locked" || (week.status === "upcoming" && !!week.startDate)
  const pct = Math.round(week.pct * 100)
  const chip: Record<ProgramWeekProgress["status"], { label: string; tint: TintName }> = {
    completed: { label: "Completed", tint: "habits" },
    current: { label: "This week", tint: "steps" },
    ended: { label: "Ended", tint: "points" },
    locked: { label: "Locked", tint: "neutral" },
    upcoming: { label: "Up next", tint: "insight" },
  }
  const c = chip[week.status]
  const ct = tint(c.tint)
  const unlock = week.startDate ? `Unlocks ${formatShortDate(week.startDate)}` : selfPaced ? "Unlocks after the week before" : "Locked"
  return (
    <Card padding={0} style={[styles.clip, week.status === "current" && { borderColor: colors.primary, borderWidth: 2 }]}>
      <View style={styles.weekHead}>
        <View style={[styles.weekNo, { backgroundColor: week.status === "completed" ? colors.success : week.status === "current" ? colors.primary : colors.muted }]}>
          {week.status === "completed" ? (
            <Check size={20} color="#ffffff" strokeWidth={3} />
          ) : locked ? (
            <Lock size={16} color={colors.mutedForeground} />
          ) : (
            <Text variant="subtitle" color={week.status === "current" ? colors.primaryForeground : colors.foreground}>
              {week.week}
            </Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text variant="overline" tone="muted">
            Week {week.week}
          </Text>
          <Text variant="subtitle" numberOfLines={1}>
            {week.title}
          </Text>
          <Text variant="small" tone="muted">
            {locked ? unlock : (dateRange(week.startDate, week.endDate) ?? "Starts when you join")}
          </Text>
        </View>
        <View style={styles.weekRight}>
          <TintPill label={c.label} icon={locked ? Lock : undefined} color={ct.fg} bg={ct.bg} />
          {tracking && !locked ? <Text variant="label">{pct}%</Text> : null}
        </View>
      </View>
      {week.goals.map((g) => {
        const v = goalVisual(g)
        const gp = Math.round(g.pct * 100)
        return (
          <Pressable
            key={g.id}
            accessibilityRole={locked ? undefined : "button"}
            accessibilityLabel={`${g.label}${locked ? ", locked" : ` — open ${g.moduleLabel}`}`}
            disabled={locked}
            onPress={() => {
              haptic.tap()
              openHref(g.href)
            }}
            style={({ pressed }) => [styles.goal, { borderTopColor: colors.border }, locked && styles.locked, pressed && { backgroundColor: colors.muted }]}
          >
            <IconTile icon={v.icon} tint={locked ? "neutral" : v.tint} size={34} />
            <View style={styles.flex}>
              <View style={styles.between}>
                <Text variant="bodyMedium" tone={g.done ? "success" : "default"} style={styles.shrink}>
                  {g.label}
                </Text>
                {g.done ? (
                  <View style={styles.rowCenterSm}>
                    <CircleCheckBig size={15} color={colors.success} />
                    <Text variant="small" tone="success" weight="semibold">
                      Done
                    </Text>
                  </View>
                ) : null}
              </View>
              {tracking && !locked ? (
                <>
                  <ProgressBar value={gp} height={5} color={g.done ? colors.success : colors.primary} />
                  <Text variant="small" tone="muted">
                    {goalValue(g.value, g)} / {goalTarget(g)} · {g.moduleLabel}
                  </Text>
                </>
              ) : (
                <Text variant="small" tone="muted">
                  Target {goalTarget(g)} · tracked in {g.moduleLabel}
                </Text>
              )}
            </View>
            {!locked ? <ChevronRight size={16} color={colors.mutedForeground} /> : null}
          </Pressable>
        )
      })}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  shrink: { flexShrink: 1 },
  clip: { overflow: "hidden" },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  pad: { padding: 14, gap: 6 },
  save: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cover: { alignItems: "center", justifyContent: "center" },
  videoTag: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  coverTopLeft: { position: "absolute", left: 10, top: 10, flexDirection: "row", gap: 6, flexWrap: "wrap", right: 10 },
  tileBody: { padding: 14, gap: 6 },
  tileFoot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tipRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCenterSm: { flexDirection: "row", alignItems: "center", gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 12 },
  startPill: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingLeft: 12, paddingRight: 8, height: 34 },
  emojiBox: { width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 24, lineHeight: 30 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  programHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", minHeight: 64 },
  programEmoji: { fontSize: 50, lineHeight: 60 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4 },
  programFoot: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 6 },
  weekHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  weekNo: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  weekRight: { alignItems: "flex-end", gap: 4 },
  goal: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  locked: { opacity: 0.6 },
})
