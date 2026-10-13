"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarCheck, EllipsisVertical, Eraser, Info, Phone, RefreshCw, SendHorizontal, ShieldAlert, ShieldOff, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { COACH_MAX_CHARS, coachApi, type CoachAccess, type CoachConversation, type CoachMessage } from "@/lib/api/employee/coach"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatNumber, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LoadError } from "../page"
import { CoachAvatar, CoachCardView, CoachDisclaimer, RichText, SUGGESTION_ICON, TypingBubble } from "./coach"
import { CoachLearnMoreDialog } from "./coach-intro"

const CONV_KEY = ["employee", "coach", "conversation"]

const schema = z.object({
  message: z.string().trim().min(1, "Type a message first.").max(COACH_MAX_CHARS, `Keep your message under ${formatNumber(COACH_MAX_CHARS)} characters.`),
})
type Values = z.infer<typeof schema>

interface StreamState {
  id: string
  phase: "typing" | "streaming"
  shown: number
}

/** SCR-M-067 AI Coach Chat. Height-locked so the composer sits above the bottom tab bar. */
export function CoachChat({ access }: { access: CoachAccess }) {
  const qc = useQueryClient()
  const conv = useApiQuery(CONV_KEY, () => coachApi.conversation())
  const [stream, setStream] = useState<StreamState | null>(null)
  const [failed, setFailed] = useState<{ text: string; limit: boolean } | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

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
    },
  })
  const withdraw = useApiMutation(coachApi.setConsent, { success: "AI personalisation turned off", invalidate: [["employee", "coach"]] })

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { message: "" } })
  const draft = useWatch({ control: form.control, name: "message" }) ?? ""

  const messages = conv.data?.messages ?? []
  const used = conv.data?.usedToday ?? access.usedToday
  const limit = conv.data?.dailyLimit ?? access.dailyLimit
  const limitReached = used >= limit
  const busy = send.isPending || !!stream
  const streamTarget = stream ? (messages.find((m) => m.id === stream.id)?.content.length ?? 0) : 0
  const streamId = stream?.id
  const streamPhase = stream?.phase

  // Reveal the answer progressively ("streaming") — timers only, never during render.
  useEffect(() => {
    if (!streamId) return
    if (streamPhase === "typing") {
      const t = setTimeout(() => setStream((s) => (s && s.id === streamId ? { ...s, phase: "streaming" } : s)), 700)
      return () => clearTimeout(t)
    }
    const step = Math.max(3, Math.ceil(streamTarget / 110))
    const t = setInterval(() => {
      setStream((s) => {
        if (!s || s.id !== streamId) return s
        const next = s.shown + step
        return next >= streamTarget ? null : { ...s, shown: next }
      })
    }, 22)
    return () => clearInterval(t)
  }, [streamId, streamPhase, streamTarget])

  // Keep the newest message in view.
  const shown = stream?.shown ?? 0
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, shown, streamPhase, send.isPending, failed])

  // Consent withdrawn elsewhere → let the page fall back to the intro.
  const consentLost = conv.error?.code === "consent_required"
  useEffect(() => {
    if (consentLost) void qc.invalidateQueries({ queryKey: ["employee", "coach", "access"] })
  }, [consentLost, qc])

  const doSend = (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    if (limitReached) {
      toast.error("You've reached today's question limit.")
      return
    }
    setFailed(null)
    send.mutate({ message })
  }

  const submit = form.handleSubmit(({ message }) => {
    doSend(message)
    form.reset({ message: "" })
  })

  const rate = (m: CoachMessage, value: "up" | "down") => {
    const next = m.feedback === value ? null : value
    qc.setQueryData<CoachConversation>(CONV_KEY, (old) => (old ? { ...old, messages: old.messages.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)) } : old))
    feedback.mutate({ id: m.id, value: next })
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const followUps = !busy && !failed && lastAssistant && messages[messages.length - 1]?.id === lastAssistant.id ? (lastAssistant.followUps.length ? lastAssistant.followUps : conv.data?.suggestions.slice(0, 3)) : undefined
  const overLimit = draft.length > COACH_MAX_CHARS

  return (
    <div className="mx-auto -mb-6 flex h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col md:mb-0 md:h-[calc(100dvh-5.5rem)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
        <CoachAvatar />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-heading text-lg leading-tight font-bold">
            AI Coach <PhaseBadge phase={2} />
          </h1>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" /> Private to you · uses only your permitted data
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 rounded-xl px-3">
          <Link href="/employee-app/coach/plan" aria-label="My 7-day plan">
            <CalendarCheck />
            <span className="hidden sm:inline">My plan</span>
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label="Coach options">
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
              <Info /> About the coach
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setClearOpen(true)} disabled={!messages.length}>
              <Eraser /> Clear conversation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setWithdrawOpen(true)}>
              <ShieldOff /> Turn off personalisation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="shrink-0 px-4 pb-2 sm:px-6">
        <CoachDisclaimer compact />
      </div>

      {/* Thread */}
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6" aria-live="polite">
        {conv.error && !consentLost ? (
          <LoadError title="Coach is unavailable right now. Please try again later." error={conv.error} onRetry={() => conv.refetch()} />
        ) : !conv.data ? (
          <ThreadSkeleton />
        ) : !messages.length && !send.isPending ? (
          <Welcome firstName={access.firstName} suggestions={conv.data.suggestions} onPick={doSend} disabled={busy || limitReached} />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => {
              if (m.role === "user") return <UserBubble key={m.id} text={m.content} at={m.at} />
              if (stream && stream.id === m.id) {
                return stream.phase === "typing" ? <TypingBubble key={m.id} /> : <AssistantBubble key={m.id} message={m} partial={m.content.slice(0, stream.shown)} />
              }
              return <AssistantBubble key={m.id} message={m} onRate={(v) => rate(m, v)} />
            })}
            {send.isPending ? (
              <>
                <UserBubble text={send.variables?.message ?? ""} pending />
                <TypingBubble />
              </>
            ) : null}
            {failed ? (
              <div className="flex flex-col items-end gap-2">
                <UserBubble text={failed.text} failed />
                <div className="flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm" role="alert">
                  <TriangleAlert className="size-4 shrink-0 text-destructive" />
                  <span>{failed.limit ? "You've reached today's question limit." : "Coach is unavailable right now. Please try again later."}</span>
                  {!failed.limit ? (
                    <Button size="sm" variant="outline" className="ml-1 h-8 rounded-lg" onClick={() => doSend(failed.text)}>
                      <RefreshCw data-icon="inline-start" /> Retry
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {followUps?.length ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pl-14 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pl-10 [&::-webkit-scrollbar]:hidden">
                {followUps.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => doSend(s)}
                    disabled={limitReached}
                    className="h-9 shrink-0 rounded-full border border-primary/30 bg-primary/5 px-3.5 text-sm font-medium whitespace-nowrap text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-background/95 px-3 pt-2.5 pb-2 backdrop-blur sm:px-6 md:rounded-b-2xl">
        {limitReached ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3.5 text-sm" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">You&apos;ve reached today&apos;s question limit.</p>
              <p className="text-xs text-muted-foreground">You can ask up to {limit} questions a day. Come back tomorrow — your plan and past answers are still here.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className={cn("flex items-end gap-2 rounded-2xl border bg-card p-1.5 pl-3.5 shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30", (overLimit || form.formState.errors.message) && "border-destructive")}>
              <label htmlFor="coach-message" className="sr-only">
                Message the coach
              </label>
              <textarea
                id="coach-message"
                rows={1}
                placeholder="Ask about sleep, food, workouts…"
                className="field-sizing-content max-h-36 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground md:text-sm"
                aria-invalid={overLimit || !!form.formState.errors.message}
                {...form.register("message")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void submit()
                  }
                }}
              />
              <Button type="submit" size="icon" className="size-10 shrink-0 rounded-xl" disabled={busy || !draft.trim() || overLimit} aria-label="Send message">
                <SendHorizontal />
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 px-1 pt-1.5 text-[11px] text-muted-foreground">
              <span className={cn("truncate", form.formState.errors.message && "font-medium text-destructive")}>
                {form.formState.errors.message?.message ?? (overLimit ? `Keep your message under ${formatNumber(COACH_MAX_CHARS)} characters.` : `${limit - used} of ${limit} questions left today · Shift+Enter for a new line`)}
              </span>
              <span className={cn("shrink-0 tabular-nums", overLimit && "font-semibold text-destructive")}>
                {formatNumber(draft.length)}/{formatNumber(COACH_MAX_CHARS)}
              </span>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear this conversation?"
        description="All messages in this chat will be deleted. Your 7-day plan is kept."
        confirmLabel="Clear conversation"
        destructive
        onConfirm={() => conv.data && clear.mutate({ id: conv.data.id })}
      />
      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="Turn off AI personalisation?"
        description="The coach will stop using your wellness data and you'll need to give consent again to chat. You can also change this in Privacy & consent."
        confirmLabel="Turn off"
        destructive
        onConfirm={() => withdraw.mutate({ granted: false, source: "ai_coach_chat" })}
      />
      <CoachLearnMoreDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  )
}

function Welcome({ firstName, suggestions, onPick, disabled }: { firstName: string; suggestions: string[]; onPick: (s: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center sm:py-8">
      <CoachAvatar size="xl" />
      <div className="space-y-1.5">
        <h2 className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">Hi {firstName}! What shall we work on?</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">Ask me about steps, sleep, food, workouts or stress. I&apos;ll use your own data to make my answers personal.</p>
      </div>
      <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => {
          const Icon = SUGGESTION_ICON[s] ?? Info
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left text-sm font-medium shadow-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md disabled:opacity-50",
                i === suggestions.length - 1 && suggestions.length % 2 === 1 && "sm:col-span-2",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </span>
              {s}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function UserBubble({ text, at, pending, failed }: { text: string; at?: string; pending?: boolean; failed?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-primary-foreground shadow-xs sm:max-w-[75%]",
          pending && "opacity-70",
          failed && "bg-primary/60",
        )}
      >
        {text}
      </div>
      <span className="px-1 text-[11px] text-muted-foreground">{failed ? "Not sent" : pending ? "Sending…" : at ? formatTime(at) : ""}</span>
    </div>
  )
}

function AssistantBubble({ message: m, partial, onRate }: { message: CoachMessage; partial?: string; onRate?: (v: "up" | "down") => void }) {
  const streaming = partial !== undefined
  const crisis = m.safety === "crisis"
  const medical = m.safety === "medical"
  return (
    <div className="flex items-start gap-2">
      <CoachAvatar size="sm" className="mt-0.5" />
      <div className="flex max-w-[88%] min-w-0 flex-col gap-2 sm:max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-xs",
            medical && "border-amber-500/40 bg-amber-500/5",
            crisis && "border-rose-500/40 bg-rose-500/5",
          )}
        >
          {medical || crisis ? (
            <p className={cn("mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase", crisis ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-300")}>
              <ShieldAlert className="size-3.5" /> {crisis ? "Please get support now" : "Safety note"}
            </p>
          ) : null}
          <RichText text={streaming ? partial : m.content} />
          {streaming ? <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70 align-middle" aria-hidden /> : null}
        </div>
        {!streaming && crisis ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="destructive" className="h-10 rounded-xl">
              <a href="tel:112">
                <Phone data-icon="inline-start" /> Call 112
              </a>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <a href="tel:14416">
                <Phone data-icon="inline-start" /> Tele-MANAS 14416
              </a>
            </Button>
          </div>
        ) : null}
        {!streaming && m.cards.length ? (
          <div className="grid gap-2">
            {m.cards.map((c, i) => (
              <CoachCardView key={i} card={c} />
            ))}
          </div>
        ) : null}
        {!streaming ? (
          <div className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            <span className="mr-1">{formatTime(m.at)}</span>
            {onRate ? (
              <>
                <button
                  type="button"
                  onClick={() => onRate("up")}
                  aria-pressed={m.feedback === "up"}
                  aria-label="Helpful"
                  className={cn("flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground", m.feedback === "up" && "bg-primary/10 text-primary")}
                >
                  <ThumbsUp className={cn("size-3.5", m.feedback === "up" && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={() => onRate("down")}
                  aria-pressed={m.feedback === "down"}
                  aria-label="Not helpful"
                  className={cn("flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground", m.feedback === "down" && "bg-rose-500/10 text-rose-600 dark:text-rose-400")}
                >
                  <ThumbsDown className={cn("size-3.5", m.feedback === "down" && "fill-current")} />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="ml-auto h-10 w-48 rounded-2xl" />
      <div className="flex gap-2">
        <Skeleton className="size-8 rounded-xl" />
        <Skeleton className="h-28 w-72 rounded-2xl" />
      </div>
      <Skeleton className="ml-auto h-10 w-40 rounded-2xl" />
    </div>
  )
}
