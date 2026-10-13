"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Building2, CheckCircle2, Circle, Copy, Save } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { ProgressRing } from "@/components/common/charts"
import { SelectField, TextareaField, TextField } from "@/components/common/form-fields"
import { KeyValueList, SectionCard } from "@/components/common/misc"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { TIMEZONES } from "@/lib/api/business/locations"
import { COMPANY_SIZES, INDUSTRIES, settingsApi, type OrganisationProfile } from "@/lib/api/business/settings"
import { ApiError } from "@/lib/api/core"
import { useApiMutation, useApiQuery } from "@/lib/api/hooks"
import { useAuthStore } from "@/lib/auth/session"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const schema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(80),
  legalName: z.string().trim().min(2, "Enter the registered company name").max(120),
  industry: z.string().min(1, "Choose an industry"),
  companySize: z.string().min(1, "Choose a size"),
  website: z
    .string()
    .trim()
    .refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), "Enter a full web address, e.g. https://example.com"),
  address: z.string().trim().max(200),
  city: z.string().trim().min(1, "Enter a city"),
  country: z.string().trim().min(1, "Enter a country"),
  timezone: z.string().min(1, "Choose a timezone"),
  primaryContactName: z.string().trim().min(2, "Enter a contact name"),
  primaryContactEmail: z.string().trim().email("Enter a valid email address"),
  primaryContactPhone: z
    .string()
    .trim()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Enter a valid phone number"),
})
type Values = z.infer<typeof schema>

const toValues = (p: OrganisationProfile): Values => ({
  name: p.name,
  legalName: p.legalName,
  industry: p.industry,
  companySize: p.companySize,
  website: p.website,
  address: p.address,
  city: p.city,
  country: p.country,
  timezone: p.timezone,
  primaryContactName: p.primaryContactName,
  primaryContactEmail: p.primaryContactEmail,
  primaryContactPhone: p.primaryContactPhone,
})

/** SCR-B-040 — Organisation profile (Company Owner). */
export default function OrganisationProfilePage() {
  const q = useApiQuery(["business", "organisation"], () => settingsApi.organisation())
  return (
    <PageContainer>
      <PageHeader title="Organisation profile" description="Your company's details. The company code helps employees find you in the HealthX app." />
      {q.isLoading ? <PageSkeleton kpis={0} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <ProfileForm profile={q.data!} />}
    </PageContainer>
  )
}

function ProfileForm({ profile }: { profile: OrganisationProfile }) {
  const updateSession = useAuthStore((s) => s.updateSession)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(profile) })
  useEffect(() => form.reset(toValues(profile)), [profile, form])
  const dirty = form.formState.isDirty

  const save = useApiMutation(settingsApi.updateOrganisation, {
    success: "Organisation details saved.",
    onSuccess: (p) => updateSession("business", { companyName: p.name }),
    onError: (err) => {
      if (err instanceof ApiError && err.fieldErrors) Object.entries(err.fieldErrors).forEach(([k, message]) => form.setError(k as keyof Values, { message }))
    },
  })

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.companyCode)
      toast.success("Company code copied")
    } catch {
      toast.message(`Company code: ${profile.companyCode}`)
    }
  }

  const done = profile.checklist.filter((s) => s.done).length
  const total = profile.checklist.length

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form id="org-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="flex flex-col gap-6 lg:col-span-2">
        <SectionCard title="Company details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Company name" required description="Shown to employees in the app" />
            <TextField control={form.control} name="legalName" label="Registered name" required description="Used on invoices" />
            <SelectField control={form.control} name="industry" label="Industry" required options={[...new Set([profile.industry, ...INDUSTRIES])].map((i) => ({ value: i, label: i }))} />
            <SelectField control={form.control} name="companySize" label="Company size" required options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} />
            <TextField control={form.control} name="website" label="Website" placeholder="https://" className="sm:col-span-2" />
          </div>
        </SectionCard>

        <SectionCard title="Address & timezone" description="The default timezone is used for daily goals, reminders and challenge start times.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextareaField control={form.control} name="address" label="Address" rows={2} className="sm:col-span-2" />
            <TextField control={form.control} name="city" label="City" required />
            <TextField control={form.control} name="country" label="Country" required />
            <SelectField control={form.control} name="timezone" label="Default timezone" required className="sm:col-span-2" options={TIMEZONES.map((t) => ({ value: t.value, label: t.label }))} />
          </div>
        </SectionCard>

        <SectionCard title="Primary contact" description="HealthX contacts this person about your account, billing and service updates.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="primaryContactName" label="Name" required />
            <TextField control={form.control} name="primaryContactEmail" label="Email" type="email" required />
            <TextField control={form.control} name="primaryContactPhone" label="Phone" placeholder="+91 98765 43210" />
          </div>
        </SectionCard>

        <div className={cn("sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur transition-all", !dirty && "pointer-events-none translate-y-2 opacity-0")}>
          <span className="mr-auto text-sm text-muted-foreground">You have unsaved changes</span>
          <Button type="button" variant="outline" onClick={() => form.reset(toValues(profile))}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Spinner /> : <Save data-icon="inline-start" />}
            Save
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-6">
        <SectionCard title="Set up your organisation" description={done === total ? "All done — nice work!" : `${done} of ${total} steps complete`}>
          <div className="mb-4 flex items-center gap-4">
            <ProgressRing value={done} max={total} size={64} stroke={7}>
              <span className="text-sm font-bold tabular-nums">{Math.round((done / total) * 100)}%</span>
            </ProgressRing>
            <p className="text-sm text-muted-foreground">Finish these steps so employees get the best first experience.</p>
          </div>
          <ul className="space-y-1">
            {profile.checklist.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60">
                  {s.done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <Circle className="size-5 shrink-0 text-muted-foreground/50" />}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-medium", s.done && "text-muted-foreground line-through decoration-1")}>{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.description}</span>
                  </span>
                  {!s.done ? <ArrowRight className="size-4 text-muted-foreground" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Company code">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <code className="flex-1 font-mono text-2xl font-bold tracking-widest">{profile.companyCode}</code>
            <Button size="icon-sm" variant="outline" aria-label="Copy company code" onClick={copyCode}>
              <Copy />
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Employees type this in the app to find your company. It can&apos;t be changed — contact HealthX if it needs to be.</p>
          <div className="mt-4">
            <KeyValueList
              columns={1}
              items={[
                { label: "Email domains", value: <span className="flex flex-wrap gap-1">{profile.emailDomains.map((d) => <Badge key={d} variant="secondary">@{d}</Badge>)}</span> },
                { label: "Plan", value: profile.planName },
                { label: "Customer since", value: formatDate(profile.createdAt) },
              ]}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
