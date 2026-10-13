"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Info, Save } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { FormActions, FormSection } from "@/components/admin/form-layout"
import { ModulePickerField } from "@/components/admin/module-picker"
import { ChoiceField, SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { useApiMutation } from "@/lib/api/hooks"
import { plansApi, SUPPORT_LEVEL_DESCRIPTION, SUPPORT_LEVEL_SHORT, type PlanInput, type PlanRow, type SupportLevel } from "@/lib/api/platform/plans"
import { formatCurrency, formatNumber } from "@/lib/format"
import type { ModuleCode } from "@/lib/types"

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter a plan name").max(40, "Keep the name under 40 characters"),
    code: z.string().trim().min(2, "Enter a plan code").max(30, "Keep the code under 30 characters").regex(SLUG, "Use lowercase letters, numbers and dashes (e.g. growth-plus)."),
    description: z.string().trim().min(10, "Describe who the plan is for (at least 10 characters).").max(240, "Keep the description under 240 characters"),
    pricePerEmployee: z.number({ error: "Enter a price" }).min(0, "Price can't be negative.").max(100_000, "That price looks too high"),
    currency: z.enum(["INR", "USD"]),
    billingCycle: z.enum(["monthly", "annual"]),
    minEmployees: z.number({ error: "Enter a number" }).int("Use a whole number").min(1, "Minimum must be at least 1."),
    maxEmployees: z.union([z.number().int().min(1), z.literal("")], { error: "Enter a whole number, or leave empty for unlimited" }),
    modules: z.array(z.custom<ModuleCode>((v) => typeof v === "string")).min(1, "Include at least one module."),
    supportLevel: z.enum(["standard", "priority", "dedicated"]),
    status: z.enum(["active", "draft", "archived"]),
  })
  .refine((v) => v.maxEmployees === "" || v.maxEmployees >= v.minEmployees, { path: ["maxEmployees"], message: "Maximum must be at least the minimum." })
type Values = z.infer<typeof schema>

const EMPTY: Values = {
  name: "",
  code: "",
  description: "",
  pricePerEmployee: 0,
  currency: "INR",
  billingCycle: "monthly",
  minEmployees: 10,
  maxEmployees: "",
  modules: ["activity", "water", "workouts", "habits", "challenges", "leaderboards", "rewards", "announcements", "analytics"],
  supportLevel: "standard",
  status: "draft",
}

const toValues = (p: PlanRow): Values => ({
  name: p.name,
  code: p.code,
  description: p.description,
  pricePerEmployee: p.pricePerEmployee,
  currency: p.currency,
  billingCycle: p.billingCycle,
  minEmployees: p.minEmployees,
  maxEmployees: p.maxEmployees ?? "",
  modules: p.modules,
  supportLevel: p.supportLevel,
  status: p.status,
})

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)

