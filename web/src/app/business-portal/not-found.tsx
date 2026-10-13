import { ArrowLeft, Compass, LifeBuoy } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"

/** SCR-B-047 — Page not found (Business Portal). */
export default function BusinessNotFound() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between p-5 sm:p-6">
        <Link href="/business-portal/dashboard" aria-label="HealthX Business Portal">
          <Logo label="Business Portal" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex size-24 items-center justify-center rounded-3xl border bg-card shadow-sm">
              <Compass className="size-11 text-primary" strokeWidth={1.6} />
            </div>
          </div>
          <p className="font-heading text-sm font-semibold tracking-wide text-primary uppercase">Error 404</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Page not found.</h1>
          <p className="mt-3 text-sm text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved. Check the address, or head back to your dashboard.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button asChild className="h-10">
              <Link href="/business-portal/dashboard">
                <ArrowLeft data-icon="inline-start" /> Back to dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <a href="mailto:support@healthx.life">
                <LifeBuoy data-icon="inline-start" /> Contact support
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
