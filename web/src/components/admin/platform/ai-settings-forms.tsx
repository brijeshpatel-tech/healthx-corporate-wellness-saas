"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { RotateCcw, Save, Undo2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { SwitchField, TextareaField, TextField } from "@/components/common/form-fields"
import { ConfirmDialog } from "@/components/common/misc"
import { FormSection } from "@/components/admin/form-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { aiApi, type AiCompanyRow, type AiGlobalSettings } from "@/lib/api/platform/ai"
import { formatCurrency, formatNumber } from "@/lib/format"

const positive = (max: number) =>
  z.number({ error: "Enter a number" }).int("Use a whole number").positive("Limits must be positive numbers").max(max, `Must be ${formatNumber(max)} or less`)

const globalSchema = z.object({
  aiCoachEnabled: z.boolean(),
  weeklyInsightEnabled: z.boolean(),
  monthlyLimitPerEmployee: positive(1000),
  defaultCompanyBudget: positive(10_000_000),
  blockMedicalDiagnosis: z.boolean(),
  piiRedaction: z.boolean(),
  crisisEscalationMessage: z.string().trim().min(20, "Write a supportive message (at least 20 characters)").max(500, "Keep it under 500 characters"),
})
type GlobalValues = z.infer<typeof globalSchema>

/** Global AI defaults and safety settings (FRM-47). */
export function AiGlobalForm({ settings, canEdit }: { settings: AiGlobalSettings; canEdit: boolean }) {
  const form = useForm<GlobalValues>({ resolver: zodResolver(globalSchema), values: settings, resetOptions: { keepDirtyValues: true } })
  const [confirm, setConfirm] = useState<GlobalValues | null>(null)
  const save = useApiMutation(aiApi.updateGlobal, {
    success: "AI settings saved.",
    onSuccess: (v) => form.reset(v),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof GlobalValues, { message }))
    },
  })
  const disabled = !canEdit || save.isPending
  const { isDirty } = form.formState

  const submit = form.handleSubmit((v) => {
    const weakening = (settings.blockMedicalDiagnosis && !v.blockMedicalDiagnosis) || (settings.piiRedaction && !v.piiRedaction)
    if (weakening) setConfirm(v)
    else save.mutate(v)
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <FormSection title="AI features" description="Platform-wide switches. When a feature is off here, it's off for every company regardless of their setting.">
        <SwitchField control={form.control} name="aiCoachEnabled" label="AI Wellness Coach" description="Chat-based coach in the employee app (for plans that include it)." disabled={disabled} className="sm:col-span-2" />
        <SwitchField control={form.control} name="weeklyInsightEnabled" label="Weekly AI insight" description="A short personalised summary each Monday." disabled={disabled} className="sm:col-span-2" />
      </FormSection>
      <FormSection title="Default limits" description="Applied to companies that don't have their own limits.">
        <TextField control={form.control} name="monthlyLimitPerEmployee" type="number" label="Monthly limit per employee" suffix="requests" description="Coach messages per employee per month." disabled={disabled} />
        <TextField control={form.control} name="defaultCompanyBudget" type="number" label="Default company monthly budget" prefix="₹" description="AI spend cap per company per month." disabled={disabled} />
      </FormSection>
      <FormSection title="Safety" description="Guardrails for every AI response. Changes are recorded as critical audit events.">
        <SwitchField control={form.control} name="blockMedicalDiagnosis" label="Block medical diagnosis" description="The coach refuses to diagnose conditions or recommend medication and suggests seeing a doctor." disabled={disabled} className="sm:col-span-2" />
        <SwitchField control={form.control} name="piiRedaction" label="Redact personal information" description="Names, phone numbers, emails and IDs are removed before text is sent to the AI model." disabled={disabled} className="sm:col-span-2" />
        <TextareaField control={form.control} name="crisisEscalationMessage" label="Crisis escalation message" description="Shown instead of an AI reply when a message suggests self-harm or crisis." rows={4} maxLength={500} disabled={disabled} className="sm:col-span-2" />
      </FormSection>
      {canEdit ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <span className="text-xs text-muted-foreground sm:mr-auto">{isDirty ? "You have unsaved changes." : "No unsaved changes."}</span>
          <Button type="button" variant="outline" disabled={!isDirty || save.isPending} onClick={() => form.reset(settings)}>
            <Undo2 data-icon="inline-start" /> Discard
          </Button>
          <Button type="submit" disabled={!isDirty || save.isPending}>
            {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save AI settings
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        destructive
        title="Turn off an AI safety guardrail?"
        description="Employees could receive medical-sounding advice or have personal details sent to the AI provider. Only do this for testing, and turn it back on afterwards."
        confirmLabel="Save anyway"
        onConfirm={() => {
          if (confirm) save.mutate(confirm)
          setConfirm(null)
        }}
      />
    </form>
  )
}

const limitsSchema = z.object({
  monthlyLimitPerEmployee: positive(1000),
  monthlyBudget: positive(10_000_000),
})
type LimitValues = z.infer<typeof limitsSchema>

/** Per-company AI limits dialog. */
export function AiCompanyLimitsDialog({ company, onOpenChange }: { company: AiCompanyRow | null; onOpenChange: (open: boolean) => void }) {
  const form = useForm<LimitValues>({ resolver: zodResolver(limitsSchema), defaultValues: { monthlyLimitPerEmployee: 60, monthlyBudget: 25000 } })
  useEffect(() => {
    if (company) form.reset({ monthlyLimitPerEmployee: company.monthlyLimitPerEmployee, monthlyBudget: company.monthlyBudget })
  }, [company, form])
  const save = useApiMutation(aiApi.updateCompany, {
    success: "AI settings saved.",
    onSuccess: () => onOpenChange(false),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof LimitValues, { message }))
    },
  })

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI limits · {company?.name}</DialogTitle>
          <DialogDescription>
            {company?.usesDefaults ? "This company uses the platform defaults. Saving sets company-specific limits." : "This company has its own limits."} Spent this month: {company ? formatCurrency(company.costThisMonth) : "—"}.
          </DialogDescription>
        </DialogHeader>
        <form id="ai-limits-form" onSubmit={form.handleSubmit((v) => company && save.mutate({ companyId: company.companyId, ...v }))} noValidate className="grid gap-4">
          <TextField control={form.control} name="monthlyLimitPerEmployee" type="number" label="Monthly limit per employee" suffix="requests" required />
          <TextField control={form.control} name="monthlyBudget" type="number" label="Company monthly budget" prefix="₹" required description="AI features pause for this company when the budget is reached." />
        </form>
        <DialogFooter className="sm:justify-between">
          {company && !company.usesDefaults ? (
            <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ companyId: company.companyId, resetLimits: true })}>
              <RotateCcw data-icon="inline-start" /> Use defaults
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="ai-limits-form" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
              Save limits
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
