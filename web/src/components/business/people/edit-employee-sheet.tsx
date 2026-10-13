"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SelectField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { employeesApi, type EmployeeRow } from "@/lib/api/business/employees"
import { organizationApi } from "@/lib/api/business/organization"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"

const NO_LOCATION = "none"

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(50),
  lastName: z.string().trim().min(1, "Enter a last name").max(50),
  jobTitle: z.string().trim().min(1, "Enter a job title").max(80),
  employeeCode: z.string().trim().min(1, "Enter an employee ID").max(20),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a valid mobile number"),
  departmentId: z.string().min(1, "Choose a department"),
  teamId: z.string().min(1, "Choose a team"),
  locationId: z.string(),
  appRole: z.enum(["employee", "team_manager"]),
})
type Values = z.infer<typeof schema>

const toValues = (e: EmployeeRow): Values => ({
  firstName: e.firstName,
  lastName: e.lastName,
  jobTitle: e.jobTitle,
  employeeCode: e.employeeCode,
  phone: e.phone ?? "",
  departmentId: e.departmentId,
  teamId: e.teamId,
  locationId: e.locationId ?? NO_LOCATION,
  appRole: e.appRole,
})

/** SCR-B-007 — edit work details (department, team, role, job title). Never health data. */
export function EditEmployeeSheet({ employee, open, onOpenChange }: { employee: EmployeeRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups())
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(employee) })
  const departmentId = useWatch({ control: form.control, name: "departmentId" })
  const teams = (lookups.data?.teams ?? []).filter((t) => t.departmentId === departmentId)

  useEffect(() => {
    if (open) form.reset(toValues(employee))
  }, [open, employee, form])

  // Team must belong to the chosen department (FRM-30).
  useEffect(() => {
    if (!lookups.data) return
    const teamId = form.getValues("teamId")
    if (teamId && !lookups.data.teams.some((t) => t.id === teamId && t.departmentId === departmentId)) form.setValue("teamId", "")
  }, [departmentId, lookups.data, form])

  const update = useApiMutation(employeesApi.update, {
    success: "Employee updated.",
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>Edit work details</SheetTitle>
          <SheetDescription>Changes are audit-logged. Leaderboards and permissions update straight away.</SheetDescription>
        </SheetHeader>
        <form
          id="edit-employee"
          noValidate
          className="flex-1 space-y-4 overflow-y-auto p-4"
          onSubmit={form.handleSubmit((v) =>
            update.mutate({
              id: employee.id,
              ...v,
              locationId: v.locationId === NO_LOCATION ? "" : v.locationId,
            }),
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="firstName" label="First name" required />
            <TextField control={form.control} name="lastName" label="Last name" required />
            <TextField control={form.control} name="jobTitle" label="Job title" required className="sm:col-span-2" />
            <TextField control={form.control} name="employeeCode" label="Employee ID" required />
            <TextField control={form.control} name="phone" label="Mobile number" placeholder="+91 98765 43210" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
              disabled={!departmentId || teams.length === 0}
              placeholder={teams.length ? "Select…" : "No teams in this department"}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
            <SelectField
              control={form.control}
              name="locationId"
              label="Location"
              className="sm:col-span-2"
              options={[{ value: NO_LOCATION, label: "Not set" }, ...(lookups.data?.locations ?? []).map((l) => ({ value: l.id, label: `${l.name} · ${l.city}` }))]}
            />
          </div>
          <ChoiceField
            control={form.control}
            name="appRole"
            label="Role in the app"
            options={[
              { value: "employee", label: "Employee", description: "Tracks wellness, joins challenges, earns rewards." },
              { value: "team_manager", label: "Team Manager", description: "Also sees their team's combined progress." },
            ]}
          />
          {employee.adminRole ? (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Administrator roles are changed by the Company Owner under Administrators.</p>
          ) : null}
        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-employee" disabled={update.isPending}>
            {update.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
