"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Crown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ChoiceField, FieldShell, TextField } from "@/components/common/form-fields"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { adminsApi } from "@/lib/api/business/admins"
import { organizationApi } from "@/lib/api/business/organization"
import { ApiError } from "@/lib/api/core"
import { errorMessage, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore, useSession } from "@/lib/auth/session"
import { BUSINESS_ROLE_LABEL } from "@/lib/types"
import { ADMIN_ROLE_OPTIONS } from "./add-admin-dialog"
import { EmployeeCombobox } from "./employee-picker"

const transferSchema = (companyName: string) =>
  z.object({
    toId: z.string().min(1, "Choose the new Company Owner"),
    myNewRole: z.enum(["hr_admin", "wellness_manager"]),
    confirmation: z.string().refine((v) => v.trim() === companyName, `Type "${companyName}" exactly to confirm`),
  })
type Values = z.infer<ReturnType<typeof transferSchema>>

/** Strong confirmation: pick the new owner, your new role, and type the company name. */
export function TransferOwnershipDialog({ open, onOpenChange, companyName }: { open: boolean; onOpenChange: (open: boolean) => void; companyName: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const session = useSession("business")
  const updateSession = useAuthStore((s) => s.updateSession)
  const people = useApiQuery(["business", "people", "all"], () => organizationApi.people({}), { enabled: open })

  const schema = useMemo(() => transferSchema(companyName), [companyName])
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { toId: "", myNewRole: "hr_admin", confirmation: "" } })

  useEffect(() => {
    if (!open) form.reset({ toId: "", myNewRole: "hr_admin", confirmation: "" })
  }, [open, form])

  const transfer = useMutation({
    mutationFn: adminsApi.transferOwnership,
    onSuccess: (r) => {
      updateSession("business", { role: r.myNewRole })
      queryClient.clear()
      toast.success(`${r.newOwner} is now the Company Owner.`, { description: `Your role is now ${BUSINESS_ROLE_LABEL[r.myNewRole]}.` })
      onOpenChange(false)
      router.replace("/business-portal/dashboard")
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
      toast.error("Couldn't transfer ownership", { description: errorMessage(err) })
    },
  })

  const candidates = (people.data ?? [])
    .filter((p) => p.id !== session?.user.id && (p.status === "active" || p.status === "registered"))
    .map((p) => ({ ...p, hint: `${p.jobTitle} · ${p.departmentName}` }))

  return (
    <Dialog open={open} onOpenChange={(o) => !transfer.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer company ownership</DialogTitle>
          <DialogDescription>The Company Owner controls billing, branding, settings and administrators.</DialogDescription>
        </DialogHeader>
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>This takes effect immediately</AlertTitle>
          <AlertDescription>You&apos;ll lose owner rights straight away and only the new owner can transfer them back.</AlertDescription>
        </Alert>
        <form id="transfer-ownership" noValidate className="grid gap-4" onSubmit={form.handleSubmit((v) => transfer.mutate(v))}>
          <Controller
            control={form.control}
            name="toId"
            render={({ field, fieldState }) => (
              <FieldShell label="New Company Owner" required error={fieldState.error?.message} description="Must have an active HealthX account.">
                <EmployeeCombobox people={candidates} value={field.value || undefined} onChange={(v) => field.onChange(v ?? "")} placeholder={people.isLoading ? "Loading…" : "Search people…"} invalid={!!fieldState.error} />
              </FieldShell>
            )}
          />
          <ChoiceField control={form.control} name="myNewRole" label="Your new role" options={ADMIN_ROLE_OPTIONS} />
          <TextField
            control={form.control}
            name="confirmation"
            label={
              <>
                Type <span className="font-mono font-semibold">{companyName}</span> to confirm
              </>
            }
            autoComplete="off"
            required
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={transfer.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="transfer-ownership" variant="destructive" className="bg-destructive text-white hover:bg-destructive/90" disabled={transfer.isPending}>
            {transfer.isPending ? <Spinner /> : <Crown data-icon="inline-start" />}
            Transfer ownership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
