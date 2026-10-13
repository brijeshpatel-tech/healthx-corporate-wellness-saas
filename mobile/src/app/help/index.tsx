/** SCR-M-080 Help & Support (#347) — FAQ search by category, troubleshooting guides, raise a support ticket, my tickets (thread + reply). */
import { zodResolver } from "@hookform/resolvers/zod"
import * as Device from "expo-device"
import * as ImagePicker from "expo-image-picker"
import { ChevronDown, ChevronRight, ChevronUp, Footprints, ImagePlus, Inbox, Info, LifeBuoy, Mail, MessageSquarePlus, Paperclip, RefreshCw, SearchX, Send, Unplug, Wrench, X } from "lucide-react-native"
import { useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { z } from "zod"
import { applyApiErrors, FormTextField } from "@/components/form"
import { ChipScroller, GroupLabel, InfoRows, SearchField, SectionCard, TintPill } from "@/components/engage/shared"
import { BottomSheet, Button, Card, EmptyState, ErrorState, IconButton, IconTile, Screen, SegmentedControl, SelectField, SkeletonList, StatusPill, Text, TextField } from "@/components/ui"
import { HELP_CATEGORIES, SUPPORT_CATEGORIES, supportApi, type HelpArticle, type MyTicket, type SupportCategory } from "@/lib/api/employee/support"
import { errorMessage, useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { APP_PLATFORM, APP_VERSION } from "@/lib/app-info"
import { useSession } from "@/lib/auth/session"
import { formatDateTime, formatRelative } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { toast } from "@/lib/toast"
import { useTheme } from "@/theme/theme"
import { RADIUS } from "@/theme/tokens"

const SUPPORT_EMAIL = "support@healthx.life"
type Tab = "help" | "contact" | "tickets"
const QUICK_FIXES = [
  { label: "Missing steps", query: "missing", icon: Footprints },
  { label: "Tracker won't connect", query: "connect", icon: Unplug },
  { label: "Sync problems", query: "sync", icon: RefreshCw },
]
const cleanTitle = (t: string) => {
  const s = t.replace(/^troubleshooting:\s*/i, "")
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const isGuide = (a: HelpArticle) => /^troubleshooting\b/i.test(a.title) || /(^|\n)1\.\s/.test(a.body)
const deviceName = () => [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || (APP_PLATFORM === "web" ? "Web browser" : "Unknown")

/** Paragraphs separated by blank lines; consecutive "1." lines become numbered steps. */
function ArticleBody({ body }: { body: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.gap10}>
      {body.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n").filter(Boolean)
        if (lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l)))
          return (
            <View key={i} style={styles.gap8}>
              {lines.map((l, j) => (
                <View key={j} style={styles.stepRow}>
                  <View style={[styles.stepNo, { backgroundColor: colors.primarySoft }]}>
                    <Text variant="small" tone="primary" weight="bold">
                      {j + 1}
                    </Text>
                  </View>
                  <Text variant="caption" tone="muted" style={styles.flex}>
                    {l.replace(/^\d+\.\s*/, "")}
                  </Text>
                </View>
              ))}
            </View>
          )
        return (
          <Text key={i} variant="caption" tone="muted">
            {block}
          </Text>
        )
      })}
    </View>
  )
}

