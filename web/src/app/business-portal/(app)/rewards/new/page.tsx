"use client"

import { RewardForm } from "@/components/business/engagement/rewards/reward-form"
import { PageContainer, PageHeader } from "@/components/common/page-header"

export default function NewRewardPage() {
  return (
    <PageContainer>
      <PageHeader
        backHref="/business-portal/rewards"
        backLabel="Rewards"
        title="Add reward"
        description="Create a company reward employees can redeem with their points. Save it as a draft until you're ready."
      />
      <RewardForm />
    </PageContainer>
  )
}
