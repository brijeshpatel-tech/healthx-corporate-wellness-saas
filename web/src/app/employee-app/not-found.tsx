import { Compass, Home, LifeBuoy } from "lucide-react"
import Link from "next/link"
import { StandaloneScreen } from "@/components/employee/engage/account/standalone-screen"
import { Button } from "@/components/ui/button"

/** Employee app 404 — shown when a page in /employee-app calls notFound(). */
export default function EmployeeNotFound() {
  return (
    <StandaloneScreen
      icon={Compass}
      tone="sky"
      eyebrow="Error 404"
      title="We couldn't find that page"
      message="It may have moved, or the link may be out of date. Let's get you back on track."
    >
      <Button asChild className="h-12 w-full rounded-xl text-base">
        <Link href="/employee-app/home">
          <Home data-icon="inline-start" /> Go to Home
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
        <Link href="/employee-app/help">
          <LifeBuoy data-icon="inline-start" /> Help & support
        </Link>
      </Button>
    </StandaloneScreen>
  )
}
