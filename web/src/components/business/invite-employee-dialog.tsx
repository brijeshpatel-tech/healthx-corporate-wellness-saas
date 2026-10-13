"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { UserPlus } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { employeesApi } from "@/lib/api/business/employees"
import { organizationApi } from "@/lib/api/business/organization"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { ApiError } from "@/lib/api/core"

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(50),
  lastName: z.string().trim().min(1, "Enter a last name").max(50),
  email: z.string().trim().email("Enter a valid work email"),
  employeeCode: z.string().trim().max(20).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  departmentId: z.string().min(1, "Choose a department"),
  teamId: z.string().min(1, "Choose a team"),
  appRole: z.enum(["employee", "team_manager"]),
  sendEmail: z.boolean(),
})
type Values = z.infer<typeof schema>

const defaults: Values = { firstName: "", lastName: "", email: "", employeeCode: "", jobTitle: "", departmentId: "", teamId: "", appRole: "employee", sendEmail: true }

/** SCR-B-008 Invite Employee. */
export function InviteEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults })
  const departmentId = useWatch({ control: form.control, name: "departmentId" })
  const teams = (lookups.data?.teams ?? []).filter((t) => t.departmentId === departmentId)

  useEffect(() => {
    if (!open) form.reset(defaults)
  }, [open, form])

  const invite = useApiMutation(employeesApi.invite, {
    success: (e) => `Invitation sent to ${e.firstName} ${e.lastName}`,
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) {
        Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite an employee</DialogTitle>
          <DialogDescription>They&apos;ll get an email with a link to join HealthX. The invitation is valid for 14 days.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" onSubmit={form.handleSubmit((v) => invite.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField control={form.control} name="firstName" label="First name" required />
          <TextField control={form.control} name="lastName" label="Last name" required />
          <TextField control={form.control} name="email" label="Work email" type="email" placeholder="name@nimbustech.in" className="sm:col-span-2" required />
          <TextField control={form.control} name="employeeCode" label="Employee ID" placeholder="Optional" />
          <TextField control={form.control} name="jobTitle" label="Job title" placeholder="Optional" />
          <SelectField
            control={form.control}
            name="departmentId"
            label="Department"
            required
            options={(lookups.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <SelectField
            control={form.control}
            name="teamId"
            label="Team"
            required
            disabled={!departmentId}
            placeholder={departmentId ? "Select…" : "Choose a department first"}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
          />
          <ChoiceField
            control={form.control}
            name="appRole"
            label="Role in the app"
            className="sm:col-span-2"
            options={[
              { value: "employee", label: "Employee", description: "Tracks wellness, joins challenges, earns rewards." },
              { value: "team_manager", label: "Team Manager", description: "Also sees their team's combined progress." },
            ]}
          />
          <SwitchField control={form.control} name="sendEmail" label="Send invitation email now" description="Turn off to invite later, e.g. on their first day." className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? <Spinner /> : <UserPlus data-icon="inline-start" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
