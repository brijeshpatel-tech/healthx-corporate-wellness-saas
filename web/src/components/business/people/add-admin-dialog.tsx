"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldPlus } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, FieldShell, SelectField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminsApi, type AdminRow } from "@/lib/api/business/admins"
import { organizationApi } from "@/lib/api/business/organization"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { EmployeeCombobox } from "./employee-picker"

export const ADMIN_ROLE_OPTIONS = [
  { value: "hr_admin", label: "HR Admin", description: "People, departments, teams, challenges, announcements and company analytics." },
  { value: "wellness_manager", label: "Wellness Manager", description: "Challenges, programmes and content, with aggregated participation analytics." },
]

const schema = z
  .object({
    mode: z.enum(["existing", "invite"]),
    role: z.enum(["hr_admin", "wellness_manager"]),
    employeeId: z.string().optional(),
    firstName: z.string().trim(),
    lastName: z.string().trim(),
    email: z.string().trim(),
    departmentId: z.string(),
    teamId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "existing") {
      if (!v.employeeId) ctx.addIssue({ code: "custom", path: ["employeeId"], message: "Choose an employee" })
      return
    }
    if (!v.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Enter a first name" })
    if (!v.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: "Enter a last name" })
    if (!/^\S+@\S+\.\S+$/.test(v.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid work email" })
    if (!v.departmentId) ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Choose a department" })
    if (!v.teamId) ctx.addIssue({ code: "custom", path: ["teamId"], message: "Choose a team" })
  })
type Values = z.infer<typeof schema>

const defaults: Values = { mode: "existing", role: "hr_admin", employeeId: undefined, firstName: "", lastName: "", email: "", departmentId: "", teamId: "" }

/** SCR-B-012 — add administrator: promote an employee or invite someone new. */
export function AddAdminDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded?: (admin: AdminRow) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const mode = useWatch({ control: form.control, name: "mode" })
  const departmentId = useWatch({ control: form.control, name: "departmentId" })
  const people = useApiQuery(["business", "people", "all"], () => organizationApi.people({}), { enabled: open })
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: open && mode === "invite" })

  useEffect(() => {
    if (!open) form.reset(defaults)
  }, [open, form])

  const add = useApiMutation(adminsApi.add, {
    success: (a) => (a.status === "invited" ? `Invitation sent to ${a.email}.` : `${a.name} is now ${a.role === "hr_admin" ? "an HR Admin" : "a Wellness Manager"}.`),
    onSuccess: (a) => {
      onOpenChange(false)
      onAdded?.(a)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const candidates = (people.data ?? [])
    .filter((p) => p.status !== "deactivated")
    .map((p) => ({ ...p, hint: `${p.jobTitle} · ${p.departmentName}` }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add administrator</DialogTitle>
          <DialogDescription>Administrators sign in to the Business Portal with two-step verification. Changes take effect at their next request.</DialogDescription>
        </DialogHeader>
        <Tabs
          value={mode}
          onValueChange={(v) => {
            form.setValue("mode", v as Values["mode"])
            form.clearErrors()
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="existing">Existing employee</TabsTrigger>
            <TabsTrigger value="invite">Invite someone new</TabsTrigger>
          </TabsList>
        </Tabs>
        <form
          id="add-admin"
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={form.handleSubmit((v) =>
            add.mutate(
              v.mode === "existing"
                ? { role: v.role, employeeId: v.employeeId }
                : { role: v.role, firstName: v.firstName, lastName: v.lastName, email: v.email, departmentId: v.departmentId, teamId: v.teamId },
            ),
          )}
        >
          {mode === "existing" ? (
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field, fieldState }) => (
                <FieldShell label="Employee" required error={fieldState.error?.message} className="sm:col-span-2" description="Only people who already have a HealthX account or invitation.">
                  <EmployeeCombobox
                    people={candidates.map((p) => ({ ...p, disabled: false }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={people.isLoading ? "Loading people…" : "Search employees…"}
                    invalid={!!fieldState.error}
                  />
                </FieldShell>
              )}
            />
          ) : (
            <>
              <TextField control={form.control} name="firstName" label="First name" required />
              <TextField control={form.control} name="lastName" label="Last name" required />
              <TextField control={form.control} name="email" label="Work email" type="email" required className="sm:col-span-2" />
              <SelectField control={form.control} name="departmentId" label="Department" required options={(lookups.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
              <SelectField
                control={form.control}
                name="teamId"
                label="Team"
                required
                disabled={!departmentId}
                placeholder={departmentId ? "Select…" : "Choose a department first"}
                options={(lookups.data?.teams ?? []).filter((t) => t.departmentId === departmentId).map((t) => ({ value: t.id, label: t.name }))}
              />
            </>
          )}
          <ChoiceField control={form.control} name="role" label="Role" className="sm:col-span-2" options={ADMIN_ROLE_OPTIONS} />
          {mode === "invite" ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">They&apos;ll get an email to set up their account (valid for 7 days) and will also be added as an employee.</p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="add-admin" disabled={add.isPending}>
            {add.isPending ? <Spinner /> : <ShieldPlus data-icon="inline-start" />}
            {mode === "invite" ? "Send invitation" : "Add administrator"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
