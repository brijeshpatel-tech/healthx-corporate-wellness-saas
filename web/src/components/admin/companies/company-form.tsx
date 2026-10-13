"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Building2, Check, Info, Mail, Save, Sparkles, UserPlus, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useController, useForm, useWatch, type Control } from "react-hook-form"
import { z } from "zod"
import { COVER_SWATCHES } from "@/components/admin/cover"
import { FormActions, FormSection } from "@/components/admin/form-layout"
import { ModulePickerField } from "@/components/admin/module-picker"
import { TagInputField } from "@/components/admin/tag-input"
import { ChoiceField, FieldShell, SelectField, SwitchField, TextField } from "@/components/common/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ApiError } from "@/lib/api/core"
import { companiesApi, type CompanyDetail, type CompanyInput, type CompanyLookups } from "@/lib/api/platform/companies"
import { useApiMutation } from "@/lib/api/hooks"
import { formatCurrency, formatNumber, titleCase } from "@/lib/format"
import { MODULE_LABEL, type ModuleCode } from "@/lib/types"
import { cn } from "@/lib/utils"
import { CompanyLogo } from "./company-actions"

const MODULES = Object.keys(MODULE_LABEL) as [ModuleCode, ...ModuleCode[]]
const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter the company name").max(80, "Keep it under 80 characters"),
    legalName: z.string().trim().min(2, "Enter the registered legal name").max(120, "Keep it under 120 characters"),
    companyCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{3,12}$/, "3–12 letters or numbers, no spaces"),
    industry: z.string().min(1, "Choose an industry"),
    segment: z.enum(["smb", "mid_market", "enterprise"]),
    country: z.string().min(1, "Choose a country"),
    city: z.string().trim().min(1, "Enter the city").max(60),
    timezone: z.string().min(1, "Choose a timezone"),
    emailDomains: z.array(z.string()).min(1, "Add at least one email domain, e.g. acme.com"),
    planId: z.string().min(1, "Choose a plan"),
    seats: z.number({ error: "Enter the number of seats" }).int("Use a whole number").min(1, "At least 1 seat").max(200000, "That's too many seats"),
    billingCycle: z.enum(["monthly", "annual"]),
    startDate: z.string().min(1, "Choose a start date"),
    status: z.enum(["onboarding", "trial", "active"]),
    modules: z.array(z.enum(MODULES)).min(1, "Enable at least one module"),
    ownerName: z.string().trim().min(2, "Enter the owner's full name").max(80),
    ownerEmail: z.string().trim().min(1, "Enter the owner's work email").email("Enter a valid email address"),
    primaryColor: z.string().min(1),
    sendInvite: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const bad = v.emailDomains.find((d) => !DOMAIN_RE.test(d))
    if (bad) ctx.addIssue({ code: "custom", path: ["emailDomains"], message: `“${bad}” isn't a valid domain` })
    const email = v.ownerEmail.trim().toLowerCase()
    if (/^\S+@\S+\.\S+$/.test(email) && v.emailDomains.length && !v.emailDomains.some((d) => email.endsWith(`@${d}`)))
      ctx.addIssue({ code: "custom", path: ["ownerEmail"], message: `Use one of the company's domains (${v.emailDomains.map((d) => `@${d}`).join(", ")})` })
  })

export type CompanyFormValues = z.infer<typeof schema>

const STATUS_OPTIONS = [
  { value: "onboarding", label: "Onboarding", description: "Owner sets up the workspace and invites people." },
  { value: "trial", label: "Free trial", description: "30 days free, then converts to the plan." },
  { value: "active", label: "Active", description: "Live and billed from the start date." },
]

const SEGMENTS = [
  { value: "smb", label: "SMB (under 100)" },
  { value: "mid_market", label: "Mid-market (100–999)" },
  { value: "enterprise", label: "Enterprise (1,000+)" },
]

const normalizeDomain = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^.*@/, "")
    .replace(/\/.*$/, "")

