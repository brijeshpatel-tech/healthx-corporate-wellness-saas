/**
 * AI Wellness Coach (Phase 2): SCR-M-066 introduction & consent, SCR-M-067 chat.
 * General wellness guidance only — never medical advice (disclaimer pinned above the chat).
 */
import { useQueryClient } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import {
  BookOpen,
  Bot,
  CalendarCheck,
  ChevronRight,
  Clock,
  Droplets,
  Dumbbell,
  EllipsisVertical,
  Eraser,
  Footprints,
  Gauge,
  Info,
  ListChecks,
  Lock,
  MessageCircle,
  Moon,
  Phone,
  RefreshCw,
  SendHorizontal,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Stethoscope,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from "lucide-react-native"
import { Fragment, useEffect, useRef, useState } from "react"
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native"
import { BottomSheet, Button, Card, Checkbox, ConfirmDialog, ErrorState, IconButton, IconTile, PhaseBadge, Screen, Skeleton, Text } from "@/components/ui"
import { COACH_MAX_CHARS, coachApi, type CoachAccess, type CoachCard, type CoachConversation, type CoachLinkIcon, type CoachMessage } from "@/lib/api/employee/coach"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatNumber, formatTime, titleCase } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { openHref } from "@/lib/routes"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { FONTS, RADIUS, type TintName } from "@/theme/tokens"
import { alpha, EmojiTile, go, GradientCard, replace } from "./shared"

const CONV_KEY = ["employee", "coach", "conversation"]

/** Gradient coach avatar. */
export function CoachAvatar({ size = 40 }: { size?: number }) {
  return (
    <LinearGradient colors={["#8b5cf6", "#6366f1", "#10b981"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: "center", justifyContent: "center" }}>
      <Bot size={size * 0.5} color="#ffffff" />
    </LinearGradient>
  )
}

const call = (n: string) => Linking.openURL(`tel:${n}`).catch(() => toast.info(`Call ${n} from your phone.`))

/** Non-medical disclaimer. `compact` = one-line banner pinned above the chat thread. */
export function CoachDisclaimer({ compact }: { compact?: boolean }) {
  const { tint } = useTheme()
  const t = tint("points")
  if (compact)
    return (
      <View style={[styles.discCompact, { backgroundColor: t.bg, borderColor: alpha("#f59e0b", 0.3) }]} accessibilityRole="text">
        <Stethoscope size={14} color={t.fg} style={styles.mt1} />
        <Text variant="small" style={styles.flex}>
          General wellness guidance, <Text variant="small" weight="bold">not medical advice</Text>. For health concerns see a doctor. Emergency?{" "}
          <Text variant="small" weight="bold" tone="destructive" onPress={() => call("112")}>
            Call 112
          </Text>
          .
        </Text>
      </View>
    )
  return (
    <View style={[styles.disc, { backgroundColor: t.bg, borderColor: alpha("#f59e0b", 0.3) }]}>
      <IconTile icon={Stethoscope} tint="points" />
      <View style={styles.flex}>
        <Text variant="subtitle">Not medical advice</Text>
        <Text variant="caption" tone="muted">
          • The coach gives general wellness guidance. It can&apos;t diagnose conditions, interpret symptoms or recommend medication.
        </Text>
        <Text variant="caption" tone="muted">
          • For any medical concern, please speak to a doctor.
        </Text>
        <Text variant="caption" tone="muted">
          • In an emergency,{" "}
          <Text variant="caption" weight="bold" tone="destructive" onPress={() => call("112")}>
            call 112
          </Text>{" "}
          straight away.
        </Text>
      </View>
    </View>
  )
}

