"use client"

import { CheckCircle2, CircleHelp, Clock, LifeBuoy, Pause, Play, RotateCcw, Search, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { EmptyState, ErrorState, PageSkeleton } from "@/components/common/states"
import { PhaseBadge } from "@/components/common/status-badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { helpApi, type Tutorial, type TutorialCategory } from "@/lib/api/business/help"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

const CATEGORIES: (TutorialCategory | "All")[] = ["All", "Getting started", "People", "Challenges", "Rewards", "Analytics", "Settings"]
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** #373 — Help & admin video tutorials (Phase 2). */
export default function HelpPage() {
  const q = useApiQuery(["business", "help"], () => helpApi.content())
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All")
  const [search, setSearch] = useState("")
  const [playing, setPlaying] = useState<Tutorial | null>(null)

  const s = search.trim().toLowerCase()
  const tutorials = useMemo(
    () => (q.data?.tutorials ?? []).filter((t) => (category === "All" || t.category === category) && (!s || `${t.title} ${t.description}`.toLowerCase().includes(s))),
    [q.data, category, s],
  )
  const faqs = useMemo(() => (q.data?.faqs ?? []).filter((f) => (category === "All" || f.category === category) && (!s || `${f.question} ${f.answer}`.toLowerCase().includes(s))), [q.data, category, s])
  const watched = (q.data?.tutorials ?? []).filter((t) => t.watched).length
  const total = q.data?.tutorials.length ?? 0

  return (
    <PageContainer>
      <PageHeader
        title="Help & tutorials"
        badge={<PhaseBadge phase={2} />}
        description="Short videos and answers to common questions about running HealthX for your company."
        actions={
          <Button asChild variant="outline">
            <a href="mailto:support@healthx.life">
              <LifeBuoy data-icon="inline-start" /> Contact support
            </a>
          </Button>
        }
      />

      {q.isLoading ? (
        <PageSkeleton kpis={0} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos and FAQs…" className="h-9 pl-8" />
              {search ? (
                <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn("shrink-0 rounded-full border px-3 py-1 text-sm transition-colors", category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground lg:ml-auto">
              <CheckCircle2 className="size-4 text-emerald-600" /> {watched} of {total} watched
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="font-heading text-base font-semibold">Video tutorials</h2>
            {tutorials.length === 0 ? (
              <EmptyState icon={Play} title="No videos match" description="Try another word or category." className="py-8" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tutorials.map((t) => (
                  <button key={t.id} type="button" onClick={() => setPlaying(t)} className="group overflow-hidden rounded-xl border bg-card text-left shadow-xs transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                    <span className="relative flex aspect-video items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                      <span className="text-5xl drop-shadow-sm transition-transform group-hover:scale-110">{t.emoji}</span>
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                          <Play className="ml-0.5 size-5 fill-current" />
                        </span>
                      </span>
                      <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">{mmss(t.durationSec)}</span>
                      {t.watched ? (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> Watched
                        </span>
                      ) : null}
                    </span>
                    <span className="block space-y-1 p-4">
                      <Badge variant="secondary">{t.category}</Badge>
                      <span className="block font-medium">{t.title}</span>
                      <span className="block text-sm text-muted-foreground">{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="inline-flex items-center gap-2 font-heading text-base font-semibold">
              <CircleHelp className="size-4 text-muted-foreground" /> Frequently asked questions
            </h2>
            {faqs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions match.</p>
            ) : (
              <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
                {faqs.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger className="text-left">{f.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>
        </>
      )}

      <PlayerDialog tutorial={playing} onClose={() => setPlaying(null)} />
    </PageContainer>
  )
}

/** Placeholder player: simulates playback (sample data has no video files). */
function PlayerDialog({ tutorial, onClose }: { tutorial: Tutorial | null; onClose: () => void }) {
  const [time, setTime] = useState(0)
  const [running, setRunning] = useState(false)
  const [current, setCurrent] = useState<string | null>(null)
  const markWatched = useApiMutation(helpApi.markWatched, { success: "Marked as watched." })
  if ((tutorial?.id ?? null) !== current) {
    setCurrent(tutorial?.id ?? null)
    setTime(0)
    setRunning(!!tutorial)
  }
  const duration = tutorial?.durationSec ?? 1
  const done = time >= duration

  useEffect(() => {
    if (!running || done) return
    // 1 real second = 8 seconds of video, so the demo finishes quickly.
    const t = setInterval(() => setTime((s) => Math.min(duration, s + 8)), 1000)
    return () => clearInterval(t)
  }, [running, done, duration])

  const marked = useRef<string | null>(null)
  const { mutate } = markWatched
  useEffect(() => {
    if (!done || !tutorial || tutorial.watched || marked.current === tutorial.id) return
    marked.current = tutorial.id
    mutate({ id: tutorial.id })
  }, [done, tutorial, mutate])
  const watchedNow = !!tutorial && (tutorial.watched || (markWatched.isSuccess && markWatched.variables?.id === tutorial.id))

  const chapter = tutorial ? [...tutorial.chapters].reverse().find((c) => c.at <= time) : undefined

  return (
    <Dialog open={!!tutorial} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {tutorial ? (
          <>
            <div className="relative aspect-video w-full" style={{ background: `linear-gradient(135deg, ${tutorial.gradient[0]}, ${tutorial.gradient[1]})` }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <span className={cn("text-7xl transition-transform", running && !done && "animate-pulse")}>{tutorial.emoji}</span>
                <span className="rounded-full bg-black/35 px-3 py-1 text-sm backdrop-blur">{done ? "Finished" : chapter?.label ?? "Starting…"}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                <Progress value={(time / duration) * 100} className="h-1.5 bg-white/25 [&>*]:bg-white" />
                <div className="flex items-center gap-2">
                  <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" aria-label={done ? "Replay" : running ? "Pause" : "Play"} onClick={() => {
                      if (done) {
                        setTime(0)
                        setRunning(true)
                      } else setRunning((r) => !r)
                    }}>
                    {done ? <RotateCcw /> : running ? <Pause /> : <Play />}
                  </Button>
                  <span className="text-xs tabular-nums">
                    {mmss(time)} / {mmss(duration)}
                  </span>
                  <span className="ml-auto text-[11px] text-white/80">Sample video</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <DialogHeader className="text-left">
                <DialogTitle>{tutorial.title}</DialogTitle>
                <DialogDescription>{tutorial.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <Clock className="size-3.5" /> Chapters
                </p>
                <ol className="grid gap-1.5 sm:grid-cols-2">
                  {tutorial.chapters.map((c) => (
                    <li key={c.at}>
                      <button
                        type="button"
                        onClick={() => {
                          setTime(c.at)
                          setRunning(true)
                        }}
                        className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted", chapter?.at === c.at && !done && "border-primary/40 bg-primary/5")}
                      >
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">{mmss(c.at)}</span>
                        {c.label}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
              {!watchedNow ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    marked.current = tutorial.id
                    markWatched.mutate({ id: tutorial.id })
                  }}
                  disabled={markWatched.isPending}
                >
                  <CheckCircle2 data-icon="inline-start" /> Mark as watched
                </Button>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" /> Watched
                </p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