function defaultsFor(lookups: CompanyLookups, detail?: CompanyDetail): CompanyFormValues {
  if (detail) {
    const c = detail.company
    return {
      name: c.name,
      legalName: c.legalName,
      companyCode: c.companyCode,
      industry: c.industry,
      segment: c.segment,
      country: c.country,
      city: c.city,
      timezone: c.timezone,
      emailDomains: c.emailDomains,
      planId: c.planId,
      seats: detail.subscription?.seats ?? c.employeeCount,
      billingCycle: detail.subscription?.billingCycle ?? "annual",
      startDate: detail.subscription?.startDate ?? c.createdAt.slice(0, 10),
      status: c.status === "suspended" ? "active" : c.status,
      modules: c.modules,
      ownerName: c.ownerName,
      ownerEmail: c.ownerEmail,
      primaryColor: c.branding.primaryColor,
      sendInvite: false,
    }
  }
  const plan = lookups.plans.find((p) => p.code === "growth" && p.status === "active") ?? lookups.plans.find((p) => p.status === "active")
  return {
    name: "",
    legalName: "",
    companyCode: "",
    industry: "",
    segment: "mid_market",
    country: "India",
    city: "",
    timezone: "Asia/Kolkata",
    emailDomains: [],
    planId: plan?.id ?? "",
    seats: plan?.minEmployees ?? 100,
    billingCycle: plan?.billingCycle ?? "annual",
    startDate: new Date().toISOString().slice(0, 10),
    status: "onboarding",
    modules: plan?.modules ?? [],
    ownerName: "",
    ownerEmail: "",
    primaryColor: COVER_SWATCHES[3]!,
    sendInvite: true,
  }
}

