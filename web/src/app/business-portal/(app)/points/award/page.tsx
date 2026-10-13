"use client"

import { AwardPointsForm } from "@/components/business/engagement/points/award-points-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"
import { PhaseBadge } from "@/components/common/status-badge"

export default function AwardPointsPage() {
  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/points"
        backLabel="Points"
        title="Award points"
        badge={<PhaseBadge phase={2} />}
        description="Give the same bonus to selected employees, whole teams or departments, or everyone — for example after a company event."
      />
      <AwardPointsForm />
    </PageContainer>
  )
}