function Article({ a, initiallyOpen }: { a: HelpArticle; initiallyOpen: boolean }) {
  const { colors, tint } = useTheme()
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View style={[styles.article, { borderTopColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptic.tap()
          setOpen((o) => !o)
        }}
        style={styles.articleHead}
      >
        <View style={styles.flex}>
          {isGuide(a) ? <TintPill label="Guide" icon={Wrench} color={tint("steps").fg} bg={tint("steps").bg} /> : null}
          <Text variant="bodyMedium">{cleanTitle(a.title)}</Text>
        </View>
        {open ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
      </Pressable>
      {open ? (
        <View style={styles.articleBody}>
          <ArticleBody body={a.body} />
        </View>
      ) : null}
    </View>
  )
}

function HelpCentre({ onContact }: { onContact: () => void }) {
  const { colors } = useTheme()
  const q = useApiQuery(["employee", "help", "articles"], () => supportApi.articles(), { staleTime: 5 * 60_000 })
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const categories = useMemo(() => {
    const seen = Array.from(new Set((q.data ?? []).map((a) => a.category)))
    return seen.map((c) => ({ value: c, emoji: HELP_CATEGORIES.find((x) => x.value.toLowerCase() === c.toLowerCase())?.emoji ?? "📄" }))
  }, [q.data])
  const term = search.trim().toLowerCase()
  const groups = useMemo(() => {
    const items = (q.data ?? []).filter((a) => (category === "all" || a.category === category) && (!term || a.title.toLowerCase().includes(term) || a.body.toLowerCase().includes(term)))
    return categories.map((c) => ({ ...c, items: items.filter((a) => a.category === c.value) })).filter((g) => g.items.length)
  }, [q.data, term, category, categories])

  return (
    <>
      <SearchField value={search} onChangeText={setSearch} placeholder="Search help articles" testID="help-search" />
      <View style={styles.quickRow}>
        {QUICK_FIXES.map((f) => {
          const on = search === f.query
          return (
            <Pressable
              key={f.query}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.select()
                setCategory("all")
                setSearch(on ? "" : f.query)
              }}
              style={({ pressed }) => [styles.quick, { backgroundColor: on ? colors.primarySoft : colors.card, borderColor: on ? colors.primary : colors.border }, pressed && { opacity: 0.85 }]}
            >
              <IconTile icon={f.icon} tint="steps" size={32} />
              <Text variant="label" numberOfLines={2}>
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <ChipScroller value={category} onChange={setCategory} accessibilityLabel="Help categories" options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c.value, label: c.value, emoji: c.emoji }))]} />
      {q.error ? (
        <ErrorState title="Couldn't load help articles." error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : !q.data ? (
        <SkeletonList count={3} height={160} header={false} />
      ) : groups.length === 0 ? (
        <EmptyState icon={SearchX} title={search ? `No answers match "${search}"` : "No articles in this category yet"} description="Try different words, or raise a support ticket — we're happy to help." action={{ label: "Contact support", icon: MessageSquarePlus, onPress: onContact }} />
      ) : (
        groups.map((g) => (
          <View key={g.value} style={styles.gap8}>
            <GroupLabel>{`${g.emoji}  ${g.value}`}</GroupLabel>
            <Card padding={0} style={styles.clip}>
              {g.items.map((a, i) => (
                <View key={`${a.id}-${term ? "s" : "n"}`} style={i === 0 ? styles.firstArticle : undefined}>
                  <Article a={a} initiallyOpen={!!term && g.items.length <= 3} />
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
      <Card>
        <View style={styles.row}>
          <IconTile icon={LifeBuoy} tint="habits" />
          <View style={styles.flex}>
            <Text variant="subtitle">Still need help?</Text>
            <Text variant="caption" tone="muted">
              Raise a ticket and we&apos;ll reply here and by email — usually within one working day.
            </Text>
          </View>
        </View>
        <Button title="Contact support" icon={MessageSquarePlus} size="md" block style={styles.mt12} onPress={onContact} />
      </Card>
    </>
  )
}

const schema = z.object({
  category: z.enum(["account", "billing", "technical", "rewards", "other"], { error: "Choose a category" }),
  subject: z.string().trim().min(5, "Add a short subject (at least 5 characters)").max(120, "Use 120 characters or fewer"),
  description: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(2000, "Use 2,000 characters or fewer"),
})
type Values = z.infer<typeof schema>

function ContactForm({ onSent }: { onSent: (t: MyTicket) => void }) {
  const { colors } = useTheme()
  const session = useSession("employee")
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "onTouched", defaultValues: { category: undefined, subject: "", description: "" } })
  const create = useApiMutation(supportApi.createTicket, {
    success: "Request sent – we'll reply by email.",
    errorTitle: "Couldn't send your request.",
    invalidate: [["employee", "support", "tickets"]],
    onSuccess: (t) => {
      haptic.success()
      form.reset({ category: undefined, subject: "", description: "" })
      setScreenshot(null)
      onSent(t)
    },
    onError: (err) => applyApiErrors(form.setError, err),
  })
  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5 })
      if (r.canceled || !r.assets[0]) return
      const a = r.assets[0]
      if (a.fileSize && a.fileSize > 5 * 1024 * 1024) return toast.error("Screenshots must be under 5 MB.")
      setScreenshot(a.fileName ?? `screenshot-${Date.now().toString(36)}.jpg`)
    } catch (err) {
      toast.error("Couldn't open your photos", { description: errorMessage(err) })
    }
  }
  const submit = () => void form.handleSubmit((v) => create.mutate({ ...v, screenshotName: screenshot ?? undefined }), () => haptic.error())()
  const mailBody = encodeURIComponent(`\n\n—\nApp version: ${APP_VERSION} (${APP_PLATFORM})\nDevice: ${deviceName()}\nCompany: ${session?.companyName ?? ""}`)

  return (
    <>
      <SectionCard icon={MessageSquarePlus} tint="workout" title="Raise a support ticket" description="Tell us what's wrong and we'll reply here and by email.">
        <Controller
          control={form.control}
          name="category"
          render={({ field, fieldState }) => <SelectField<SupportCategory> label="Category" placeholder="Choose a category" value={field.value} onChange={field.onChange} options={SUPPORT_CATEGORIES} error={fieldState.error?.message} testID="ticket-category" />}
        />
        <FormTextField control={form.control} name="subject" label="Subject" placeholder="e.g. My steps aren't syncing" maxLength={120} testID="ticket-subject" />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <TextField label="Description" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} multiline numberOfLines={5} maxLength={2000} placeholder="What happened, and what did you expect to happen?" error={fieldState.error?.message} hint={`${field.value.length}/2,000`} testID="ticket-description" />
          )}
        />
        <View style={styles.gap8}>
          <Text variant="label">Screenshot (optional)</Text>
          {screenshot ? (
            <View style={[styles.attachment, { borderColor: colors.border }]}>
              <Paperclip size={16} color={colors.mutedForeground} />
              <Text variant="caption" numberOfLines={1} style={styles.flex}>
                {screenshot}
              </Text>
              <IconButton icon={X} variant="ghost" size={36} accessibilityLabel="Remove screenshot" onPress={() => setScreenshot(null)} />
            </View>
          ) : (
            <Button title="Attach a screenshot" icon={ImagePlus} variant="outline" size="md" onPress={pick} />
          )}
          <Text variant="small" tone="muted">
            JPG, PNG or WebP, up to 5 MB.
          </Text>
        </View>
        <Button title="Submit ticket" icon={Send} loading={create.isPending} onPress={submit} feedback="none" testID="submit-ticket" />
      </SectionCard>

      <Card>
        <View style={styles.row}>
          <IconTile icon={Mail} tint="habits" />
          <View style={styles.flex}>
            <Text variant="subtitle">Prefer email?</Text>
            <Text variant="caption" tone="muted">
              Write to our support team — we usually reply within one working day.
            </Text>
          </View>
        </View>
        <Button
          title="Email support"
          icon={Mail}
          variant="outline"
          size="md"
          block
          style={styles.mt12}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("HealthX support request")}&body=${mailBody}`).catch(() => toast.info(`Email ${SUPPORT_EMAIL}`))}
        />
        <View style={styles.mt12}>
          <InfoRows
            rows={[
              ["Support email", SUPPORT_EMAIL],
              ["App version", `${APP_VERSION} · ${APP_PLATFORM}`],
              ["Device", deviceName()],
            ]}
          />
        </View>
        <View style={[styles.rowTop, styles.mt12]}>
          <Info size={13} color={colors.mutedForeground} />
          <Text variant="small" tone="muted" style={styles.flex}>
            Include your app version and device so we can help faster. We never ask for your password.
          </Text>
        </View>
      </Card>
    </>
  )
}

function TicketSheet({ ticket, onClose }: { ticket: MyTicket | null; onClose: () => void }) {
  const { colors } = useTheme()
  const [draft, setDraft] = useState("")
  const reply = useApiMutation(supportApi.reply, { success: "Message sent.", errorTitle: "Couldn't send your message.", invalidate: [["employee", "support", "tickets"]], onSuccess: () => setDraft("") })
  const category = ticket ? (SUPPORT_CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category) : ""
  return (
    <BottomSheet
      open={!!ticket}
      onClose={onClose}
      title={ticket?.subject}
      description={ticket ? `${ticket.number} · ${category} · Opened ${formatDateTime(ticket.createdAt)}` : undefined}
      footer={
        ticket && ticket.status !== "closed" ? (
          <View style={styles.replyRow}>
            <TextField value={draft} onChangeText={setDraft} placeholder="Write a reply…" multiline maxLength={2000} containerStyle={styles.flex} accessibilityLabel="Reply" />
            <IconButton icon={Send} variant="primary" accessibilityLabel="Send reply" disabled={reply.isPending || draft.trim().length < 2} onPress={() => ticket && reply.mutate({ id: ticket.id, body: draft })} />
          </View>
        ) : ticket ? (
          <Text variant="caption" tone="muted" align="center">
            This ticket is closed. Raise a new ticket if you still need help.
          </Text>
        ) : undefined
      }
    >
      {ticket ? (
        <View style={styles.gap10}>
          <StatusPill status={ticket.status} />
          {ticket.messages.map((m, i) => (
            <View key={i} style={[styles.msgWrap, m.mine ? styles.alignEnd : styles.alignStart]}>
              <View style={[styles.msg, m.mine ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 } : { backgroundColor: colors.muted, borderBottomLeftRadius: 6 }]}>
                <Text variant="caption" color={m.mine ? colors.primaryForeground : colors.foreground} selectable>
                  {m.body}
                </Text>
              </View>
              <Text variant="small" tone="muted">
                {m.mine ? "You" : `${m.from} · HealthX support`} · {formatRelative(m.at)}
              </Text>
            </View>
          ))}
          {ticket.replies === 0 ? (
            <Text variant="small" tone="muted" align="center">
              We usually reply within one working day.
            </Text>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  )
}

function MyTickets({ openId, setOpenId, onContact }: { openId: string | null; setOpenId: (id: string | null) => void; onContact: () => void }) {
  const { colors } = useTheme()
  const tickets = useApiQuery(["employee", "support", "tickets"], () => supportApi.myTickets())
  const open = tickets.data?.find((t) => t.id === openId) ?? null
  return (
    <>
      {tickets.error ? (
        <ErrorState title="Couldn't load your tickets." error={tickets.error} onRetry={() => tickets.refetch()} retrying={tickets.isFetching} />
      ) : !tickets.data ? (
        <SkeletonList count={3} height={86} header={false} />
      ) : tickets.data.length === 0 ? (
        <EmptyState icon={Inbox} title="You haven't raised any tickets yet." description="If something isn't working, we're here to help." action={{ label: "Raise a ticket", icon: MessageSquarePlus, onPress: onContact }} />
      ) : (
        <Card padding={4}>
          {tickets.data.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.subject}, ${t.status}`}
              onPress={() => {
                haptic.tap()
                setOpenId(t.id)
              }}
              style={({ pressed }) => [styles.ticket, pressed && { backgroundColor: colors.muted }]}
              testID={`ticket-${t.number}`}
            >
              <View style={styles.flex}>
                <View style={styles.between}>
                  <Text variant="bodyMedium" numberOfLines={1} style={styles.shrink}>
                    {t.subject}
                  </Text>
                  <StatusPill status={t.status} />
                </View>
                <Text variant="small" tone="muted">
                  {t.number} · Sent {formatRelative(t.createdAt)}
                  {t.replies ? ` · ${t.replies} ${t.replies === 1 ? "reply" : "replies"}` : ""}
                </Text>
                {t.lastReply ? (
                  <View style={[styles.lastReply, { backgroundColor: colors.muted }]}>
                    <Text variant="small" numberOfLines={2}>
                      <Text variant="small" weight="semibold">
                        {t.lastReply.from}:
                      </Text>{" "}
                      {t.lastReply.body}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      )}
      <TicketSheet ticket={open} onClose={() => setOpenId(null)} />
    </>
  )
}