/** SCR-P-005 Create / Edit Company — sectioned form used by /companies/new and /companies/[id]/edit. */
export function CompanyForm({ lookups, detail }: { lookups: CompanyLookups; detail?: CompanyDetail }) {
  const router = useRouter()
  const editing = !!detail
  const form = useForm<CompanyFormValues>({ resolver: zodResolver(schema), defaultValues: defaultsFor(lookups, detail), mode: "onTouched" })
  const [planId, seats, billingCycle, name, ownerEmail, sendInvite] = useWatch({ control: form.control, name: ["planId", "seats", "billingCycle", "name", "ownerEmail", "sendInvite"] })
  const plan = lookups.plans.find((p) => p.id === planId)

  // When the plan changes: new companies get all plan modules; edits keep what's still included.
  const prevPlan = useRef(planId)
  useEffect(() => {
    if (prevPlan.current === planId || !plan) return
    prevPlan.current = planId
    const current = form.getValues("modules")
    form.setValue("modules", editing ? current.filter((m) => plan.modules.includes(m)) : plan.modules, { shouldDirty: true })
    if (!editing) form.setValue("billingCycle", plan.billingCycle, { shouldDirty: true })
  }, [planId, plan, editing, form])

  const applyErrors = (err: ApiError) => {
    if (!err.fieldErrors) return
    Object.entries(err.fieldErrors).forEach(([k, message], i) => form.setError(k as keyof CompanyFormValues, { message }, { shouldFocus: i === 0 }))
  }

  const create = useApiMutation(companiesApi.create, {
    success: (c, input) => (input.sendInvite ? `Company created – invitation sent to ${c.ownerEmail}.` : `${c.name} created.`),
    errorTitle: "Couldn't create the company",
    onSuccess: (c) => router.push(`/admin-portal/companies/${c.id}`),
    onError: applyErrors,
  })
  const update = useApiMutation(companiesApi.update, {
    success: (c) => `${c.name} saved.`,
    errorTitle: "Couldn't save the company",
    onSuccess: (c) => router.push(`/admin-portal/companies/${c.id}`),
    onError: applyErrors,
  })
  const suggest = useApiMutation(companiesApi.suggestCode, {
    invalidate: false,
    onSuccess: (r) => form.setValue("companyCode", r.code, { shouldValidate: true, shouldDirty: true }),
  })

  const onSubmit = form.handleSubmit((v) => {
    const input: CompanyInput = { ...v, companyCode: v.companyCode.toUpperCase() }
    if (editing) {
      const { sendInvite: _s, startDate: _d, ...patch } = input
      void _s
      void _d
      update.mutate({ id: detail.company.id, ...patch })
    } else create.mutate(input)
  })

  const pending = create.isPending || update.isPending
  const monthly = plan ? (Number(seats) || 0) * plan.pricePerEmployee : 0
  const domains = useWatch({ control: form.control, name: "emailDomains" })
  const ownerDomainHint = domains.length ? `Must use @${domains.join(" or @")}` : "Add the company's email domains first"
  const availablePlans = lookups.plans.filter((p) => p.status === "active" || p.id === detail?.company.planId)

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {editing && detail.company.status === "suspended" ? (
        <Alert className="border-rose-500/30 bg-rose-500/6">
          <Info />
          <AlertDescription>This company is suspended. Saving won&apos;t change that — reactivate it from the company page.</AlertDescription>
        </Alert>
      ) : null}

      <FormSection title="Company details" description="How the company appears across HealthX. Employees type the company code in the app to find their workspace.">
        <TextField control={form.control} name="name" label="Company name" required placeholder="Acme Health Pvt Ltd" />
        <TextField control={form.control} name="legalName" label="Legal name" required placeholder="As on invoices" />
        <div className="space-y-1">
          <TextField control={form.control} name="companyCode" label="Company code" required placeholder="ACME" description="Unique, 3–12 letters or numbers." />
          <Button type="button" variant="link" size="xs" className="h-auto px-0" disabled={!name || suggest.isPending} onClick={() => suggest.mutate({ name })}>
            {suggest.isPending ? <Spinner className="size-3" /> : <Wand2 data-icon="inline-start" />} Suggest from name
          </Button>
        </div>
        <SelectField control={form.control} name="industry" label="Industry" required options={lookups.industries.map((i) => ({ value: i, label: i }))} />
        <SelectField control={form.control} name="segment" label="Size band" required options={SEGMENTS} />
        <SelectField control={form.control} name="country" label="Country" required options={lookups.countries.map((c) => ({ value: c, label: c }))} />
        <TextField control={form.control} name="city" label="City (HQ)" required placeholder="Bengaluru" />
        <SelectField control={form.control} name="timezone" label="Default timezone" required options={lookups.timezones.map((t) => ({ value: t, label: t.replace("_", " ") }))} description="Used for daily goals, reminders and leaderboards." />
      </FormSection>

      <FormSection title="Email domains" description="Only people with these work email domains can be invited or join with the company code.">
        <TagInputField control={form.control} name="emailDomains" label="Allowed domains" required placeholder="acme.com — press Enter to add" normalize={normalizeDomain} className="sm:col-span-2" description="Paste a website or email and we'll keep just the domain." />
      </FormSection>

      <FormSection
        title="Plan & seats"
        description="Prices are per active employee. One subscription per company."
        aside={
          plan ? (
            <div className="space-y-1 rounded-xl border bg-card p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Estimate at full adoption</p>
              <p className="font-heading text-xl font-bold tabular-nums">
                {formatCurrency(monthly, plan.currency)}
                <span className="text-sm font-normal text-muted-foreground"> / month</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(Number(seats) || 0)} seats × {formatCurrency(plan.pricePerEmployee, plan.currency)}
                {billingCycle === "annual" ? ` · billed yearly (${formatCurrency(monthly * 12, plan.currency, true)})` : " · billed monthly"}
              </p>
            </div>
          ) : null
        }
      >
        <ChoiceField
          control={form.control}
          name="planId"
          label="Plan"
          className="sm:col-span-2"
          columns={3}
          options={availablePlans.map((p) => ({
            value: p.id,
            label: (
              <span className="flex items-center gap-2">
                {p.name}
                {p.status !== "active" ? <span className="text-xs font-normal text-muted-foreground">({p.status})</span> : null}
              </span>
            ),
            description: `${formatCurrency(p.pricePerEmployee, p.currency)} / employee · ${p.billingCycle} · ${formatNumber(p.minEmployees)}${p.maxEmployees ? `–${formatNumber(p.maxEmployees)}` : "+"} employees · ${titleCase(p.supportLevel)} support`,
          }))}
        />
        <TextField
          control={form.control}
          name="seats"
          label="Seat limit"
          type="number"
          required
          description={plan ? `${plan.name} covers ${formatNumber(plan.minEmployees)}${plan.maxEmployees ? `–${formatNumber(plan.maxEmployees)}` : "+"} employees` : undefined}
        />
        <SelectField
          control={form.control}
          name="billingCycle"
          label="Billing cycle"
          required
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: "Annual" },
          ]}
        />
        {editing ? (
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            disabled={detail.company.status === "suspended"}
            options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            description="Suspend or reactivate from the company page."
          />
        ) : (
          <>
            <TextField control={form.control} name="startDate" label="Subscription start date" type="date" required />
            <ChoiceField control={form.control} name="status" label="Start as" className="sm:col-span-2" columns={3} options={STATUS_OPTIONS} />
          </>
        )}
      </FormSection>

      <FormSection title="Modules" description={plan ? `Choose what's switched on. Only modules included in ${plan.name} can be enabled.` : "Choose a plan first."}>
        <ModulePickerField control={form.control} name="modules" available={plan?.modules ?? []} className="sm:col-span-2" columns={2} />
      </FormSection>

      <FormSection title="Company Owner" description={editing ? "The main administrator of the workspace." : "We'll email the owner an invitation to set up the workspace (valid for 14 days)."}>
        <TextField control={form.control} name="ownerName" label="Owner's full name" required placeholder="Ananya Iyer" />
        <TextField control={form.control} name="ownerEmail" label="Owner's work email" type="email" required placeholder="owner@acme.com" description={ownerDomainHint} />
        {editing ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
            <Info className="mt-0.5 size-3.5 shrink-0" /> Changing the owner&apos;s email updates their sign-in address. Resend the invitation from the company page if they haven&apos;t joined yet.
          </p>
        ) : (
          <SwitchField control={form.control} name="sendInvite" label="Send the owner invitation now" description="Turn off to create the workspace first and invite later." className="sm:col-span-2" />
        )}
      </FormSection>

      <FormSection title="Branding" description="Company colour shown in the employee app and Business Portal. The owner can upload the logo later." aside={<BrandPreview control={form.control} />}>
        <ColorField control={form.control} />
      </FormSection>

      <FormActions
        hint={
          editing ? (
            "Changes are audit-logged."
          ) : sendInvite ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> Invitation goes to {ownerEmail || "the owner"} when you create the company.
            </span>
          ) : (
            "The workspace is created without sending an invitation."
          )
        }
      >
        <Button type="button" variant="outline" onClick={() => router.push(editing ? `/admin-portal/companies/${detail.company.id}` : "/admin-portal/companies")}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || (editing && !form.formState.isDirty)}>
          {pending ? <Spinner /> : editing ? <Save data-icon="inline-start" /> : sendInvite ? <UserPlus data-icon="inline-start" /> : <Building2 data-icon="inline-start" />}
          {editing ? "Save changes" : sendInvite ? "Create & invite owner" : "Create company"}
        </Button>
      </FormActions>
    </form>
  )
}

