"use client"

import { ContentForm } from "@/components/admin/content/content-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"

/** SCR-P-031 New global content. */
export default function NewContentPage() {
  return (
    <PageContainer className="pb-0">
      <PageHeader
        title="New content"
        badge={<PhaseBadge phase={2} />}
        description="Create a tip, article, video or link for every company's wellness feed."
        backHref="/admin-portal/content"
        backLabel="Content library"
      />
      <ContentForm />
    </PageContainer>
  )
}