export default function HelpScreen() {
  const [tab, setTab] = useState<Tab>("help")
  const [openId, setOpenId] = useState<string | null>(null)
  const tickets = useApiQuery(["employee", "support", "tickets"], () => supportApi.myTickets())
  const count = tickets.data?.length ?? 0
  return (
    <Screen title="Help & support" back backHref="/settings" testID="help-screen">
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        accessibilityLabel="Help sections"
        options={[
          { value: "help", label: "Help centre" },
          { value: "contact", label: "Contact us" },
          { value: "tickets", label: count ? `Tickets (${count})` : "My tickets" },
        ]}
      />
      {tab === "help" ? (
        <HelpCentre onContact={() => setTab("contact")} />
      ) : tab === "contact" ? (
        <ContactForm
          onSent={(t) => {
            setTab("tickets")
            setOpenId(t.id)
          }}
        />
      ) : (
        <MyTickets openId={openId} setOpenId={setOpenId} onContact={() => setTab("contact")} />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  shrink: { flexShrink: 1 },
  clip: { overflow: "hidden" },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  mt12: { marginTop: 12 },
  alignEnd: { alignItems: "flex-end" },
  alignStart: { alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  quickRow: { flexDirection: "row", gap: 8 },
  quick: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: 10, gap: 8, minHeight: 92 },
  firstArticle: { marginTop: -StyleSheet.hairlineWidth },
  article: { borderTopWidth: StyleSheet.hairlineWidth },
  articleHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  articleBody: { paddingHorizontal: 14, paddingBottom: 14 },
  stepRow: { flexDirection: "row", gap: 10 },
  stepNo: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  attachment: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth },
  ticket: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16 },
  lastReply: { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6, marginTop: 2 },
  replyRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgWrap: { gap: 3 },
  msg: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
})
