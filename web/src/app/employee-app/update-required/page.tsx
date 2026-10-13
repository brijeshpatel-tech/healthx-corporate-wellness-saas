"use client"

import { ArrowUpCircle, Check, Download } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState, useSyncExternalStore } from "react"
import { ErrorState } from "@/components/common/states"
import { EmployeeAuthLayout } from "@/components/shell/employee-auth-layout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { accountApi } from "@/lib/api/employee/onboarding"
import { useApiQuery } from "@/lib/api/hooks"

type Platform = "ios" | "android" | "web"
const detect = (): Platform => (/iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : /Android/i.test(navigator.userAgent) ? "android" : "web")

/** SCR-M-002 App Update Required. Demo: ?version=1.8.0 (installed), ?optional=1 shows "Later". */
function UpdateRequired() {
  const params = useSearchParams()
  const detected = useSyncExternalStore(
    () => () => {},
    detect,
    () => "web" as const,
  )
  const platform = (params.get("platform") as Platform | null) ?? detected
  const version = params.get("version") ?? "1.8.0"
  const optional = params.get("optional") === "1"
  const [storeError, setStoreError] = useState(false)
  const q = useApiQuery(["employee", "app-config", platform, version], () => accountApi.appConfig({ platform, version }))
  const storeName = platform === "android" ? "Google Play" : "the App Store"

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!q.data)
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto size-28 rounded-3xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    )
  const c = q.data

  const openStore = () => {
    const w = window.open(c.storeUrl, "_blank")
    if (w) w.opener = null
    else setStoreError(true)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <span className="relative flex size-28 items-center justify-center rounded-[32px] bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 text-white shadow-xl shadow-emerald-500/30">
          <ArrowUpCircle className="size-14" />
          <span className="absolute -right-2 -bottom-2 rounded-full border-4 border-background bg-amber-500 px-2 py-0.5 text-xs font-bold">v{c.latestVersion}</span>
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight">{c.updateRequired && !optional ? "Time to update HealthX" : "A new version is available"}</h1>
        <p className="text-muted-foreground">
          {c.updateRequired
            ? `Version ${c.installedVersion} is no longer supported. Update to ${c.latestVersion} to keep tracking and earning points.`
            : `You're on ${c.installedVersion}. Update to ${c.latestVersion} for the latest improvements.`}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">What&apos;s new</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {c.releaseNotes.map((n) => (
            <li key={n} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {n}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Minimum supported version: {c.minimumVersion} · {platform === "android" ? "Android" : platform === "ios" ? "iOS" : "Web preview"}
        </p>
      </div>

      {storeError ? (
        <Alert variant="destructive">
          <AlertDescription>Please update HealthX from the App Store / Google Play.</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-auto grid gap-2">
        <Button className="h-12 text-base" onClick={openStore}>
          <Download data-icon="inline-start" /> Update now
        </Button>
        {optional || !c.updateRequired ? (
          <Button asChild variant="ghost" className="h-11 text-muted-foreground">
            <Link href="/employee-app">Later</Link>
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">You&apos;ll be taken to {storeName}. After updating, HealthX restarts automatically.</p>
        )}
      </div>
    </div>
  )
}

export default function UpdateRequiredPage() {
  return (
    <EmployeeAuthLayout>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <UpdateRequired />
      </Suspense>
    </EmployeeAuthLayout>
  )
}
