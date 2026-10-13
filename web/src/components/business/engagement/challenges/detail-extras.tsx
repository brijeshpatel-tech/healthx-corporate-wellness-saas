"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Award, Ban, Download, Eye, Mail, MapPin, Plus, QrCode, RefreshCw, Zap } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SelectField, SwitchField, TextareaField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog, SectionCard } from "@/components/common/misc"
import { PhaseBadge, StatusBadge } from "@/components/common/status-badge"
import { EmptyState } from "@/components/common/states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { challengeExtrasApi, type CertificateRow, type CertificateSummary, type MiniChallengeRow } from "@/lib/api/business/challenge-extras"
import type { ChallengeDetail } from "@/lib/api/business/challenges"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { downloadText } from "@/lib/download"
import { formatDate, formatDateTime, formatNumber, formatShortDate } from "@/lib/format"
import type { ChallengeMetric } from "@/lib/types"
import { CopyButton } from "../leaderboards/share-board-dialog"
import { formatMetricValue, METRIC_META } from "./challenge-meta"
import { PLACE_META, RoutePreview } from "./form-sections"

// ─── Invite to join (#356, P1) ──────────────────────────────────────────

export function InviteCard({ challenge }: { challenge: ChallengeDetail }) {
  const q = useApiQuery(["business", "challenges", "join", challenge.id], () => challengeExtrasApi.joinInfo({ id: challenge.id }))
  const [confirm, setConfirm] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const regen = useApiMutation(challengeExtrasApi.regenerateJoinCode, { success: "New join code created – the old code and QR stop working." })
  const url = q.data?.path ? `${typeof window !== "undefined" ? window.location.origin : ""}${q.data.path}` : ""
  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg")
    if (svg && q.data) downloadText(`${challenge.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${q.data.code}.svg`, new XMLSerializer().serializeToString(svg), "image/svg+xml")
  }
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <QrCode className="size-4 text-primary" /> Invite to join
        </span>
      }
      description="Share on posters, slides or chat — employees scan the QR code, open the link or type the code in the app."
    >
      {q.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !q.data?.available ? (
        <p className="text-sm text-muted-foreground">A join code is created when the challenge is published.</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-stretch xl:flex-row xl:items-center">
          <div ref={qrRef} className="mx-auto shrink-0 rounded-xl border bg-white p-3 sm:mx-0">
            <QRCodeSVG value={url} size={132} level="M" marginSize={0} title={`Join ${challenge.name}`} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Join code</p>
              <p className="font-mono text-2xl font-bold tracking-[0.25em]">{q.data.code}</p>
            </div>
            <div className="flex gap-1.5">
              <Input readOnly value={url} className="h-8 min-w-0 font-mono text-xs" aria-label="Join link" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={url} label="Copy join link" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadQr}>
                <Download data-icon="inline-start" /> QR code
              </Button>
              {challenge.canCancel ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} disabled={regen.isPending}>
                  {regen.isPending ? <Spinner /> : <RefreshCw data-icon="inline-start" />} New code
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Create a new join code?"
        description="The current code, link and printed QR codes will stop working. People who already joined stay in the challenge."
        confirmLabel="Create new code"
        onConfirm={() => {
          regen.mutate({ id: challenge.id })
          setConfirm(false)
        }}
      />
    </SectionCard>
  )
}

// ─── Winner prizes (#359, P1) ───────────────────────────────────────────

