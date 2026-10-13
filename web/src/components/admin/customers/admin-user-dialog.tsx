"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save, UserPlus } from "lucide-react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { ChoiceField, SwitchField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { ADMIN_EMAIL_DOMAIN, adminsApi, type AdminUserRow } from "@/lib/api/platform/admins"
import type { PlatformRole } from "@/lib/types"
import { ROLE_INFO, RoleBadge } from "./admin-roles"

const schema = z.object({
  name: z.string().trim().min(2, "Enter the admin's full name").max(80, "Keep the name under 80 characters"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine((v) => v.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`), `Use a HealthX email address (@${ADMIN_EMAIL_DOMAIN}).`),
  role: z.enum(["super_admin", "support_admin", "content_admin"], { error: "Choose a role" }),
  mfaRequired: z.boolean(),
})
type Values = z.infer<typeof schema>

const empty: Values = { name: "", email: "", role: "support_admin", mfaRequired: true }

/** SCR-P-007 add / edit modal. `admin` = edit mode. */
export function AdminUserDialog({
  open,
  onOpenChange,
  admin,
  lastSuperAdmin,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  admin?: AdminUserRow | null
  /** The admin being edited is the only active Super Admin (role can't change). */
  lastSuperAdmin?: boolean
}) {
  const editing = !!admin
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })

  useEffect(() => {
    if (open) form.reset(admin ? { name: admin.name, email: admin.email, role: admin.role, mfaRequired: admin.mfaRequired } : empty)
  }, [open, admin, form])

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const invite = useApiMutation(adminsApi.invite, { success: "Admin invited.", onSuccess: () => onOpenChange(false), onError })
  const update = useApiMutation(adminsApi.update, { success: (a) => `${a.name}'s access was updated`, onSuccess: () => onOpenChange(false), onError })
  const pending = invite.isPending || update.isPending
  const roleLocked = editing && (admin.isYou || lastSuperAdmin)

  const submit = form.handleSubmit((v) => {
    if (admin) update.mutate({ id: admin.id, name: v.name, role: roleLocked ? undefined : v.role, mfaRequired: v.mfaRequired })
    else invite.mutate({ name: v.name, email: v.email, role: v.role, mfaRequired: v.mfaRequired })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${admin.name}` : "Add a HealthX admin"}</DialogTitle>
          <DialogDescription>
            {editing ? "Change what this person can do in the Platform Admin portal. Changes are audit-logged." : "They'll get an email invitation to set a password and two-step verification."}
          </DialogDescription>
        </DialogHeader>
        <form id="admin-user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <TextField control={form.control} name="name" label="Full name" required autoComplete="off" />
          <TextField
            control={form.control}
            name="email"
            label="Work email"
            type="email"
            placeholder={`name@${ADMIN_EMAIL_DOMAIN}`}
            required
            disabled={editing}
            description={editing ? "Email can't be changed." : `Only @${ADMIN_EMAIL_DOMAIN} addresses.`}
          />
          {roleLocked ? (
            <div className="space-y-2 rounded-xl border border-dashed bg-muted/40 p-3 sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Role <RoleBadge role={admin.role} />
              </div>
              <p className="text-xs text-muted-foreground">
                {admin.isYou ? "You can't change your own role. Ask another Super Admin." : "At least one active Super Admin must remain, so this role can't be changed."}
              </p>
            </div>
          ) : (
            <ChoiceField
              control={form.control}
              name="role"
              label="Role"
              columns={1}
              className="sm:col-span-2"
              options={(Object.keys(ROLE_INFO) as PlatformRole[]).map((r) => ({
                value: r,
                label: ROLE_INFO[r].label,
                description: ROLE_INFO[r].summary,
              }))}
            />
          )}
          <SwitchField
            control={form.control}
            name="mfaRequired"
            label="Require two-step verification (MFA)"
            description="Recommended. They must set up an authenticator app before they can use the portal."
            className="sm:col-span-2"
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="admin-user-form" disabled={pending}>
            {pending ? <Spinner /> : editing ? <Save data-icon="inline-start" /> : <UserPlus data-icon="inline-start" />}
            {editing ? "Save changes" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
