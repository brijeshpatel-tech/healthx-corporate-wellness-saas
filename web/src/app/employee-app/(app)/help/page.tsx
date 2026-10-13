"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronRight, ImagePlus, Inbox, Info, Mail, MessageSquarePlus, Paperclip, SearchX, Send, Unplug, Wrench, X, Footprints, RefreshCw } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { SearchInput } from "@/components/common/misc"
import { EmptyState } from "@/components/common/states"
import { StatusBadge } from "@/components/common/status-badge"
import { APP_BUILD, APP_VERSION, useDeviceInfo } from "@/components/employee/engage/account/device"
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/components/employee/engage/account/image"
import { FormSection } from "@/components/employee/engage/account/rows"
import { ChipTabs, EngagePage, IconTile, LoadError } from "@/components/employee/engage/page"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/core"
import { HELP_CATEGORIES, SUPPORT_CATEGORIES, supportApi, type HelpArticle, type MyTicket } from "@/lib/api/employee/support"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useSession } from "@/lib/auth/session"
import { formatDateTime, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

const SUPPORT_EMAIL = "support@healthx.life"

/** Shortcuts to the most common troubleshooting guides (they set the search). */
const QUICK_FIXES = [
  { label: "Missing steps", query: "missing", icon: Footprints },
  { label: "Tracker won't connect", query: "connect", icon: Unplug },
  { label: "Sync problems", query: "sync", icon: RefreshCw },
]

/** FRM-68 */
const schema = z.object({
  category: z.enum(["account", "billing", "technical", "rewards", "other"], { error: "Choose a category" }),
  subject: z.string().trim().min(5, "Add a short subject (at least 5 characters)").max(120, "Use 120 characters or fewer"),
  description: z.string().trim().min(20, "Tell us a little more (at least 20 characters)").max(2000, "Use 2,000 characters or fewer"),
})
type Values = z.infer<typeof schema>

/** SCR-M-080 Help & Support — help centre, troubleshooting guides and support tickets (#347). */
export default function HelpPage() {
  return (
    <EngagePage title="Help & support" description="Answers to common questions, step-by-step fixes, and how to reach us.">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <HelpCentre />
        <div className="space-y-5">
          <SupportTickets />
          <ContactCard />
        </div>
      </div>
    </EngagePage>
  )
}

// ─── Help centre ────────────────────────────────────────────────────────

function HelpCentre() {
  const q = useApiQuery(["employee", "help", "articles"], () => supportApi.articles(), { staleTime: 5 * 60_000 })
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")

  const categories = useMemo(() => {
    const seen = Array.from(new Set((q.data ?? []).map((a) => a.category)))
    return seen.map((c) => ({ value: c, emoji: HELP_CATEGORIES.find((x) => x.value.toLowerCase() === c.toLowerCase())?.emoji ?? "📄" }))
  }, [q.data])

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase()
    const items = (q.data ?? []).filter(
      (a) => (category === "all" || a.category === category) && (!term || a.title.toLowerCase().includes(term) || a.body.toLowerCase().includes(term)),
    )
    return categories.map((c) => ({ ...c, items: items.filter((a) => a.category === c.value) })).filter((g) => g.items.length)
  }, [q.data, search, category, categories])

  return (
    <section className="space-y-4" aria-label="Help centre">
      <SearchInput value={search} onChange={setSearch} placeholder="Search help articles" className="sm:w-full [&_input]:h-11 [&_input]:rounded-xl" />

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Quick fixes">
        {QUICK_FIXES.map((f) => (
          <button
            key={f.query}
            type="button"
            onClick={() => {
              setCategory("all")
              setSearch(f.query)
            }}
            className={cn(
              "flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl border bg-card p-3 text-left text-sm font-medium shadow-xs transition-colors hover:bg-muted/50",
              search === f.query && "border-primary bg-primary/5 ring-1 ring-primary/30",
            )}
          >
            <IconTile icon={f.icon} tone="sky" size="sm" />
            <span className="leading-tight">{f.label}</span>
          </button>
        ))}
      </div>

      <ChipTabs
        ariaLabel="Help categories"
        value={category}
        onChange={setCategory}
        options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: c.value, label: c.value, icon: <span aria-hidden>{c.emoji}</span> }))]}
      />

      {q.error ? (
        <LoadError title="Couldn't load help articles." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={search ? `No answers match "${search}"` : "No articles in this category yet"}
          description="Try different words, or raise a support ticket — we're happy to help."
          action={
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
          className="rounded-2xl"
        />
      ) : (
        groups.map((g) => (
          <div key={g.value} className="space-y-2">
            <h2 className="flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <span aria-hidden className="text-sm">
                {g.emoji}
              </span>
              {g.value}
            </h2>
            <ArticleGroup items={g.items} expandAll={!!search.trim()} />
          </div>
        ))
      )}
    </section>
  )
}