export function PrizesCard({ challenge }: { challenge: ChallengeDetail }) {
  const prizes = challenge.settings.prizes
  if (challenge.type === "collaborative") return null
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Award className="size-4 text-amber-500" /> Winner prizes
        </span>
      }
      description={challenge.type === "team" ? `For every participant in the top ${challenge.teamUnit === "team" ? "teams" : "departments"}.` : "For the top 3 on the challenge leaderboard."}
    >
      {prizes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No winner prizes — everyone who completes gets the {formatNumber(challenge.points)} completion points.</p>
      ) : (
        <ul className="space-y-2">
          {PLACE_META.map((m) => {
            const p = prizes.find((x) => x.place === m.place)
            if (!p) return null
            return (
              <li key={m.place} className="flex items-start gap-3 rounded-xl border p-3">
                <span className="text-2xl leading-none" aria-label={m.label}>
                  {m.medal}
                </span>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-medium">{p.text || p.rewardName || `${formatNumber(p.points ?? 0)} bonus points`}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {p.rewardName && p.text ? (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-300">
                        {p.rewardEmoji} {p.rewardName}
                      </span>
                    ) : null}
                    {p.points && (p.text || p.rewardName) ? <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-amber-700 dark:text-amber-300">+{formatNumber(p.points)} pts</span> : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── Walking journey (#374, P2) ─────────────────────────────────────────

export function JourneyCard({ challenge }: { challenge: ChallengeDetail }) {
  const q = useApiQuery(["business", "challenges", "journey", challenge.id], () => challengeExtrasApi.journey({ id: challenge.id }), { enabled: !!challenge.settings.journey })
  const j = q.data
  if (!challenge.settings.journey) return null
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> {challenge.settings.journey.name} <PhaseBadge phase={2} />
        </span>
      }
      description={`Walking journey · ${formatNumber(challenge.settings.journey.totalKm)} km${challenge.metric === "steps" ? " · 1 km ≈ 1,320 steps" : ""}`}
    >
      {q.isLoading || !j ? (
        <Skeleton className="h-36 rounded-xl" />
      ) : (
        <div className="space-y-4">
          <RoutePreview totalKm={j.journey.totalKm} milestones={j.milestones} averageKm={j.participants ? j.averageKm : undefined} leaderKm={j.participants ? j.leaderKm : undefined} color={challenge.coverColor} />
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Average distance" value={`${formatNumber(j.averageKm, 1)} km`} />
            <MiniStat label="Furthest walker" value={`${formatNumber(j.leaderKm, 1)} km`} />
            <MiniStat label="On the route" value={formatNumber(j.participants)} />
          </div>
          {j.milestones.length ? (
            <ul className="divide-y rounded-xl border">
              {j.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatNumber(m.km)} km</span>
                    {m.points ? <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">+{m.points} pts</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{m.reached === null ? `< ${j.minGroupSize} reached` : `${formatNumber(m.reached)} reached`}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold tabular-nums">{value}</p>
    </div>
  )
}

// ─── Mini-challenges (#350, P2) ─────────────────────────────────────────

export function MiniChallengesCard({ challenge }: { challenge: ChallengeDetail }) {
  const q = useApiQuery(["business", "challenges", "mini", challenge.id], () => challengeExtrasApi.miniList({ id: challenge.id }))
  const [open, setOpen] = useState(false)
  const [cancel, setCancel] = useState<MiniChallengeRow | null>(null)
  const cancelM = useApiMutation(challengeExtrasApi.miniCancel, { success: "Mini-challenge cancelled" })
  const canAdd = challenge.canCancel && (challenge.status === "active" || challenge.status === "scheduled")
  const items = q.data ?? []
  if (!canAdd && items.length === 0) return null
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Zap className="size-4 text-amber-500" /> Mini-challenges <PhaseBadge phase={2} />
        </span>
      }
      description="Short, optional competitions inside this challenge with bonus points for a limited number of winners."
      actions={
        canAdd ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" /> Add
          </Button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={Zap} title="No mini-challenges yet" description="Add a weekend sprint or a one-week top-10 to keep energy up mid-challenge." className="border-0 py-6" />
      ) : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.kind === "race" ? `Race: first ${m.winnerSlots} to ${formatMetricValue(m.target ?? 0, m.metric, challenge.customMetricLabel, true)}` : `Leaderboard: top ${m.winnerSlots} on ${METRIC_META[m.metric].label.toLowerCase()}`} ·{" "}
                    {formatShortDate(m.startDate)} – {formatShortDate(m.endDate)} · +{formatNumber(m.bonusPoints)} pts
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={m.status} />
                  {canAdd && (m.status === "scheduled" || m.status === "active") ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Cancel ${m.title}`} onClick={() => setCancel(m)}>
                      <Ban className="text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {m.status !== "scheduled" && m.status !== "cancelled" ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground tabular-nums">{formatNumber(m.taking)}</span> taking part
                  </span>
                  {m.kind === "race" ? (
                    <span>
                      <span className="font-semibold text-foreground tabular-nums">{formatNumber(Math.min(m.reached, m.winnerSlots))}</span>/{m.winnerSlots} winner slots filled
                    </span>
                  ) : null}
                  {m.leaders.length ? <span className="truncate">Leading: {m.leaders.map((l) => `${l.name} (${formatMetricValue(l.value, m.metric, challenge.customMetricLabel, true)})`).join(", ")}</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <MiniChallengeDialog challenge={challenge} open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={!!cancel}
        onOpenChange={(o) => !o && setCancel(null)}
        destructive
        title={`Cancel “${cancel?.title}”?`}
        description="No bonus points will be awarded for it. The main challenge isn't affected."
        confirmLabel="Cancel mini-challenge"
        onConfirm={() => {
          if (cancel) cancelM.mutate({ id: challenge.id, miniId: cancel.id })
          setCancel(null)
        }}
      />
    </SectionCard>
  )
}

const num = z.union([z.number(), z.literal("")])
const miniSchema = z.object({
  title: z.string().trim().min(3, "Give it a short title").max(60, "Keep it under 60 characters"),
  description: z.string().max(200, "Keep it under 200 characters"),
  kind: z.enum(["race", "leaderboard"]),
  metric: z.enum(["steps", "distance", "calories", "active_minutes", "workouts", "water", "meditation", "custom"]),
  target: num,
  startDate: z.string().min(1, "Choose a start date"),
  endDate: z.string().min(1, "Choose an end date"),
  bonusPoints: z.number({ error: "Enter bonus points" }).int().min(0, "0 or more").max(5000, "Up to 5,000"),
  winnerSlots: z.number({ error: "How many winners?" }).int().min(1, "At least 1").max(100, "Up to 100"),
  announce: z.boolean(),
})
type MiniValues = z.infer<typeof miniSchema>

function MiniChallengeDialog({ challenge, open, onOpenChange }: { challenge: ChallengeDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const today = formatDate(new Date(), "yyyy-MM-dd")
  const start = challenge.startDate > today ? challenge.startDate : today
  const defaults: MiniValues = { title: "", description: "", kind: "race", metric: challenge.metric, target: "", startDate: start, endDate: start, bonusPoints: 50, winnerSlots: 10, announce: true }
  const form = useForm<MiniValues>({
    resolver: zodResolver(
      miniSchema.superRefine((v, ctx) => {
        if (v.kind === "race" && !(typeof v.target === "number" && v.target > 0)) ctx.addIssue({ code: "custom", path: ["target"], message: "Races need a target above 0" })
        if (v.startDate && (v.startDate < challenge.startDate || v.startDate > challenge.endDate)) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Within the challenge dates" })
        if (v.endDate && v.endDate > challenge.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "By the challenge end date" })
        if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "On or after the start date" })
      }),
    ),
    defaultValues: defaults,
  })
  const kind = useWatch({ control: form.control, name: "kind" })
  const metric = useWatch({ control: form.control, name: "metric" }) as ChallengeMetric
  const create = useApiMutation(challengeExtrasApi.miniCreate, {
    success: (m) => (m.announce ? "Mini-challenge added – participants have been notified." : "Mini-challenge added"),
    onSuccess: () => {
      onOpenChange(false)
      form.reset(defaults)
    },
    onError: (err) => Object.entries(err.fieldErrors ?? {}).forEach(([k, message]) => form.setError(k as keyof MiniValues, { message })),
  })
  const unit = metric === "custom" ? challenge.customMetricLabel || "check-ins" : METRIC_META[metric].unit
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add a mini-challenge <PhaseBadge phase={2} />
          </DialogTitle>
          <DialogDescription>
            Runs inside “{challenge.name}” ({formatShortDate(challenge.startDate)} – {formatShortDate(challenge.endDate)}). Participants can take part without leaving the main challenge.
          </DialogDescription>
        </DialogHeader>
        <form
          id="mini-form"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) => create.mutate({ ...v, challengeId: challenge.id, target: v.kind === "race" && typeof v.target === "number" ? v.target : undefined, description: v.description || undefined }))}
        >
          <TextField control={form.control} name="title" label="Title" placeholder="e.g. Weekend 25K sprint" required className="sm:col-span-2" />
          <ChoiceField
            control={form.control}
            name="kind"
            label="Format"
            className="sm:col-span-2"
            options={[
              { value: "race", label: "Race to target", description: "The first N people to reach the target win." },
              { value: "leaderboard", label: "Open leaderboard", description: "The top N at the end win." },
            ]}
          />
          <SelectField control={form.control} name="metric" label="Metric" options={(Object.keys(METRIC_META) as ChallengeMetric[]).map((m) => ({ value: m, label: m === "custom" && challenge.customMetricLabel ? challenge.customMetricLabel : METRIC_META[m].label }))} />
          {kind === "race" ? <TextField control={form.control} name="target" type="number" label="Target" suffix={unit.length <= 5 ? unit : undefined} required /> : <div className="hidden sm:block" />}
          <TextField control={form.control} name="startDate" type="date" label="Starts" required />
          <TextField control={form.control} name="endDate" type="date" label="Ends" required />
          <TextField control={form.control} name="bonusPoints" type="number" label="Bonus points" suffix="pts" required />
          <TextField control={form.control} name="winnerSlots" type="number" label="Winner slots" required description="How many people can win." />
          <TextareaField control={form.control} name="description" label="Description (optional)" rows={2} maxLength={200} className="sm:col-span-2" />
          <SwitchField control={form.control} name="announce" label="Announce with a push notification" description="Sent to everyone in the challenge." className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="mini-form" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Plus data-icon="inline-start" />}
            Add mini-challenge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Completion certificates (#355, P2) ─────────────────────────────────

export function CertificatesCard({ challenge }: { challenge: ChallengeDetail }) {
  const enabled = challenge.status === "active" || challenge.status === "completed"
  const q = useApiQuery(["business", "challenges", "certificates", challenge.id], () => challengeExtrasApi.certificates({ id: challenge.id }), { enabled })
  const [preview, setPreview] = useState<CertificateRow | null>(null)
  const [confirm, setConfirm] = useState(false)
  const email = useApiMutation(challengeExtrasApi.emailCertificates, { success: (r) => `Certificates emailed to ${formatNumber(r.sent)} employees.` })
  if (!enabled) return null
  const data = q.data
  const exportCsv = () => {
    if (!data) return
    const origin = window.location.origin
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const rows = data.items.map((c) => [c.number, c.name, c.department, c.completedOn, `${origin}${c.path}`].map(esc).join(","))
    downloadText(`certificates-${challenge.id}.csv`, ["Certificate no.,Employee,Department,Completed on,Certificate link", ...rows].join("\n"))
  }
  return (
    <SectionCard
      title={
        <span className="inline-flex items-center gap-2">
          <Award className="size-4 text-primary" /> Completion certificates <PhaseBadge phase={2} />
        </span>
      }
      description={data?.rule ?? "Issued automatically to people who complete."}
    >
      {q.isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : q.error ? (
        <p className="text-sm text-muted-foreground">Certificates are available to challenge managers.</p>
      ) : !data?.available ? (
        <p className="text-sm text-muted-foreground">{data?.reason}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-bold tabular-nums">{formatNumber(data.items.length)}</span>
            <span className="text-sm text-muted-foreground">certificates issued</span>
          </div>
          <p className="text-xs text-muted-foreground">{data.emailedAt ? `Last emailed ${formatDateTime(data.emailedAt)} to ${formatNumber(data.emailedCount ?? 0)} people.` : "Not emailed yet — employees can always download theirs in the app."}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPreview(data.items[0]!)}>
              <Eye data-icon="inline-start" /> Preview
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(true)} disabled={email.isPending}>
              {email.isPending ? <Spinner /> : <Mail data-icon="inline-start" />} Email all
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download data-icon="inline-start" /> CSV
            </Button>
          </div>
        </div>
      )}
      {data && preview ? <CertificatePreview open={!!preview} onOpenChange={(o) => !o && setPreview(null)} summary={data} row={preview} onPick={setPreview} /> : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Email ${formatNumber(data?.items.length ?? 0)} certificates?`}
        description="Each person gets their own certificate by email and an in-app notification."
        confirmLabel="Email all"
        onConfirm={() => {
          email.mutate({ id: challenge.id })
          setConfirm(false)
        }}
      />
    </SectionCard>
  )
}

function CertificatePreview({ open, onOpenChange, summary, row, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; summary: CertificateSummary; row: CertificateRow; onPick: (r: CertificateRow) => void }) {
  const idx = summary.items.findIndex((r) => r.id === row.id)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Certificate preview</DialogTitle>
          <DialogDescription>
            {idx + 1} of {formatNumber(summary.items.length)} · {row.number}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border-4 border-double border-primary/40 bg-gradient-to-br from-primary/5 via-background to-amber-500/5 p-6 text-center sm:p-10">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">{summary.companyName}</p>
          <p className="mt-4 font-heading text-2xl font-bold sm:text-3xl">Certificate of completion</p>
          <p className="mt-6 text-sm text-muted-foreground">This certifies that</p>
          <p className="mt-1 font-heading text-3xl font-bold break-words text-primary sm:text-4xl">{row.name}</p>
          <p className="mt-3 text-sm text-muted-foreground">successfully completed</p>
          <p className="mt-1 text-lg font-semibold">{summary.challengeName}</p>
          <div className="mt-8 flex items-end justify-between gap-4 text-left text-xs text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">{formatDate(row.completedOn)}</p>
              <p>Completed on</p>
            </div>
            <span className="flex size-14 items-center justify-center rounded-full border-2 border-primary/50 text-2xl" aria-hidden>
              🏅
            </span>
            <div className="text-right">
              <p className="font-mono font-medium text-foreground">{row.number}</p>
              <p>
                Health<span className="text-primary">X</span> verified
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <span className="text-xs text-muted-foreground">Employees download theirs from the challenge page in the app.</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={idx <= 0} onClick={() => onPick(summary.items[idx - 1]!)}>
              Previous
            </Button>
            <Button variant="outline" disabled={idx >= summary.items.length - 1} onClick={() => onPick(summary.items[idx + 1]!)}>
              Next
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
