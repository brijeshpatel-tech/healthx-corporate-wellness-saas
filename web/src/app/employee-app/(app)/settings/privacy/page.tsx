"use client"

import type { LucideIcon } from "lucide-react"
import { BarChart3, Bell, Bot, Building2, Check, Download, EyeOff, HeartPulse, History, Lock, MessageSquareHeart, ShieldCheck, Trash2, Trophy, Watch, X } from "lucide-react"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { SwitchRow } from "@/components/employee/engage/account/rows"
import { EngagePage, IconTile, LoadError, MenuGroup, MenuRow, type Tone } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { LEADERBOARD_NAME_LABEL, privacyApi, type ConsentCentre, type ConsentHistoryEntry } from "@/lib/api/employee/privacy"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate, formatDateTime } from "@/lib/format"
import type { Consent, ConsentKey } from "@/lib/types"
import { cn } from "@/lib/utils"

const CONSENT_UI: Record<ConsentKey, { icon: LucideIcon; tone: Tone; phase?: 2 }> = {
  health_data: { icon: HeartPulse, tone: "rose" },
  wearable_connection: { icon: Watch, tone: "cyan" },
  data_sharing: { icon: Building2, tone: "teal" },
  notifications: { icon: Bell, tone: "amber" },
  ai_personalisation: { icon: Bot, tone: "violet", phase: 2 },
  analytics: { icon: BarChart3, tone: "slate" },
}

const SAVED = "Your choice has been saved."
const FAILED = "Couldn't save your choice. Your previous setting is still active."

/** SCR-M-075 Privacy & Consent Centre. */
export default function PrivacyCentrePage() {
  const q = useApiQuery(["employee", "privacy", "consents"], () => privacyApi.consents())
  return (
    <EngagePage size="narrow" title="Privacy & consent" description="You're in control of your data. Changes take effect immediately and are recorded." backHref="/employee-app/settings" backLabel="Settings">
      {q.error ? (
        <LoadError title="Couldn't load your privacy settings." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-[28rem] rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <Centre data={q.data} />
      )}
    </EngagePage>
  )
}

