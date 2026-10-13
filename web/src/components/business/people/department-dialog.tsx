"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Network } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { FieldShell, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { organizationApi, type DepartmentRow } from "@/lib/api/business/organization"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { EmployeeCombobox } from "./employee-picker"

const NONE = "none"

const schema = z.object({
  name: z.string().trim().min(2, "Enter a department name").max(60, "Keep it under 60 characters"),
  description: z.string().trim().max(200, "Keep it under 200 characters"),
  headEmployeeId: z.string().optional(),
  locationId: z.string(),
})
type Values = z.infer<typeof schema>

/** Add / edit department (SCR-B-010). */
export function DepartmentDialog({ open, onOpenChange, department }: { open: boolean; onOpenChange: (open: boolean) => void; department?: DepartmentRow | null }) {
  const editing = !!department
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: open })
  const people = useApiQuery(["business", "people", department?.id ?? "all"], () => organizationApi.people(department ? { departmentId: department.id } : {}), { enabled: open })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "", headEmployeeId: undefined, locationId: NONE } })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: department?.name ?? "",
      description: department?.description ?? "",
      headEmployeeId: department?.headEmployeeId,
      locationId: department?.locationId ?? NONE,
    })
  }, [open, department, form])

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(organizationApi.createDepartment, { success: "Department created.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(organizationApi.updateDepartment, { success: "Department updated.", onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending

  const submit = form.handleSubmit((v) => {
    const input = { name: v.name, description: v.description, headEmployeeId: v.headEmployeeId || undefined, locationId: v.locationId === NONE ? undefined : v.locationId }
    if (department) update.mutate({ id: department.id, ...input })
    else create.mutate(input)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${department?.name}` : "Add department"}</DialogTitle>
          <DialogDescription>{editing ? "Renaming updates filters, challenges and analytics everywhere." : "Departments group your teams — e.g. Engineering, Sales, Marketing and HR."}</DialogDescription>
        </DialogHeader>
        <form id="department-form" onSubmit={submit} className="grid gap-4" noValidate>
          <TextField control={form.control} name="name" label="Department name" placeholder="e.g. Engineering" required />
          <TextareaField control={form.control} name="description" label="Description" placeholder="Optional — what this department does" rows={3} maxLength={200} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="headEmployeeId"
              render={({ field, fieldState }) => (
                <FieldShell label="Department head" error={fieldState.error?.message} description={editing ? "Someone in this department" : "Optional"}>
                  <EmployeeCombobox
                    people={(people.data ?? []).map((p) => ({ ...p, hint: `${p.jobTitle} · ${p.departmentName}` }))}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={people.isLoading ? "Loading…" : "Choose a person…"}
                    invalid={!!fieldState.error}
                  />
                </FieldShell>
              )}
            />
            <SelectField
              control={form.control}
              name="locationId"
              label="Main location"
              options={[{ value: NONE, label: "Not set" }, ...(lookups.data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))]}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="department-form" disabled={pending}>
            {pending ? <Spinner /> : <Network data-icon="inline-start" />}
            {editing ? "Save changes" : "Create department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
