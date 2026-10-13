"use client"

import { Award, Check, CheckCircle2, Copy, Flag, Flame, KeyRound, Link2, MapPin, Printer, QrCode, Smartphone, Sparkles, Trophy, Watch } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { challengesApi, type ChallengePrizes, type ChallengeResults, type JourneyView, type MiniChallengeView, type WarmUp } from "@/lib/api/employee/challenges"
import { useApiMutation } from "@/lib/api/hooks"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const PLACES = [
  { medal: "🥇", label: "1st place", ring: "border-amber-400/60 bg-amber-500/10" },
  { medal: "🥈", label: "2nd place", ring: "border-slate-400/50 bg-slate-500/8" },
  { medal: "🥉", label: "3rd place", ring: "border-orange-400/50 bg-orange-500/8" },
]

/** #359 — 1st / 2nd / 3rd place prizes (individual and/or team). */
export function PrizesCard({ prizes, className }: { prizes: ChallengePrizes; className?: string }) {
  const groups = [
    { key: "individual", title: "Individual prizes", list: prizes.individual },
    { key: "team", title: "Team prizes", list: prizes.team },
  ].filter((g) => g.list.some(Boolean))
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          <h2 className="font-heading text-base font-semibold">Winner prizes</h2>
        </div>
        {groups.map((g) => (
          <div key={g.key} className="space-y-2">
            {groups.length > 1 ? <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</p> : null}
            <div className="grid gap-2">
              {g.list.map((prize, i) =>
                prize ? (
                  <div key={i} className={cn("flex items-center gap-3 rounded-xl border p-2.5", PLACES[i]!.ring)}>
                    <span className="text-2xl leading-none">{PLACES[i]!.medal}</span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground">{PLACES[i]!.label}</p>
                      <p className="truncate text-sm font-semibold">{prize}</p>
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** #358 — warm-up / get-ready checklist before scoring starts. */
export function GetReadyCard({ warmUp, startDate, joined, trackerConnected, phase }: { warmUp: WarmUp | null; startDate: string; joined: boolean; trackerConnected: boolean; phase: string }) {
  const scoringStart = warmUp?.scoringStart ?? startDate
  const steps = [
    { done: joined, label: "Join the challenge", hint: joined ? "You're in." : "Tap Join to take part." },
    { done: trackerConnected, label: "Connect Apple Health or Health Connect", hint: trackerConnected ? "Your tracker is connected." : "So your steps count automatically.", href: trackerConnected ? undefined : "/employee-app/settings/connected-apps" },
    { done: false, label: `Scoring starts ${formatDate(scoringStart, "EEE, d MMM")}`, hint: "Activity from this date counts towards your total." },
  ]
  return (
    <Card className="gap-0 overflow-hidden border-orange-500/25 py-0">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-orange-500" />
          <h2 className="font-heading text-base font-semibold">{phase === "warmup" ? "Warm-up period" : "Get ready"}</h2>
          {warmUp ? <span className="rounded-full bg-orange-500/12 px-2 py-0.5 text-[11px] font-semibold text-orange-700 dark:text-orange-300">{warmUp.days}-day warm-up</span> : null}
        </div>
        <p className="text-sm text-muted-foreground">{phase === "warmup" ? "Join now and connect your tracker — nothing is scored until the warm-up ends." : "Set yourself up before the challenge starts."}</p>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2", s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 text-muted-foreground")}>
                {s.done ? <Check className="size-3.5" strokeWidth={3} /> : s.label.startsWith("Connect") ? <Watch className="size-3" /> : <Flag className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </div>
              {s.href ? (
                <Button asChild size="sm" variant="outline" className="shrink-0 rounded-lg">
                  <Link href={s.href}>Connect</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

/** #374 — walking journey: progress along a virtual route with milestones. */
export function JourneyCard({ journey }: { journey: JourneyView }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold">{journey.name}</h2>
          </div>
          <p className="text-sm">
            <span className="font-heading font-bold tabular-nums">{formatNumber(journey.doneKm, 1)}</span>
            <span className="text-muted-foreground"> / {formatNumber(journey.totalKm, 1)} km</span>
          </p>
        </div>
        <div className="relative px-2 pt-7 pb-8">
          <div className="h-2 rounded-full bg-muted" />
          <div className="absolute top-7 left-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `calc((100% - 1rem) * ${journey.pct})` }} />
          {journey.milestones.map((m) => (
            <div key={`${m.name}-${m.km}`} className="absolute top-[1.35rem] -translate-x-1/2" style={{ left: `calc(0.5rem + (100% - 1rem) * ${Math.min(1, m.km / journey.totalKm)})` }}>
              <span className={cn("block size-5 rounded-full border-2", m.reached ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 bg-card")} title={`${m.name} · ${m.km} km`} />
            </div>
          ))}
          <div className="absolute top-0 -translate-x-1/2 text-lg" style={{ left: `calc(0.5rem + (100% - 1rem) * ${journey.pct})` }} aria-label="You are here">
            🚶
          </div>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {journey.milestones.map((m) => (
            <li key={`${m.name}-${m.km}-row`} className={cn("flex items-center gap-2.5 rounded-xl border p-2.5 text-sm", m.reached && "border-emerald-500/30 bg-emerald-500/6")}>
              {m.reached ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Flag className="size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate font-medium">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(m.km, 1)} km</span>
              {m.reward ? <span className="shrink-0 rounded-full bg-amber-500/12 px-1.5 text-[10px] leading-4 font-semibold text-amber-700 dark:text-amber-300">{m.reward}</span> : null}
            </li>
          ))}
        </ul>
        {journey.next ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatNumber(journey.next.kmToGo, 1)} km</span> to {journey.next.name}
          </p>
        ) : (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Journey complete! 🎉</p>
        )}
      </CardContent>
    </Card>
  )
}

/** #350 — optional mini-challenges inside the main challenge. */
export function MiniChallengesCard({ minis, challengeId, joinedMain }: { minis: MiniChallengeView[]; challengeId: string; joinedMain: boolean }) {
  const join = useApiMutation(challengesApi.joinMini, { success: "You've joined the mini-challenge." })
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          <h2 className="font-heading text-base font-semibold">Mini-challenges</h2>
          <span className="rounded-md bg-violet-500/12 px-1.5 text-[10px] font-semibold text-violet-700 uppercase dark:text-violet-300">Bonus</span>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">Short, optional competitions inside this challenge — limited winner slots.</p>
        <div className="space-y-2.5">
          {minis.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {m.title}
                  <span className={cn("rounded-full px-1.5 text-[10px] leading-4 font-semibold uppercase", m.status === "live" ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : m.status === "upcoming" ? "bg-sky-500/12 text-sky-700 dark:text-sky-300" : "bg-muted text-muted-foreground")}>
                    {m.status === "live" ? "Live" : m.status === "upcoming" ? "Soon" : "Ended"}
                  </span>
                </p>
                {m.description ? <p className="text-xs text-muted-foreground">{m.description}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {m.bonusPoints ? `+${m.bonusPoints} bonus pts` : "Bonus points"}
                  {m.winnerSlots ? ` · top ${m.winnerSlots} win` : ""}
                  {m.startDate && m.endDate ? ` · ${formatDate(m.startDate, "d MMM")} – ${formatDate(m.endDate, "d MMM")}` : ""}
                  {m.joinedCount ? ` · ${m.joinedCount} joined` : ""}
                </p>
              </div>
              {m.joined ? (
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:self-center dark:text-emerald-300">
                  <Check className="size-3.5" /> Joined
                </span>
              ) : (
                <Button size="sm" className="h-9 self-start rounded-lg sm:self-center" disabled={!joinedMain || m.status === "ended" || join.isPending} onClick={() => join.mutate({ id: challengeId, miniId: m.id })} title={joinedMain ? undefined : "Join the main challenge first"}>
                  {join.isPending ? <Spinner /> : null} Join
                </Button>
              )}
            </div>
          ))}
        </div>
        {!joinedMain ? <p className="text-xs text-muted-foreground">Join the main challenge to take part in mini-challenges.</p> : null}
      </CardContent>
    </Card>
  )
}

/** #356 — share the short code / link so colleagues can join. */
export function InviteCodeCard({ code, challengeId }: { code: string; challengeId: string }) {
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied`)
    } catch {
      toast.error("Couldn't copy — select the text instead.")
    }
  }
  const link = () => `${window.location.origin}/employee-app/challenges/join/${code}`
  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-primary" />
          <p className="text-sm font-semibold">Invite colleagues</p>
        </div>
        <p className="text-xs text-muted-foreground">Share the code or link — colleagues can enter it under Challenges → Join with code (challenge {challengeId.toUpperCase()}).</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-xl border border-dashed bg-muted/50 px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.3em]">{code}</code>
          <Button variant="outline" size="icon-lg" className="rounded-xl" onClick={() => copy(code, "Code")} aria-label="Copy code">
            <Copy />
          </Button>
          <Button variant="outline" size="icon-lg" className="rounded-xl" onClick={() => copy(link(), "Link")} aria-label="Copy link">
            <Link2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** #356 — "Join with code" dialog on the Challenges page. */
export function JoinWithCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const error = code && clean.length < 4 ? "Codes have at least 4 letters or numbers" : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> Join with code
          </DialogTitle>
          <DialogDescription>Enter the short code from a poster, QR code or message from your HR team.</DialogDescription>
        </DialogHeader>
        <form
          id="join-code-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (clean.length < 4) return
            onOpenChange(false)
            router.push(`/employee-app/challenges/join/${clean}`)
          }}
          className="space-y-2"
        >
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. 7K2F9Q"
            className="h-12 rounded-xl text-center font-mono text-xl tracking-[0.3em] uppercase"
            maxLength={16}
            aria-invalid={!!error}
            aria-label="Challenge code"
          />
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="size-3.5" /> Scanning a QR code opens the challenge directly.</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="join-code-form" disabled={clean.length < 4}>
            Find challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** #355 — printable completion certificate. */
export function CertificateDialog({ certificate, color, open, onOpenChange }: { certificate: NonNullable<ChallengeResults["certificate"]>; color: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <style>{`@media print {
          body * { visibility: hidden !important; }
          .hx-certificate, .hx-certificate * { visibility: visible !important; }
          .hx-certificate { position: fixed; inset: 0; margin: 0; border: none !important; box-shadow: none !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }`}</style>
        <DialogHeader>
          <DialogTitle>Completion certificate</DialogTitle>
          <DialogDescription>Print it or choose “Save as PDF” in the print dialog.</DialogDescription>
        </DialogHeader>
        <div className="hx-certificate relative overflow-hidden rounded-2xl border-4 bg-white p-6 text-center text-slate-900 sm:p-10" style={{ borderColor: color }}>
          <div className="pointer-events-none absolute inset-2 rounded-xl border border-dashed" style={{ borderColor: `${color}80` }} />
          <div className="relative flex flex-col items-center gap-3">
            <Logo />
            <p className="mt-2 text-xs font-semibold tracking-[0.3em] text-slate-500 uppercase">Certificate of completion</p>
            <p className="text-sm text-slate-500">This certifies that</p>
            <p className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{certificate.employeeName}</p>
            <p className="text-sm text-slate-500">successfully completed</p>
            <p className="font-heading text-xl font-bold" style={{ color }}>
              {certificate.challengeName}
            </p>
            <p className="max-w-md text-sm text-slate-600">{certificate.achievement}</p>
            <div className="mt-4 flex w-full flex-wrap items-end justify-between gap-4 text-left text-xs text-slate-500">
              <div>
                <p className="font-semibold text-slate-700">{certificate.companyName}</p>
                <p>Completed {formatDate(certificate.completedOn, "d MMMM yyyy")}</p>
              </div>
              <Award className="size-10" style={{ color }} />
              <div className="text-right">
                <p className="font-semibold text-slate-700">HealthX Wellness</p>
                <p>No. {certificate.certificateNo}</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" /> Print / save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
