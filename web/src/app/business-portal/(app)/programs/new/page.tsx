"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { PrefillNotice } from "@/components/business/engagement/announcements/prefill-notice"
import { ProgramForm, blankProgramValues, valuesFromTemplate } from "@/components/business/engagement/programs/program-form"
import { TemplatePicker } from "@/components/business/engagement/programs/template-picker"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { programsApi } from "@/lib/api/business/programs"
import { useApiQuery } from "@/lib/api/hooks"

function NewProgram() {
  const params = useSearchParams()
  const template = params.get("template")
  const templates = useApiQuery(["business", "program-templates"], () => programsApi.templates())

  if (!template) {
    return (
      <PageContainer>
        <PageHeader
          title="Create a program"
          badge={<PhaseBadge phase={2} />}
          description="Start from a ready-made HealthX template and adjust it, or build your own week by week."
          backHref="/business-portal/programs"
          backLabel="Wellness programs"
        />
        {templates.error ? <ErrorState error={templates.error} onRetry={() => templates.refetch()} /> : <TemplatePicker templates={templates.data ?? []} loading={templates.isLoading} />}
      </PageContainer>
    )
  }

  const tpl = template !== "blank" ? templates.data?.find((t) => t.id === template) : undefined
  const waiting = template !== "blank" && templates.isLoading

  return (
    <PageContainer>
      <PageHeader
        title="New program"
        badge={<PhaseBadge phase={2} />}
        description="Set up the details, the weekly goals and who can take part. Save a draft at any time."
        backHref="/business-portal/programs/new"
        backLabel="Choose another template"
      />
      {waiting ? (
        <PageSkeleton kpis={0} />
      ) : (
        <ProgramForm
          key={tpl?.id ?? "blank"}
          initial={tpl ? valuesFromTemplate(tpl) : blankProgramValues()}
          templateId={tpl?.id}
          notice={
            tpl ? (
              <PrefillNotice>
                Using the <strong>{tpl.name}</strong> template. Change anything you like — the template itself stays the same.
              </PrefillNotice>
            ) : template !== "blank" ? (
              <PrefillNotice>That template isn&apos;t available any more, so you&apos;re starting from scratch.</PrefillNotice>
            ) : null
          }
        />
      )}
    </PageContainer>
  )
}

export default function Page() {
  return (
    <Suspense>
      <NewProgram />
    </Suspense>
  )
}
