"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/lib/auth/session"

/** /business-portal/settings → first settings page this role can open. */
export default function SettingsIndex() {
  const router = useRouter()
  const session = useSession("business")
  useEffect(() => {
    if (!session) return
    const target =
      session.role === "company_owner" ? "/business-portal/settings/organisation" : session.role === "hr_admin" ? "/business-portal/settings/notifications" : "/business-portal/account"
    router.replace(target)
  }, [session, router])
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="size-6 text-primary" />
    </div>
  )
}
