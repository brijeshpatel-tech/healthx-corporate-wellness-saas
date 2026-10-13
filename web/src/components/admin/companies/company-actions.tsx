"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Headset, ShieldOff } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TextareaField } from "@/components/common/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { companiesApi, type SupportSession } from "@/lib/api/platform/companies"
import { useApiMutation } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

export const SEGMENT_LABEL: Record<string, string> = { smb: "SMB", mid_market: "Mid-market", enterprise: "Enterprise" }

/** Square logo tile with the company's initials and brand colour. */
export function CompanyLogo({ name, initials, color, size = "sm", className }: { name: string; initials?: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const text =
    initials ||
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("")
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-white shadow-sm",
        size === "sm" && "size-9 rounded-lg text-xs",
        size === "md" && "size-12 rounded-xl text-sm",
        size === "lg" && "size-16 rounded-2xl text-xl",
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {text}
    </span>
  )
}

const reasonSchema = z.object({ reason: z.string().trim().min(5, "Explain why (at least 5 characters)").max(300, "Keep it under 300 characters") })
type ReasonValues = z.infer<typeof reasonSchema>

/** Suspend a company — reason required (FRM-71). Suspension blocks sign-in but keeps all data. */
export function SuspendCompanyDialog({ company, open, onOpenChange }: { company: { id: string; name: string } | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } })
  useEffect(() => {
    if (!open) form.reset({ reason: "" })
  }, [open, form])
  const suspend = useApiMutation(companiesApi.suspend, {
    success: "Company suspended – users can no longer sign in.",
    errorTitle: "Couldn't update company status.",
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors?.reason) form.setError("reason", { message: err.fieldErrors.reason })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suspend {company?.name}?</DialogTitle>
          <DialogDescription>Everyone at this company is signed out and can&apos;t sign in to the app or the Business Portal. Their data, points and history are kept, and you can reactivate the company at any time.</DialogDescription>
        </DialogHeader>
        <form id="suspend-form" noValidate onSubmit={form.handleSubmit((v) => company && suspend.mutate({ id: company.id, reason: v.reason }))} className="space-y-4">
          <TextareaField control={form.control} name="reason" label="Reason" required rows={3} maxLength={300} placeholder="e.g. Invoice INV-202609-0142 unpaid for 45 days" description="Saved in the audit log and shown to other HealthX admins." />
          <Alert className="border-amber-500/30 bg-amber-500/6">
            <AlertDescription className="text-xs">This action is audit-logged with your name and the reason.</AlertDescription>
          </Alert>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="suspend-form" variant="destructive" disabled={suspend.isPending}>
            {suspend.isPending ? <Spinner /> : <ShieldOff data-icon="inline-start" />}
            Suspend company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Start a time-boxed, audit-logged support session for a company. */
export function SupportAccessDialog({
  company,
  open,
  onOpenChange,
  onStarted,
}: {
  company: { id: string; name: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStarted?: (session: SupportSession) => void
}) {
  const form = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: "" } })
  useEffect(() => {
    if (!open) form.reset({ reason: "" })
  }, [open, form])
  const start = useApiMutation(companiesApi.openAsSupport, {
    success: "Support access started for 30 minutes — logged in the audit trail.",
    onSuccess: (s) => {
      onOpenChange(false)
      onStarted?.(s)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors?.reason) form.setError("reason", { message: err.fieldErrors.reason })
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open {company?.name} as support</DialogTitle>
          <DialogDescription>You get read-only access to this company&apos;s workspace settings and aggregated figures for 30 minutes. Individual health data is never visible.</DialogDescription>
        </DialogHeader>
        <form id="support-form" noValidate onSubmit={form.handleSubmit((v) => company && start.mutate({ id: company.id, reason: v.reason }))}>
          <TextareaField control={form.control} name="reason" label="Reason for access" required rows={3} maxLength={300} placeholder="e.g. Ticket SUP-3104 — owner can't see the October challenge" description="Recorded in the platform audit log and visible to the company's owner on request." />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="support-form" disabled={start.isPending}>
            {start.isPending ? <Spinner /> : <Headset data-icon="inline-start" />}
            Start support session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
