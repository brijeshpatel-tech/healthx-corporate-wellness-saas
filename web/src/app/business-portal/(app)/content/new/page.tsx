"use client"

import { ContentForm, blankContentValues } from "@/components/business/engagement/content/content-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"

export default function NewContentPage() {
  return (
    <PageContainer>
      <PageHeader
        title="New content"
        badge={<PhaseBadge phase={2} />}
        description="Write a tip or article, or share a video or link. The preview shows how it appears in the wellness feed."
        backHref="/business-portal/content"
        backLabel="Content library"
      />
      <ContentForm initial={blankContentValues()} />
    </PageContainer>
  )
}
