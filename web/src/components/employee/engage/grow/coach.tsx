"use client"

import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Bot,
  CalendarCheck,
  ChevronRight,
  Clock,
  Droplets,
  Dumbbell,
  Footprints,
  Gauge,
  ListChecks,
  Moon,
  Stethoscope,
  Utensils,
} from "lucide-react"
import Link from "next/link"
import { Fragment } from "react"
import type { CoachCard, CoachLinkIcon } from "@/lib/api/employee/coach"
import { titleCase } from "@/lib/format"
import { cn } from "@/lib/utils"
import { EmojiCover, IconTile, type Tone } from "../page"

/** Gradient coach avatar. */
export function CoachAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-500 via-indigo-500 to-emerald-500 text-white shadow-sm",
        size === "sm" && "size-8 rounded-xl",
        size === "md" && "size-10 rounded-2xl",
        size === "lg" && "size-14 rounded-2xl",
        size === "xl" && "size-20 rounded-3xl shadow-lg shadow-violet-500/25",
        className,
      )}
      aria-hidden
    >
      <Bot className={size === "sm" ? "size-4" : size === "md" ? "size-5" : size === "lg" ? "size-7" : "size-10"} />
    </span>
  )
}

/** Non-medical disclaimer. `compact` = one-line banner pinned above the chat thread. */
export function CoachDisclaimer({ compact, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <p className={cn("flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-900 dark:text-amber-200", className)} role="note">
        <Stethoscope className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          General wellness guidance, <span className="font-semibold">not medical advice</span>. For health concerns see a doctor. Emergency? <a href="tel:112" className="font-semibold underline underline-offset-2">Call 112</a>.
        </span>
      </p>
    )
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4", className)} role="note">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <Stethoscope className="size-5" />
      </span>
      <div className="space-y-1.5 text-sm">
        <p className="font-semibold">Not medical advice</p>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground marker:text-amber-500">
          <li>The coach gives general wellness guidance. It can&apos;t diagnose conditions, interpret symptoms or recommend medication.</li>
          <li>For any medical concern, please speak to a doctor.</li>
          <li>
            In an emergency, <a href="tel:112" className="font-semibold text-foreground underline underline-offset-2">call 112</a> straight away.
          </li>
        </ul>
      </div>
    </div>
  )
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Tiny formatter for coach answers: paragraphs, "- " bullets and **bold** (no HTML). */
export function RichText({ text, className }: { text: string; className?: string }) {
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
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{inline(b.text)}</p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2">
                <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
                <span className="min-w-0">{inline(it)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

const LINK_ICON: Record<CoachLinkIcon, { icon: LucideIcon; tone: Tone }> = {
  steps: { icon: Footprints, tone: "sky" },
  water: { icon: Droplets, tone: "cyan" },
  sleep: { icon: Moon, tone: "indigo" },
  habits: { icon: ListChecks, tone: "emerald" },
  score: { icon: Gauge, tone: "violet" },
  nutrition: { icon: Utensils, tone: "amber" },
  article: { icon: BookOpen, tone: "teal" },
  workouts: { icon: Dumbbell, tone: "violet" },
}

/** Tappable card attached to a coach answer (workout, plan or module link). */
export function CoachCardView({ card }: { card: CoachCard }) {
  if (card.type === "workout") {
    return (
      <Link href={`/employee-app/workouts/${card.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition-all hover:-translate-y-px hover:shadow-md">
        <EmojiCover emoji={card.emoji} color={card.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{card.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {card.durationMin} min
            </span>
            <span>{titleCase(card.level)}</span>
            <span>{titleCase(card.location)}</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          Open <ChevronRight className="size-3.5" />
        </span>
      </Link>
    )
  }
  if (card.type === "plan") {
    return (
      <Link
        href="/employee-app/coach/plan"
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 p-4 text-white shadow-md shadow-emerald-500/20 transition-transform hover:-translate-y-px"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <CalendarCheck className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-bold">{card.title}</span>
          <span className="block text-xs text-white/85">{card.summary}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
          Open plan <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    )
  }
  const v = LINK_ICON[card.icon]
  return (
    <Link href={card.href} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition-all hover:-translate-y-px hover:shadow-md">
      <IconTile icon={v.icon} tone={v.tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{card.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{card.description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

/** Three bouncing dots inside an assistant bubble. */
export function TypingBubble() {
  return (
    <div className="flex items-end gap-2" role="status" aria-label="Coach is typing">
      <CoachAvatar size="sm" />
      <div className="flex h-11 items-center gap-1.5 rounded-2xl rounded-bl-md border bg-card px-4 shadow-xs">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }} />
        ))}
      </div>
    </div>
  )
}

export const SUGGESTION_ICON: Record<string, LucideIcon> = {
  "How can I improve my wellness score?": Gauge,
  "Give me a 20-minute workout.": Dumbbell,
  "What should I eat for lunch?": Utensils,
  "How can I improve my sleep?": Moon,
  "Create a 7-day wellness plan.": CalendarCheck,
}
