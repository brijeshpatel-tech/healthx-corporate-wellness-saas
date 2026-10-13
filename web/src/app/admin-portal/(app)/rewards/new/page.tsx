"use client"

import { ADMIN } from "@/components/admin/engagement/meta"
import { RewardForm } from "@/components/admin/engagement/reward-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"

export default function NewRewardPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Add global reward"
        description="Global rewards appear in the rewards store of every company on HealthX."
        backHref={`${ADMIN}/rewards`}
        backLabel="Rewards catalogue"
      />
      <RewardForm />
    </PageContainer>
  )
}
