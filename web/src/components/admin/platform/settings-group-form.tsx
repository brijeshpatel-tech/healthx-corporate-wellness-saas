"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Save, TriangleAlert, Undo2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useController, useForm, type Control } from "react-hook-form"
import { z } from "zod"
import { SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { FormSection } from "@/components/admin/form-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { SETTING_LIMITS, settingField, settingsApi, type SettingsGroupView, type SettingValue } from "@/lib/api/platform/settings"
import { formatNumber, formatRelative } from "@/lib/format"
import type { SystemSetting } from "@/lib/types"
import { cn } from "@/lib/utils"

type Values = Record<string, SettingValue>

const VERSION_RE = /^\d+\.\d+\.\d+$/

function buildSchema(settings: SystemSetting[]) {
  const shape: Record<string, z.ZodType<SettingValue>> = {}
  for (const s of settings) {
    const name = settingField(s.key)
    if (s.type === "boolean") shape[name] = z.boolean()
    else if (s.type === "number") {
      const lim = SETTING_LIMITS[s.key]
      const n = z.number({ error: "Enter a number" }).int("Use a whole number")
      shape[name] = lim ? n.min(lim.min, `Must be at least ${formatNumber(lim.min)}`).max(lim.max, `Must be ${formatNumber(lim.max)} or less`) : n.min(0, "Must be 0 or more")
    } else if (s.type === "select") shape[name] = z.string().refine((v) => !!s.options?.includes(v), "Choose an option")
    else if (s.key.startsWith("app.min_version")) shape[name] = z.string().trim().regex(VERSION_RE, "Use a version like 1.4.0")
    else if (s.key.endsWith("sender_email")) shape[name] = z.string().trim().email("Enter a valid email address")
    else shape[name] = z.string().trim().min(1, "This field is required").max(200, "Keep it under 200 characters")
  }
  return z.object(shape) as unknown as z.ZodType<Values, Values>
}

const toValues = (settings: SystemSetting[]): Values => Object.fromEntries(settings.map((s) => [settingField(s.key), s.value]))

/** One settings group (SCR-P-023): its own form with Save / Discard. */
export function SettingsGroupForm({ group, canEdit }: { group: SettingsGroupView; canEdit: boolean }) {
  const schema = useMemo(() => buildSchema(group.settings), [group.settings])
  const values = useMemo(() => toValues(group.settings), [group.settings])
  const form = useForm<Values>({ resolver: zodResolver(schema), values, resetOptions: { keepDirtyValues: true } })
  const { isDirty } = form.formState

  const save = useApiMutation(settingsApi.update, {
    success: (r) => (r.changed ? "Configuration saved." : "No changes to save."),
    errorTitle: "Couldn't save configuration.",
    onSuccess: () => form.reset(form.getValues()),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k, { message }))
    },
  })

  const submit = form.handleSubmit((v) => {
    const dirty = form.formState.dirtyFields
    const changed: Values = {}
    for (const s of group.settings) {
      const name = settingField(s.key)
      if (dirty[name]) changed[s.key] = v[name]!
    }
    save.mutate({ group: group.id, values: changed })
  })

  return (
    <FormSection
      title={group.title}
      description={group.description}
      className="scroll-mt-24"
      aside={
        <p className="text-xs text-muted-foreground">
          {group.updatedAt ? (
            <>
              Last updated {formatRelative(group.updatedAt)}
              {group.updatedBy ? ` by ${group.updatedBy}` : ""}
            </>
          ) : (
            "Never changed"
          )}
        </p>
      }
    >
      <form id={`settings-${group.id}`} onSubmit={submit} noValidate className="contents">
        {group.settings.map((s) => (
          <SettingInput key={s.key} setting={s} control={form.control} disabled={!canEdit || save.isPending} />
        ))}
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{isDirty ? "You have unsaved changes." : canEdit ? "Changes apply platform-wide and are audit-logged." : "Only Super Admins can change these settings."}</p>
          {canEdit ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={!isDirty || save.isPending} onClick={() => form.reset(values)}>
                <Undo2 data-icon="inline-start" /> Discard
              </Button>
              <Button type="submit" disabled={!isDirty || save.isPending}>
                {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
                Save
              </Button>
            </div>
          ) : null}
        </div>
      </form>
    </FormSection>
  )
}

function SettingInput({ setting: s, control, disabled }: { setting: SystemSetting; control: Control<Values>; disabled: boolean }) {
  const name = settingField(s.key)
  if (s.key === "app.maintenance_mode") return <MaintenanceSwitch control={control} name={name} setting={s} disabled={disabled} />
  if (s.type === "boolean") return <SwitchField control={control} name={name} label={s.label} description={s.description} disabled={disabled} className="sm:col-span-2" />
  if (s.type === "select") return <SelectField control={control} name={name} label={s.label} description={s.description} disabled={disabled} options={(s.options ?? []).map((o) => ({ value: o, label: o }))} />
  if (s.type === "number") {
    const lim = SETTING_LIMITS[s.key]
    return (
      <TextField
        control={control}
        name={name}
        type="number"
        label={s.label}
        disabled={disabled}
        suffix={lim?.unit}
        description={
          <>
            {s.description}
            {lim ? ` (${formatNumber(lim.min)}–${formatNumber(lim.max)})` : ""}
          </>
        }
      />
    )
  }
  return <TextField control={control} name={name} label={s.label} description={s.description} disabled={disabled} placeholder={s.key.startsWith("app.min_version") ? "e.g. 1.4.0" : undefined} />
}

/** Maintenance mode needs an explicit confirmation before it is switched on or off. */
function MaintenanceSwitch({ control, name, setting, disabled }: { control: Control<Values>; name: string; setting: SystemSetting; disabled: boolean }) {
  const { field } = useController({ control, name })
  const [pending, setPending] = useState<boolean | null>(null)
  const on = field.value === true
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border p-4 sm:col-span-2", on && "border-amber-500/40 bg-amber-500/8")}>
      <div className="space-y-0.5">
        <Label htmlFor="f-maintenance" className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {setting.label}
          {on ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
              <TriangleAlert /> On
            </Badge>
          ) : null}
        </Label>
        <p className="text-xs text-muted-foreground">{setting.description} Employees and company admins can&apos;t use HealthX while it&apos;s on.</p>
      </div>
      <Switch id="f-maintenance" checked={on} onCheckedChange={(v) => setPending(v)} disabled={disabled} />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        destructive={pending === true}
        title={pending ? "Turn on maintenance mode?" : "Turn off maintenance mode?"}
        description={
          pending
            ? "After you save, every app shows a maintenance message and employees can't log activity, join challenges or redeem rewards until you turn it off."
            : "After you save, all apps become available again for every company."
        }
        confirmLabel={pending ? "Turn on" : "Turn off"}
        onConfirm={() => {
          field.onChange(pending)
          setPending(null)
        }}
      />
    </div>
  )
}