const isGuide = (a: HelpArticle) => /^troubleshooting\b/i.test(a.title) || /(^|\n)1\.\s/.test(a.body)

function ArticleGroup({ items, expandAll }: { items: HelpArticle[]; expandAll: boolean }) {
  return (
    <Accordion
      key={expandAll ? "open" : "closed"}
      type="multiple"
      defaultValue={expandAll && items.length <= 3 ? items.map((a) => a.id) : []}
      className="overflow-hidden rounded-2xl border bg-card px-4 shadow-xs"
    >
      {items.map((a) => (
        <AccordionItem key={a.id} value={a.id}>
          <AccordionTrigger className="min-h-14 items-center gap-3 py-3.5 text-[15px] hover:no-underline">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {isGuide(a) ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-500/12 px-1.5 text-[10px] leading-5 font-semibold tracking-wide text-sky-700 uppercase dark:text-sky-300">
                  <Wrench className="size-3" /> Guide
                </span>
              ) : null}
              <span>{a.title.replace(/^troubleshooting:\s*/i, "")}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 leading-relaxed text-muted-foreground">
            <ArticleBody body={a.body} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** Paragraphs separated by blank lines; consecutive "1." lines become a numbered list. */
function ArticleBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/)
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean)
        if (lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l)))
          return (
            <ol key={i} className="space-y-2">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">{j + 1}</span>
                  <span>{l.replace(/^\d+\.\s*/, "")}</span>
                </li>
              ))}
            </ol>
          )
        return (
          <p key={i} className="whitespace-pre-line">
            {block}
          </p>
        )
      })}
    </div>
  )
}

// ─── Support tickets ────────────────────────────────────────────────────