function inline(text: string, color?: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={i} variant="body" weight="semibold" color={color}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Tiny formatter for coach answers: paragraphs, "- " bullets and **bold** (no HTML). */
export function RichText({ text }: { text: string }) {
  const blocks: ({ type: "p"; text: string } | { type: "ul"; items: string[] })[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    if (/^\s*[-•]\s+/.test(line)) {
      const item = line.replace(/^\s*[-•]\s+/, "")
      const last = blocks[blocks.length - 1]
      if (last && last.type === "ul") last.items.push(item)
      else blocks.push({ type: "ul", items: [item] })
    } else blocks.push({ type: "p", text: line })
  }
  return (
    <View style={styles.rich}>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <Text key={i} variant="body" selectable>
            {inline(b.text)}
          </Text>
        ) : (
          <View key={i} style={styles.ul}>
            {b.items.map((it, j) => (
              <View key={j} style={styles.li}>
                <Text variant="body">•</Text>
                <Text variant="body" style={styles.flex}>
                  {inline(it)}
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  )
}

const LINK_ICON: Record<CoachLinkIcon, { icon: LucideIcon; tint: TintName }> = {
  steps: { icon: Footprints, tint: "steps" },
  water: { icon: Droplets, tint: "water" },
  sleep: { icon: Moon, tint: "sleep" },
  habits: { icon: ListChecks, tint: "habits" },
  score: { icon: Gauge, tint: "workout" },
  nutrition: { icon: Utensils, tint: "points" },
  article: { icon: BookOpen, tint: "insight" },
  workouts: { icon: Dumbbell, tint: "workout" },
}

/** Tappable card attached to a coach answer (workout, plan or module link). */
export function CoachCardView({ card }: { card: CoachCard }) {
  const { colors } = useTheme()
  if (card.type === "workout")
    return (
      <Card padding={12} onPress={() => go(`/workouts/${card.id}`)} accessibilityLabel={`Open workout ${card.name}`}>
        <View style={styles.cardRow}>
          <EmojiTile emoji={card.emoji} color={card.color} size={44} solid />
          <View style={styles.flex}>
            <Text variant="label" numberOfLines={1}>
              {card.name}
            </Text>
            <View style={styles.rowSm}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text variant="small" tone="muted">
                {card.durationMin} min · {titleCase(card.level)} · {titleCase(card.location)}
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </View>
      </Card>
    )
  if (card.type === "plan")
    return (
      <GradientCard colors={["#10b981", "#14b8a6", "#0284c7"]} padding={14} radius={RADIUS.xl} onPress={() => go("/coach/plan")} accessibilityLabel={`Open plan: ${card.title}`}>
        <View style={styles.cardRow}>
          <View style={styles.planIcon}>
            <CalendarCheck size={20} color="#ffffff" />
          </View>
          <View style={styles.flex}>
            <Text variant="subtitle" color="#ffffff">
              {card.title}
            </Text>
            <Text variant="small" color="rgba(255,255,255,0.88)">
              {card.summary}
            </Text>
          </View>
          <View style={styles.openPill}>
            <Text variant="small" color="#047857" weight="bold">
              Open plan
            </Text>
          </View>
        </View>
      </GradientCard>
    )
  const v = LINK_ICON[card.icon]
  return (
    <Card padding={12} onPress={() => openHref(card.href)} accessibilityLabel={card.label}>
      <View style={styles.cardRow}>
        <IconTile icon={v.icon} tint={v.tint} size={36} />
        <View style={styles.flex}>
          <Text variant="label" numberOfLines={1}>
            {card.label}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {card.description}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </View>
    </Card>
  )
}

/** Three pulsing dots inside an assistant bubble. */
function TypingBubble() {
  const { colors } = useTheme()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 3), 300)
    return () => clearInterval(t)
  }, [])
  return (
    <View style={styles.assistantRow} accessibilityLabel="Coach is typing" accessibilityRole="progressbar">
      <CoachAvatar size={30} />
      <View style={[styles.typing, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.typingDot, { backgroundColor: colors.mutedForeground, opacity: tick === i ? 1 : 0.35 }]} />
        ))}
      </View>
    </View>
  )
}

const LEARN_MORE: { title: string; body: string }[] = [
  { title: "How it works", body: "When you ask a question, the coach looks at your recent wellness data and your preferences, then suggests simple next steps. It works only inside HealthX." },
  {
    title: "What it never does",
    body: "It never diagnoses conditions, interprets symptoms or recommends medication. Questions about health problems get a safe answer pointing you to a doctor or a qualified professional — and to emergency services (112) when it's urgent.",
  },
  { title: "Who can see your chats", body: "Only you. HR, managers and colleagues can never see your conversations or the data the coach uses. Your company only sees anonymous totals, such as how many people used the coach." },
  { title: "Your choices", body: "Clear a conversation at any time, and turn AI personalisation off in Privacy & consent. When it's off, the coach stops using your data." },
  { title: "Daily limit", body: "To keep the service fast for everyone, you can ask up to 30 questions a day." },
]