function ColorField({ control }: { control: Control<CompanyFormValues> }) {
  const { field } = useController({ control, name: "primaryColor" })
  return (
    <FieldShell label="Brand colour" description="Used for buttons and highlights in the app." className="sm:col-span-2">
      <div className="flex flex-wrap gap-2">
        {COVER_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => field.onChange(c)}
            className={cn("flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110", field.value === c && "ring-2 ring-foreground/60")}
            style={{ backgroundColor: c }}
            aria-label={`Colour ${c}`}
            aria-pressed={field.value === c}
          >
            {field.value === c ? <Check className="size-4 text-white" /> : null}
          </button>
        ))}
      </div>
    </FieldShell>
  )
}

function BrandPreview({ control }: { control: Control<CompanyFormValues> }) {
  const [name, color] = useWatch({ control, name: ["name", "primaryColor"] })
  const display = name || "Your company"
  return (
    <div className="overflow-hidden rounded-xl border bg-card text-sm shadow-xs" aria-label="App preview">
      <div className="flex items-center gap-2.5 px-3 py-2.5 text-white" style={{ backgroundColor: color }}>
        <CompanyLogo name={display} color="rgba(255,255,255,0.22)" className="size-7 rounded-md text-[10px] shadow-none" />
        <span className="truncate font-semibold">{display}</span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" style={{ color }} /> Today&apos;s goal
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
        </div>
        <div className="rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold text-white" style={{ backgroundColor: color }}>
          Join challenge
        </div>
      </div>
    </div>
  )
}