function SupportTickets() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const tickets = useApiQuery(["employee", "support", "tickets"], () => supportApi.myTickets())
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { category: undefined, subject: "", description: "" },
  })
  const create = useApiMutation(supportApi.createTicket, {
    success: "Request sent – we'll reply by email.",
    errorTitle: "Couldn't send your request.",
    onSuccess: () => {
      form.reset({ category: undefined, subject: "", description: "" })
      setScreenshot(null)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const pickFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return void toast.error("Attach a JPG, PNG or WebP screenshot.")
    if (file.size > MAX_UPLOAD_BYTES) return void toast.error("Screenshots must be under 5 MB.")
    setScreenshot(file.name)
  }

  const openTicket = tickets.data?.find((t) => t.id === openId) ?? null

  return (
    <>
      <FormSection icon={MessageSquarePlus} tone="violet" title="Raise a support ticket" description="Tell us what's wrong and we'll reply here and by email.">
        <form onSubmit={form.handleSubmit((v) => create.mutate({ ...v, screenshotName: screenshot ?? undefined }))} className="space-y-4" noValidate>
          <SelectField control={form.control} name="category" label="Category" placeholder="Choose a category" options={SUPPORT_CATEGORIES} required />
          <TextField control={form.control} name="subject" label="Subject" placeholder="e.g. My steps aren't syncing" required />
          <TextareaField control={form.control} name="description" label="Description" rows={5} maxLength={2000} placeholder="What happened, and what did you expect to happen?" required />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Screenshot (optional)</p>
            {screenshot ? (
              <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{screenshot}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setScreenshot(null)} aria-label="Remove screenshot">
                  <X />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="h-11 w-full rounded-xl border-dashed" onClick={() => fileRef.current?.click()}>
                <ImagePlus data-icon="inline-start" /> Attach a screenshot
              </Button>
            )}
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => pickFile(e.target.files?.[0])} />
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB.</p>
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Send data-icon="inline-start" />}
            Submit ticket
          </Button>
        </form>
      </FormSection>

      <section className="space-y-2" aria-label="My tickets">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">My tickets</h2>
        {tickets.error ? (
          <LoadError title="Couldn't load your tickets." error={tickets.error} onRetry={() => tickets.refetch()} />
        ) : !tickets.data ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : tickets.data.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
            <IconTile icon={Inbox} tone="slate" size="sm" />
            You haven&apos;t raised any tickets yet.
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-xs">
            {tickets.data.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-sm font-medium">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t.number} · Sent {formatRelative(t.createdAt)}
                      {t.replies ? ` · ${t.replies} ${t.replies === 1 ? "reply" : "replies"}` : ""}
                    </span>
                    {t.lastReply ? (
                      <span className="line-clamp-2 block rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                        <span className="font-medium">{t.lastReply.from}:</span> {t.lastReply.body}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TicketSheet ticket={openTicket} onOpenChange={(o) => !o && setOpenId(null)} />
    </>
  )
}

function TicketSheet({ ticket, onOpenChange }: { ticket: MyTicket | null; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState("")
  const reply = useApiMutation(supportApi.reply, {
    success: "Message sent.",
    errorTitle: "Couldn't send your message.",
    invalidate: [["employee", "support", "tickets"]],
    onSuccess: () => setDraft(""),
  })
  const category = ticket ? (SUPPORT_CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category) : ""
  return (
    <Sheet open={!!ticket} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {ticket ? (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{ticket.number}</span>
                <StatusBadge status={ticket.status} />
              </div>
              <SheetTitle className="font-heading text-lg leading-snug">{ticket.subject}</SheetTitle>
              <SheetDescription>
                {category} · Opened {formatDateTime(ticket.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <ol className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Messages">
              {ticket.messages.map((m, i) => (
                <li key={i} className={cn("flex flex-col gap-1", m.mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line",
                      m.mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-muted/60",
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="px-1 text-[11px] text-muted-foreground">
                    {m.mine ? "You" : `${m.from} · HealthX support`} · {formatRelative(m.at)}
                  </span>
                </li>
              ))}
              {ticket.replies === 0 ? <li className="pt-2 text-center text-xs text-muted-foreground">We usually reply within one working day.</li> : null}
            </ol>
            {ticket.status === "closed" ? (
              <p className="border-t p-4 text-center text-sm text-muted-foreground">This ticket is closed. Raise a new ticket if you still need help.</p>
            ) : (
              <form
                className="space-y-2 border-t p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (draft.trim().length >= 2) reply.mutate({ id: ticket.id, body: draft })
                }}
              >
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={2000} placeholder="Write a reply…" aria-label="Reply" className="min-h-16 rounded-xl" />
                <Button type="submit" className="h-11 w-full rounded-xl" disabled={reply.isPending || draft.trim().length < 2}>
                  {reply.isPending ? <Spinner /> : <Send data-icon="inline-start" />}
                  Send reply
                </Button>
              </form>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

// ─── Contact ────────────────────────────────────────────────────────────

function ContactCard() {
  const device = useDeviceInfo()
  const session = useSession("employee")
  const body = encodeURIComponent(`\n\n—\nApp version: ${APP_VERSION} (${APP_BUILD})\nDevice: ${device ?? "Unknown"}\nCompany: ${session?.companyName ?? ""}`)
  return (
    <section className="space-y-4 rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-4 shadow-xs sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Mail className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold">Prefer email?</h2>
          <p className="text-sm text-muted-foreground">Write to our support team — we usually reply within one working day.</p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-11 w-full rounded-xl bg-card">
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("HealthX support request")}&body=${body}`}>
          <Mail data-icon="inline-start" /> Contact support
        </a>
      </Button>
      <dl className="space-y-2 rounded-xl border bg-card p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">Support email</dt>
          <dd className="font-medium">{SUPPORT_EMAIL}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">App version</dt>
          <dd className="text-right font-medium">
            {APP_VERSION} <span className="text-muted-foreground">· {APP_BUILD}</span>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">Device</dt>
          <dd className="text-right font-medium">{device ?? "—"}</dd>
        </div>
      </dl>
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" /> Include your app version and device so we can help faster. We never ask for your password.
      </p>
    </section>
  )
}