function Centre({ data }: { data: ConsentCentre }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState<"health" | "wearable" | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const clear = (key: string) =>
    setOverrides((o) => {
      const next = { ...o }
      delete next[key]
      return next
    })

  const updateConsent = useApiMutation(privacyApi.updateConsent, {
    success: (r) => (r.disconnected.length ? `${SAVED} ${r.disconnected.join(" and ")} disconnected.` : SAVED),
    errorTitle: FAILED,
  })
  const updateLeaderboard = useApiMutation(privacyApi.updateLeaderboardVisibility, { success: SAVED, errorTitle: FAILED })
  const updateShoutouts = useApiMutation(privacyApi.updateShoutouts, { success: SAVED, errorTitle: FAILED })

  const applyConsent = (key: ConsentKey, granted: boolean) => {
    setOverrides((o) => ({ ...o, [key]: granted }))
    updateConsent.mutate({ type: key, granted }, { onSettled: () => clear(key) })
  }

  const onToggle = (c: Consent, granted: boolean) => {
    if (!granted && c.key === "health_data") return setConfirm("health")
    if (!granted && c.key === "wearable_connection" && data.connectedApps.length) return setConfirm("wearable")
    applyConsent(c.key, granted)
  }

  const value = (key: string, server: boolean) => overrides[key] ?? server
  const hidden = value("leaderboard", data.leaderboard.hidden)
  const shoutouts = value("shoutouts", data.shoutouts.granted)

  return (
    <>
      <WhoSeesWhat data={data} />

      <MenuGroup title="Your consents" description="Turn each one on or off at any time.">
        {data.consents.map((c) => {
          const ui = CONSENT_UI[c.key]
          return (
            <SwitchRow
              key={c.key}
              id={`consent-${c.key}`}
              icon={ui.icon}
              tone={ui.tone}
              title={c.title}
              badge={
                <>
                  {c.required ? <span className="rounded-md bg-rose-500/12 px-1.5 text-[10px] leading-5 font-semibold tracking-wide text-rose-700 uppercase dark:text-rose-300">Required</span> : null}
                  {ui.phase ? <PhaseBadge phase={ui.phase} /> : null}
                </>
              }
              description={c.description}
              meta={`Version ${c.version} · Updated ${formatDate(c.updatedAt)}`}
              checked={value(c.key, c.granted)}
              pending={c.key in overrides}
              onCheckedChange={(v) => onToggle(c, v)}
            />
          )
        })}
      </MenuGroup>

      <MenuGroup title="Leaderboards & sharing">
        <div className="flex items-start gap-3 px-4 py-3.5">
          <IconTile icon={Trophy} tone="amber" size="sm" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">How your name appears</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.companyName} shows <span className="font-medium text-foreground">{LEADERBOARD_NAME_LABEL[data.leaderboard.nameDisplay].toLowerCase()}</span> on leaderboards. You appear as{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">{data.leaderboard.example}</span>
            </p>
          </div>
        </div>
        <SwitchRow
          id="privacy-leaderboard"
          icon={EyeOff}
          tone="slate"
          title="Appear as Anonymous on leaderboards"
          description={
            data.leaderboard.allowOptOut
              ? "Your name and photo are replaced with “Anonymous” on company, department and team leaderboards. Your activity still counts, and you'll still see your own rank."
              : "Your company shows everyone on leaderboards as set above, so this can't be changed. Only your name and leaderboard figures are shown — never your health data."
          }
          meta={data.leaderboard.updatedAt ? `Updated ${formatDate(data.leaderboard.updatedAt)}` : undefined}
          checked={hidden}
          disabled={!data.leaderboard.allowOptOut}
          pending={"leaderboard" in overrides}
          onCheckedChange={(v) => {
            setOverrides((o) => ({ ...o, leaderboard: v }))
            updateLeaderboard.mutate({ hidden: v }, { onSettled: () => clear("leaderboard") })
          }}
        />
        <SwitchRow
          id="privacy-shoutouts"
          icon={MessageSquareHeart}
          tone="pink"
          title="Slack / Teams shout-outs"
          badge={<PhaseBadge phase={2} />}
          description={
            data.shoutouts.companyConnected
              ? "Let us celebrate your badges and challenge wins in your company's Slack or Teams channel."
              : "Let us celebrate your badges and challenge wins in Slack or Teams once your company connects them."
          }
          meta={data.shoutouts.updatedAt ? `Updated ${formatDate(data.shoutouts.updatedAt)}` : undefined}
          checked={shoutouts}
          pending={"shoutouts" in overrides}
          onCheckedChange={(v) => {
            setOverrides((o) => ({ ...o, shoutouts: v }))
            updateShoutouts.mutate({ granted: v }, { onSettled: () => clear("shoutouts") })
          }}
        />
      </MenuGroup>

      <Button variant="outline" className="h-12 w-full justify-center rounded-2xl" onClick={() => setHistoryOpen(true)}>
        <History data-icon="inline-start" />
        View consent history
      </Button>

      <MenuGroup title="Your data">
        <MenuRow icon={Watch} tone="cyan" title="Connected apps & devices" value={data.connectedApps.length ? data.connectedApps.join(", ") : "None"} href="/employee-app/settings/connected-apps" />
        <MenuRow icon={Download} tone="indigo" title="Download my data" badge={<PhaseBadge phase={2} />} description="Get a copy of everything we hold about you" href="/employee-app/settings/download-data" />
        <MenuRow icon={Trash2} destructive title="Delete account" description="Deactivate your account and delete your personal data" href="/employee-app/settings/delete-account" />
      </MenuGroup>

      <ConfirmDialog
        open={confirm === "health"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Withdraw health data permission?"
        destructive
        confirmLabel="Withdraw permission"
        cancelLabel="Keep it on"
        onConfirm={() => applyConsent("health_data", false)}
        description={
          <>
            <span className="block">HealthX needs this permission to track your wellness. If you withdraw it:</span>
            <span className="mt-2 block">• Step, activity, water and sleep tracking stops — new data won&apos;t be saved.</span>
            <span className="block">• Challenges and leaderboards stop counting your activity.</span>
            <span className="block">• Your Wellness Score is frozen at its current value.</span>
            <span className="block">• You keep your points and can still use rewards, workouts and wellness content.</span>
            <span className="mt-2 block">You can turn it back on at any time.</span>
          </>
        }
      />
      <ConfirmDialog
        open={confirm === "wearable"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Stop syncing health apps?"
        destructive
        confirmLabel="Withdraw & disconnect"
        cancelLabel="Keep syncing"
        onConfirm={() => applyConsent("wearable_connection", false)}
        description={
          <>
            <span className="block">
              We&apos;ll disconnect <span className="font-medium text-foreground">{data.connectedApps.join(" and ")}</span> straight away and stop reading new data from it.
            </span>
            <span className="mt-2 block">Data that already synced stays in your history. You can still log activity manually, and reconnect any time from Connected apps.</span>
          </>
        }
      />
      <ConsentHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  )
}

function WhoSeesWhat({ data }: { data: ConsentCentre }) {
  const n = data.minGroupSize
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex items-start gap-3 border-b bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-base font-semibold">Your health data stays yours</h2>
          <p className="text-sm text-muted-foreground">
            {data.companyName} can see your participation — like your account status and the challenges you joined — but never your individual health data. Wellness figures are only shown for
            groups of {n} or more people.
          </p>
        </div>
      </div>
      <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <WhoColumn
          icon={Building2}
          tone="teal"
          title="What your company can see"
          items={[
            "Whether your account is active, and which challenges you joined",
            `Combined wellness figures for groups of ${n} or more people`,
            "Leaderboards, with names shown as your company has set",
            "Your reward orders, so they can be approved and delivered",
          ]}
          positive
        />
        <WhoColumn
          icon={Lock}
          tone="violet"
          title="What only you can see"
          items={[
            "Your steps, activity and workouts",
            "Water, sleep, habits and meals",
            "Height, weight, goals and Wellness Score",
            "Your points history, connected-app data and AI coach chats",
          ]}
        />
      </div>
    </section>
  )
}

function WhoColumn({ icon, tone, title, items, positive }: { icon: LucideIcon; tone: Tone; title: string; items: string[]; positive?: boolean }) {
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <IconTile icon={icon} tone={tone} size="sm" />
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", positive ? "bg-teal-500/15 text-teal-600 dark:text-teal-400" : "bg-violet-500/15 text-violet-600 dark:text-violet-400")}>
              {positive ? <Check className="size-3" /> : <Lock className="size-2.5" />}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ConsentHistorySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const q = useApiQuery(["employee", "privacy", "history"], () => privacyApi.history(), { enabled: open })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-lg">Consent history</SheetTitle>
          <SheetDescription>Every change to your privacy choices, newest first.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {q.error ? (
            <LoadError title="Couldn't load your consent history." error={q.error} onRetry={() => q.refetch()} />
          ) : !q.data ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : (
            <ol className="relative space-y-1">
              {q.data.map((e, i) => (
                <HistoryItem key={e.id} entry={e} last={i === q.data.length - 1} />
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function HistoryItem({ entry, last }: { entry: ConsentHistoryEntry; last: boolean }) {
  const granted = entry.action === "granted"
  return (
    <li className="relative flex gap-3 pb-4">
      {!last ? <span className="absolute top-8 bottom-0 left-[15px] w-px bg-border" aria-hidden /> : null}
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full",
          granted ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
        )}
      >
        {granted ? <Check className="size-4" /> : <X className="size-4" />}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm">
          <span className="font-medium">{entry.title}</span> <span className="text-muted-foreground">— {granted ? "turned on" : "turned off"}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(entry.at)} · Version {entry.version}
        </p>
        {entry.note ? <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p> : null}
      </div>
    </li>
  )
}
