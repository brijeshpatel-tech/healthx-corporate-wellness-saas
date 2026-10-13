"use client"

import { ADMIN } from "@/components/admin/engagement/meta"
import { TemplateForm } from "@/components/admin/engagement/template-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"

export default function NewChallengeTemplatePage() {
  return (
    <PageContainer>
      <PageHeader
        title="New challenge template"
        description="Create a ready-made challenge companies can launch. Save it as a draft or publish it straight away."
        backHref={`${ADMIN}/challenge-templates`}
        backLabel="Challenge templates"
      />
      <TemplateForm />
    </PageContainer>
  )
}