export function LearnMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="About the AI Wellness Coach" description="What it does, the data it uses and how your privacy is protected." footer={<Button title="Got it" onPress={onClose} />}>
      {LEARN_MORE.map((s) => (
        <View key={s.title} style={styles.gap4}>
          <Text variant="subtitle">{s.title}</Text>
          <Text variant="caption" tone="muted">
            {s.body}
          </Text>
        </View>
      ))}
    </BottomSheet>
  )
}

// ─── SCR-M-066 Introduction & consent ───────────────────────────────────

const CAN_DO: { icon: LucideIcon; tint: TintName; title: string; text: string }[] = [
  { icon: MessageCircle, tint: "workout", title: "Answer wellness questions", text: "Sleep, stress, hydration, steps — in plain language." },
  { icon: Dumbbell, tint: "habits", title: "Suggest workouts", text: "Sessions that fit your time, place and level." },
  { icon: Utensils, tint: "points", title: "Meal ideas", text: "Indian-friendly ideas that match your food preference." },
  { icon: CalendarCheck, tint: "steps", title: "Build a 7-day plan", text: "Daily steps you can tick off as you go." },
]

const DATA_USED: { icon: LucideIcon; tint: TintName; title: string; text: string }[] = [
  { icon: Footprints, tint: "steps", title: "Steps & activity", text: "Daily steps, active minutes and sessions" },
  { icon: Moon, tint: "sleep", title: "Sleep", text: "Nights you've tracked or synced" },
  { icon: Droplets, tint: "water", title: "Water", text: "Daily intake against your goal" },
  { icon: ListChecks, tint: "habits", title: "Workouts & habits", text: "What you've completed and your streaks" },
  { icon: Gauge, tint: "workout", title: "Wellness score", text: "Your score and its six areas" },
  { icon: SlidersHorizontal, tint: "neutral", title: "Your preferences", text: "Main goal, food preference, workout place and time" },
]

