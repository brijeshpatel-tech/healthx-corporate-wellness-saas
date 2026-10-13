"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { UsersRound } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { organizationApi, type TeamRow } from "@/lib/api/business/organization"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"

const schema = z.object({
  name: z.string().trim().min(2, "Enter a team name").max(60, "Keep it under 60 characters"),
  departmentId: z.string().min(1, "Choose a department"),
  description: z.string().trim().max(200, "Keep it under 200 characters"),
})
type Values = z.infer<typeof schema>

/** Add / edit team (SCR-B-011). Members and Team Managers are managed in the team panel. */
export function TeamDialog({
  open,
  onOpenChange,
  team,
  defaultDepartmentId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: TeamRow | null
  defaultDepartmentId?: string
  onCreated?: (team: TeamRow) => void
}) {
  const editing = !!team
  const lookups = useApiQuery(["business", "lookups"], () => organizationApi.lookups(), { enabled: open })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", departmentId: "", description: "" } })

  useEffect(() => {
    if (!open) return
    form.reset({ name: team?.name ?? "", departmentId: team?.departmentId ?? defaultDepartmentId ?? "", description: team?.description ?? "" })
  }, [open, team, defaultDepartmentId, form])

  const onError = (err: ApiError) => {
    if (err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const create = useApiMutation(organizationApi.createTeam, {
    success: (t) => `${t.name} created — now add members.`,
    onSuccess: (t) => {
      onOpenChange(false)
      onCreated?.(t)
    },
    onError,
  })
  const update = useApiMutation(organizationApi.updateTeam, { success: "Team updated.", onSuccess: () => onOpenChange(false), onError })
  const pending = create.isPending || update.isPending
  const departmentId = useWatch({ control: form.control, name: "departmentId" })
  const movingDepartment = editing && departmentId !== team?.departmentId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${team?.name}` : "Add team"}</DialogTitle>
          <DialogDescription>Team names must be unique within a department.</DialogDescription>
        </DialogHeader>
        <form
          id="team-form"
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => (team ? update.mutate({ id: team.id, ...v }) : create.mutate(v)))}
        >
          <TextField control={form.control} name="name" label="Team name" placeholder="e.g. Mobile" required />
          <SelectField
            control={form.control}
            name="departmentId"
            label="Department"
            required
            options={(lookups.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            description={movingDepartment ? `All ${team?.memberCount ?? 0} members move to the new department too.` : undefined}
          />
          <TextareaField control={form.control} name="description" label="Description" placeholder="Optional" rows={3} maxLength={200} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="team-form" disabled={pending}>
            {pending ? <Spinner /> : <UsersRound data-icon="inline-start" />}
            {editing ? "Save changes" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
