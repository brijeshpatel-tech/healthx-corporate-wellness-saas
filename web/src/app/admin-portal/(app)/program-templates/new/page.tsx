"use client"

import { ProgramTemplateForm } from "@/components/admin/content/program-template-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"

/** SCR-P-032 Create program template. */
export default function NewProgramTemplatePage() {
  return (
    <PageContainer className="pb-0">
      <PageHeader
        title="Create program template"
        badge={<PhaseBadge phase={2} />}
        description="Build the weeks and goals once; companies copy the template and choose their own start date and participants."
        backHref="/admin-portal/program-templates"
        backLabel="Program templates"
      />
      <ProgramTemplateForm />
    </PageContainer>
  )
}
