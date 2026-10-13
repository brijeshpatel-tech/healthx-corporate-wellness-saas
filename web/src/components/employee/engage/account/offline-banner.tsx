"use client"

import { Wifi, WifiOff } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useOnline } from "./use-online"

/**
 * SCR-M-081 banner variant: shown on cached screens while the device is offline,
 * then briefly confirms when the connection comes back.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline()
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onOnline = () => {
      setJustReconnected(true)
      clearTimeout(timer)
      timer = setTimeout(() => setJustReconnected(false), 3000)
    }
    const onOffline = () => {
      clearTimeout(timer)
      setJustReconnected(false)
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  if (online && !justReconnected) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium sm:text-sm",
        online ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200" : "bg-amber-500/15 text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      {online ? <Wifi className="size-4 shrink-0" /> : <WifiOff className="size-4 shrink-0" />}
      {online ? "You're back online." : "You're offline. Some information may be out of date."}
    </div>
  )
}
