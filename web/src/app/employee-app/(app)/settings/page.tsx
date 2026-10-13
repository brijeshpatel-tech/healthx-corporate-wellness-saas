"use client"

import { Bell, ChevronRight, Download, FileText, HeartPulse, Info, Languages, LifeBuoy, LogOut, Palette, Ruler, ShieldCheck, Smartphone, Trash2, TriangleAlert, UserRound, Watch } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { ConfirmDialog } from "@/components/common/misc"
import { PhaseBadge } from "@/components/common/status-badge"
import { UserAvatar } from "@/components/common/user-avatar"
import { APP_BUILD, APP_VERSION, useDeviceInfo } from "@/components/employee/engage/account/device"
import { THEME_LABEL } from "@/components/employee/engage/account/labels"
import { LegalDialog, type LegalDoc } from "@/components/employee/engage/account/legal-dialog"
import { useEmployeeSignOut } from "@/components/employee/engage/account/use-sign-out"
import { EngagePage, LoadError, MenuGroup, MenuRow } from "@/components/employee/engage/page"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { profileApi, type MyProfile } from "@/lib/api/employee/profile"
import { privacyApi } from "@/lib/api/employee/privacy"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { formatDate } from "@/lib/format"

/** SCR-M-074 Settings. */
export default function SettingsPage() {
  const q = useApiQuery(["employee", "profile"], () => profileApi.get())
  return (
    <EngagePage size="narrow" title="Settings">
      {q.error ? (
        <LoadError title="Couldn't load your settings." error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <SettingsSkeleton />
      ) : (
        <Settings data={q.data} />
      )}
    </EngagePage>
  )
}

function Settings({ data }: { data: MyProfile }) {
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const { signOut, pending: signingOut } = useEmployeeSignOut()
  const device = useDeviceInfo()

  return (
    <>
      {data.deletionRequestedAt ? <DeletionBanner requestedAt={data.deletionRequestedAt} /> : null}

      <Link href="/employee-app/profile/edit" className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40">
        <UserAvatar name={data.fullName} color={data.avatarColor} src={data.photoUrl} size="lg" className="[&_[data-slot=avatar-fallback]]:text-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-base font-semibold">{data.fullName}</span>
          <span className="block truncate text-sm text-muted-foreground">{data.email}</span>
          <span className="block truncate text-xs text-muted-foreground">{data.companyName}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

      <MenuGroup title="Account">
        <MenuRow icon={UserRound} tone="sky" title="Basic details" description="Name, photo, email and phone" href="/employee-app/profile/edit" />
        <MenuRow icon={HeartPulse} tone="rose" title="Wellness details" description="Height, weight, goals and step goal" href="/employee-app/profile/wellness" />
      </MenuGroup>

      <MenuGroup title="Notifications">
        <MenuRow
          icon={Bell}
          tone="amber"
          title="Notification preferences"
          description={data.notificationsOn ? `Quiet hours ${data.quietHours.start}–${data.quietHours.end}` : "Push and email are off"}
          value={data.notificationsOn ? "On" : "Off"}
          href="/employee-app/settings/notifications"
        />
      </MenuGroup>

      <MenuGroup title="Privacy & data">
        <MenuRow icon={ShieldCheck} tone="teal" title="Privacy & consent" description="What your company can see and your choices" href="/employee-app/settings/privacy" />
        <MenuRow
          icon={Watch}
          tone="cyan"
          title="Connected apps & devices"
          value={data.connectedApps.length ? data.connectedApps.join(", ") : "Not connected"}
          href="/employee-app/settings/connected-apps"
        />
        <MenuRow icon={Download} tone="indigo" title="Download my data" badge={<PhaseBadge phase={2} />} href="/employee-app/settings/download-data" />
      </MenuGroup>

      <MenuGroup title="Language & preferences">
        <MenuRow icon={Languages} tone="violet" title="Language & preferences" description="Activities, workouts and food" value={data.preferences.language || "English"} href="/employee-app/settings/preferences" />
        <MenuRow
          icon={Ruler}
          tone="orange"
          title="Units"
          badge={<PhaseBadge phase={2} />}
          value={data.preferences.units === "imperial" ? "Imperial" : "Metric"}
          href="/employee-app/settings/preferences#units"
        />
        <MenuRow icon={Palette} tone="pink" title="Appearance" value={THEME_LABEL[data.preferences.theme] ?? "System"} href="/employee-app/settings/preferences#appearance" />
      </MenuGroup>

      <MenuGroup title="Support & legal">
        <MenuRow icon={LifeBuoy} tone="emerald" title="Help & support" description="FAQs and contact support" href="/employee-app/help" />
        <MenuRow icon={FileText} tone="slate" title="Terms of Use" onClick={() => setLegal("terms")} />
        <MenuRow icon={ShieldCheck} tone="slate" title="Privacy Policy" onClick={() => setLegal("privacy")} />
        <MenuRow icon={Info} tone="slate" title="App version" value={`${APP_VERSION}`} description={APP_BUILD} />
        <MenuRow icon={Smartphone} tone="slate" title="This device" description={device ?? "Checking…"} />
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon={LogOut} tone="slate" title="Sign out" onClick={() => setConfirmSignOut(true)} trailing={signingOut ? <Spinner className="size-4" /> : undefined} />
        <MenuRow icon={Trash2} destructive title="Delete account" description="Deactivate your account and delete your data" href="/employee-app/settings/delete-account" />
      </MenuGroup>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        HealthX for {data.companyName} · v{APP_VERSION}
      </p>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of HealthX?"
        description="You'll need to sign in again to see your progress. Data saved on this device will be cleared."
        confirmLabel="Sign out"
        onConfirm={() => void signOut()}
      />
      <LegalDialog doc={legal} onOpenChange={(o) => !o && setLegal(null)} />
    </>
  )
}

function DeletionBanner({ requestedAt }: { requestedAt: string }) {
  const [confirm, setConfirm] = useState(false)
  const cancel = useApiMutation(privacyApi.cancelDeletion, { success: "Deletion request cancelled. Your account stays active.", errorTitle: "Couldn't cancel the request" })
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/6 p-4 sm:flex-row sm:items-center" role="status">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <p className="text-sm">
          <span className="font-semibold">Deletion requested on {formatDate(requestedAt)}.</span>{" "}
          <span className="text-muted-foreground">Your personal data will be deleted within 30 days unless you cancel.</span>
        </p>
      </div>
      <Button variant="outline" className="h-10 shrink-0 rounded-xl" onClick={() => setConfirm(true)} disabled={cancel.isPending}>
        {cancel.isPending ? <Spinner /> : null}
        Cancel request
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Keep your account?"
        description="We'll cancel your deletion request and your account and data will stay as they are."
        confirmLabel="Keep my account"
        cancelLabel="Go back"
        onConfirm={() => cancel.mutate()}
      />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 rounded-2xl" />
      {[2, 1, 3, 3, 5].map((rows, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="rounded-2xl" style={{ height: rows * 60 }} />
        </div>
      ))}
    </div>
  )
}
