/** Challenge building blocks (SCR-M-042 … 047, #350 mini-challenges, #355 certificates, #356 join codes, #358 warm-up, #359 prizes, #374 journeys). */
import * as Linking from "expo-linking"
import { router } from "expo-router"
import {
  Award,
  Brain,
  CalendarClock,
  Check,
  CircleCheck,
  Droplets,
  Dumbbell,
  Flag,
  Flame,
  Footprints,
  Gift,
  Hourglass,
  KeyRound,
  MapPin,
  Medal,
  QrCode,
  Route,
  Share2,
  Smartphone,
  Sparkles,
  Timer,
  Trophy,
  UsersRound,
  Watch,
  type LucideIcon,
} from "lucide-react-native"
import { useState, type ReactNode } from "react"
import { Platform, Pressable, StyleSheet, View } from "react-native"
import { BottomSheet, Button, Card, ProgressBar, Text, TextField } from "@/components/ui"
import { challengesApi, formatMetricValue, type ChallengePhase, type ChallengePrizes, type ChallengeResults, type ChallengeSummary, type JourneyView, type MiniChallengeView, type WarmUp } from "@/lib/api/employee/challenges"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatShortDate } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import type { ChallengeMetric, ChallengeType } from "@/lib/types"
import { useTheme } from "@/theme/theme"
import { RADIUS, type TintName } from "@/theme/tokens"
import { alpha, copyText, EmojiTile, go, GradientCard, OnColorPill, shareText, TintPill, useNow, WHITE_85 } from "./shared"

export const METRIC_ICON: Record<ChallengeMetric, LucideIcon> = {
  steps: Footprints,
  distance: Route,
  calories: Flame,
  active_minutes: Timer,
  workouts: Dumbbell,
  water: Droplets,
  meditation: Brain,
  custom: CircleCheck,
}

export const TYPE_TINT: Record<ChallengeType, TintName> = {
  individual: "steps",
  leaderboard: "points",
  team: "sleep",
  company: "habits",
  collaborative: "water",
}

type PhaseInfo = Pick<ChallengeSummary, "phase" | "daysLeft" | "daysToStart" | "endDate"> & { daysToScoring?: number }

export function phaseText(c: PhaseInfo) {
  const toScore = c.daysToScoring ?? c.daysToStart
  const map: Record<ChallengePhase, string> = {
    upcoming: c.daysToStart === 0 ? "Starts today" : c.daysToStart === 1 ? "Starts tomorrow" : `Starts in ${c.daysToStart} days`,
    warmup: toScore <= 1 ? "Warm-up · scoring starts tomorrow" : `Warm-up · scoring in ${toScore} days`,
    live: c.daysLeft === 0 ? "Ends today" : c.daysLeft === 1 ? "1 day left" : `${c.daysLeft} days left`,
    finalising: "Finalising results",
    ended: `Ended ${formatShortDate(c.endDate)}`,
  }
  return map[c.phase]
}

export const PHASE_ICON: Record<ChallengePhase, LucideIcon> = { upcoming: CalendarClock, warmup: Flame, live: Timer, finalising: Hourglass, ended: CircleCheck }

export const targetText = (c: Pick<ChallengeSummary, "metric" | "target" | "unit" | "totalDays">) =>
  c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit} in ${c.totalDays} days` : `${formatMetricValue(c.target, c.metric)} in ${c.totalDays} days`

/** "64,200 / 1,00,000 steps" */
export const progressText = (c: Pick<ChallengeSummary, "metric" | "target" | "unit">, value: number) =>
  `${formatMetricValue(value, c.metric, false)} / ${c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit}` : formatMetricValue(c.target, c.metric)}`

export const isOpen = (p: ChallengePhase) => p === "upcoming" || p === "warmup" || p === "live"

// ─── Card (list, suggestions) ───────────────────────────────────────────

