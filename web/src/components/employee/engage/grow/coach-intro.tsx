"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { LucideIcon } from "lucide-react"
import { CalendarCheck, Droplets, Dumbbell, Footprints, Gauge, Info, ListChecks, Lock, MessageCircle, Moon, ShieldCheck, SlidersHorizontal, Utensils } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { CheckboxField } from "@/components/common/form-fields"
import { PhaseBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { coachApi, type CoachAccess } from "@/lib/api/employee/coach"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"
import { EngagePage, IconTile, type Tone } from "../page"
import { CoachAvatar, CoachDisclaimer } from "./coach"

const CAN_DO: { icon: LucideIcon; tone: Tone; title: string; text: string }[] = [
  { icon: MessageCircle, tone: "violet", title: "Answer wellness questions", text: "Sleep, stress, hydration, steps — in plain language." },
  { icon: Dumbbell, tone: "emerald", title: "Suggest workouts", text: "Sessions that fit your time, place and level." },
  { icon: Utensils, tone: "amber", title: "Meal ideas", text: "Indian-friendly ideas that match your food preference." },
  { icon: CalendarCheck, tone: "sky", title: "Build a 7-day plan", text: "Daily steps you can tick off as you go." },
]

const DATA_USED: { icon: LucideIcon; tone: Tone; title: string; text: string }[] = [
  { icon: Footprints, tone: "sky", title: "Steps & activity", text: "Daily steps, active minutes and sessions" },
  { icon: Moon, tone: "indigo", title: "Sleep", text: "Nights you've tracked or synced" },
  { icon: Droplets, tone: "cyan", title: "Water", text: "Daily intake against your goal" },
  { icon: ListChecks, tone: "emerald", title: "Workouts & habits", text: "What you've completed and your streaks" },
  { icon: Gauge, tone: "violet", title: "Wellness score", text: "Your score and its six areas" },
  { icon: SlidersHorizontal, tone: "slate", title: "Your preferences", text: "Main goal, food preference, workout place and time" },
]

const schema = z.object({ consent: z.boolean().refine((v) => v, "Tick the box to give your consent.") })
type Values = z.infer<typeof schema>

/** SCR-M-066 AI Coach – Introduction & Consent. */
export function CoachIntro({ access }: { access: CoachAccess }) {
  const [learnMore, setLearnMore] = useState(false)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { consent: false } })
  const agree = useApiMutation(coachApi.setConsent, {
    success: "You're all set — ask me anything!",
    errorTitle: "Couldn't save your choice.",
    invalidate: [["employee", "coach"]],
  })
  const submit = form.handleSubmit(() => agree.mutate({ granted: true, source: "ai_coach_intro" }))

  return (
    <EngagePage size="narrow">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-emerald-500 p-6 text-white shadow-lg shadow-violet-500/20 sm:p-8">
        <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <CoachAvatar size="lg" className="bg-none bg-white/20 ring-1 ring-white/30" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white/85">AI Wellness Coach</span>
              <PhaseBadge phase={2} className="bg-white/90 text-violet-700" />
            </div>
          </div>
          <h1 className="font-heading text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl">Hi {access.firstName}, meet your personal wellness coach</h1>
          <p className="max-w-lg text-sm text-white/90 sm:text-base">Ask questions any time and get tips, workouts, meal ideas and a 7-day plan — personalised from your own HealthX data.</p>
        </div>
      </section>

      {/* What it can do */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">What the coach can do</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAN_DO.map((c) => (
            <div key={c.title} className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-xs">
              <IconTile icon={c.icon} tone={c.tone} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data used */}
      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">What data it uses</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Only your own data that you&apos;ve allowed in Privacy &amp; consent — nothing else.</p>
        </div>
        <div className="grid divide-y overflow-hidden rounded-2xl border bg-card shadow-xs sm:grid-cols-2 sm:divide-y-0">
          {DATA_USED.map((d, i) => (
            <div key={d.title} className={`flex items-center gap-3 px-4 py-3 ${i >= 2 ? "sm:border-t" : ""} ${i % 2 === 1 ? "sm:border-l" : ""}`}>
              <IconTile icon={d.icon} tone={d.tone} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">{d.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-1 text-sm">
          <p className="font-semibold">HR and colleagues can never see your conversations.</p>
          <p className="text-muted-foreground">Your chats are private and encrypted. {access.companyName} only ever sees combined, anonymous usage numbers. You can clear your chats or turn the coach off at any time.</p>
        </div>
      </div>

      <CoachDisclaimer />

      {/* Consent */}
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-4 shadow-xs sm:p-5" noValidate>
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">AI personalisation consent</h2>
        </div>
        <CheckboxField
          control={form.control}
          name="consent"
          label="I agree that the AI coach can use my wellness data listed above to personalise its answers."
          description={`Consent version ${access.version}${access.updatedAt ? ` · last changed ${formatDate(access.updatedAt)}` : ""}. You can withdraw it any time in Privacy & consent.`}
        />
        {agree.error ? (
          <p className="rounded-xl bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive" role="alert">
            Couldn&apos;t save your choice. Please try again.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="submit" className="h-12 rounded-xl px-6 text-base sm:order-1" disabled={agree.isPending}>
            {agree.isPending ? <Spinner data-icon="inline-start" /> : null}
            Agree &amp; start
          </Button>
          <Button asChild type="button" variant="outline" className="h-12 rounded-xl px-6 text-base sm:order-2">
            <Link href="/employee-app/home">Not now</Link>
          </Button>
          <Button type="button" variant="ghost" className="h-12 rounded-xl px-4 text-base sm:order-3 sm:ml-auto" onClick={() => setLearnMore(true)}>
            <Info data-icon="inline-start" /> Learn more
          </Button>
        </div>
      </form>

      <CoachLearnMoreDialog open={learnMore} onOpenChange={setLearnMore} />
    </EngagePage>
  )
}

/** "Learn more" / "About the coach" details. */
export function CoachLearnMoreDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const sections: { title: string; body: React.ReactNode }[] = [
    {
      title: "How it works",
      body: "When you ask a question, the coach looks at your recent wellness data and your preferences, then suggests simple next steps. It works only inside HealthX.",
    },
    {
      title: "What it never does",
      body: "It never diagnoses conditions, interprets symptoms or recommends medication. Questions about health problems get a safe answer pointing you to a doctor or a qualified professional — and to emergency services (112) when it's urgent.",
    },
    {
      title: "Who can see your chats",
      body: "Only you. HR, managers and colleagues can never see your conversations or the data the coach uses. Your company only sees anonymous totals, such as how many people used the coach.",
    },
    {
      title: "Your choices",
      body: "Clear a conversation at any time, and turn AI personalisation off in Privacy & consent. When it's off, the coach stops using your data.",
    },
    {
      title: "Daily limit",
      body: "To keep the service fast for everyone, you can ask up to 30 questions a day.",
    },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <CoachAvatar />
            <DialogTitle className="font-heading text-lg">About the AI Wellness Coach</DialogTitle>
          </div>
          <DialogDescription>What it does, the data it uses and how your privacy is protected.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.title} className="space-y-1">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
        <Button className="mt-2 h-11 rounded-xl" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