/** SCR-P-009 Create / Edit Plan — shared by /plans/new and /plans/[id]. */
export function PlanForm({ plan }: { plan?: PlanRow }) {
  const router = useRouter()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: plan ? toValues(plan) : EMPTY })
  const [name, price, currency, cycle, minEmployees] = useWatch({ control: form.control, name: ["name", "pricePerEmployee", "currency", "billingCycle", "minEmployees"] })

  // New plans: suggest a code from the name until the code is edited by hand.
  useEffect(() => {
    if (plan || form.getFieldState("code").isDirty) return
    form.setValue("code", slugify(name ?? ""), { shouldValidate: form.formState.isSubmitted })
  }, [name, plan, form])

  const onError = (err: ApiError) => {
    if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
  }
  const done = () => router.push("/admin-portal/plans")
  const create = useApiMutation(plansApi.create, { success: "Plan saved.", onSuccess: done, onError })
  const update = useApiMutation(plansApi.update, { success: "Plan saved.", onSuccess: done, onError })
  const pending = create.isPending || update.isPending

  const submit = form.handleSubmit((v) => {
    const input: PlanInput = { ...v, code: v.code.toLowerCase(), maxEmployees: v.maxEmployees === "" ? null : v.maxEmployees }
    if (plan) update.mutate({ id: plan.id, ...input })
    else create.mutate(input)
  })

  const exampleSeats = Math.max(typeof minEmployees === "number" ? minEmployees : 0, 250)
  const priceNumber = typeof price === "number" ? price : 0
  const priceChanged = !!plan && (priceNumber !== plan.pricePerEmployee || currency !== plan.currency)

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <FormSection title="Plan details" description="Name and describe the plan the way customers will see it on proposals and invoices.">
        <TextField control={form.control} name="name" label="Plan name" placeholder="e.g. Growth Plus" required />
        <TextField control={form.control} name="code" label="Plan code" placeholder="growth-plus" required description="Unique. Lowercase letters, numbers and dashes." />
        <TextareaField control={form.control} name="description" label="Description" rows={3} maxLength={240} required className="sm:col-span-2" placeholder="Who is this plan for and what does it unlock?" />
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={[
            { value: "active", label: "Active — can be assigned" },
            { value: "draft", label: "Draft — hidden from assignment" },
            { value: "archived", label: "Archived — retired" },
          ]}
          description={plan && plan.activeCompanies > 0 ? `${plan.activeCompanies} companies are on this plan, so it can't be archived.` : "Only active plans can be assigned to companies."}
        />
      </FormSection>

      <FormSection
        title="Pricing"
        description="Billing is based on active employees. Prices are stored on the plan — never hard-coded."
        aside={
          <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>New prices apply to new billing periods. Invoices already issued don&apos;t change.</span>
          </div>
        }
      >
        <TextField
          control={form.control}
          name="pricePerEmployee"
          label="Price per active employee / month"
          type="number"
          prefix={currency === "USD" ? "$" : "₹"}
          required
        />
        <SelectField
          control={form.control}
          name="currency"
          label="Currency"
          options={[
            { value: "INR", label: "INR — Indian rupee" },
            { value: "USD", label: "USD — US dollar" },
          ]}
        />
        <ChoiceField
          control={form.control}
          name="billingCycle"
          label="Billing cycle"
          className="sm:col-span-2"
          options={[
            { value: "monthly", label: "Monthly", description: "Invoiced every month for active employees." },
            { value: "annual", label: "Annual", description: "Annual commitment, invoiced monthly for active employees." },
          ]}
        />
        <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Example: </span>
          {formatNumber(exampleSeats)} active employees × {formatCurrency(priceNumber, currency)} ={" "}
          <span className="font-semibold">{formatCurrency(exampleSeats * priceNumber, currency)}</span>
          <span className="text-muted-foreground"> / month + GST · billed {cycle === "annual" ? "on an annual plan" : "monthly"}</span>
        </div>
        {priceChanged && plan.activeCompanies > 0 ? (
          <p className="text-xs font-medium text-amber-700 sm:col-span-2 dark:text-amber-400">
            {plan.activeCompanies} {plan.activeCompanies === 1 ? "company is" : "companies are"} on this plan. The new price applies from their next billing period.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Limits" description="Company size this plan is designed for. Leave the maximum empty for no upper limit.">
        <TextField control={form.control} name="minEmployees" label="Minimum employees" type="number" required />
        <TextField control={form.control} name="maxEmployees" label="Maximum employees" type="number" placeholder="Unlimited" description="Leave empty for unlimited." />
      </FormSection>

      <FormSection title="Included modules" description="Companies on this plan get these modules. Phase 2 modules are tagged.">
        <ModulePickerField control={form.control} name="modules" className="sm:col-span-2" columns={2} />
      </FormSection>

      <FormSection title="Support" description="Service level included with the plan.">
        <ChoiceField
          control={form.control}
          name="supportLevel"
          className="sm:col-span-2"
          columns={3}
          options={(Object.keys(SUPPORT_LEVEL_SHORT) as SupportLevel[]).map((l) => ({ value: l, label: SUPPORT_LEVEL_SHORT[l], description: SUPPORT_LEVEL_DESCRIPTION[l] }))}
        />
      </FormSection>

      <FormActions hint={plan ? "Changes are audit-logged." : "You can save as draft and activate later."}>
        <Button asChild variant="outline" type="button">
          <Link href="/admin-portal/plans">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : <Save data-icon="inline-start" />}
          {plan ? "Save plan" : "Create plan"}
        </Button>
      </FormActions>
    </form>
  )
}