export function ChallengeCard({ c, href, compact }: { c: ChallengeSummary; href: string; compact?: boolean }) {
  const { colors, tint } = useTheme()
  const Icon = METRIC_ICON[c.metric]
  const PhaseIcon = PHASE_ICON[c.phase]
  const pct = c.myProgress !== null && c.target ? Math.min(100, (c.myProgress / c.target) * 100) : 0
  const urgent = c.phase === "live" && c.daysLeft <= 3
  const pts = tint("points")
  return (
    <Card padding={0} onPress={() => go(href)} accessibilityLabel={`${c.name}. ${c.typeLabel} challenge. ${phaseText(c)}`} style={styles.clip} testID={`challenge-${c.id}`}>
      <GradientCard colors={[c.coverColor, alpha(c.coverColor, 0.72)]} radius={0} padding={14}>
        <View style={styles.cardHead}>
          <View style={styles.coverEmoji}>
            <Text style={styles.coverEmojiText}>{c.coverEmoji}</Text>
          </View>
          <View style={styles.flex}>
            <View style={styles.pills}>
              <OnColorPill label={c.typeLabel} />
              {c.reward ? <OnColorPill label="Reward" icon={Gift} /> : null}
              {c.hasPrizes ? <OnColorPill label="Prizes" icon={Medal} /> : null}
            </View>
            <Text variant="subtitle" color="#ffffff" numberOfLines={2} style={styles.cardTitle}>
              {c.name}
            </Text>
          </View>
          <OnColorPill label={`+${c.points}`} icon={Trophy} />
        </View>
      </GradientCard>
      <View style={styles.cardBody}>
        {!compact ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {c.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon size={14} color={colors.primary} />
            <Text variant="small" numberOfLines={1}>
              {targetText(c)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <UsersRound size={14} color={colors.mutedForeground} />
            <Text variant="small" tone="muted">
              {formatNumber(c.participantsCount)} joined
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {formatShortDate(c.startDate)} – {formatShortDate(c.endDate)}
          </Text>
        </View>
        {c.joined && c.myProgress !== null && c.type !== "collaborative" ? (
          <View style={styles.progressBlock}>
            <View style={styles.between}>
              <Text variant="caption">
                <Text variant="label">{formatMetricValue(c.myProgress, c.metric, false)}</Text>
                <Text variant="caption" tone="muted">
                  {" "}
                  / {c.metric === "custom" ? `${formatNumber(c.target)} ${c.unit}` : formatMetricValue(c.target, c.metric)}
                </Text>
              </Text>
              <Text variant="label">{Math.round(pct)}%</Text>
            </View>
            <ProgressBar value={pct} height={7} color={c.targetReached ? colors.success : colors.primary} />
          </View>
        ) : null}
        <View style={styles.between}>
          <View style={styles.metaItem}>
            <PhaseIcon size={14} color={urgent ? colors.warning : colors.mutedForeground} />
            <Text variant="small" color={urgent ? colors.warning : colors.mutedForeground}>
              {phaseText(c)}
            </Text>
          </View>
          {c.joined && c.myRank ? (
            <TintPill label={`#${c.myRank}`} icon={Trophy} color={pts.fg} bg={pts.bg} />
          ) : c.joined ? (
            <TintPill label="Joined" icon={Check} color={tint("habits").fg} bg={tint("habits").bg} />
          ) : (
            <Text variant="label" tone="primary">
              {isOpen(c.phase) ? "View & join →" : "View →"}
            </Text>
          )}
        </View>
      </View>
    </Card>
  )
}

// ─── Hero & countdown ───────────────────────────────────────────────────

type HeroInfo = Pick<ChallengeSummary, "coverEmoji" | "coverColor" | "name" | "typeLabel" | "points" | "phase" | "daysLeft" | "daysToStart" | "endDate"> & { daysToScoring?: number }

/** Gradient hero at the top of challenge screens. */
export function ChallengeHero({ c, subtitle, children }: { c: HeroInfo; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <GradientCard colors={[c.coverColor, alpha(c.coverColor, 0.7)]} emoji={c.coverEmoji}>
      <View style={styles.heroTop}>
        <View style={styles.heroEmoji}>
          <Text style={styles.heroEmojiText}>{c.coverEmoji}</Text>
        </View>
        <View style={styles.heroText}>
          <View style={styles.pills}>
            <OnColorPill label={c.typeLabel} />
            <OnColorPill label={`+${c.points} pts`} icon={Trophy} />
          </View>
          <Text variant="heading" color="#ffffff" accessibilityRole="header" style={styles.heroTitle}>
            {c.name}
          </Text>
          <OnColorPill label={phaseText(c)} dark />
        </View>
      </View>
      {subtitle ? (
        typeof subtitle === "string" ? (
          <Text variant="caption" color={WHITE_85} style={styles.heroSubtitle}>
            {subtitle}
          </Text>
        ) : (
          <View style={styles.heroSubtitle}>{subtitle}</View>
        )
      ) : null}
      {children ? <View style={styles.heroChildren}>{children}</View> : null}
    </GradientCard>
  )
}

/** "05 days 06 hrs 12 min 09 sec" boxes on a gradient. */
export function Countdown({ to, endOfDay }: { to: string; endOfDay?: boolean }) {
  const now = useNow()
  const target = new Date(`${to}T${endOfDay ? "23:59:59" : "00:00:00"}`).getTime()
  const diff = Math.max(0, target - now)
  const parts = [
    { v: Math.floor(diff / 86_400_000), l: "days" },
    { v: Math.floor((diff % 86_400_000) / 3_600_000), l: "hrs" },
    { v: Math.floor((diff % 3_600_000) / 60_000), l: "min" },
    { v: Math.floor((diff % 60_000) / 1000), l: "sec" },
  ]
  return (
    <View style={styles.countdown} accessibilityRole="timer" accessibilityLabel={`${parts[0]!.v} days ${parts[1]!.v} hours ${parts[2]!.v} minutes`}>
      {parts.map((p) => (
        <View key={p.l} style={styles.countBox}>
          <Text variant="heading" color="#ffffff" style={styles.tabular}>
            {String(p.v).padStart(2, "0")}
          </Text>
          <Text variant="small" color="rgba(255,255,255,0.8)">
            {p.l}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ─── #359 Prizes ────────────────────────────────────────────────────────

const PLACES = [
  { medal: "🥇", label: "1st place", color: "#f59e0b" },
  { medal: "🥈", label: "2nd place", color: "#94a3b8" },
  { medal: "🥉", label: "3rd place", color: "#c2774a" },
]

export function PrizesCard({ prizes }: { prizes: ChallengePrizes }) {
  const { colors } = useTheme()
  const groups = [
    { key: "individual", title: "Individual prizes", list: prizes.individual },
    { key: "team", title: "Team prizes", list: prizes.team },
  ].filter((g) => g.list.some(Boolean))
  return (
    <Card>
      <View style={styles.cardTitleRow}>
        <Trophy size={18} color="#f59e0b" />
        <Text variant="subtitle">Winner prizes</Text>
      </View>
      {groups.map((g) => (
        <View key={g.key} style={styles.prizeGroup}>
          {groups.length > 1 ? (
            <Text variant="overline" tone="muted">
              {g.title}
            </Text>
          ) : null}
          {g.list.map((prize, i) =>
            prize ? (
              <View key={i} style={[styles.prizeRow, { borderColor: alpha(PLACES[i]!.color, 0.45), backgroundColor: alpha(PLACES[i]!.color, 0.08) }]}>
                <Text style={styles.medalEmoji}>{PLACES[i]!.medal}</Text>
                <View style={styles.flex}>
                  <Text variant="small" tone="muted">
                    {PLACES[i]!.label}
                  </Text>
                  <Text variant="label" numberOfLines={2}>
                    {prize}
                  </Text>
                </View>
              </View>
            ) : null,
          )}
        </View>
      ))}
      <Text variant="small" tone="muted" style={{ color: colors.mutedForeground }}>
        Prizes are confirmed when results are final.
      </Text>
    </Card>
  )
}

// ─── #358 Warm-up / get ready ───────────────────────────────────────────

export function GetReadyCard({ warmUp, startDate, joined, trackerConnected, phase }: { warmUp: WarmUp | null; startDate: string; joined: boolean; trackerConnected: boolean; phase: ChallengePhase }) {
  const { colors, tint } = useTheme()
  const streak = tint("streak")
  const scoringStart = warmUp?.scoringStart ?? startDate
  const steps = [
    { done: joined, label: "Join the challenge", hint: joined ? "You're in." : "Tap Join to take part.", icon: Flag },
    { done: trackerConnected, label: "Connect Apple Health or Health Connect", hint: trackerConnected ? "Your tracker is connected." : "So your steps count automatically.", icon: Watch, href: trackerConnected ? undefined : "/settings/connected-apps" },
    { done: false, label: `Scoring starts ${formatDate(scoringStart, "EEE, d MMM")}`, hint: "Activity from this date counts towards your total.", icon: Flag },
  ]
  return (
    <Card style={{ borderColor: alpha("#f97316", 0.35) }}>
      <View style={styles.cardTitleRow}>
        <Flame size={18} color={streak.fg} />
        <Text variant="subtitle" style={styles.flex}>
          {phase === "warmup" ? "Warm-up period" : "Get ready"}
        </Text>
        {warmUp ? <TintPill label={`${warmUp.days}-day warm-up`} color={streak.fg} bg={streak.bg} /> : null}
      </View>
      <Text variant="caption" tone="muted" style={styles.gapSm}>
        {phase === "warmup" ? "Join now and connect your tracker — nothing is scored until the warm-up ends." : "Set yourself up before the challenge starts."}
      </Text>
      <View style={styles.steps}>
        {steps.map((s) => (
          <View key={s.label} style={styles.stepRow}>
            <View style={[styles.stepDot, s.done ? { backgroundColor: colors.success, borderColor: colors.success } : { borderColor: colors.input }]}>
              {s.done ? <Check size={14} color="#ffffff" strokeWidth={3} /> : <s.icon size={12} color={colors.mutedForeground} />}
            </View>
            <View style={styles.flex}>
              <Text variant="bodyMedium">{s.label}</Text>
              <Text variant="caption" tone="muted">
                {s.hint}
              </Text>
            </View>
            {s.href ? <Button title="Connect" size="sm" variant="outline" onPress={() => go(s.href!)} /> : null}
          </View>
        ))}
      </View>
    </Card>
  )
}

// ─── #374 Walking journey ───────────────────────────────────────────────

export function JourneyCard({ journey }: { journey: JourneyView }) {
  const { colors, tint } = useTheme()
  const pts = tint("points")
  const [width, setWidth] = useState(0)
  return (
    <Card>
      <View style={styles.between}>
        <View style={[styles.cardTitleRow, styles.flex]}>
          <MapPin size={18} color={colors.primary} />
          <Text variant="subtitle" numberOfLines={1} style={styles.flex}>
            {journey.name}
          </Text>
        </View>
        <Text variant="caption" tone="muted">
          <Text variant="label">{formatNumber(journey.doneKm, 1)}</Text> / {formatNumber(journey.totalKm, 1)} km
        </Text>
      </View>
      <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityLabel={`${formatNumber(journey.doneKm, 1)} of ${formatNumber(journey.totalKm, 1)} km walked`}>
        <View style={[styles.trackLine, { backgroundColor: colors.muted }]} />
        <View style={[styles.trackLine, { backgroundColor: colors.primary, width: `${journey.pct * 100}%` }]} />
        {width
          ? journey.milestones.map((m) => (
              <View
                key={`${m.name}-${m.km}`}
                style={[styles.milestoneDot, { left: Math.min(1, m.km / journey.totalKm) * width - 9, backgroundColor: m.reached ? colors.primary : colors.card, borderColor: m.reached ? colors.primary : colors.input }]}
              />
            ))
          : null}
        {width ? (
          <View style={[styles.walker, { left: Math.max(0, journey.pct * width - 12) }]}>
            <Text style={styles.walkerEmoji}>🚶</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.milestones}>
        {journey.milestones.map((m) => (
          <View key={`${m.name}-${m.km}-row`} style={[styles.milestoneRow, { borderColor: m.reached ? alpha("#10b981", 0.35) : colors.border, backgroundColor: m.reached ? alpha("#10b981", 0.06) : "transparent" }]}>
            {m.reached ? <CircleCheck size={16} color={colors.success} /> : <Flag size={16} color={colors.mutedForeground} />}
            <Text variant="label" numberOfLines={1} style={styles.flex}>
              {m.name}
            </Text>
            <Text variant="small" tone="muted">
              {formatNumber(m.km, 1)} km
            </Text>
            {m.reward ? <TintPill label={m.reward} color={pts.fg} bg={pts.bg} /> : null}
          </View>
        ))}
      </View>
      {journey.next ? (
        <Text variant="caption" tone="muted">
          <Text variant="label">{formatNumber(journey.next.kmToGo, 1)} km</Text> to {journey.next.name}
        </Text>
      ) : (
        <Text variant="label" tone="success">
          Journey complete! 🎉
        </Text>
      )}
    </Card>
  )
}

// ─── #350 Mini-challenges ───────────────────────────────────────────────

export function MiniChallengesCard({ minis, challengeId, joinedMain }: { minis: MiniChallengeView[]; challengeId: string; joinedMain: boolean }) {
  const { colors, tint } = useTheme()
  const join = useApiMutation(challengesApi.joinMini, { success: "You've joined the mini-challenge." })
  const ins = tint("insight")
  const statusTint = (s: MiniChallengeView["status"]) => (s === "live" ? tint("habits") : s === "upcoming" ? tint("steps") : tint("neutral"))
  return (
    <Card>
      <View style={styles.cardTitleRow}>
        <Sparkles size={18} color={ins.fg} />
        <Text variant="subtitle" style={styles.flex}>
          Mini-challenges
        </Text>
        <TintPill label="Bonus" color={ins.fg} bg={ins.bg} />
      </View>
      <Text variant="caption" tone="muted" style={styles.gapSm}>
        Short, optional competitions inside this challenge — limited winner slots.
      </Text>
      <View style={styles.minis}>
        {minis.map((m) => {
          const st = statusTint(m.status)
          return (
            <View key={m.id} style={[styles.miniRow, { borderColor: colors.border }]}>
              <View style={styles.flex}>
                <View style={styles.miniTitle}>
                  <Text variant="label" style={styles.shrink}>
                    {m.title}
                  </Text>
                  <TintPill label={m.status === "live" ? "Live" : m.status === "upcoming" ? "Soon" : "Ended"} color={st.fg} bg={st.bg} />
                </View>
                {m.description ? (
                  <Text variant="caption" tone="muted">
                    {m.description}
                  </Text>
                ) : null}
                <Text variant="small" tone="muted">
                  {m.bonusPoints ? `+${m.bonusPoints} bonus pts` : "Bonus points"}
                  {m.winnerSlots ? ` · top ${m.winnerSlots} win` : ""}
                  {m.startDate && m.endDate ? ` · ${formatDate(m.startDate, "d MMM")} – ${formatDate(m.endDate, "d MMM")}` : ""}
                  {m.joinedCount ? ` · ${m.joinedCount} joined` : ""}
                </Text>
              </View>
              {m.joined ? (
                <TintPill label="Joined" icon={Check} color={tint("habits").fg} bg={tint("habits").bg} />
              ) : (
                <Button
                  title="Join"
                  size="sm"
                  disabled={!joinedMain || m.status === "ended"}
                  loading={join.isPending && join.variables?.miniId === m.id}
                  onPress={() => join.mutate({ id: challengeId, miniId: m.id })}
                  accessibilityLabel={`Join ${m.title}`}
                />
              )}
            </View>
          )
        })}
      </View>
      {!joinedMain ? (
        <Text variant="small" tone="muted">
          Join the main challenge to take part in mini-challenges.
        </Text>
      ) : null}
    </Card>
  )
}

// ─── #356 Invite / join by code ─────────────────────────────────────────

export const joinLink = (code: string) => Linking.createURL(`/challenges/join/${code}`)

export function InviteCodeCard({ code, name }: { code: string; name: string }) {
  const { colors } = useTheme()
  return (
    <Card>
      <View style={styles.cardTitleRow}>
        <QrCode size={18} color={colors.primary} />
        <Text variant="subtitle">Invite colleagues</Text>
      </View>
      <Text variant="caption" tone="muted" style={styles.gapSm}>
        Share the code or link — colleagues enter it under Challenges → Join with code.
      </Text>
      <View style={[styles.codeBox, { borderColor: colors.input, backgroundColor: colors.muted }]}>
        <Text variant="title" selectable style={styles.code} accessibilityLabel={`Code ${code.split("").join(" ")}`}>
          {code}
        </Text>
      </View>
      <View style={styles.row2}>
        <Button title="Copy code" icon={KeyRound} variant="outline" size="md" block style={styles.flex} onPress={() => copyText(code, "Code")} />
        <Button
          title="Share link"
          icon={Share2}
          variant="outline"
          size="md"
          block
          style={styles.flex}
          onPress={() => shareText(`Join me in "${name}" on HealthX! Use code ${code} or open ${joinLink(code)}`, "Join my challenge")}
        />
      </View>
    </Card>
  )
}

/** "Join with code" bottom sheet (Challenges tab, join-code error screen). */
export function JoinCodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("")
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const error = code && clean.length < 4 ? "Codes have at least 4 letters or numbers" : undefined
  const submit = () => {
    if (clean.length < 4) return
    haptic.tap()
    onClose()
    setCode("")
    router.push(`/challenges/join/${clean}` as never)
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Join with code"
      description="Enter the short code from a poster, QR code or message from your HR team."
      footer={<Button title="Find challenge" icon={KeyRound} disabled={clean.length < 4} onPress={submit} testID="join-code-submit" />}
    >
      <TextField
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="e.g. 7K2F9Q"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={16}
        returnKeyType="go"
        onSubmitEditing={submit}
        error={error}
        hint="Scanning a challenge QR code with your camera opens it directly."
        icon={Smartphone}
        accessibilityLabel="Challenge code"
        testID="join-code-input"
      />
    </BottomSheet>
  )
}

// ─── #355 Certificate ───────────────────────────────────────────────────

export function CertificateSheet({ certificate, color, open, onClose }: { certificate: NonNullable<ChallengeResults["certificate"]>; color: string; open: boolean; onClose: () => void }) {
  const text = `Certificate of completion\n\n${certificate.employeeName} successfully completed ${certificate.challengeName}.\n${certificate.achievement}\n\n${certificate.companyName} · Completed ${formatDate(certificate.completedOn, "d MMMM yyyy")}\nHealthX Wellness · No. ${certificate.certificateNo}`
  const print = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.print()
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Completion certificate"
      description={Platform.OS === "web" ? "Print it or choose “Save as PDF”." : "Share it or save it to your files."}
      footer={
        <View style={styles.row2}>
          <Button title="Close" variant="outline" size="md" block style={styles.flex} onPress={onClose} />
          {Platform.OS === "web" ? (
            <Button title="Print / PDF" icon={Award} size="md" block style={styles.flex} onPress={print} />
          ) : (
            <Button title="Share" icon={Share2} size="md" block style={styles.flex} onPress={() => shareText(text, "My HealthX certificate")} />
          )}
        </View>
      }
    >
      <View style={[styles.cert, { borderColor: color }]} testID="certificate">
        <View style={[styles.certInner, { borderColor: alpha(color, 0.5) }]}>
          <Text variant="overline" color="#64748b" align="center">
            Certificate of completion
          </Text>
          <Text variant="caption" color="#64748b" align="center">
            This certifies that
          </Text>
          <Text variant="title" color="#0f172a" align="center">
            {certificate.employeeName}
          </Text>
          <Text variant="caption" color="#64748b" align="center">
            successfully completed
          </Text>
          <Text variant="heading" color={color} align="center">
            {certificate.challengeName}
          </Text>
          <Text variant="caption" color="#475569" align="center">
            {certificate.achievement}
          </Text>
          <View style={styles.certFoot}>
            <View style={styles.flex}>
              <Text variant="small" color="#334155" weight="semibold">
                {certificate.companyName}
              </Text>
              <Text variant="small" color="#64748b">
                {formatDate(certificate.completedOn, "d MMM yyyy")}
              </Text>
            </View>
            <Award size={30} color={color} />
            <View style={[styles.flex, styles.alignEnd]}>
              <Text variant="small" color="#334155" weight="semibold">
                HealthX Wellness
              </Text>
              <Text variant="small" color="#64748b">
                No. {certificate.certificateNo}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </BottomSheet>
  )
}

/** Small row used for "challenge" boards and suggestions. */
export function ChallengeMiniRow({ c, subtitle, right, onPress }: { c: Pick<ChallengeSummary, "id" | "name" | "coverEmoji" | "coverColor">; subtitle?: string; right?: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={({ pressed }) => [styles.miniLink, pressed && { opacity: 0.8 }]}
    >
      <EmojiTile emoji={c.coverEmoji} color={c.coverColor} size={44} solid />
      <View style={styles.flex}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {c.name}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  alignEnd: { alignItems: "flex-end" },
  clip: { overflow: "hidden" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gapSm: { marginTop: 4 },
  row2: { flexDirection: "row", gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  coverEmoji: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  coverEmojiText: { fontSize: 26, lineHeight: 32 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cardTitle: { marginTop: 6 },
  cardBody: { padding: 14, gap: 10 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 14, rowGap: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  progressBlock: { gap: 6 },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  heroEmoji: { width: 60, height: 60, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  heroEmojiText: { fontSize: 32, lineHeight: 40 },
  heroText: { flex: 1, gap: 8 },
  heroTitle: { fontSize: 21, lineHeight: 27 },
  heroSubtitle: { marginTop: 12 },
  heroChildren: { marginTop: 16 },
  countdown: { flexDirection: "row", gap: 8 },
  countBox: { flex: 1, alignItems: "center", borderRadius: RADIUS.md, backgroundColor: "rgba(255,255,255,0.18)", paddingVertical: 8 },
  tabular: { fontVariant: ["tabular-nums"] },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prizeGroup: { gap: 8, marginTop: 12 },
  prizeRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: 10 },
  medalEmoji: { fontSize: 26, lineHeight: 32 },
  steps: { gap: 12, marginTop: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  track: { height: 56, justifyContent: "center", marginTop: 8, marginHorizontal: 9 },
  trackLine: { position: "absolute", left: 0, right: 0, height: 8, borderRadius: 4, top: 30 },
  milestoneDot: { position: "absolute", top: 25, width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  walker: { position: "absolute", top: 0 },
  walkerEmoji: { fontSize: 20, lineHeight: 26 },
  milestones: { gap: 8, marginVertical: 10 },
  milestoneRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 9 },
  minis: { gap: 10, marginVertical: 12 },
  miniRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12 },
  miniTitle: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  codeBox: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: "center", marginVertical: 12 },
  code: { letterSpacing: 6, fontVariant: ["tabular-nums"] },
  cert: { borderWidth: 4, borderRadius: RADIUS.xl, backgroundColor: "#ffffff", padding: 8 },
  certInner: { borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, padding: 18, gap: 6, alignItems: "center" },
  certFoot: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 14, alignSelf: "stretch" },
  miniLink: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64 },
})