export function CoachIntro({ access }: { access: CoachAccess }) {
  const { colors, tint } = useTheme()
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string>()
  const [learnMore, setLearnMore] = useState(false)
  const agree = useApiMutation(coachApi.setConsent, {
    success: "You're all set — ask me anything!",
    errorTitle: "Couldn't save your choice.",
    invalidate: [["employee", "coach"]],
    onSuccess: () => haptic.success(),
  })
  const submit = () => {
    if (!agreed) {
      haptic.error()
      setError("Tick the box to give your consent.")
      return
    }
    agree.mutate({ granted: true, source: "ai_coach_intro" })
  }
  return (
    <Screen
      title="AI Coach"
      back
      right={<PhaseBadge phase={2} />}
      footer={
        <>
          <Button title="Agree & start" loading={agree.isPending} onPress={submit} feedback="none" testID="coach-agree" />
          <View style={styles.row2}>
            <Button title="Not now" variant="outline" size="md" block style={styles.flex1} onPress={() => replace("/home")} />
            <Button title="Learn more" icon={Info} variant="ghost" size="md" block style={styles.flex1} onPress={() => setLearnMore(true)} />
          </View>
        </>
      }
      testID="coach-intro"
    >
      <GradientCard colors={["#7c3aed", "#4f46e5", "#10b981"]}>
        <View style={styles.cardRow}>
          <View style={styles.heroAvatar}>
            <Bot size={28} color="#ffffff" />
          </View>
          <Text variant="label" color="rgba(255,255,255,0.88)">
            AI Wellness Coach
          </Text>
        </View>
        <Text variant="title" color="#ffffff" style={styles.mt12}>
          Hi {access.firstName}, meet your personal wellness coach
        </Text>
        <Text variant="caption" color="rgba(255,255,255,0.9)" style={styles.mt4}>
          Ask questions any time and get tips, workouts, meal ideas and a 7-day plan — personalised from your own HealthX data.
        </Text>
      </GradientCard>

      <Text variant="overline" tone="muted">
        What the coach can do
      </Text>
      <View style={styles.grid}>
        {CAN_DO.map((c) => (
          <View key={c.title} style={[styles.canDo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <IconTile icon={c.icon} tint={c.tint} size={36} />
            <Text variant="label">{c.title}</Text>
            <Text variant="small" tone="muted">
              {c.text}
            </Text>
          </View>
        ))}
      </View>

      <View>
        <Text variant="overline" tone="muted">
          What data it uses
        </Text>
        <Text variant="small" tone="muted">
          Only your own data that you&apos;ve allowed in Privacy &amp; consent — nothing else.
        </Text>
      </View>
      <Card padding={4}>
        {DATA_USED.map((d) => (
          <View key={d.title} style={styles.dataRow}>
            <IconTile icon={d.icon} tint={d.tint} size={34} />
            <View style={styles.flex}>
              <Text variant="label">{d.title}</Text>
              <Text variant="small" tone="muted">
                {d.text}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <View style={[styles.privacy, { backgroundColor: tint("habits").bg }]}>
        <ShieldCheck size={20} color={tint("habits").fg} />
        <View style={styles.flex}>
          <Text variant="label">HR and colleagues can never see your conversations.</Text>
          <Text variant="caption" tone="muted">
            Your chats are private and encrypted. {access.companyName} only ever sees combined, anonymous usage numbers. You can clear your chats or turn the coach off at any time.
          </Text>
        </View>
      </View>

      <CoachDisclaimer />

      <Card>
        <View style={styles.rowSm}>
          <Lock size={14} color={colors.mutedForeground} />
          <Text variant="subtitle">AI personalisation consent</Text>
        </View>
        <View style={styles.mt8}>
          <Checkbox
            checked={agreed}
            onChange={(v) => {
              setAgreed(v)
              setError(undefined)
            }}
            error={!!error}
            label="I agree that the AI coach can use my wellness data listed above to personalise its answers."
            description={`Consent version ${access.version}${access.updatedAt ? ` · last changed ${formatDate(access.updatedAt)}` : ""}. You can withdraw it any time in Privacy & consent.`}
            testID="coach-consent"
          />
        </View>
        {error ? (
          <Text variant="caption" tone="destructive" style={styles.mt8}>
            {error}
          </Text>
        ) : null}
        {agree.error ? (
          <Text variant="caption" tone="destructive" style={styles.mt8}>
            Couldn&apos;t save your choice. Please try again.
          </Text>
        ) : null}
      </Card>
      <LearnMoreSheet open={learnMore} onClose={() => setLearnMore(false)} />
    </Screen>
  )
}

// ─── SCR-M-067 Chat ─────────────────────────────────────────────────────

interface StreamState {
  id: string
  phase: "typing" | "streaming"
  shown: number
}

const SUGGESTION_ICON: Record<string, LucideIcon> = {
  "How can I improve my wellness score?": Gauge,
  "Give me a 20-minute workout.": Dumbbell,
  "What should I eat for lunch?": Utensils,
  "How can I improve my sleep?": Moon,
  "Create a 7-day wellness plan.": CalendarCheck,
}

function UserBubble({ text, at, pending, failed }: { text: string; at?: string; pending?: boolean; failed?: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={styles.userWrap}>
      <View style={[styles.userBubble, { backgroundColor: failed ? alpha(colors.primary, 0.6) : colors.primary }, pending && styles.dim]}>
        <Text variant="body" color={colors.primaryForeground} selectable>
          {text}
        </Text>
      </View>
      <Text variant="small" tone="muted">
        {failed ? "Not sent" : pending ? "Sending…" : at ? formatTime(at) : ""}
      </Text>
    </View>
  )
}

function AssistantBubble({ message: m, partial, onRate }: { message: CoachMessage; partial?: string; onRate?: (v: "up" | "down") => void }) {
  const { colors, tint } = useTheme()
  const streaming = partial !== undefined
  const crisis = m.safety === "crisis"
  const medical = m.safety === "medical"
  const tone = crisis ? tint("danger") : medical ? tint("points") : null
  return (
    <View style={styles.assistantRow}>
      <CoachAvatar size={30} />
      <View style={styles.assistantCol}>
        <View style={[styles.assistantBubble, { backgroundColor: tone ? tone.bg : colors.card, borderColor: tone ? alpha(tone.fg, 0.4) : colors.border }]}>
          {tone ? (
            <View style={[styles.rowSm, styles.mb6]}>
              <ShieldAlert size={14} color={tone.fg} />
              <Text variant="overline" color={tone.fg}>
                {crisis ? "Please get support now" : "Safety note"}
              </Text>
            </View>
          ) : null}
          <RichText text={streaming ? `${partial}▍` : m.content} />
        </View>
        {!streaming && crisis ? (
          <View style={styles.row2}>
            <Button title="Call 112" icon={Phone} variant="destructive" size="md" onPress={() => call("112")} />
            <Button title="Tele-MANAS 14416" icon={Phone} variant="outline" size="md" onPress={() => call("14416")} />
          </View>
        ) : null}
        {!streaming && m.cards.length ? (
          <View style={styles.gap8}>
            {m.cards.map((c, i) => (
              <CoachCardView key={i} card={c} />
            ))}
          </View>
        ) : null}
        {!streaming ? (
          <View style={styles.rateRow}>
            <Text variant="small" tone="muted">
              {formatTime(m.at)}
            </Text>
            {onRate ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Helpful" accessibilityState={{ selected: m.feedback === "up" }} hitSlop={6} onPress={() => onRate("up")} style={[styles.rateBtn, m.feedback === "up" && { backgroundColor: colors.primarySoft }]}>
                  <ThumbsUp size={14} color={m.feedback === "up" ? colors.primary : colors.mutedForeground} fill={m.feedback === "up" ? colors.primary : "transparent"} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Not helpful" accessibilityState={{ selected: m.feedback === "down" }} hitSlop={6} onPress={() => onRate("down")} style={[styles.rateBtn, m.feedback === "down" && { backgroundColor: colors.destructiveSoft }]}>
                  <ThumbsDown size={14} color={m.feedback === "down" ? colors.destructive : colors.mutedForeground} fill={m.feedback === "down" ? colors.destructive : "transparent"} />
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function Welcome({ firstName, suggestions, onPick, disabled }: { firstName: string; suggestions: string[]; onPick: (s: string) => void; disabled: boolean }) {
  const { colors } = useTheme()
  return (
    <View style={styles.welcome}>
      <CoachAvatar size={76} />
      <Text variant="title" align="center">
        Hi {firstName}! What shall we work on?
      </Text>
      <Text variant="caption" tone="muted" align="center">
        Ask me about steps, sleep, food, workouts or stress. I&apos;ll use your own data to make my answers personal.
      </Text>
      <View style={styles.suggestions}>
        {suggestions.map((s) => {
          const Icon = SUGGESTION_ICON[s] ?? Info
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => {
                haptic.tap()
                onPick(s)
              }}
              style={({ pressed }) => [styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }, pressed && { opacity: 0.8 }, disabled && styles.dim]}
            >
              <View style={[styles.sugIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon size={17} color={colors.primary} />
              </View>
              <Text variant="bodyMedium" style={styles.flex}>
                {s}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function CoachChat({ access }: { access: CoachAccess }) {
  const { colors } = useTheme()
  const qc = useQueryClient()
  const conv = useApiQuery(CONV_KEY, () => coachApi.conversation())
  const [stream, setStream] = useState<StreamState | null>(null)
  const [failed, setFailed] = useState<{ text: string; limit: boolean } | null>(null)
  const [draft, setDraft] = useState("")
  const [draftError, setDraftError] = useState<string>()
  const [menu, setMenu] = useState(false)
  const [confirm, setConfirm] = useState<"clear" | "withdraw" | null>(null)
  const [about, setAbout] = useState(false)
  const scroll = useRef<ScrollView>(null)

  const send = useApiMutation(coachApi.send, {
    invalidate: false,
    errorTitle: "Message not sent",
    onSuccess: (res) => {
      qc.setQueryData<CoachConversation>(CONV_KEY, (old) => (old ? { ...old, messages: [...old.messages, res.user, res.reply], usedToday: res.usedToday } : old))
      setStream({ id: res.reply.id, phase: "typing", shown: 0 })
      setFailed(null)
      if (res.reply.cards.some((c) => c.type === "plan")) void qc.invalidateQueries({ queryKey: ["employee", "coach", "plan"] })
    },
    onError: (err, input) => setFailed({ text: input.message, limit: err.status === 429 }),
  })
  const feedback = useApiMutation(coachApi.feedback, {
    invalidate: false,
    onSuccess: (r) => {
      if (r.value) toast.success("Thanks for your feedback", { description: r.value === "up" ? "Glad that helped!" : "We'll use it to improve the coach." })
    },
    onError: () => void qc.invalidateQueries({ queryKey: CONV_KEY }),
  })
  const clear = useApiMutation(coachApi.clear, {
    success: "Conversation cleared",
    invalidate: [["employee", "coach"]],
    onSuccess: () => {
      setStream(null)
      setFailed(null)
      setConfirm(null)
    },
  })
  const withdraw = useApiMutation(coachApi.setConsent, { success: "AI personalisation turned off", invalidate: [["employee", "coach"]], onSuccess: () => setConfirm(null) })

  const messages = conv.data?.messages ?? []
  const used = conv.data?.usedToday ?? access.usedToday
  const limit = conv.data?.dailyLimit ?? access.dailyLimit
  const limitReached = used >= limit
  const busy = send.isPending || !!stream
  const streamTarget = stream ? (messages.find((m) => m.id === stream.id)?.content.length ?? 0) : 0
  const streamId = stream?.id
  const streamPhase = stream?.phase

  // Reveal the answer progressively ("streaming") — timers only.
  useEffect(() => {
    if (!streamId) return
    if (streamPhase === "typing") {
      const t = setTimeout(() => setStream((s) => (s && s.id === streamId ? { ...s, phase: "streaming" } : s)), 650)
      return () => clearTimeout(t)
    }
    const step = Math.max(3, Math.ceil(streamTarget / 90))
    const t = setInterval(() => {
      setStream((s) => {
        if (!s || s.id !== streamId) return s
        const next = s.shown + step
        return next >= streamTarget ? null : { ...s, shown: next }
      })
    }, 24)
    return () => clearInterval(t)
  }, [streamId, streamPhase, streamTarget])

  // Consent withdrawn elsewhere → fall back to the intro.
  const consentLost = conv.error?.code === "consent_required"
  useEffect(() => {
    if (consentLost) void qc.invalidateQueries({ queryKey: ["employee", "coach", "access"] })
  }, [consentLost, qc])

  const doSend = (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    if (message.length > COACH_MAX_CHARS) return setDraftError(`Keep your message under ${formatNumber(COACH_MAX_CHARS)} characters.`)
    if (limitReached) {
      toast.error("You've reached today's question limit.")
      return
    }
    haptic.tap()
    setFailed(null)
    setDraft("")
    setDraftError(undefined)
    send.mutate({ message })
  }

  const rate = (m: CoachMessage, value: "up" | "down") => {
    haptic.select()
    const next = m.feedback === value ? null : value
    qc.setQueryData<CoachConversation>(CONV_KEY, (old) => (old ? { ...old, messages: old.messages.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)) } : old))
    feedback.mutate({ id: m.id, value: next })
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const followUps = !busy && !failed && lastAssistant && messages[messages.length - 1]?.id === lastAssistant.id ? (lastAssistant.followUps.length ? lastAssistant.followUps : conv.data?.suggestions.slice(0, 3)) : undefined
  const overLimit = draft.length > COACH_MAX_CHARS

  const composer = limitReached ? (
    <View style={[styles.limit, { backgroundColor: alpha("#f59e0b", 0.12) }]} accessibilityRole="alert">
      <TriangleAlert size={16} color="#d97706" />
      <View style={styles.flex}>
        <Text variant="label">You&apos;ve reached today&apos;s question limit.</Text>
        <Text variant="small" tone="muted">
          You can ask up to {limit} questions a day. Come back tomorrow — your plan and past answers are still here.
        </Text>
      </View>
    </View>
  ) : (
    <View>
      <View style={[styles.composer, { backgroundColor: colors.card, borderColor: overLimit || draftError ? colors.destructive : colors.input }]}>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t)
            setDraftError(undefined)
          }}
          placeholder="Ask about sleep, food, workouts…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={COACH_MAX_CHARS + 50}
          accessibilityLabel="Message the coach"
          style={[styles.input, { color: colors.foreground }]}
          testID="coach-input"
        />
        <IconButton icon={SendHorizontal} variant="primary" accessibilityLabel="Send message" disabled={busy || !draft.trim() || overLimit} onPress={() => doSend(draft)} testID="coach-send" />
      </View>
      <View style={styles.composerMeta}>
        <Text variant="small" tone={draftError || overLimit ? "destructive" : "muted"} numberOfLines={1} style={styles.flex}>
          {draftError ?? (overLimit ? `Keep your message under ${formatNumber(COACH_MAX_CHARS)} characters.` : `${limit - used} of ${limit} questions left today`)}
        </Text>
        <Text variant="small" tone={overLimit ? "destructive" : "muted"}>
          {formatNumber(draft.length)}/{formatNumber(COACH_MAX_CHARS)}
        </Text>
      </View>
    </View>
  )

  return (
    <Screen
      title="AI Coach"
      subtitle="Private to you"
      back
      scroll={false}
      right={
        <>
          <IconButton icon={CalendarCheck} variant="ghost" accessibilityLabel="My 7-day plan" onPress={() => go("/coach/plan")} testID="coach-plan" />
          <IconButton icon={EllipsisVertical} variant="ghost" accessibilityLabel="Coach options" onPress={() => setMenu(true)} />
        </>
      }
      footer={composer}
      contentStyle={styles.chatContent}
      testID="coach-chat"
    >
      <View style={styles.chatTop}>
        <CoachDisclaimer compact />
      </View>
      <ScrollView ref={scroll} style={styles.flex1} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {conv.error && !consentLost ? (
          <ErrorState title="Coach is unavailable right now. Please try again later." error={conv.error} onRetry={() => conv.refetch()} retrying={conv.isFetching} />
        ) : !conv.data ? (
          <View style={styles.gap8}>
            <Skeleton height={44} width="60%" radius={RADIUS.xl} style={styles.alignEnd} />
            <Skeleton height={120} width="80%" radius={RADIUS.xl} />
          </View>
        ) : !messages.length && !send.isPending ? (
          <Welcome firstName={access.firstName} suggestions={conv.data.suggestions} onPick={doSend} disabled={busy || limitReached} />
        ) : (
          <>
            {messages.map((m) => {
              if (m.role === "user") return <UserBubble key={m.id} text={m.content} at={m.at} />
              if (stream && stream.id === m.id) return stream.phase === "typing" ? <TypingBubble key={m.id} /> : <AssistantBubble key={m.id} message={m} partial={m.content.slice(0, stream.shown)} />
              return <AssistantBubble key={m.id} message={m} onRate={(v) => rate(m, v)} />
            })}
            {send.isPending ? (
              <>
                <UserBubble text={send.variables?.message ?? ""} pending />
                <TypingBubble />
              </>
            ) : null}
            {failed ? (
              <View style={styles.failed}>
                <UserBubble text={failed.text} failed />
                <View style={[styles.failBox, { backgroundColor: colors.destructiveSoft }]} accessibilityRole="alert">
                  <TriangleAlert size={16} color={colors.destructive} />
                  <Text variant="caption" style={styles.flex}>
                    {failed.limit ? "You've reached today's question limit." : "Coach is unavailable right now. Please try again later."}
                  </Text>
                  {!failed.limit ? <Button title="Retry" icon={RefreshCw} size="sm" variant="outline" onPress={() => doSend(failed.text)} /> : null}
                </View>
              </View>
            ) : null}
            {followUps?.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.followUps}>
                {followUps.map((s) => (
                  <Pressable key={s} accessibilityRole="button" disabled={limitReached} onPress={() => doSend(s)} style={({ pressed }) => [styles.followUp, { borderColor: alpha(colors.primary, 0.35), backgroundColor: colors.primarySoft }, pressed && { opacity: 0.8 }]}>
                    <Text variant="label" tone="primary" numberOfLines={1}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Coach options">
        <Button
          title="About the coach"
          icon={Info}
          variant="outline"
          onPress={() => {
            setMenu(false)
            setAbout(true)
          }}
        />
        <Button
          title="Clear conversation"
          icon={Eraser}
          variant="outline"
          disabled={!messages.length}
          onPress={() => {
            setMenu(false)
            setConfirm("clear")
          }}
        />
        <Button
          title="Turn off personalisation"
          icon={ShieldOff}
          variant="destructive"
          onPress={() => {
            setMenu(false)
            setConfirm("withdraw")
          }}
        />
      </BottomSheet>
      <ConfirmDialog
        open={confirm === "clear"}
        title="Clear this conversation?"
        message="All messages in this chat will be deleted. Your 7-day plan is kept."
        confirmLabel="Clear"
        destructive
        loading={clear.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => conv.data && clear.mutate({ id: conv.data.id })}
      />
      <ConfirmDialog
        open={confirm === "withdraw"}
        title="Turn off AI personalisation?"
        message="The coach will stop using your wellness data and you'll need to give consent again to chat. You can also change this in Privacy & consent."
        confirmLabel="Turn off"
        destructive
        loading={withdraw.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => withdraw.mutate({ granted: false, source: "ai_coach_chat" })}
      />
      <LearnMoreSheet open={about} onClose={() => setAbout(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  flex1: { flex: 1 },
  mt1: { marginTop: 1 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mb6: { marginBottom: 6 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  dim: { opacity: 0.6 },
  alignEnd: { alignSelf: "flex-end" },
  row2: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  rowSm: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  discCompact: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 8 },
  disc: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: RADIUS.xl, padding: 14 },
  rich: { gap: 8 },
  ul: { gap: 6 },
  li: { flexDirection: "row", gap: 8 },
  planIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  openPill: { backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: -6 },
  canDo: { width: "47.5%", flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, gap: 6 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10 },
  privacy: { flexDirection: "row", gap: 12, padding: 14, borderRadius: RADIUS.xl },
  chatContent: { paddingHorizontal: 0, gap: 0, paddingTop: 0 },
  chatTop: { paddingHorizontal: 16, paddingBottom: 8 },
  thread: { paddingHorizontal: 16, paddingVertical: 10, gap: 16, flexGrow: 1 },
  userWrap: { alignItems: "flex-end", gap: 3 },
  userBubble: { maxWidth: "85%", borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  assistantRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  assistantCol: { flex: 1, gap: 8, maxWidth: "92%" },
  assistantBubble: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, borderTopLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 12 },
  typing: { flexDirection: "row", gap: 5, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, borderTopLeftRadius: 6, paddingHorizontal: 16, height: 42, alignItems: "center" },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  rateBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  welcome: { alignItems: "center", gap: 10, paddingVertical: 12 },
  suggestions: { alignSelf: "stretch", gap: 8, marginTop: 6 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.lg, padding: 12, minHeight: 56 },
  sugIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  failed: { alignItems: "flex-end", gap: 8 },
  failBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: RADIUS.lg, padding: 10, alignSelf: "stretch" },
  followUps: { gap: 8, paddingLeft: 38 },
  followUp: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 36, justifyContent: "center" },
  limit: { flexDirection: "row", gap: 10, padding: 12, borderRadius: RADIUS.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderWidth: 1, borderRadius: RADIUS.xl, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontFamily: FONTS.regular, fontSize: 16, minHeight: 40, maxHeight: 120, paddingTop: 10, paddingBottom: 10, outlineWidth: 0 },
  composerMeta: { flexDirection: "row", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
})
